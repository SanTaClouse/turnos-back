import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '../appointments/appointment.entity';
import { Tenant } from '../tenants/tenant.entity';

export type EarningsPeriod = 'dia' | 'semana' | 'mes';

export interface EarningsResult {
  period: EarningsPeriod;
  label: string;
  range: { from: string; to: string };
  previousRange: { from: string; to: string };
  total: number;
  prev: number;
  breakdown: number[];
  labels: string[];
  services: Array<{
    service_id: string | null;
    name: string;
    count: number;
    total: number;
  }>;
  pros: Array<{
    resource_id: string | null;
    name: string;
    hue: number;
    count: number;
    total: number;
  }>;
}

const MONTH_LABELS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

@Injectable()
export class EarningsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentsRepo: Repository<Appointment>,
    @InjectRepository(Tenant) private tenantsRepo: Repository<Tenant>,
  ) {}

  private revenue(a: Appointment): number {
    const p = a.service?.price;
    if (p === null || p === undefined) return 0;
    return typeof p === 'string' ? parseFloat(p) : Number(p);
  }

  /**
   * Date math sin librería. Trabajamos en UTC para que el server no
   * shiftee días por zona horaria. El front maneja TZ a la hora de mostrar.
   */
  private toISODate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private addDays(d: Date, n: number): Date {
    const r = new Date(d.getTime());
    r.setUTCDate(r.getUTCDate() + n);
    return r;
  }

  private startOfWeek(d: Date): Date {
    // Semana lunes-domingo (estilo es-AR/eu)
    const day = d.getUTCDay(); // 0=Dom, 1=Lun
    const diff = day === 0 ? -6 : 1 - day;
    return this.addDays(d, diff);
  }

  /**
   * Resuelve los rangos del período actual + el período anterior comparable.
   */
  private resolveRanges(period: EarningsPeriod, ref: Date) {
    if (period === 'dia') {
      const today = new Date(
        Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()),
      );
      const yesterday = this.addDays(today, -1);
      return {
        from: this.toISODate(today),
        to: this.toISODate(today),
        prevFrom: this.toISODate(yesterday),
        prevTo: this.toISODate(yesterday),
        label: 'Hoy',
      };
    }

    if (period === 'semana') {
      const monday = this.startOfWeek(
        new Date(
          Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()),
        ),
      );
      const sunday = this.addDays(monday, 6);
      const prevMonday = this.addDays(monday, -7);
      const prevSunday = this.addDays(monday, -1);
      return {
        from: this.toISODate(monday),
        to: this.toISODate(sunday),
        prevFrom: this.toISODate(prevMonday),
        prevTo: this.toISODate(prevSunday),
        label: 'Esta semana',
      };
    }

    // mes
    const y = ref.getUTCFullYear();
    const m = ref.getUTCMonth();
    const firstDay = new Date(Date.UTC(y, m, 1));
    const lastDay = new Date(Date.UTC(y, m + 1, 0));
    const prevFirst = new Date(Date.UTC(y, m - 1, 1));
    const prevLast = new Date(Date.UTC(y, m, 0));
    return {
      from: this.toISODate(firstDay),
      to: this.toISODate(lastDay),
      prevFrom: this.toISODate(prevFirst),
      prevTo: this.toISODate(prevLast),
      label: MONTH_LABELS[m],
    };
  }

  private async fetchInRange(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<Appointment[]> {
    return this.appointmentsRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.client', 'client')
      .leftJoinAndSelect('a.service', 'service')
      .leftJoinAndSelect('a.resource', 'resource')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.date BETWEEN :from AND :to', { from, to })
      .andWhere('a.status = :status', { status: 'confirmed' })
      .getMany();
  }

  /**
   * Buckets del breakdown para el bar chart:
   * - día: 3 buckets (Mañana < 12 / Tarde 12-18 / Noche ≥ 18)
   * - semana: 7 días (L M M J V S D)
   * - mes: N días del mes (1..lastDay)
   */
  private buildBreakdown(
    period: EarningsPeriod,
    from: string,
    to: string,
    appointments: Appointment[],
  ): { breakdown: number[]; labels: string[] } {
    if (period === 'dia') {
      const buckets = [0, 0, 0]; // mañana, tarde, noche
      for (const a of appointments) {
        const h = parseInt(a.time.split(':')[0], 10);
        const idx = h < 12 ? 0 : h < 18 ? 1 : 2;
        buckets[idx] += this.revenue(a);
      }
      return { breakdown: buckets, labels: ['Mañana', 'Tarde', 'Noche'] };
    }

    if (period === 'semana') {
      // L M M J V S D = índices 0..6
      const buckets = [0, 0, 0, 0, 0, 0, 0];
      for (const a of appointments) {
        const d = new Date(a.date + 'T00:00:00Z').getUTCDay(); // 0=Dom
        const idx = d === 0 ? 6 : d - 1;
        buckets[idx] += this.revenue(a);
      }
      return { breakdown: buckets, labels: ['L', 'M', 'M', 'J', 'V', 'S', 'D'] };
    }

    // mes
    const start = new Date(from + 'T00:00:00Z');
    const end = new Date(to + 'T00:00:00Z');
    const days = Math.round(
      (end.getTime() - start.getTime()) / (24 * 3600 * 1000),
    ) + 1;
    const buckets = new Array<number>(days).fill(0);
    for (const a of appointments) {
      const d = new Date(a.date + 'T00:00:00Z');
      const idx = Math.round(
        (d.getTime() - start.getTime()) / (24 * 3600 * 1000),
      );
      if (idx >= 0 && idx < days) {
        buckets[idx] += this.revenue(a);
      }
    }
    const labels = Array.from({ length: days }, (_, i) => String(i + 1));
    return { breakdown: buckets, labels };
  }

  async summary(
    tenantId: string,
    period: EarningsPeriod,
    refDateISO?: string,
  ): Promise<EarningsResult> {
    if (!['dia', 'semana', 'mes'].includes(period)) {
      throw new BadRequestException('period debe ser dia, semana o mes');
    }
    const tenant = await this.tenantsRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const ref = refDateISO ? new Date(refDateISO + 'T00:00:00Z') : new Date();
    const ranges = this.resolveRanges(period, ref);

    const [current, previous] = await Promise.all([
      this.fetchInRange(tenantId, ranges.from, ranges.to),
      this.fetchInRange(tenantId, ranges.prevFrom, ranges.prevTo),
    ]);

    const total = current.reduce((s, a) => s + this.revenue(a), 0);
    const prev = previous.reduce((s, a) => s + this.revenue(a), 0);

    const { breakdown, labels } = this.buildBreakdown(
      period,
      ranges.from,
      ranges.to,
      current,
    );

    // Por servicio
    const svc = new Map<
      string,
      { service_id: string | null; name: string; count: number; total: number }
    >();
    for (const a of current) {
      const key = a.service_id ?? '__none__';
      const entry = svc.get(key) ?? {
        service_id: a.service_id ?? null,
        name: a.service?.name ?? 'Sin servicio',
        count: 0,
        total: 0,
      };
      entry.count += 1;
      entry.total += this.revenue(a);
      svc.set(key, entry);
    }

    // Por profesional
    const pros = new Map<
      string,
      {
        resource_id: string | null;
        name: string;
        hue: number;
        count: number;
        total: number;
      }
    >();
    for (const a of current) {
      const key = a.resource_id ?? '__none__';
      const entry = pros.get(key) ?? {
        resource_id: a.resource_id ?? null,
        name: a.resource?.name ?? 'Sin asignar',
        hue: a.resource?.hue ?? 24,
        count: 0,
        total: 0,
      };
      entry.count += 1;
      entry.total += this.revenue(a);
      pros.set(key, entry);
    }

    return {
      period,
      label: ranges.label,
      range: { from: ranges.from, to: ranges.to },
      previousRange: { from: ranges.prevFrom, to: ranges.prevTo },
      total,
      prev,
      breakdown,
      labels,
      services: Array.from(svc.values()).sort((a, b) => b.total - a.total),
      pros: Array.from(pros.values()).sort((a, b) => b.total - a.total),
    };
  }
}
