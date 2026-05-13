import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Appointment } from './appointment.entity';
import { AvailabilityService } from '../availability/availability.service';
import { ClientsService } from '../clients/clients.service';
import { ResourcesService } from '../resources/resources.service';
import { ServicesService } from '../services/services.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentsRepo: Repository<Appointment>,
    private availabilityService: AvailabilityService,
    private clientsService: ClientsService,
    private resourcesService: ResourcesService,
    private servicesService: ServicesService,
    private tenantsService: TenantsService,
    private configService: ConfigService,
    private jwtService: JwtService,
    private eventEmitter: EventEmitter2,
  ) {}

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
   * Create appointment with full validation:
   * 1. Validate service exists and get duration
   * 2. Find resources that can perform the service
   * 3. Check available slots considering duration + buffer
   * 4. Auto-assign first available resource (or use preferred)
   * 5. Find or create client
   * 6. Create appointment
   */
  async create(dto: CreateAppointmentDto) {
    if (
      !dto.tenant_id ||
      !dto.service_id ||
      !dto.date ||
      !dto.time ||
      !dto.client_phone
    ) {
      throw new BadRequestException(
        'tenant_id, service_id, date, time, and client_phone are required',
      );
    }

    // 1. Get service details (duration, buffer)
    const service = await this.servicesService.findById(dto.service_id);
    if (!service || !service.is_active) {
      throw new BadRequestException('Service not found or inactive');
    }

    const totalDuration = service.duration_minutes + service.buffer_minutes;

    // 2. Find resources that can do this service
    let candidateResourceIds: string[];

    if (dto.resource_id) {
      // User chose a specific resource — validate it can do this service
      const resource = await this.resourcesService.findById(dto.resource_id);
      if (!resource || !resource.is_active) {
        throw new BadRequestException('Resource not found or inactive');
      }
      const canDoService = resource.services?.some(
        (s) => s.id === dto.service_id,
      );
      if (!canDoService) {
        throw new BadRequestException(
          'This resource does not offer the requested service',
        );
      }
      candidateResourceIds = [dto.resource_id];
    } else {
      // Auto-assign: find all resources that can do this service
      const resources = await this.resourcesService.findByService(
        dto.tenant_id,
        dto.service_id,
      );
      if (!resources.length) {
        throw new BadRequestException(
          'No resources available for this service',
        );
      }
      candidateResourceIds = resources.map((r) => r.id);
    }

    // 3. Get available slots for the service across candidate resources
    const availableSlots =
      await this.availabilityService.getAvailableSlotsForService(
        dto.tenant_id,
        dto.date,
        service.duration_minutes,
        service.buffer_minutes,
        candidateResourceIds,
      );

    // 4. Check if the requested time is available
    const matchingSlot = availableSlots.find((s) => s.slot === dto.time);
    if (!matchingSlot) {
      throw new BadRequestException(
        `Slot ${dto.time} not available. Available slots: ${availableSlots.map((s) => s.slot).join(', ') || 'none'}`,
      );
    }

    // Pick the resource: preferred if specified and available, otherwise first available
    let assignedResourceId: string;
    if (
      dto.resource_id &&
      matchingSlot.resource_ids.includes(dto.resource_id)
    ) {
      assignedResourceId = dto.resource_id;
    } else {
      assignedResourceId = matchingSlot.resource_ids[0];
    }

    // 5. Find or create client (con email opcional)
    const client = await this.clientsService.findOrCreate(
      dto.tenant_id,
      dto.client_phone,
      dto.client_name || 'Unknown',
      dto.client_email?.trim().toLowerCase(),
    );

    // 6. Calculate end_time and create appointment
    const startMin = this.timeToMinutes(dto.time);
    const endTime = this.minutesToTime(startMin + totalDuration);

    let saved: Appointment;
    try {
      const appointment = this.appointmentsRepo.create({
        tenant_id: dto.tenant_id,
        service_id: dto.service_id,
        resource_id: assignedResourceId,
        client_id: client.id,
        date: dto.date,
        time: dto.time,
        end_time: endTime,
        notes: dto.notes ?? undefined,
        source: dto.source ?? 'web',
        status: 'pending',
      });

      saved = await this.appointmentsRepo.save(appointment);

      // Generate verification token (7 days expiry)
      const token = this.generateVerificationToken(saved.id);
      saved.verification_token = token;
      saved.token_expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      saved = await this.appointmentsRepo.save(saved);
    } catch {
      throw new ConflictException(
        'Could not create appointment — the slot may have been taken',
      );
    }

    // 7. Emitir evento - los listeners se encargan del resto
    // DESACOPLADO: AppointmentsService no conoce de notificaciones.
    // NOTA: NO se envía email al cliente acá. El email de confirmación se
    // dispara solo cuando el admin confirma el turno (appointment.confirmed).
    void (async () => {
      try {
        // Load full appointment with relations for listeners
        const appointmentWithRelations = await this.findById(saved.id);
        const tenant = await this.tenantsService.findById(dto.tenant_id);
        if (tenant && appointmentWithRelations) {
          this.eventEmitter.emit('appointment.created', {
            appointment: appointmentWithRelations,
            tenant,
          });
        }
      } catch (error) {
        console.error('Error emitting appointment.created event:', error);
      }
    })();

    return saved;
  }

  async findAll(
    tenantId: string,
    filters?: {
      clientPhone?: string;
      clientEmail?: string;
      date?: string;
      startDate?: string;
      endDate?: string;
      resourceId?: string;
      status?: string;
    },
  ) {
    const qb = this.appointmentsRepo
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.client', 'client')
      .leftJoinAndSelect('appointment.service', 'service')
      .leftJoinAndSelect('appointment.resource', 'resource')
      .where('appointment.tenant_id = :tenantId', { tenantId });

    if (filters?.clientPhone) {
      qb.andWhere('client.phone = :clientPhone', {
        clientPhone: filters.clientPhone,
      });
    }

    if (filters?.clientEmail) {
      qb.andWhere('LOWER(client.email) = :clientEmail', {
        clientEmail: filters.clientEmail.trim().toLowerCase(),
      });
    }

    if (filters?.date) {
      qb.andWhere('appointment.date = :date', { date: filters.date });
    } else if (filters?.startDate && filters?.endDate) {
      qb.andWhere('appointment.date BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    } else if (filters?.startDate) {
      qb.andWhere('appointment.date >= :startDate', {
        startDate: filters.startDate,
      });
    } else if (filters?.endDate) {
      qb.andWhere('appointment.date <= :endDate', {
        endDate: filters.endDate,
      });
    }

    if (filters?.resourceId) {
      qb.andWhere('appointment.resource_id = :resourceId', {
        resourceId: filters.resourceId,
      });
    }

    if (filters?.status) {
      qb.andWhere('appointment.status = :status', { status: filters.status });
    }

    return qb
      .orderBy('appointment.date', 'ASC')
      .addOrderBy('appointment.time', 'ASC')
      .getMany();
  }

  async update(id: string, data: { notes?: string }) {
    const appointment = await this.findById(id);
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (data.notes !== undefined) {
      appointment.notes = data.notes;
    }

    return this.appointmentsRepo.save(appointment);
  }

  async findById(id: string) {
    return this.appointmentsRepo.findOne({
      where: { id },
      relations: ['client', 'tenant', 'service', 'resource'],
    });
  }

  async confirm(id: string) {
    const appointment = await this.findById(id);
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    appointment.status = 'confirmed';
    const saved = await this.appointmentsRepo.save(appointment);

    // Emitir evento
    void (async () => {
      try {
        const appointmentWithRelations = await this.findById(saved.id);
        const tenant = await this.tenantsService.findById(appointment.tenant_id);
        if (tenant && appointmentWithRelations) {
          this.eventEmitter.emit('appointment.confirmed', {
            appointment: appointmentWithRelations,
            tenant,
          });
        }
      } catch (error) {
        console.error('Error emitting appointment.confirmed event:', error);
      }
    })();

    return saved;
  }

  async cancel(id: string) {
    const appointment = await this.findById(id);
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    appointment.status = 'cancelled';
    const saved = await this.appointmentsRepo.save(appointment);

    // Emitir evento
    void (async () => {
      try {
        const appointmentWithRelations = await this.findById(saved.id);
        const tenant = await this.tenantsService.findById(appointment.tenant_id);
        if (tenant && appointmentWithRelations) {
          this.eventEmitter.emit('appointment.cancelled', {
            appointment: appointmentWithRelations,
            tenant,
          });
        }
      } catch (error) {
        console.error('Error emitting appointment.cancelled event:', error);
      }
    })();

    return saved;
  }

  /**
   * Verify and confirm appointment using verification token from email
   */
  async verifyByToken(id: string, token: string) {
    const appointment = await this.findById(id);
    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Check if token exists
    if (!appointment.verification_token) {
      throw new BadRequestException('No verification token for this appointment');
    }

    // Check if token has expired
    if (appointment.token_expires_at && new Date() > appointment.token_expires_at) {
      throw new BadRequestException('Verification token has expired');
    }

    // Verify token
    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
      });

      // Validate token matches the appointment
      if (decoded.appointmentId !== id) {
        throw new BadRequestException('Invalid verification token');
      }
    } catch {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Token is valid, confirm the appointment
    appointment.status = 'confirmed';
    return this.appointmentsRepo.save(appointment);
  }

  /**
   * Generate verification token for appointment (used in emails)
   */
  generateVerificationToken(appointmentId: string): string {
    return this.jwtService.sign(
      { appointmentId },
      {
        secret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
        expiresIn: '7d',
      },
    );
  }
}
