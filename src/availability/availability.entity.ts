import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Resource } from '../resources/resource.entity';

@Entity('availability')
@Index(['resource_id', 'day_of_week'])
export class Availability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  day_of_week: number; // 0 = sunday, 1 = monday, ..., 6 = saturday

  @Column('time')
  start_time: string; // HH:MM format

  @Column('time')
  end_time: string; // HH:MM format

  @Column()
  slot_duration: number; // minutes - granularity of the schedule

  @ManyToOne(() => Tenant, (tenant) => tenant.availabilities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column()
  tenant_id: string;

  @ManyToOne(() => Resource, (resource) => resource.availabilities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'resource_id' })
  resource: Resource;

  @Column()
  resource_id: string;
}
