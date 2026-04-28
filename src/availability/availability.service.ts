import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Availability } from './availability.entity';
import { Appointment } from '../appointments/appointment.entity';
import { BlockedSlot } from '../blocked-slots/blocked-slot.entity';
import { CreateAvailabilityDto } from './dto/create-availability.dto';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(Availability)
    private repo: Repository<Availability>,
    @InjectRepository(Appointment)
    private appointmentsRepo: Repository<Appointment>,
    @InjectRepository(BlockedSlot)
    private blockedSlotsRepo: Repository<BlockedSlot>,
  ) {}

  async create(dto: CreateAvailabilityDto) {
    if (
      !dto.tenant_id ||
      !dto.resource_id ||
      dto.day_of_week === undefined ||
      !dto.start_time ||
      !dto.end_time ||
      !dto.slot_duration
    ) {
      throw new BadRequestException(
        'tenant_id, resource_id, day_of_week, start_time, end_time, and slot_duration are required',
      );
    }

    const availability = this.repo.create(dto);
    return this.repo.save(availability);
  }

  async getByResourceAndDay(resourceId: string, dayOfWeek: number) {
    return this.repo.find({
      where: { resource_id: resourceId, day_of_week: dayOfWeek },
    });
  }

  async findAll(tenantId: string) {
    return this.repo.find({
      where: { tenant_id: tenantId },
      relations: ['resource'],
    });
  }

  async findByResource(resourceId: string) {
    return this.repo.find({ where: { resource_id: resourceId } });
  }

  async delete(id: string) {
    return this.repo.delete(id);
  }

  /**
   * Convert "HH:MM" to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes since midnight to "HH:MM"
   */
  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  /**
   * Generate time slots for a given availability rule
   */
  private generateSlots(
    startTime: string,
    endTime: string,
    slotDuration: number,
  ): string[] {
    const slots: string[] = [];
    let current = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);

    while (current < end) {
      slots.push(this.minutesToTime(current));
      current += slotDuration;
    }

    return slots;
  }

  /**
   * Check if a time range [startMin, endMin) overlaps with an appointment
   */
  private overlaps(
    startMin: number,
    endMin: number,
    aptStartMin: number,
    aptEndMin: number,
  ): boolean {
    return startMin < aptEndMin && endMin > aptStartMin;
  }

  /**
   * Check if a resource is free for a given time range on a date.
   * Considers existing appointments and blocked slots.
   */
  private isResourceFreeForRange(
    resourceId: string,
    date: string,
    startMin: number,
    endMin: number,
    appointments: Appointment[],
    blockedSlots: BlockedSlot[],
  ): boolean {
    // Check against existing appointments for this resource
    const resourceAppointments = appointments.filter(
      (apt) =>
        apt.resource_id === resourceId &&
        apt.date === date &&
        apt.status !== 'cancelled',
    );

    for (const apt of resourceAppointments) {
      const aptStart = this.timeToMinutes(apt.time);
      const aptEnd = this.timeToMinutes(apt.end_time);
      if (this.overlaps(startMin, endMin, aptStart, aptEnd)) {
        return false;
      }
    }

    // Check against blocked slots (resource-specific or tenant-wide)
    for (const block of blockedSlots) {
      // Skip blocks for other resources (null resource_id = blocks all)
      if (block.resource_id && block.resource_id !== resourceId) {
        continue;
      }

      // Check if this date falls within the block's date range
      const blockStart = block.date;
      const blockEnd = block.end_date || block.date;
      if (date < blockStart || date > blockEnd) {
        continue;
      }

      // If no time range specified, entire day is blocked
      if (!block.start_time || !block.end_time) {
        return false;
      }

      // Check time overlap
      const blockStartMin = this.timeToMinutes(block.start_time);
      const blockEndMin = this.timeToMinutes(block.end_time);
      if (this.overlaps(startMin, endMin, blockStartMin, blockEndMin)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get available slots for a specific resource on a date, considering service duration.
   * Returns start times where the service fits entirely within availability
   * and doesn't overlap with existing appointments.
   */
  async getAvailableSlotsForResource(
    resourceId: string,
    date: string,
    serviceDurationMinutes: number,
    serviceBufferMinutes: number,
    appointments: Appointment[],
    blockedSlots: BlockedSlot[],
  ): Promise<string[]> {
    const dateObj = new Date(date + 'T00:00:00Z');
    const dayOfWeek = dateObj.getUTCDay();

    const availabilityRules = await this.getByResourceAndDay(
      resourceId,
      dayOfWeek,
    );
    if (!availabilityRules.length) {
      return [];
    }

    const totalDuration = serviceDurationMinutes + serviceBufferMinutes;
    const availableSlots: string[] = [];

    for (const rule of availabilityRules) {
      const possibleStarts = this.generateSlots(
        rule.start_time,
        rule.end_time,
        rule.slot_duration,
      );

      for (const startTime of possibleStarts) {
        const startMin = this.timeToMinutes(startTime);
        const endMin = startMin + totalDuration;
        const ruleEndMin = this.timeToMinutes(rule.end_time);

        // Service must fit within the availability window
        if (endMin > ruleEndMin) {
          continue;
        }

        // Check if resource is free for the entire duration
        if (
          this.isResourceFreeForRange(
            resourceId,
            date,
            startMin,
            endMin,
            appointments,
            blockedSlots,
          )
        ) {
          availableSlots.push(startTime);
        }
      }
    }

    return [...new Set(availableSlots)].sort();
  }

  /**
   * Get all available slots across ALL resources that can perform a service.
   * This is the CORE endpoint for WhatsApp: "¿Qué horarios hay para corte de pelo?"
   *
   * Returns: { slot: "10:00", resources: ["resource-id-1", "resource-id-2"] }[]
   * The consumer can then pick the first available resource or let the user choose.
   */
  async getAvailableSlotsForService(
    tenantId: string,
    date: string,
    serviceDurationMinutes: number,
    serviceBufferMinutes: number,
    resourceIds: string[],
  ): Promise<{ slot: string; resource_ids: string[] }[]> {
    // Load all appointments and blocked slots for this tenant on this date
    const appointments = await this.appointmentsRepo.find({
      where: { tenant_id: tenantId },
    });

    const blockedSlots = await this.blockedSlotsRepo.find({
      where: { tenant_id: tenantId },
    });

    // For each resource, get available slots
    const slotMap = new Map<string, string[]>();

    for (const resourceId of resourceIds) {
      const slots = await this.getAvailableSlotsForResource(
        resourceId,
        date,
        serviceDurationMinutes,
        serviceBufferMinutes,
        appointments,
        blockedSlots,
      );

      for (const slot of slots) {
        if (!slotMap.has(slot)) {
          slotMap.set(slot, []);
        }
        slotMap.get(slot)!.push(resourceId);
      }
    }

    // Convert map to sorted array
    return Array.from(slotMap.entries())
      .map(([slot, resource_ids]) => ({ slot, resource_ids }))
      .sort((a, b) => a.slot.localeCompare(b.slot));
  }

  /**
   * LEGACY: Get available slots for a tenant (backward compatible).
   * Uses old logic — no service/resource awareness.
   */
  async getAvailableSlots(
    tenantId: string,
    date: string,
    appointments: any[],
    blockedSlots: any[],
  ) {
    const dateObj = new Date(date + 'T00:00:00Z');
    const dayOfWeek = dateObj.getUTCDay();

    // Get all availability rules for this tenant on this day
    const availabilityRules = await this.repo.find({
      where: { tenant_id: tenantId, day_of_week: dayOfWeek },
    });

    if (!availabilityRules.length) {
      return [];
    }

    let allSlots: string[] = [];
    for (const rule of availabilityRules) {
      const ruleSlots = this.generateSlots(
        rule.start_time,
        rule.end_time,
        rule.slot_duration,
      );
      allSlots = [...allSlots, ...ruleSlots];
    }

    allSlots = [...new Set(allSlots)];

    const bookedTimes = appointments
      .filter((apt) => apt.date === date && apt.status !== 'cancelled')
      .map((apt) => apt.time);

    const blockedTimes = blockedSlots
      .filter((block) => block.date === date)
      .map((block) => block.time);

    return allSlots
      .filter(
        (slot) => !bookedTimes.includes(slot) && !blockedTimes.includes(slot),
      )
      .sort();
  }
}
