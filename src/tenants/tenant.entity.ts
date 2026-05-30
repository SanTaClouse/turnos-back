import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToMany,
  Index,
} from 'typeorm';
import { Availability } from '../availability/availability.entity';
import { Appointment } from '../appointments/appointment.entity';
import { BlockedSlot } from '../blocked-slots/blocked-slot.entity';
import { Client } from '../clients/client.entity';
import { Service } from '../services/service.entity';
import { Resource } from '../resources/resource.entity';

@Entity('tenant')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string; // URL-friendly identifier (ej: "peluqueria-carlos")

  @Column()
  whatsapp_number: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  @Column({ default: 'America/Argentina/Buenos_Aires' })
  timezone: string;

  @Column({ default: 'ARS' })
  currency: string;

  @Column({ default: 'es-AR' })
  locale: string;

  @Column({ default: '+54', nullable: true })
  country_code: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  logo_url: string;

  @Column({ nullable: true })
  cover_url: string;

  @Column({ default: true })
  is_public: boolean;

  // ───────────────────────── Billing / Suscripción ─────────────────────────
  // 'free'      → dentro del límite gratis (primeros N clientes)
  // 'active'    → suscripción de Mercado Pago vigente (paga $20.000/mes)
  // 'past_due'  → MP no pudo cobrar el último período (reintentando)
  // 'cancelled' → suscripción cancelada por el dueño o por MP
  @Column({ default: 'free' })
  plan_status: 'free' | 'active' | 'past_due' | 'cancelled';

  // Override manual del dueño de la plataforma (vos): si es true, este tenant
  // NUNCA paga ni ve el modal de bloqueo, sin importar cuántos clientes tenga.
  // Para los conocidos a los que les dejás la app gratis.
  @Column({ default: false })
  billing_exempt: boolean;

  // Cantidad de clientes gratis antes de exigir suscripción. Configurable por
  // tenant por si querés dar más cupo a alguno puntual.
  @Column({ type: 'int', default: 30 })
  free_client_limit: number;

  // ID del preapproval (suscripción) en Mercado Pago. Lo usamos para conciliar
  // los webhooks de cobro recurrente con el tenant.
  @Column({ type: 'varchar', nullable: true })
  mp_preapproval_id: string | null;

  @Column({ type: 'timestamp', nullable: true })
  subscription_started_at: Date | null;

  // Hasta cuándo está paga la suscripción. Si la fecha pasó y no llegó un
  // nuevo cobro, el cron/webhook la pasa a 'past_due'.
  @Column({ type: 'timestamp', nullable: true })
  current_period_end: Date | null;

  // Fin del período de gracia. Cuando un tenant tiene que pagar (superó el cupo
  // o se le rechazó el cobro), NO lo bloqueamos de una: le damos ~1 mes para
  // pagar mientras le mandamos recordatorios. Si esta fecha pasa y sigue sin
  // pagar, recién ahí se bloquea el panel.
  @Column({ type: 'timestamp', nullable: true })
  grace_until: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Availability, (availability) => availability.tenant)
  availabilities: Availability[];

  @OneToMany(() => Appointment, (appointment) => appointment.tenant)
  appointments: Appointment[];

  @OneToMany(() => BlockedSlot, (blockedSlot) => blockedSlot.tenant)
  blockedSlots: BlockedSlot[];

  @ManyToMany(() => Client, (client) => client.tenants)
  clients: Client[];

  @OneToMany(() => Service, (service) => service.tenant)
  services: Service[];

  @OneToMany(() => Resource, (resource) => resource.tenant)
  resources: Resource[];
}
