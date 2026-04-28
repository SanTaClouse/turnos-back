import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from './client.entity';
import { Tenant } from '../tenants/tenant.entity';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client)
    private repo: Repository<Client>,
    @InjectRepository(Tenant)
    private tenantsRepo: Repository<Tenant>,
  ) {}

  /**
   * Find client by phone (platform-level) or create a new one.
   * Always ensures the client is linked to the given tenant.
   * If `email` is provided and the client doesn't have one yet, it's saved.
   */
  async findOrCreate(
    tenantId: string,
    phone: string,
    name: string,
    email?: string,
  ) {
    let client = await this.repo.findOne({
      where: { phone },
      relations: ['tenants'],
    });

    if (!client) {
      client = this.repo.create({ phone, name, email: email ?? undefined });
      client.tenants = [];
      client = await this.repo.save(client);
    } else if (email && !client.email) {
      // Backfill email si no lo tenía
      client.email = email;
      await this.repo.save(client);
    }

    // Ensure client is linked to this tenant
    const isLinked = client.tenants?.some((t) => t.id === tenantId);
    if (!isLinked) {
      const tenant = await this.tenantsRepo.findOne({
        where: { id: tenantId },
      });
      if (tenant) {
        client.tenants = [...(client.tenants || []), tenant];
        await this.repo.save(client);
      }
    }

    return client;
  }

  async findByEmail(email: string) {
    return this.repo.findOne({
      where: { email: email.trim().toLowerCase() },
      relations: ['tenants'],
    });
  }

  async findById(id: string) {
    return this.repo.findOne({
      where: { id },
      relations: ['tenants'],
    });
  }

  async findByPhone(phone: string) {
    return this.repo.findOne({
      where: { phone },
      relations: ['tenants'],
    });
  }

  async findByTenant(tenantId: string) {
    return this.repo
      .createQueryBuilder('client')
      .innerJoin('client.tenants', 'tenant', 'tenant.id = :tenantId', {
        tenantId,
      })
      .getMany();
  }

  async update(id: string, data: Partial<Client>) {
    await this.repo.update(id, data);
    return this.findById(id);
  }
}
