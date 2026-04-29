import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly service: AppointmentsService,
    private readonly whatsappService: WhatsappService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo turno' })
  @ApiCreatedResponse({ description: 'Turno creado exitosamente' })
  @ApiBadRequestResponse({
    description: 'Slot no disponible o datos inválidos',
  })
  @ApiConflictResponse({ description: 'El turno ya está reservado' })
  create(@Body() dto: CreateAppointmentDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar turnos de una empresa con filtros opcionales',
    description:
      'Filtros opcionales: date (YYYY-MM-DD para un día), startDate/endDate (rango), ' +
      'resourceId (turnos de un recurso), status (pending/confirmed/cancelled), ' +
      'clientPhone (historial de un cliente). Resultados ordenados por fecha y hora.',
  })
  @ApiOkResponse({ description: 'Lista de turnos' })
  findAll(
    @Query('tenantId') tenantId: string,
    @Query('clientPhone') clientPhone?: string,
    @Query('clientEmail') clientEmail?: string,
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('resourceId') resourceId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(tenantId, {
      clientPhone,
      clientEmail,
      date,
      startDate,
      endDate,
      resourceId,
      status,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un turno específico' })
  @ApiOkResponse({ description: 'Turno encontrado' })
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar un turno',
    description: 'Permite editar campos como notes',
  })
  @ApiOkResponse({ description: 'Turno actualizado' })
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirmar un turno' })
  @ApiOkResponse({ description: 'Turno confirmado' })
  confirm(@Param('id') id: string) {
    return this.service.confirm(id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancelar un turno (libera el horario)' })
  @ApiOkResponse({ description: 'Turno cancelado' })
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @Post(':id/verify-by-token')
  @ApiOperation({
    summary: 'Verificar turno por token',
    description: 'Verifica un turno usando el token enviado por email',
  })
  @ApiOkResponse({ description: 'Turno verificado' })
  @ApiBadRequestResponse({ description: 'Token inválido o expirado' })
  verifyByToken(
    @Param('id') id: string,
    @Body('token') token: string,
  ) {
    return this.service.verifyByToken(id, token);
  }

  @Post('webhook')
  @ApiOperation({
    summary: 'Webhook de WhatsApp',
    description: 'Recibe mensajes desde WhatsApp Business API',
  })
  @ApiOkResponse({ description: 'Mensaje recibido' })
  handleWebhookPost(@Req() req) {
    this.whatsappService.logWebhook(req.body);
    const parsedMessage = this.whatsappService.parseMessage(req.body);

    if (!parsedMessage) {
      return { success: false };
    }

    // TODO: Process message and create/confirm appointments
    // This will connect to your WhatsApp flow
    return { success: true };
  }
}
