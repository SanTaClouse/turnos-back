import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';

/**
 * Registro de cada cobro/evento recibido de Mercado Pago.
 *
 * Sirve para dos cosas:
 *  1) Idempotencia: MP reenvía la misma notificación varias veces. Antes de
 *     procesar buscamos por `mp_payment_id` para no duplicar el efecto.
 *  2) Auditoría: guardamos el payload crudo por si hay que conciliar a mano.
 */
@Entity('payment')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'uuid', nullable: true })
  tenant_id: string | null;

  // ID del pago en Mercado Pago (único por cobro). Clave de idempotencia.
  @Column({ type: 'varchar', unique: true })
  @Index()
  mp_payment_id: string;

  // ID del preapproval (suscripción) que originó el cobro, si aplica.
  @Column({ type: 'varchar', nullable: true })
  mp_preapproval_id: string | null;

  // approved | pending | rejected | refunded | cancelled (lo que mande MP)
  @Column({ type: 'varchar' })
  status: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  amount: string | null;

  @Column({ type: 'varchar', default: 'ARS' })
  currency: string;

  // Payload crudo del pago tal como lo devolvió la API de MP.
  @Column({ type: 'jsonb', nullable: true })
  raw_payload: unknown;

  @CreateDateColumn()
  created_at: Date;
}
