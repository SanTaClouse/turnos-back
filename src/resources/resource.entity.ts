import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  ManyToMany,
  OneToMany,
  JoinTable,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Service } from '../services/service.entity';
import { Availability } from '../availability/availability.entity';
import { Appointment } from '../appointments/appointment.entity';

@Entity('resource')
@Index(['tenant_id', 'name'], { unique: true })
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  role: string; // ej: "Barbero senior", "Terapeuta"

  @Column({ type: 'int', default: 24 })
  hue: number; // 0-360, para color del avatar

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.resources, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column()
  tenant_id: string;

  @ManyToMany(() => Service, (service) => service.resources)
  @JoinTable({
    name: 'resource_service',
    joinColumn: { name: 'resource_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'service_id', referencedColumnName: 'id' },
  })
  services: Service[];

  @OneToMany(() => Availability, (availability) => availability.resource)
  availabilities: Availability[];

  @OneToMany(() => Appointment, (appointment) => appointment.resource)
  appointments: Appointment[];
}
