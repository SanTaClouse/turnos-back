import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Resource } from '../resources/resource.entity';

@Entity('service')
@Index(['tenant_id', 'name'], { unique: true })
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  duration_minutes: number;

  @Column({ default: 0 })
  buffer_minutes: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  price: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.services, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column()
  tenant_id: string;

  @ManyToMany(() => Resource, (resource) => resource.services)
  resources: Resource[];
}
