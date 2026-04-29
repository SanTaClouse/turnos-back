import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Appointment } from '../appointments/appointment.entity';
import { Client } from '../clients/client.entity';

@Entity('notification_log')
@Index(['tenant_id'])
@Index(['client_id'])
@Index(['appointment_id'])
@Index(['channel'])
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column()
  tenant_id: string;

  @ManyToOne(() => Client, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ nullable: true })
  client_id: string;

  @ManyToOne(() => Appointment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'appointment_id' })
  appointment: Appointment;

  @Column({ nullable: true })
  appointment_id: string;

  @Column()
  type: string; // 'appointment.created', 'appointment.reminder.24h', 'appointment.reminder.2h', 'appointment.cancelled', etc.

  @Column()
  channel: string; // 'push', 'email', 'whatsapp', 'sms'

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ default: false })
  sent: boolean;

  @Column({ nullable: true })
  error: string; // Si falló el envío

  @Column({ default: false })
  read: boolean; // Para notificaciones in-app

  @CreateDateColumn()
  created_at: Date;

  @Column({ nullable: true })
  sent_at: Date;

  @Column({ nullable: true })
  read_at: Date;
}
