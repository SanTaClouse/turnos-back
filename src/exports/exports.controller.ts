import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ExportsService } from './exports.service';

@ApiTags('Exports')
@Controller('exports')
export class ExportsController {
  constructor(private readonly service: ExportsService) {}

  @Get('appointments/preview')
  @ApiOperation({
    summary: 'Preview de export: cantidad de filas + alertas de duplicación',
    description:
      'Llamar antes de pedir la descarga para mostrar el aviso "Este rango ya fue exportado el X" en el front.',
  })
  @ApiOkResponse({
    description:
      'Devuelve rowCount, totalRevenue, hash, y duplicates: { exactRange, exactRows, overlappingRanges }.',
  })
  preview(
    @Query('tenantId') tenantId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('status') status?: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId es requerido');
    return this.service.preview({ tenantId, from, to, status });
  }

  @Get('appointments.xlsx')
  @ApiOperation({
    summary: 'Descarga directa del Excel (stream sin storage)',
    description:
      'Genera el archivo en memoria y lo escribe al response. NO se persiste en disco. ' +
      'Si el rango ya fue exportado, responde 409 con detalle. Para forzar, pasar confirm=true.',
  })
  @ApiOkResponse({ description: 'Streaming binario del .xlsx' })
  @ApiConflictResponse({
    description: 'Export duplicado — pasar confirm=true para forzar',
  })
  async download(
    @Res() res: Response,
    @Query('tenantId') tenantId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('status') status?: string,
    @Query('confirm') confirm?: string,
    @Query('exportedBy') exportedBy?: string,
  ) {
    if (!tenantId || !from || !to) {
      throw new BadRequestException('tenantId, from y to son requeridos');
    }
    await this.service.streamAppointmentsExcel(
      {
        tenantId,
        from,
        to,
        status,
        confirm: confirm === 'true' || confirm === '1',
        exportedBy: exportedBy ?? null,
      },
      res,
    );
  }

  @Get('appointments/history')
  @ApiOperation({ summary: 'Listado de exports previos del tenant' })
  @ApiOkResponse({ description: 'Lista de exports recientes' })
  history(
    @Query('tenantId') tenantId: string,
    @Query('limit') limit?: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId es requerido');
    const n = limit ? parseInt(limit, 10) : 20;
    return this.service.listHistory(tenantId, Number.isFinite(n) ? n : 20);
  }
}
