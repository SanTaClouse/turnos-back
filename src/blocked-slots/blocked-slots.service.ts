import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BlockedSlot } from './blocked-slot.entity';
import { CreateBlockedSlotDto } from './dto/create-blocked-slot.dto';

@Injectable()
export class BlockedSlotsService {
  constructor(
    @InjectRepository(BlockedSlot)
    private repo: Repository<BlockedSlot>,
  ) {}

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
