import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private repo: Repository<Tenant>,
  ) {}

  async create(dto: CreateTenantDto) {
    if (!dto.name || !dto.slug || !dto.whatsapp_number) {
      throw new BadRequestException(
        'name, slug, and whatsapp_number are required',
      );
    }

    const tenant = this.repo.create(dto);
    return this.repo.save(tenant);
  }

  async findBySlug(slug: string) {
    return this.repo.findOne({ where: { slug } });
  }

  async findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async findAll() {
    return this.repo.find();
  }

  async update(id: string, dto: Partial<CreateTenantDto>) {
    await this.repo.update(id, dto);
    return this.findById(id);
  }

  async delete(id: string) {
    return this.repo.delete(id);
  }
}
