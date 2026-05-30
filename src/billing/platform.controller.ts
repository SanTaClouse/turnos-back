import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { PlatformAdminGuard } from './platform-admin.guard';

class UpdateBillingFlagsDto {
  billing_exempt?: boolean;
  free_client_limit?: number;
}

/**
 * Endpoints de administración de la plataforma (uso del dueño). Protegidos con
 * el header `x-admin-key`. Acá decidís a quién le cobrás y a quién no.
 */
@ApiTags('Platform Admin')
@ApiHeader({ name: 'x-admin-key', description: 'Clave de administrador' })
@UseGuards(PlatformAdminGuard)
@Controller('platform')
export class PlatformController {
  constructor(private readonly billing: BillingService) {}

  @Get('tenants')
  @ApiOperation({
    summary: 'Listar todos los tenants con su info de facturación',
  })
  @ApiOkResponse({
    schema: {
      example: [
        {
          id: 'uuid',
          name: 'Barbería Juan',
          slug: 'barberia-juan',
          email: 'juan@negocio.com',
          plan_status: 'free',
          billing_exempt: false,
          free_client_limit: 30,
          client_count: 12,
          grace_until: null,
          current_period_end: null,
        },
      ],
    },
  })
  listTenants() {
    return this.billing.listTenantsForAdmin();
  }

  @Patch('tenants/:id/billing')
  @ApiOperation({
    summary: 'Cambiar exención de cobro y/o cupo gratis de un tenant',
    description:
      'billing_exempt=true → ese tenant nunca paga ni ve el bloqueo (para los ' +
      'conocidos a los que les dejás la app gratis). free_client_limit cambia ' +
      'cuántos clientes gratis tiene antes de pedir suscripción.',
  })
  @ApiOkResponse({ schema: { example: { ok: true } } })
  updateBilling(
    @Param('id') id: string,
    @Body() dto: UpdateBillingFlagsDto,
  ) {
    return this.billing.updateBillingFlags(id, dto);
  }
}
