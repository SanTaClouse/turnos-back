import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Client } from '../clients/client.entity';
import { Service } from '../services/service.entity';
import { Resource } from '../resources/resource.entity';

@Entity('appointment')
// Safety net: prevents exact duplicate bookings for the same resource+date+time.
// NOTE: This does NOT prevent overlapping multi-slot services (e.g. 60min at 10:00
// vs 30min at 10:30). Overlap validation is handled in AppointmentsService.create().
@Index(['resource_id', 'date', 'time'], { unique: true })
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('date')
  date: string; // YYYY-MM-DD format

  @Column('time')
  time: string; // HH:MM format (start time)

  @Column('time')
  end_time: string; // HH:MM format (calculated: time + service.duration + service.buffer)

  @Column({
    default: 'pending',
  })
  status: string; // pending, confirmed, cancelled

  @Column({ default: 'whatsapp' })
  source: string; // 'whatsapp', 'web', 'manual'

  @Column({ type: 'text', nullable: true })
  notes: string; // free-text notes from client or business

  @Column({ type: 'varchar', nullable: true })
  verification_token: string; // JWT token for email verification link

  @Column({ type: 'timestamp', nullable: true })
  token_expires_at: Date; // Token expiration time (7 days)

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.appointments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column()
  tenant_id: string;

  @ManyToOne(() => Client, (client) => client.appointments, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ nullable: true })
  client_id: string;

  @ManyToOne(() => Service, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ nullable: true })
  service_id: string;

  @ManyToOne(() => Resource, (resource) => resource.appointments, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'resource_id' })
  resource: Resource;

  @Column({ nullable: true })
  resource_id: string;
}
