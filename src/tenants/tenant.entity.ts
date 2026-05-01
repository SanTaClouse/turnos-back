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
