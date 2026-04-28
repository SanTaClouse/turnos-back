import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { UpdateClientDto } from './dto/update-client.dto';

@ApiTags('Clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar clientes de una empresa' })
  @ApiOkResponse({ description: 'Lista de clientes del tenant' })
  @ApiBadRequestResponse({ description: 'tenantId requerido' })
  findByTenant(@Query('tenantId') tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId query param is required');
    }
    return this.service.findByTenant(tenantId);
  }

  @Get('by-phone/:phone')
  @ApiOperation({
    summary: 'Buscar cliente por teléfono (búsqueda global en la plataforma)',
  })
  @ApiOkResponse({ description: 'Cliente encontrado' })
  @ApiNotFoundResponse({ description: 'Cliente no encontrado' })
  async findByPhone(@Param('phone') phone: string) {
    const client = await this.service.findByPhone(phone);
    if (!client) {
      throw new NotFoundException(`Client with phone "${phone}" not found`);
    }
    return client;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un cliente por ID' })
  @ApiOkResponse({ description: 'Cliente encontrado' })
  @ApiNotFoundResponse({ description: 'Cliente no encontrado' })
  async findById(@Param('id') id: string) {
    const client = await this.service.findById(id);
    if (!client) {
      throw new NotFoundException(`Client with id "${id}" not found`);
    }
    return client;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar datos de un cliente' })
  @ApiOkResponse({ description: 'Cliente actualizado' })
  @ApiNotFoundResponse({ description: 'Cliente no encontrado' })
  async update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    const existing = await this.service.findById(id);
    if (!existing) {
      throw new NotFoundException(`Client with id "${id}" not found`);
    }
    return this.service.update(id, dto);
  }
}
