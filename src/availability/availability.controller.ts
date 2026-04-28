import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { ResourcesService } from '../resources/resources.service';
import { ServicesService } from '../services/services.service';

@ApiTags('Availability')
@Controller('availability')
export class AvailabilityController {
  constructor(
    private readonly service: AvailabilityService,
    private readonly resourcesService: ResourcesService,
    private readonly servicesService: ServicesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear regla de disponibilidad para un recurso' })
  @ApiCreatedResponse({ description: 'Regla creada exitosamente' })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  create(@Body() dto: CreateAvailabilityDto) {
    return this.service.create(dto);
  }

  @Get('slots')
  @ApiOperation({
    summary: 'Obtener horarios disponibles para un servicio (CORE)',
    description:
      'Devuelve TODOS los horarios disponibles para un servicio en una fecha. ' +
      'Busca automáticamente en todos los recursos que ofrecen ese servicio. ' +
      'Cada slot indica qué recursos están disponibles.',
  })
  @ApiQuery({
    name: 'tenantId',
    description: 'ID de la empresa',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'serviceId',
    description: 'ID del servicio solicitado',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'date',
    description: 'Fecha en formato YYYY-MM-DD',
    required: true,
    type: String,
  })
  @ApiOkResponse({
    description:
      'Lista de horarios disponibles con los recursos que pueden atender',
    schema: {
      example: [
        { slot: '09:00', resource_ids: ['uuid-1', 'uuid-2'] },
        { slot: '09:30', resource_ids: ['uuid-1'] },
        { slot: '10:00', resource_ids: ['uuid-2'] },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'Error de validación' })
  async getAvailableSlots(
    @Query('tenantId') tenantId: string,
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
  ) {
    if (!tenantId || tenantId.trim() === '') {
      throw new BadRequestException('tenantId es requerido');
    }

    if (!serviceId || serviceId.trim() === '') {
      throw new BadRequestException('serviceId es requerido');
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!date || !dateRegex.test(date)) {
      throw new BadRequestException(
        `Formato de fecha inválido. Debe ser YYYY-MM-DD. Recibido: "${date}"`,
      );
    }

    const dateObj = new Date(date + 'T00:00:00Z');
    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException(`Fecha no válida: "${date}"`);
    }

    // Get service details
    const service = await this.servicesService.findById(serviceId);
    if (!service || !service.is_active) {
      throw new BadRequestException('Servicio no encontrado o inactivo');
    }

    // Find resources that can perform this service
    const resources = await this.resourcesService.findByService(
      tenantId,
      serviceId,
    );

    if (!resources.length) {
      return [];
    }

    const resourceIds = resources.map((r) => r.id);

    return this.service.getAvailableSlotsForService(
      tenantId,
      date,
      service.duration_minutes,
      service.buffer_minutes,
      resourceIds,
    );
  }

  @Get(':tenantId')
  @ApiOperation({ summary: 'Listar reglas de disponibilidad de una empresa' })
  @ApiOkResponse({ description: 'Lista de reglas' })
  findAll(@Param('tenantId') tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar regla de disponibilidad' })
  @ApiOkResponse({ description: 'Regla eliminada' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
