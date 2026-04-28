import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Resource } from './resource.entity';
import { Service } from '../services/service.entity';
import { CreateResourceDto } from './dto/create-resource.dto';

@Injectable()
export class ResourcesService {
  constructor(
    @InjectRepository(Resource)
    private repo: Repository<Resource>,
    @InjectRepository(Service)
    private servicesRepo: Repository<Service>,
  ) {}

  async create(dto: CreateResourceDto) {
    if (!dto.tenant_id || !dto.name) {
      throw new BadRequestException('tenant_id and name are required');
    }

    const resource = this.repo.create({
      tenant_id: dto.tenant_id,
      name: dto.name,
      role: dto.role,
      hue: dto.hue ?? 24,
    });

    if (dto.service_ids?.length) {
      const services = await this.servicesRepo.find({
        where: { id: In(dto.service_ids), tenant_id: dto.tenant_id },
      });
      resource.services = services;
    }

    return this.repo.save(resource);
  }

  async update(
    id: string,
    data: { name?: string; role?: string; hue?: number },
  ) {
    const resource = await this.repo.findOne({ where: { id } });
    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    if (data.name !== undefined) resource.name = data.name;
    if (data.role !== undefined) resource.role = data.role;
    if (data.hue !== undefined) {
      if (data.hue < 0 || data.hue > 360) {
        throw new BadRequestException('hue must be between 0 and 360');
      }
      resource.hue = data.hue;
    }

    await this.repo.save(resource);
    return this.findById(id);
  }

  async findAll(tenantId: string) {
    return this.repo.find({
      where: { tenant_id: tenantId, is_active: true },
      relations: ['services'],
    });
  }

  async findById(id: string) {
    return this.repo.findOne({
      where: { id },
      relations: ['services'],
    });
  }

  async findByService(tenantId: string, serviceId: string) {
    return this.repo
      .createQueryBuilder('resource')
      .innerJoin('resource.services', 'service', 'service.id = :serviceId', {
        serviceId,
      })
      .where('resource.tenant_id = :tenantId', { tenantId })
      .andWhere('resource.is_active = true')
      .getMany();
  }

  async assignServices(resourceId: string, serviceIds: string[]) {
    const resource = await this.repo.findOne({
      where: { id: resourceId },
      relations: ['services'],
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    const services = await this.servicesRepo.find({
      where: { id: In(serviceIds), tenant_id: resource.tenant_id },
    });

    resource.services = services;
    return this.repo.save(resource);
  }

  async deactivate(id: string) {
    await this.repo.update(id, { is_active: false });
    return this.findById(id);
  }
}
