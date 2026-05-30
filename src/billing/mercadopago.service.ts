import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

const MP_API = 'https://api.mercadopago.com';

export interface CreatePreapprovalParams {
  reason: string;
  amount: number;
  currency: string;
  payerEmail: string;
  backUrl: string;
  notificationUrl: string;
  externalReference: string; // tenant_id
}

export interface PreapprovalResponse {
  id: string;
  init_point: string;
  status: string;
  external_reference?: string;
}

/**
 * Wrapper fino sobre la API de Mercado Pago (Suscripciones / Preapproval).
 *
 * Usa un único access token: el TUYO (dueño de la plataforma). Todos los
 * tenants pagan a tu cuenta — modelo marketplace simple, sin split de pagos.
 *
 * Docs: https://www.mercadopago.com.ar/developers/es/reference/subscriptions/_preapproval/post
 */
@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name);

  constructor(private readonly config: ConfigService) {}

  private get accessToken(): string {
    const token = this.config.get<string>('MP_ACCESS_TOKEN');
    if (!token) {
      throw new InternalServerErrorException(
        'MP_ACCESS_TOKEN no configurado en el backend',
      );
    }
    return token;
  }

  private async mpFetch<T>(
    path: string,
    init?: Omit<RequestInit, 'body'> & { body?: unknown },
  ): Promise<T> {
    const { body, ...rest } = init ?? {};
    const res = await fetch(`${MP_API}${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...(rest.headers as Record<string, string> | undefined),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : null;

    if (!res.ok) {
      // Logueamos también el cuerpo que enviamos (sin el token) para poder
      // depurar errores de MP que vienen genéricos (ej: 500 sin detalle).
      this.logger.error(
        `MP ${rest.method ?? 'GET'} ${path} → ${res.status}: ${text}\n` +
          `→ request body: ${
            body !== undefined ? JSON.stringify(body) : '(sin body)'
          }`,
      );
      throw new InternalServerErrorException(
        'Error comunicándose con Mercado Pago',
      );
    }
    return json as T;
  }

  /**
   * Crea una suscripción (preapproval) SIN plan asociado. MP devuelve un
   * `init_point` al que redirigimos al dueño para que autorice el débito
   * automático mensual.
   */
  async createPreapproval(
    params: CreatePreapprovalParams,
  ): Promise<PreapprovalResponse> {
    return this.mpFetch<PreapprovalResponse>('/preapproval', {
      method: 'POST',
      body: {
        reason: params.reason,
        external_reference: params.externalReference,
        payer_email: params.payerEmail,
        back_url: params.backUrl,
        notification_url: params.notificationUrl,
        status: 'pending', // el dueño confirma en el init_point
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: params.amount,
          currency_id: params.currency,
        },
      },
    });
  }

  /** Estado de una suscripción: authorized | paused | cancelled | pending */
  async getPreapproval(id: string): Promise<{
    id: string;
    status: string;
    external_reference?: string;
    next_payment_date?: string;
    payer_email?: string;
  }> {
    return this.mpFetch(`/preapproval/${id}`);
  }

  /** Detalle de un cobro recurrente autorizado (subscription_authorized_payment) */
  async getAuthorizedPayment(id: string): Promise<{
    id: string | number;
    preapproval_id?: string;
    status: string;
    transaction_amount?: number;
    currency_id?: string;
    payment?: { id?: number; status?: string };
  }> {
    return this.mpFetch(`/authorized_payments/${id}`);
  }

  /** Detalle de un pago individual (topic "payment") */
  async getPayment(id: string): Promise<{
    id: number;
    status: string;
    transaction_amount?: number;
    currency_id?: string;
    external_reference?: string;
    metadata?: Record<string, unknown>;
  }> {
    return this.mpFetch(`/v1/payments/${id}`);
  }

  /**
   * Valida la firma del webhook (header `x-signature`).
   *
   * MP arma un manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
   * y lo firma con HMAC-SHA256 usando el secret del webhook. Comparamos con
   * el valor `v1` del header. Si MP_WEBHOOK_SECRET no está seteado, no
   * validamos (útil en dev) pero lo logueamos como warning.
   */
  verifyWebhookSignature(
    signatureHeader: string | undefined,
    requestId: string | undefined,
    dataId: string | undefined,
  ): boolean {
    const secret = this.config.get<string>('MP_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn(
        'MP_WEBHOOK_SECRET no configurado — webhook sin validar firma',
      );
      return true;
    }
    if (!signatureHeader || !dataId) return false;

    // x-signature: "ts=1700000000,v1=abcdef..."
    const parts = Object.fromEntries(
      signatureHeader.split(',').map((kv) => {
        const [k, v] = kv.split('=');
        return [k.trim(), (v ?? '').trim()];
      }),
    ) as { ts?: string; v1?: string };

    if (!parts.ts || !parts.v1) return false;

    const manifest = `id:${dataId};request-id:${requestId ?? ''};ts:${parts.ts};`;
    const expected = createHmac('sha256', secret)
      .update(manifest)
      .digest('hex');

    try {
      const a = Buffer.from(expected, 'hex');
      const b = Buffer.from(parts.v1, 'hex');
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}
