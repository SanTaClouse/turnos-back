import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { ResourcesService } from './resources.service';
import { CreateResourceDto } from './dto/create-resource.dto';

@ApiTags('Resources')
@Controller('resources')
export class ResourcesController {
  constructor(private readonly service: ResourcesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo recurso (profesional, sala, etc)' })
  @ApiCreatedResponse({ description: 'Recurso creado exitosamente' })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  create(@Body() dto: CreateResourceDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar recursos activos de una empresa' })
  @ApiOkResponse({ description: 'Lista de recursos' })
  findAll(@Query('tenantId') tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un recurso por ID' })
  @ApiOkResponse({ description: 'Recurso encontrado' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar nombre, rol o color del recurso' })
  @ApiOkResponse({ description: 'Recurso actualizado' })
  update(
    @Param('id') id: string,
    @Body() dto: { name?: string; role?: string; hue?: number },
  ) {
    return this.service.update(id, dto);
  }

  @Patch(':id/services')
  @ApiOperation({ summary: 'Asignar servicios a un recurso' })
  @ApiOkResponse({ description: 'Servicios asignados' })
  assignServices(
    @Param('id') id: string,
    @Body('service_ids') serviceIds: string[],
  ) {
    return this.service.assignServices(id, serviceIds);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Desactivar un recurso' })
  @ApiOkResponse({ description: 'Recurso desactivado' })
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }
}
