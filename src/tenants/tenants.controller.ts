import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant } from './tenant.entity';
import { AdminAuthService } from '../auth/admin-auth.service';

function getClientIp(req: Request): string | null {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0];
  return req.ip ?? null;
}

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(
    private readonly service: TenantsService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Crear una nueva empresa',
    description:
      'Crea el tenant. Si se envía un email, también crea una session ' +
      'inicial para el dispositivo que hace la request (el dueño está ' +
      'completando el onboarding) y devuelve un session_token para guardar ' +
      'en cookie httpOnly. En devices distintos, el dueño debe usar ' +
      'POST /auth/admin/request-code + /auth/admin/verify.',
  })
  @ApiCreatedResponse({
    description: 'Empresa creada (con session_token si se proveyó email)',
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  async create(
    @Body() dto: CreateTenantDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Req() req: Request,
  ) {
    const tenant = await this.service.create(dto);

    if (dto.email && tenant.email) {
      const session = await this.adminAuth.createSession(
        tenant,
        userAgent ?? null,
        getClientIp(req),
      );
      return { ...tenant, session_token: session.session_token };
    }

    return tenant;
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las empresas' })
  @ApiOkResponse({ description: 'Lista de empresas', type: [Tenant] })
  findAll() {
    return this.service.findAll();
  }

  @Get('slug/:slug')
  @ApiOperation({
    summary: 'Obtener empresa por slug (landing pública)',
    description:
      'Endpoint público usado por la landing del cliente (tuapp.com/:slug)',
  })
  @ApiOkResponse({ description: 'Empresa encontrada', type: Tenant })
  @ApiNotFoundResponse({ description: 'Empresa no encontrada' })
  async findBySlug(@Param('slug') slug: string) {
    const tenant = await this.service.findBySlug(slug);
    if (!tenant) {
      throw new NotFoundException(`Tenant with slug "${slug}" not found`);
    }
    return tenant;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una empresa por ID' })
  @ApiOkResponse({ description: 'Empresa encontrada', type: Tenant })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una empresa' })
  @ApiOkResponse({ description: 'Empresa actualizada', type: Tenant })
  update(@Param('id') id: string, @Body() dto: Partial<CreateTenantDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una empresa' })
  @ApiOkResponse({ description: 'Empresa eliminada' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
