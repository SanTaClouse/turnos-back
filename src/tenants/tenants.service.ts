import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';

// Postgres unique_violation
const PG_UNIQUE_VIOLATION = '23505';

interface PgError {
  code?: string;
  constraint?: string;
  detail?: string;
}

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

    // Pre-flight: chequeamos antes de insertar para devolver mensajes
    // específicos por campo (mejor UX que un 409 genérico). El try/catch
    // más abajo es el safety net para race conditions.
    const normalizedEmail = dto.email?.trim().toLowerCase();
    const [emailTaken, slugTaken] = await Promise.all([
      normalizedEmail
        ? this.repo.findOne({
            where: { email: normalizedEmail },
            select: ['id'],
          })
        : Promise.resolve(null),
      this.repo.findOne({ where: { slug: dto.slug }, select: ['id'] }),
    ]);

    if (emailTaken) {
      throw new ConflictException(
        'Ya existe un negocio registrado con ese email. Probá iniciando sesión.',
      );
    }
    if (slugTaken) {
      throw new ConflictException(
        'Esa URL ya está en uso. Probá con otra (ej: agregar tu zona o número).',
      );
    }

    try {
      const tenant = this.repo.create({ ...dto, email: normalizedEmail });
      return await this.repo.save(tenant);
    } catch (err) {
      // Safety net: si dos requests llegan al mismo tiempo, una pasa el
      // pre-flight y la otra revienta acá. Lo convertimos en 409 amigable.
      const pgErr = err as PgError;
      if (pgErr?.code === PG_UNIQUE_VIOLATION) {
        const detail = pgErr.detail ?? '';
        if (detail.includes('(email)')) {
          throw new ConflictException(
            'Ya existe un negocio registrado con ese email.',
          );
        }
        if (detail.includes('(slug)')) {
          throw new ConflictException(
            'Esa URL ya está en uso. Probá con otra.',
          );
        }
        throw new ConflictException(
          'Ya existe un negocio con esos datos.',
        );
      }
      throw err;
    }
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
