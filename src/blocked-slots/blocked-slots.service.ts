import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockedSlot } from './blocked-slot.entity';
import { Appointment } from '../appointments/appointment.entity';
import { CreateBlockedSlotDto } from './dto/create-blocked-slot.dto';

@Injectable()
export class BlockedSlotsService {
  constructor(
    @InjectRepository(BlockedSlot)
    private repo: Repository<BlockedSlot>,
    @InjectRepository(Appointment)
    private appointmentsRepo: Repository<Appointment>,
  ) {}

  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  /**
   * Devuelve los turnos activos que chocarían con este bloqueo.
   * - Si dto.resource_id está, filtra por ese recurso; si no, considera todos.
   * - Si dto tiene start_time/end_time, sólo cuenta turnos que se solapan
   *   con ese rango horario. Sin horario = día completo, cualquier turno cuenta.
   * - Sólo considera turnos no cancelados.
   */
  private async findConflictingAppointments(
    dto: CreateBlockedSlotDto,
  ): Promise<Appointment[]> {
    const endDate = dto.end_date ?? dto.date;

    const qb = this.appointmentsRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.client', 'client')
      .leftJoinAndSelect('a.service', 'service')
      .leftJoinAndSelect('a.resource', 'resource')
      .where('a.tenant_id = :tenantId', { tenantId: dto.tenant_id })
      .andWhere('a.date BETWEEN :from AND :to', {
        from: dto.date,
        to: endDate,
      })
      .andWhere(`a.status <> 'cancelled'`);

    if (dto.resource_id) {
      qb.andWhere('a.resource_id = :resourceId', {
        resourceId: dto.resource_id,
      });
    }

    const candidates = await qb.getMany();

    // Si es día completo, todos los candidatos chocan.
    if (!dto.start_time || !dto.end_time) return candidates;

    // Rango horario: filtramos por overlap [start, end) vs [a.time, a.end_time).
    const blockStart = this.timeToMinutes(dto.start_time);
    const blockEnd = this.timeToMinutes(dto.end_time);
    return candidates.filter((a) => {
      const aStart = this.timeToMinutes(a.time);
      const aEnd = this.timeToMinutes(a.end_time);
      return blockStart < aEnd && blockEnd > aStart;
    });
  }

  async create(dto: CreateBlockedSlotDto) {
    if (!dto.tenant_id || !dto.date) {
      throw new BadRequestException('tenant_id and date are required');
    }

    // start_time and end_time must be provided together (or both omitted = full day)
    const hasStart = !!dto.start_time;
    const hasEnd = !!dto.end_time;
    if (hasStart !== hasEnd) {
      throw new BadRequestException(
        'start_time and end_time must be provided together (omit both to block the entire day)',
      );
    }

    if (hasStart && hasEnd && dto.start_time! >= dto.end_time!) {
      throw new BadRequestException('start_time must be earlier than end_time');
    }

    if (dto.end_date && dto.end_date < dto.date) {
      throw new BadRequestException(
        'end_date must be the same or after the start date',
      );
    }

    const conflicts = await this.findConflictingAppointments(dto);
    if (conflicts.length > 0) {
      const sample = conflicts
        .slice(0, 5)
        .map(
          (a) =>
            `${a.date} ${a.time}` +
            (a.client?.name ? ` · ${a.client.name}` : ''),
        )
        .join(', ');
      const more =
        conflicts.length > 5 ? ` y ${conflicts.length - 5} más` : '';
      throw new ConflictException({
        message: `Hay ${conflicts.length} turno${conflicts.length === 1 ? '' : 's'} en ese período: ${sample}${more}. Cancelalos o reagendalos antes de bloquear.`,
        conflicts: conflicts.map((a) => ({
          id: a.id,
          date: a.date,
          time: a.time,
          end_time: a.end_time,
          client_name: a.client?.name ?? null,
          service_name: a.service?.name ?? null,
          resource_id: a.resource_id,
          resource_name: a.resource?.name ?? null,
        })),
      });
    }

    const blockedSlot = this.repo.create(dto);
    return this.repo.save(blockedSlot);
  }

  async findByTenant(tenantId: string) {
    return this.repo.find({ where: { tenant_id: tenantId } });
  }

  async delete(id: string) {
    return this.repo.delete(id);
  }
}
