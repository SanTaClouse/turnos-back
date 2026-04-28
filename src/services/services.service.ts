import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './service.entity';
import { CreateServiceDto } from './dto/create-service.dto';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private repo: Repository<Service>,
  ) {}

  async create(dto: CreateServiceDto) {
    if (!dto.tenant_id || !dto.name || !dto.duration_minutes) {
      throw new BadRequestException(
        'tenant_id, name, and duration_minutes are required',
      );
    }

    if (dto.duration_minutes <= 0) {
      throw new BadRequestException('duration_minutes must be greater than 0');
    }

    const service = this.repo.create(dto);
    return this.repo.save(service);
  }

  async findAll(tenantId: string) {
    return this.repo.find({
      where: { tenant_id: tenantId, is_active: true },
      relations: ['resources'],
    });
  }

  async findById(id: string) {
    return this.repo.findOne({
      where: { id },
      relations: ['resources'],
    });
  }

  async update(id: string, data: Partial<CreateServiceDto>) {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async deactivate(id: string) {
    await this.repo.update(id, { is_active: false });
    return this.findById(id);
  }
}
