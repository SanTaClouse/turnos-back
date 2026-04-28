import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
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
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant } from './tenant.entity';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva empresa' })
  @ApiCreatedResponse({
    description: 'Empresa creada exitosamente',
    type: Tenant,
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  create(@Body() dto: CreateTenantDto) {
    return this.service.create(dto);
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
