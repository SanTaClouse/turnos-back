import {
  Controller,
  Get,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import {
  EarningsService,
  type EarningsPeriod,
} from './earnings.service';

@ApiTags('Earnings')
@Controller('earnings')
export class EarningsController {
  constructor(private readonly service: EarningsService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Resumen de ganancias por período',
    description:
      'Devuelve total, comparación con período anterior, breakdown para chart, ' +
      'desglose por servicio y por profesional. Sólo cuenta turnos confirmados.',
  })
  @ApiOkResponse({
    description:
      'EarningsResult: { period, label, range, total, prev, breakdown, labels, services, pros }',
  })
  summary(
    @Query('tenantId') tenantId: string,
    @Query('period') period: string,
    @Query('date') date?: string,
  ) {
    if (!tenantId) throw new BadRequestException('tenantId es requerido');
    const allowed = ['dia', 'semana', 'mes'];
    if (!allowed.includes(period)) {
      throw new BadRequestException('period debe ser dia, semana o mes');
    }
    return this.service.summary(tenantId, period as EarningsPeriod, date);
  }
}
