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

@Entity('blocked_slot')
@Index(['tenant_id', 'date'])
export class BlockedSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('date')
  date: string; // YYYY-MM-DD format (start date)

  @Column('date', { nullable: true })
  end_date: string; // YYYY-MM-DD format (for multi-day blocks like vacations, null = single day)

  @Column('time', { nullable: true })
  start_time: string; // HH:MM format (null = entire day blocked)

  @Column('time', { nullable: true })
  end_time: string; // HH:MM format (null = entire day blocked)

  @Column({ nullable: true })
  reason: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.blockedSlots, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column()
  tenant_id: string;

  @ManyToOne(() => Resource, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'resource_id' })
  resource: Resource;

  @Column({ nullable: true })
  resource_id: string; // null = blocks ALL resources for this tenant
}
