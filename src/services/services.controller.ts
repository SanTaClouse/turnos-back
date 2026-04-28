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
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';

@ApiTags('Services')
@Controller('services')
export class ServicesController {
  constructor(private readonly service: ServicesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo servicio' })
  @ApiCreatedResponse({ description: 'Servicio creado exitosamente' })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  create(@Body() dto: CreateServiceDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar servicios activos de una empresa' })
  @ApiOkResponse({ description: 'Lista de servicios' })
  findAll(@Query('tenantId') tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un servicio por ID' })
  @ApiOkResponse({ description: 'Servicio encontrado' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar un servicio' })
  @ApiOkResponse({ description: 'Servicio actualizado' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateServiceDto>) {
    return this.service.update(id, dto);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Desactivar un servicio' })
  @ApiOkResponse({ description: 'Servicio desactivado' })
  deactivate(@Param('id') id: string) {
    return this.service.deactivate(id);
  }
}
