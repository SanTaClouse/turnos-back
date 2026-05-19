import {
  Controller,
  Get,
  Post,
  Query,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AiSummariesService } from './ai-summaries.service';

@ApiTags('AI Summaries')
@Controller('ai-summaries')
export class AiSummariesController {
  constructor(private readonly service: AiSummariesService) {}

  @Get('current')
  @ApiOperation({
    summary: 'Resumen mensual vigente (el más reciente, normalmente mes pasado)',
  })
  @ApiOkResponse({
    description: 'Resumen o null si todavía no se generó ninguno',
  })
  async current(@Query('tenantId') tenantId: string) {
    if (!tenantId) throw new BadRequestException('tenantId es requerido');
    return this.service.getCurrent(tenantId);
  }

  @Get('by-month')
  @ApiOperation({ summary: 'Resumen de un mes específico (YYYY-MM)' })
  @ApiOkResponse({ description: 'Resumen del mes solicitado' })
  async byMonth(
    @Query('tenantId') tenantId: string,
    @Query('month') month: string,
  ) {
    if (!tenantId || !month) {
      throw new BadRequestException('tenantId y month son requeridos');
    }
    const s = await this.service.getByMonth(tenantId, month);
    if (!s) throw new NotFoundException('No hay resumen para ese mes');
    return s;
  }

  @Post('generate')
  @ApiOperation({
    summary: 'Generar (o regenerar) el resumen del mes indicado',
    description:
      'Construye el digest a partir de los turnos confirmados y lo guarda. ' +
      'En el futuro hará la llamada a Claude — hoy genera insights deterministícamente.',
  })
  @ApiOkResponse({ description: 'Resumen generado y persistido' })
  generate(
    @Query('tenantId') tenantId: string,
    @Query('month') month: string,
  ) {
    if (!tenantId || !month) {
      throw new BadRequestException('tenantId y month son requeridos');
    }
    return this.service.generate(tenantId, month);
  }
}
