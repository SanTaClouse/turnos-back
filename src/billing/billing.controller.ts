import {
  Controller,
  Get,
  Post,
  Req,
  Body,
  Query,
  Headers,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { AdminAuthGuard } from '../auth/admin-auth.guard';
import type { AuthedRequest } from '../auth/admin-auth.guard';
import { BillingService } from './billing.service';
import { MercadoPagoService } from './mercadopago.service';

@ApiTags('Billing')
@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly mp: MercadoPagoService,
  ) {}

  @Get('me/billing')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  @ApiOperation({
    summary: 'Estado de facturación del tenant autenticado',
    description:
      'Devuelve cantidad de clientes, límite gratis y si requiere pagar. ' +
      'El front usa requires_payment para mostrar el modal y bloquear el panel.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        plan_status: 'free',
        billing_exempt: false,
        client_count: 31,
        free_client_limit: 30,
        requires_payment: true,
        current_period_end: null,
        amount: 20000,
        currency: 'ARS',
      },
    },
  })
  getStatus(@Req() req: AuthedRequest) {
    return this.billing.getStatus(req.authedSession.tenant.id);
  }

  @Post('me/billing/subscribe')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  @ApiOperation({
    summary: 'Crear suscripción en Mercado Pago y devolver init_point',
    description:
      'Crea un preapproval (débito mensual automático) y devuelve la URL ' +
      'init_point para redirigir al dueño a autorizar el pago.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        init_point: 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=...',
        preapproval_id: '2c938084...',
      },
    },
  })
  subscribe(@Req() req: AuthedRequest) {
    return this.billing.createSubscription(req.authedSession.tenant.id);
  }

  /**
   * Webhook público de Mercado Pago. MP manda el tipo y el id tanto por query
   * (?type=...&data.id=...) como en el body ({ type, data: { id } }) según el
   * tipo de notificación. Contemplamos ambos.
   *
   * Respondemos 200 siempre que la firma sea válida y el procesamiento no
   * falle, para que MP no siga reintentando innecesariamente.
   */
  @Post('billing/webhook')
  @HttpCode(200)
  @ApiExcludeEndpoint()
  async webhook(
    @Query() query: Record<string, string>,
    @Body() body: Record<string, unknown>,
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
  ) {
    const type =
      query.type ||
      query.topic ||
      (body?.type as string) ||
      (body?.topic as string) ||
      '';

    const dataId =
      query['data.id'] ||
      query.id ||
      ((body?.data as { id?: string } | undefined)?.id ?? '') ||
      (body?.id as string) ||
      '';

    const valid = this.mp.verifyWebhookSignature(signature, requestId, dataId);
    if (!valid) {
      // Firma inválida: 200 igual para no filtrar info, pero no procesamos.
      return { received: true, processed: false };
    }

    await this.billing.handleWebhook(type, String(dataId));
    return { received: true, processed: true };
  }
}
