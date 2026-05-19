import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { ExportLog } from './export-log.entity';
import { Appointment } from '../appointments/appointment.entity';
import { Tenant } from '../tenants/tenant.entity';
import { Service } from '../services/service.entity';
import { Resource } from '../resources/resource.entity';
import { Client } from '../clients/client.entity';

const DEFAULT_STATUS = 'confirmed';

interface ExportParams {
  tenantId: string;
  from: string;
  to: string;
  status?: string;
  exportedBy?: string | null;
}

export interface PreviewResult {
  rowCount: number;
  totalRevenue: number;
  hash: string;
  duplicates: {
    exactRange: ExportLogSummary | null;
    exactRows: ExportLogSummary | null;
    overlappingRanges: ExportLogSummary[];
  };
}

export interface ExportLogSummary {
  id: string;
  range_from: string;
  range_to: string;
  status_filter: string;
  row_count: number;
  created_at: Date;
  exported_by: string | null;
}

export interface MonthlyDigest {
  tenant: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currency: string;
    locale: string;
  };
  month: string; // YYYY-MM
  range: { from: string; to: string };
  totals: {
    revenue: number;
    appointments: number;
    uniqueClients: number;
    workingHours: number;
  };
  previousMonth: {
    revenue: number;
    appointments: number;
  } | null;
  byService: Array<{
    service_id: string | null;
    name: string;
    count: number;
    revenue: number;
  }>;
  byResource: Array<{
    resource_id: string | null;
    name: string;
    count: number;
    revenue: number;
    hours: number;
  }>;
  byDayOfWeek: Array<{
    dow: number; // 0 = sunday
    label: string;
    count: number;
    revenue: number;
  }>;
  byHourBucket: Array<{
    hour: number;
    count: number;
    revenue: number;
  }>;
  topClients: Array<{
    client_id: string | null;
    name: string;
    visits: number;
  }>;
  bestDay: {
    date: string;
    count: number;
    revenue: number;
  } | null;
  worstDay: {
    date: string;
    count: number;
    revenue: number;
  } | null;
}

@Injectable()
export class ExportsService {
  constructor(
    @InjectRepository(ExportLog) private logsRepo: Repository<ExportLog>,
    @InjectRepository(Appointment)
    private appointmentsRepo: Repository<Appointment>,
    @InjectRepository(Tenant) private tenantsRepo: Repository<Tenant>,
  ) {}

  // ──────────── Helpers ────────────

  private parseStatusList(status?: string): string[] {
    const raw = (status ?? DEFAULT_STATUS)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return raw.length ? raw : [DEFAULT_STATUS];
  }

  private validateRange(from: string, to: string) {
    if (!from || !to) {
      throw new BadRequestException('from y to son requeridos (YYYY-MM-DD)');
    }
    if (from > to) {
      throw new BadRequestException('from debe ser anterior o igual a to');
    }
  }

  private async fetchAppointmentsInRange(
    tenantId: string,
    from: string,
    to: string,
    statuses: string[],
  ): Promise<Appointment[]> {
    return this.appointmentsRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.client', 'client')
      .leftJoinAndSelect('a.service', 'service')
      .leftJoinAndSelect('a.resource', 'resource')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.date BETWEEN :from AND :to', { from, to })
      .andWhere('a.status IN (:...statuses)', { statuses })
      .orderBy('a.date', 'ASC')
      .addOrderBy('a.time', 'ASC')
      .getMany();
  }

  private hashAppointmentIds(ids: string[]): string {
    const sorted = [...ids].sort();
    return createHash('sha256').update(sorted.join('|')).digest('hex');
  }

  private summarize(log: ExportLog): ExportLogSummary {
    return {
      id: log.id,
      range_from: log.range_from,
      range_to: log.range_to,
      status_filter: log.status_filter,
      row_count: log.row_count,
      created_at: log.created_at,
      exported_by: log.exported_by,
    };
  }

  private serviceRevenue(a: Appointment): number {
    const price = a.service?.price;
    if (price === null || price === undefined) return 0;
    return typeof price === 'string' ? parseFloat(price) : Number(price);
  }

  private minutesBetween(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return eh * 60 + em - (sh * 60 + sm);
  }

  // ──────────── Preview ────────────

  async preview(params: ExportParams): Promise<PreviewResult> {
    this.validateRange(params.from, params.to);
    const statuses = this.parseStatusList(params.status);
    const statusKey = statuses.slice().sort().join(',');

    const appointments = await this.fetchAppointmentsInRange(
      params.tenantId,
      params.from,
      params.to,
      statuses,
    );

    const ids = appointments.map((a) => a.id);
    const hash = this.hashAppointmentIds(ids);
    const totalRevenue = appointments.reduce(
      (sum, a) => sum + this.serviceRevenue(a),
      0,
    );

    const tenantLogs = await this.logsRepo.find({
      where: { tenant_id: params.tenantId, status: 'success' },
      order: { created_at: 'DESC' },
      take: 50,
    });

    const exactRange =
      tenantLogs.find(
        (l) =>
          l.range_from === params.from &&
          l.range_to === params.to &&
          l.status_filter === statusKey,
      ) ?? null;

    const exactRows =
      ids.length > 0
        ? (tenantLogs.find((l) => l.row_hash === hash) ?? null)
        : null;

    const overlappingRanges = tenantLogs.filter((l) => {
      if (l.id === exactRange?.id) return false;
      return l.range_from <= params.to && l.range_to >= params.from;
    });

    return {
      rowCount: appointments.length,
      totalRevenue,
      hash,
      duplicates: {
        exactRange: exactRange ? this.summarize(exactRange) : null,
        exactRows: exactRows ? this.summarize(exactRows) : null,
        overlappingRanges: overlappingRanges
          .slice(0, 5)
          .map((l) => this.summarize(l)),
      },
    };
  }

  // ──────────── Excel stream ────────────

  /**
   * Streams an .xlsx file directly to the Express Response.
   * El archivo NUNCA se guarda en disco ni en cloud — se genera en memoria
   * vía exceljs WorkbookWriter y se va escribiendo a `res` mientras se lee
   * la query. Logueamos metadatos sólo después de que el stream cerró bien.
   */
  async streamAppointmentsExcel(
    params: ExportParams & { confirm?: boolean },
    res: Response,
  ): Promise<void> {
    this.validateRange(params.from, params.to);
    const statuses = this.parseStatusList(params.status);
    const statusKey = statuses.slice().sort().join(',');

    const tenant = await this.tenantsRepo.findOne({
      where: { id: params.tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const appointments = await this.fetchAppointmentsInRange(
      params.tenantId,
      params.from,
      params.to,
      statuses,
    );
    const ids = appointments.map((a) => a.id);
    const hash = this.hashAppointmentIds(ids);

    // Detección de duplicados — bloquea si el cliente no confirmó.
    if (!params.confirm) {
      const prev = await this.logsRepo.find({
        where: { tenant_id: params.tenantId, status: 'success' },
        order: { created_at: 'DESC' },
        take: 20,
      });
      const exactRange = prev.find(
        (l) =>
          l.range_from === params.from &&
          l.range_to === params.to &&
          l.status_filter === statusKey,
      );
      const exactRows =
        ids.length > 0 ? prev.find((l) => l.row_hash === hash) : null;
      if (exactRange || exactRows) {
        throw new ConflictException({
          message: 'Este rango/contenido ya fue exportado',
          duplicates: {
            exactRange: exactRange ? this.summarize(exactRange) : null,
            exactRows: exactRows ? this.summarize(exactRows) : null,
          },
        });
      }
    }

    const fileName = `turnos-${tenant.slug}-${params.from}_${params.to}.xlsx`;

    // Pre-registramos el log como pending. Si el stream falla, queda como
    // failed (lo marcamos en el catch). Si termina ok, lo promovemos a
    // success con row_count/row_hash finales.
    const log = await this.logsRepo.save(
      this.logsRepo.create({
        tenant_id: params.tenantId,
        range_from: params.from,
        range_to: params.to,
        status_filter: statusKey,
        row_count: appointments.length,
        row_hash: hash,
        file_name: fileName,
        exported_by: params.exportedBy ?? null,
        status: 'pending',
      }),
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`,
    );

    try {
      const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
        stream: res,
        useStyles: true,
      });
      workbook.creator = tenant.name;
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Turnos');
      sheet.columns = [
        { header: 'Fecha', key: 'date', width: 12 },
        { header: 'Hora', key: 'time', width: 8 },
        { header: 'Cliente', key: 'client', width: 26 },
        { header: 'Teléfono', key: 'phone', width: 16 },
        { header: 'Servicio', key: 'service', width: 22 },
        { header: 'Profesional', key: 'resource', width: 18 },
        { header: 'Duración (min)', key: 'duration', width: 14 },
        { header: 'Precio', key: 'price', width: 12 },
        { header: 'Estado', key: 'status', width: 12 },
        { header: 'Origen', key: 'source', width: 10 },
        { header: 'Notas', key: 'notes', width: 30 },
      ];
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).commit();

      for (const a of appointments) {
        sheet
          .addRow({
            date: a.date,
            time: a.time,
            client: a.client?.name ?? '',
            phone: a.client?.phone ?? '',
            service: a.service?.name ?? '',
            resource: a.resource?.name ?? '',
            duration: a.end_time
              ? this.minutesBetween(a.time, a.end_time)
              : '',
            price: this.serviceRevenue(a),
            status: a.status,
            source: a.source,
            notes: a.notes ?? '',
          })
          .commit();
      }

      // Hoja resumen
      const summary = workbook.addWorksheet('Resumen');
      summary.columns = [
        { header: 'Métrica', key: 'k', width: 28 },
        { header: 'Valor', key: 'v', width: 18 },
      ];
      summary.getRow(1).font = { bold: true };
      summary.getRow(1).commit();
      const totalRevenue = appointments.reduce(
        (s, a) => s + this.serviceRevenue(a),
        0,
      );
      const uniqueClients = new Set(
        appointments.map((a) => a.client_id).filter(Boolean),
      ).size;
      summary.addRow({ k: 'Rango', v: `${params.from} → ${params.to}` }).commit();
      summary.addRow({ k: 'Turnos exportados', v: appointments.length }).commit();
      summary.addRow({ k: 'Clientes únicos', v: uniqueClients }).commit();
      summary.addRow({ k: 'Facturación total', v: totalRevenue }).commit();
      summary.addRow({ k: 'Estados incluidos', v: statusKey }).commit();
      summary
        .addRow({
          k: 'Generado',
          v: new Date().toISOString().slice(0, 19).replace('T', ' '),
        })
        .commit();
      await sheet.commit();
      await summary.commit();
      await workbook.commit();

      log.status = 'success';
      await this.logsRepo.save(log);
    } catch (err) {
      log.status = 'failed';
      await this.logsRepo.save(log).catch(() => undefined);
      throw err;
    }
  }

  // ──────────── History ────────────

  async listHistory(tenantId: string, limit = 20) {
    const logs = await this.logsRepo.find({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return logs.map((l) => this.summarize(l));
  }

  // ──────────── Monthly digest (para IA) ────────────

  /**
   * Estructura de datos lista para enviar al modelo Claude.
   * NO hace la llamada — sólo arma la representación numérica del mes,
   * los rankings de servicios/profesionales/clientes y los días/horarios
   * notables. La generación del resumen textual vive en ai-summaries.
   */
  async buildMonthlyDigest(
    tenantId: string,
    month: string, // YYYY-MM
  ): Promise<MonthlyDigest> {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month debe tener formato YYYY-MM');
    }
    const tenant = await this.tenantsRepo.findOne({
      where: { id: tenantId },
    });
    if (!tenant) throw new NotFoundException('Tenant no encontrado');

    const [year, mon] = month.split('-').map(Number);
    const from = `${year}-${String(mon).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const to = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const prevMon = mon === 1 ? 12 : mon - 1;
    const prevYear = mon === 1 ? year - 1 : year;
    const prevFrom = `${prevYear}-${String(prevMon).padStart(2, '0')}-01`;
    const prevLast = new Date(Date.UTC(prevYear, prevMon, 0)).getUTCDate();
    const prevTo = `${prevYear}-${String(prevMon).padStart(2, '0')}-${String(prevLast).padStart(2, '0')}`;

    const statuses = ['confirmed'];
    const [current, previous] = await Promise.all([
      this.fetchAppointmentsInRange(tenantId, from, to, statuses),
      this.fetchAppointmentsInRange(tenantId, prevFrom, prevTo, statuses),
    ]);

    const totalRevenue = current.reduce(
      (s, a) => s + this.serviceRevenue(a),
      0,
    );
    const workingMinutes = current.reduce(
      (s, a) =>
        s + (a.end_time && a.time ? this.minutesBetween(a.time, a.end_time) : 0),
      0,
    );
    const uniqueClients = new Set(
      current.map((a) => a.client_id).filter(Boolean) as string[],
    ).size;

    // Por servicio
    const svc = new Map<
      string,
      { service_id: string | null; name: string; count: number; revenue: number }
    >();
    for (const a of current) {
      const key = a.service_id ?? '__none__';
      const entry = svc.get(key) ?? {
        service_id: a.service_id ?? null,
        name: a.service?.name ?? 'Sin servicio',
        count: 0,
        revenue: 0,
      };
      entry.count += 1;
      entry.revenue += this.serviceRevenue(a);
      svc.set(key, entry);
    }

    // Por profesional
    const res = new Map<
      string,
      {
        resource_id: string | null;
        name: string;
        count: number;
        revenue: number;
        minutes: number;
      }
    >();
    for (const a of current) {
      const key = a.resource_id ?? '__none__';
      const entry = res.get(key) ?? {
        resource_id: a.resource_id ?? null,
        name: a.resource?.name ?? 'Sin asignar',
        count: 0,
        revenue: 0,
        minutes: 0,
      };
      entry.count += 1;
      entry.revenue += this.serviceRevenue(a);
      entry.minutes += a.end_time
        ? this.minutesBetween(a.time, a.end_time)
        : 0;
      res.set(key, entry);
    }

    // Por día de semana
    const dow = new Map<number, { count: number; revenue: number }>();
    const dowLabels = [
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ];
    for (const a of current) {
      // Usamos UTC para evitar shifts por timezone del server
      const d = new Date(a.date + 'T00:00:00Z').getUTCDay();
      const entry = dow.get(d) ?? { count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += this.serviceRevenue(a);
      dow.set(d, entry);
    }

    // Por hora (bucket de 1h, según el time de inicio)
    const hours = new Map<number, { count: number; revenue: number }>();
    for (const a of current) {
      const h = parseInt(a.time.split(':')[0], 10);
      const entry = hours.get(h) ?? { count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += this.serviceRevenue(a);
      hours.set(h, entry);
    }

    // Top clientes
    const cli = new Map<
      string,
      { client_id: string | null; name: string; visits: number }
    >();
    for (const a of current) {
      const key = a.client_id ?? '__anon__';
      const entry = cli.get(key) ?? {
        client_id: a.client_id ?? null,
        name: a.client?.name ?? 'Anónimo',
        visits: 0,
      };
      entry.visits += 1;
      cli.set(key, entry);
    }

    // Mejor / peor día
    const byDay = new Map<string, { count: number; revenue: number }>();
    for (const a of current) {
      const entry = byDay.get(a.date) ?? { count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += this.serviceRevenue(a);
      byDay.set(a.date, entry);
    }
    let best: { date: string; count: number; revenue: number } | null = null;
    let worst: { date: string; count: number; revenue: number } | null = null;
    for (const [date, v] of byDay) {
      if (!best || v.revenue > best.revenue) best = { date, ...v };
      if (!worst || v.count < worst.count) worst = { date, ...v };
    }

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        timezone: tenant.timezone,
        currency: tenant.currency,
        locale: tenant.locale,
      },
      month,
      range: { from, to },
      totals: {
        revenue: totalRevenue,
        appointments: current.length,
        uniqueClients,
        workingHours: Math.round((workingMinutes / 60) * 10) / 10,
      },
      previousMonth:
        previous.length > 0
          ? {
              revenue: previous.reduce(
                (s, a) => s + this.serviceRevenue(a),
                0,
              ),
              appointments: previous.length,
            }
          : null,
      byService: Array.from(svc.values()).sort(
        (a, b) => b.revenue - a.revenue,
      ),
      byResource: Array.from(res.values())
        .map((r) => ({
          resource_id: r.resource_id,
          name: r.name,
          count: r.count,
          revenue: r.revenue,
          hours: Math.round((r.minutes / 60) * 10) / 10,
        }))
        .sort((a, b) => b.revenue - a.revenue),
      byDayOfWeek: Array.from(dow.entries())
        .map(([d, v]) => ({
          dow: d,
          label: dowLabels[d],
          count: v.count,
          revenue: v.revenue,
        }))
        .sort((a, b) => b.revenue - a.revenue),
      byHourBucket: Array.from(hours.entries())
        .map(([h, v]) => ({ hour: h, count: v.count, revenue: v.revenue }))
        .sort((a, b) => b.count - a.count),
      topClients: Array.from(cli.values())
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 5),
      bestDay: best,
      worstDay: worst,
    };
  }
}
