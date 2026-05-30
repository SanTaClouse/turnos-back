import {
  Injectable,
  Logger,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Tenant } from '../tenants/tenant.entity';
import { Client } from '../clients/client.entity';
import { Payment } from './payment.entity';
import { MercadoPagoService } from './mercadopago.service';

export interface BillingStatus {
  plan_status: Tenant['plan_status'];
  billing_exempt: boolean;
  client_count: number;
  free_client_limit: number;
  /** true → bloqueo duro: mostrar el modal que tapa el panel */
  requires_payment: boolean;
  /**
   * true → período de gracia: el tenant debe pagar pero todavía puede usar la
   * app. El front muestra un banner no bloqueante con botón de pago.
   */
  in_grace: boolean;
  /** Fin del período de gracia (ISO) o null si no aplica. */
  grace_until: string | null;
  current_period_end: string | null;
  amount: number;
  currency: string;
}

type Access = 'ok' | 'grace' | 'blocked';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    private readonly mp: MercadoPagoService,
    private readonly config: ConfigService,
  ) {}

  private get amount(): number {
    return parseInt(this.config.get<string>('MP_PLAN_AMOUNT') ?? '20000', 10);
  }

  private get currency(): string {
    return this.config.get<string>('MP_PLAN_CURRENCY') ?? 'ARS';
  }

  /** Días de gracia antes de bloquear el panel (default 30). */
  private get graceDays(): number {
    return parseInt(this.config.get<string>('BILLING_GRACE_DAYS') ?? '30', 10);
  }

  /** Cuenta los clientes vinculados a un tenant (filas en tenant_client). */
  async countClients(tenantId: string): Promise<number> {
    return this.clientRepo
      .createQueryBuilder('client')
      .innerJoin('client.tenants', 'tenant', 'tenant.id = :tenantId', {
        tenantId,
      })
      .getCount();
  }

  /**
   * ¿Este tenant necesita pagar? (independiente de la gracia). No paga si está
   * exento (override manual) o si la suscripción está activa.
   */
  private needsPayment(tenant: Tenant, clientCount: number): boolean {
    if (tenant.billing_exempt) return false;
    if (tenant.plan_status === 'active') return false;
    return clientCount >= tenant.free_client_limit;
  }

  /**
   * Evalúa el nivel de acceso del tenant y, si recién entra en deuda, ARRANCA
   * el período de gracia (persiste `grace_until`). Devuelve:
   *  - 'ok'      → todo bien, sin restricciones
   *  - 'grace'   → debe pagar pero está dentro de la gracia (usa + banner)
   *  - 'blocked' → gracia vencida y sin pagar → bloqueo duro
   *
   * Es la única fuente de verdad del acceso; la usan getStatus, el gate y el
   * cron. Como lee/escribe en la base, es consistente entre dispositivos.
   */
  private async evaluateAccess(
    tenant: Tenant,
    clientCount: number,
  ): Promise<Access> {
    if (!this.needsPayment(tenant, clientCount)) {
      // Si volvió a estar en regla (p.ej. se hizo exento), limpiamos la gracia.
      if (tenant.grace_until) {
        tenant.grace_until = null;
        await this.tenantRepo.save(tenant);
      }
      return 'ok';
    }

    const now = new Date();

    // Primera vez que entra en deuda → arranca la gracia.
    if (!tenant.grace_until) {
      tenant.grace_until = new Date(
        now.getTime() + this.graceDays * 24 * 60 * 60 * 1000,
      );
      await this.tenantRepo.save(tenant);
    }

    return now < tenant.grace_until ? 'grace' : 'blocked';
  }

  async getStatus(tenantId: string): Promise<BillingStatus> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const clientCount = await this.countClients(tenantId);
    const access = await this.evaluateAccess(tenant, clientCount);

    return {
      plan_status: tenant.plan_status,
      billing_exempt: tenant.billing_exempt,
      client_count: clientCount,
      free_client_limit: tenant.free_client_limit,
      requires_payment: access === 'blocked',
      in_grace: access === 'grace',
      grace_until: tenant.grace_until
        ? tenant.grace_until.toISOString()
        : null,
      current_period_end: tenant.current_period_end
        ? tenant.current_period_end.toISOString()
        : null,
      amount: this.amount,
      currency: this.currency,
    };
  }

  /**
   * Gate llamado antes de vincular un cliente NUEVO a un tenant. Si el tenant
   * ya alcanzó su cupo gratis y no tiene suscripción activa ni exención, lanza
   * 403 con `code: 'PLAN_LIMIT_REACHED'` para que el front muestre el modal.
   *
   * Multidispositivo: el chequeo lee siempre de la base, así que da igual
   * desde cuántos dispositivos opere el dueño — todos ven el mismo estado.
   */
  async assertCanAddClient(tenantId: string): Promise<void> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) return; // si no existe, que falle más adelante donde corresponda
    if (tenant.billing_exempt || tenant.plan_status === 'active') return;

    const clientCount = await this.countClients(tenantId);
    const access = await this.evaluateAccess(tenant, clientCount);

    // En gracia todavía dejamos sumar clientes (con banner + recordatorios).
    // Solo bloqueamos cuando la gracia venció.
    if (access === 'blocked') {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_REACHED',
        message:
          'Este negocio superó el límite gratis y venció el período de ' +
          'gracia. El dueño debe activar la suscripción para seguir.',
        limit: tenant.free_client_limit,
      });
    }
  }

  /**
   * Crea (o reutiliza) la suscripción de Mercado Pago para el tenant y
   * devuelve el `init_point` al que redirigir para autorizar el débito.
   */
  async createSubscription(
    tenantId: string,
  ): Promise<{ init_point: string; preapproval_id: string }> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');
    if (!tenant.email) {
      throw new ForbiddenException(
        'El negocio no tiene un email configurado para la suscripción.',
      );
    }

    const appUrl =
      this.config.get<string>('APP_URL') ?? 'http://localhost:3001';
    const apiUrl =
      this.config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3000';

    const pre = await this.mp.createPreapproval({
      reason: `Suscripción Turno1min — ${tenant.name}`,
      amount: this.amount,
      currency: this.currency,
      payerEmail: tenant.email,
      backUrl: `${appUrl}/admin/billing/success`,
      notificationUrl: `${apiUrl}/billing/webhook`,
      externalReference: tenant.id,
    });

    tenant.mp_preapproval_id = pre.id;
    await this.tenantRepo.save(tenant);

    return { init_point: pre.init_point, preapproval_id: pre.id };
  }

  // ──────────────────── Administración de plataforma (vos) ────────────────────

  /**
   * Lista todos los tenants con su info de facturación, para que el dueño de
   * la plataforma decida a quién cobrarle y a quién dejarle gratis.
   */
  async listTenantsForAdmin(): Promise<
    Array<{
      id: string;
      name: string;
      slug: string;
      email: string | null;
      plan_status: Tenant['plan_status'];
      billing_exempt: boolean;
      free_client_limit: number;
      client_count: number;
      grace_until: string | null;
      current_period_end: string | null;
    }>
  > {
    const tenants = await this.tenantRepo.find({ order: { created_at: 'DESC' } });
    const rows = await Promise.all(
      tenants.map(async (t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        email: t.email,
        plan_status: t.plan_status,
        billing_exempt: t.billing_exempt,
        free_client_limit: t.free_client_limit,
        client_count: await this.countClients(t.id),
        grace_until: t.grace_until ? t.grace_until.toISOString() : null,
        current_period_end: t.current_period_end
          ? t.current_period_end.toISOString()
          : null,
      })),
    );
    return rows;
  }

  /**
   * Actualiza los flags de facturación de un tenant (override manual del dueño
   * de la plataforma): exención total y/o cupo de clientes gratis.
   */
  async updateBillingFlags(
    tenantId: string,
    flags: { billing_exempt?: boolean; free_client_limit?: number },
  ): Promise<{ ok: true }> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    if (typeof flags.billing_exempt === 'boolean') {
      tenant.billing_exempt = flags.billing_exempt;
      // Si lo hago exento, limpio cualquier gracia pendiente.
      if (flags.billing_exempt) tenant.grace_until = null;
    }
    if (typeof flags.free_client_limit === 'number') {
      tenant.free_client_limit = flags.free_client_limit;
    }
    await this.tenantRepo.save(tenant);
    return { ok: true };
  }

  // ──────────────────────── Soporte para el cron ────────────────────────

  /**
   * Red de seguridad por si no llega el webhook de MP: pasa a 'past_due' las
   * suscripciones activas cuyo período ya venció, y les arranca la gracia.
   * Devuelve cuántas actualizó.
   */
  async lapseExpiredSubscriptions(): Promise<number> {
    const now = new Date();
    const lapsed = await this.tenantRepo
      .createQueryBuilder('t')
      .where('t.plan_status = :active', { active: 'active' })
      .andWhere('t.current_period_end IS NOT NULL')
      .andWhere('t.current_period_end < :now', { now })
      .getMany();

    for (const tenant of lapsed) {
      tenant.plan_status = 'past_due';
      tenant.grace_until = new Date(
        now.getTime() + this.graceDays * 24 * 60 * 60 * 1000,
      );
      await this.tenantRepo.save(tenant);
    }
    return lapsed.length;
  }

  /** Tenants que hoy están en período de gracia (deben pagar, todavía pueden usar). */
  async getTenantsInGrace(): Promise<Tenant[]> {
    const now = new Date();
    return this.tenantRepo
      .createQueryBuilder('t')
      .where('t.billing_exempt = false')
      .andWhere('t.plan_status != :active', { active: 'active' })
      .andWhere('t.grace_until IS NOT NULL')
      .andWhere('t.grace_until > :now', { now })
      .getMany();
  }

  /** Días que faltan para que venza la gracia (>= 0). */
  daysUntilGraceEnd(tenant: Tenant): number {
    if (!tenant.grace_until) return 0;
    const ms = tenant.grace_until.getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  // ───────────────────────────── Webhooks ─────────────────────────────

  /**
   * Procesa una notificación de Mercado Pago. Es idempotente: si ya
   * registramos ese pago, no hace nada.
   *
   * Tipos relevantes:
   *  - subscription_preapproval        → cambió el estado de la suscripción
   *  - subscription_authorized_payment → se cobró un período (mensual)
   *  - payment                         → pago individual (fallback)
   */
  async handleWebhook(type: string, dataId: string): Promise<void> {
    if (!type || !dataId) return;

    try {
      if (type === 'subscription_preapproval') {
        await this.syncPreapproval(dataId);
      } else if (type === 'subscription_authorized_payment') {
        await this.handleAuthorizedPayment(dataId);
      } else if (type === 'payment') {
        await this.handlePayment(dataId);
      } else {
        this.logger.log(`Webhook MP ignorado (type=${type})`);
      }
    } catch (err) {
      this.logger.error(`Error procesando webhook MP type=${type}`, err);
      throw err; // que MP reintente
    }
  }

  /** Sincroniza el estado de la suscripción (authorized/paused/cancelled). */
  private async syncPreapproval(preapprovalId: string): Promise<void> {
    const pre = await this.mp.getPreapproval(preapprovalId);
    const tenant = await this.findTenantByPreapproval(
      preapprovalId,
      pre.external_reference,
    );
    if (!tenant) return;

    if (pre.status === 'authorized') {
      tenant.plan_status = 'active';
      tenant.grace_until = null; // al activarse, se limpia la gracia
      if (!tenant.subscription_started_at) {
        tenant.subscription_started_at = new Date();
      }
      if (pre.next_payment_date) {
        tenant.current_period_end = new Date(pre.next_payment_date);
      }
    } else if (pre.status === 'paused') {
      // Cobro rechazado/pausado → arranca (o mantiene) la gracia de 1 mes.
      tenant.plan_status = 'past_due';
      if (!tenant.grace_until) {
        tenant.grace_until = new Date(
          Date.now() + this.graceDays * 24 * 60 * 60 * 1000,
        );
      }
    } else if (pre.status === 'cancelled') {
      tenant.plan_status = 'cancelled';
    }
    tenant.mp_preapproval_id = preapprovalId;
    await this.tenantRepo.save(tenant);
    this.logger.log(
      `Suscripción ${preapprovalId} → tenant ${tenant.id} status=${tenant.plan_status}`,
    );
  }

  /** Un cobro mensual recurrente fue autorizado/aprobado. */
  private async handleAuthorizedPayment(authPaymentId: string): Promise<void> {
    const ap = await this.mp.getAuthorizedPayment(authPaymentId);
    const mpPaymentId = String(ap.payment?.id ?? ap.id);

    if (await this.alreadyProcessed(mpPaymentId)) return;

    const tenant = ap.preapproval_id
      ? await this.findTenantByPreapproval(ap.preapproval_id)
      : null;

    const status = ap.payment?.status ?? ap.status;
    await this.recordPayment({
      tenantId: tenant?.id ?? null,
      mpPaymentId,
      preapprovalId: ap.preapproval_id ?? null,
      status,
      amount: ap.transaction_amount ?? null,
      currency: ap.currency_id ?? this.currency,
      raw: ap,
    });

    if (tenant && (status === 'approved' || status === 'authorized')) {
      tenant.plan_status = 'active';
      tenant.grace_until = null;
      tenant.current_period_end = this.addOneMonth(new Date());
      await this.tenantRepo.save(tenant);
    }
  }

  /** Fallback: notificación tipo "payment". */
  private async handlePayment(paymentId: string): Promise<void> {
    if (await this.alreadyProcessed(paymentId)) return;
    const pay = await this.mp.getPayment(paymentId);

    const tenant = pay.external_reference
      ? await this.tenantRepo.findOne({
          where: { id: pay.external_reference },
        })
      : null;

    await this.recordPayment({
      tenantId: tenant?.id ?? null,
      mpPaymentId: String(pay.id),
      preapprovalId: null,
      status: pay.status,
      amount: pay.transaction_amount ?? null,
      currency: pay.currency_id ?? this.currency,
      raw: pay,
    });

    if (tenant && pay.status === 'approved') {
      tenant.plan_status = 'active';
      tenant.grace_until = null;
      tenant.current_period_end = this.addOneMonth(new Date());
      await this.tenantRepo.save(tenant);
    }
  }

  // ──────────────────────────── Helpers ────────────────────────────

  private async alreadyProcessed(mpPaymentId: string): Promise<boolean> {
    const existing = await this.paymentRepo.findOne({
      where: { mp_payment_id: mpPaymentId },
    });
    return !!existing;
  }

  private async recordPayment(input: {
    tenantId: string | null;
    mpPaymentId: string;
    preapprovalId: string | null;
    status: string;
    amount: number | null;
    currency: string;
    raw: unknown;
  }): Promise<void> {
    await this.paymentRepo.save(
      this.paymentRepo.create({
        tenant_id: input.tenantId,
        mp_payment_id: input.mpPaymentId,
        mp_preapproval_id: input.preapprovalId,
        status: input.status,
        amount: input.amount !== null ? String(input.amount) : null,
        currency: input.currency,
        raw_payload: input.raw,
      }),
    );
  }

  private async findTenantByPreapproval(
    preapprovalId: string,
    externalReference?: string,
  ): Promise<Tenant | null> {
    let tenant = await this.tenantRepo.findOne({
      where: { mp_preapproval_id: preapprovalId },
    });
    if (!tenant && externalReference) {
      tenant = await this.tenantRepo.findOne({
        where: { id: externalReference },
      });
    }
    return tenant;
  }

  private addOneMonth(from: Date): Date {
    const d = new Date(from);
    d.setMonth(d.getMonth() + 1);
    return d;
  }
}
