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

@Entity('push_subscription')
@Index(['tenant_id'])
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column()
  tenant_id: string;

  @Column({ type: 'text' })
  endpoint: string; // Push service endpoint URL

  @Column({ type: 'json' })
  keys: {
    p256dh: string;
    auth: string;
  };

  @CreateDateColumn()
  created_at: Date;
}
