import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  MonthlySummary,
  InsightCard,
  SummaryHero,
} from './monthly-summary.entity';
import { ExportsService, MonthlyDigest } from '../exports/exports.service';

const CURRENCY = (n: number): string => {
  if (n >= 1_000_000)
    return '$' + (n / 1_000_000).toFixed(2).replace('.', ',') + 'M';
  if (n >= 1000) return '$' + Math.round(n / 1000) + 'K';
  return '$' + Math.round(n);
};

const PCT = (a: number, b: number) =>
  b === 0 ? 0 : Math.round((a / b) * 100);

@Injectable()
export class AiSummariesService {
  private readonly logger = new Logger(AiSummariesService.name);

  constructor(
    @InjectRepository(MonthlySummary)
    private repo: Repository<MonthlySummary>,
    private exportsService: ExportsService,
  ) {}

  /**
   * Devuelve el resumen vigente: el del mes pasado, si existe.
   * Si todavía no se generó, devuelve null y el front oculta el banner.
   */
  async getCurrent(tenantId: string): Promise<MonthlySummary | null> {
    return this.repo.findOne({
      where: { tenant_id: tenantId },
      order: { month: 'DESC' },
    });
  }

  async getByMonth(
    tenantId: string,
    month: string,
  ): Promise<MonthlySummary | null> {
    return this.repo.findOne({
      where: { tenant_id: tenantId, month },
    });
  }

  /**
   * Genera (o regenera) el resumen mensual.
   *
   * IMPORTANTE — placeholder de IA: hoy las insights se computan
   * deterministícamente a partir del digest (no consumimos tokens). El día
   * que conectemos Claude, este método se reemplaza por una llamada al
   * SDK pasándole `digest` como input y parseando un JSON estructurado.
   *
   * Estimación cuando se conecte: ~$0.02-0.04 por mes/cliente con Haiku
   * (con prompt caching del contexto del tenant, baja aún más).
   */
  async generate(tenantId: string, month: string): Promise<MonthlySummary> {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month debe tener formato YYYY-MM');
    }

    const digest = await this.exportsService.buildMonthlyDigest(
      tenantId,
      month,
    );

    if (digest.totals.appointments === 0) {
      throw new BadRequestException(
        'No hay turnos confirmados en ese mes — no se puede generar resumen',
      );
    }

    const hero = this.buildHero(digest);
    const insights = this.buildInsights(digest);

    // Upsert por (tenant_id, month)
    const existing = await this.getByMonth(tenantId, month);
    if (existing) {
      existing.hero = hero;
      existing.insights = insights;
      existing.model = 'deterministic-v1';
      existing.generated_at = new Date();
      return this.repo.save(existing);
    }

    return this.repo.save(
      this.repo.create({
        tenant_id: tenantId,
        month,
        hero,
        insights,
        model: 'deterministic-v1',
      }),
    );
  }

  // ──────────── Builders ────────────

  private buildHero(digest: MonthlyDigest): SummaryHero {
    const prev = digest.previousMonth?.revenue ?? null;
    return {
      revenue: digest.totals.revenue,
      prev_revenue: prev,
      delta_pct:
        prev !== null && prev > 0
          ? Math.round(((digest.totals.revenue - prev) / prev) * 1000) / 10
          : null,
      appointments: digest.totals.appointments,
    };
  }

  private buildInsights(d: MonthlyDigest): InsightCard[] {
    const out: InsightCard[] = [];

    // 1. Profesional estrella
    const topPro = d.byResource[0];
    if (topPro && topPro.revenue > 0) {
      const share = PCT(topPro.revenue, d.totals.revenue);
      out.push({
        kind: 'top_resource',
        icon: 'crown',
        accent: '#c08a2e',
        accentBg: '#fbf3de',
        title: 'Tu profesional estrella',
        body: `${topPro.name} facturó ${CURRENCY(
          topPro.revenue,
        )} este mes — el ${share}% de la facturación total. Atendió a ${topPro.count} turnos en ${topPro.hours} horas de trabajo.`,
      });
    }

    // 2. Servicio más vendido
    const topSvc = d.byService[0];
    if (topSvc && topSvc.revenue > 0) {
      const share = PCT(topSvc.revenue, d.totals.revenue);
      const perDay = Math.round((topSvc.count / 30) * 10) / 10;
      out.push({
        kind: 'top_service',
        icon: 'trending',
        accent: '#1f8a5a',
        accentBg: '#e3f3e8',
        title: 'Tu servicio más vendido',
        body: `${topSvc.name} generó ${CURRENCY(
          topSvc.revenue,
        )} — el ${share}% de tus ingresos. ${topSvc.count} servicios al mes, promedio de ${perDay} por día.`,
      });
    }

    // 3. Mejor día
    if (d.bestDay) {
      const dayLabel = this.formatDayShort(d.bestDay.date);
      const dow = this.dayOfWeekLabel(d.bestDay.date);
      out.push({
        kind: 'best_day',
        icon: 'calendar',
        accent: '#e8725a',
        accentBg: '#fdece7',
        title: 'Tu mejor día',
        body: `Los ${dow}s son tu día más activo. El ${dow.toLowerCase()} ${dayLabel} hiciste ${d.bestDay.count} servicios, recaudando ${CURRENCY(d.bestDay.revenue)}.`,
      });
    }

    // 4. Día más flojo
    if (d.worstDay && d.worstDay.count > 0) {
      const dayLabel = this.formatDayShort(d.worstDay.date);
      const dow = this.dayOfWeekLabel(d.worstDay.date);
      out.push({
        kind: 'worst_day',
        icon: 'alert',
        accent: '#8a6a1a',
        accentBg: '#fbf3de',
        title: 'Tu día más flojo',
        body: `Los ${dow.toLowerCase()}s son tu día de menor actividad. Este mes tuviste un día especialmente flojo (${dow.toLowerCase()} ${dayLabel}, ${d.worstDay.count} servicios). Probá subir contenido el día anterior para levantar la demanda.`,
      });
    }

    // 5. Clientes más fieles
    const loyal = d.topClients.filter((c) => c.visits >= 2).slice(0, 2);
    if (loyal.length > 0) {
      const names = loyal.map((c) => c.name).join(' y ');
      const visits = loyal[0].visits;
      out.push({
        kind: 'loyal_clients',
        icon: 'user',
        accent: '#2a2926',
        accentBg: '#f0eee8',
        title: 'Tus clientes más fieles',
        body: `${names} ${
          loyal.length > 1 ? 'fueron' : 'fue'
        } ${visits} veces${loyal.length > 1 ? ' cada uno' : ''} este mes. Seguro les estás brindando un servicio excelente — pensá en un programa de referidos.`,
      });
    }

    // 6. Horario estrella
    const topHour = d.byHourBucket[0];
    if (topHour && topHour.count > 0) {
      const totalAppts = d.totals.appointments;
      const share = PCT(topHour.count, totalAppts);
      const hr = String(topHour.hour).padStart(2, '0');
      const next = String(topHour.hour + 2).padStart(2, '0');
      out.push({
        kind: 'top_hour',
        icon: 'clock',
        accent: '#5a6dac',
        accentBg: '#e6e9f4',
        title: 'Tu horario estrella',
        body: `El horario de ${hr}:00 a ${next}:00 concentra el ${share}% de los turnos. Considerá agregar un recurso en esa franja o subir el precio un 8%.`,
      });
    }

    return out;
  }

  private formatDayShort(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    const months = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
    return `${d} ${months[m - 1]}`;
  }

  private dayOfWeekLabel(iso: string): string {
    const d = new Date(iso + 'T00:00:00Z').getUTCDay();
    return [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ][d];
  }
}
