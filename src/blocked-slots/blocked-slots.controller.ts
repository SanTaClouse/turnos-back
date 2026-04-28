import {
  Controller,
  Post,
  Get,
  Delete,
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
import { BlockedSlotsService } from './blocked-slots.service';
import { CreateBlockedSlotDto } from './dto/create-blocked-slot.dto';

@ApiTags('Blocked Slots')
@Controller('blocked-slots')
export class BlockedSlotsController {
  constructor(private readonly service: BlockedSlotsService) {}

  @Post()
  @ApiOperation({ summary: 'Bloquear un horario' })
  @ApiCreatedResponse({ description: 'Horario bloqueado exitosamente' })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  create(@Body() dto: CreateBlockedSlotDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar horarios bloqueados de una empresa' })
  @ApiOkResponse({ description: 'Lista de horarios bloqueados' })
  findByTenant(@Query('tenantId') tenantId: string) {
    return this.service.findByTenant(tenantId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar bloqueo de horario' })
  @ApiOkResponse({ description: 'Bloqueo eliminado' })
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
