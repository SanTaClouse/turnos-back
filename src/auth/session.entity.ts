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

@Entity('session')
@Index(['tenant_id', 'revoked_at'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  token_hash: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column()
  tenant_id: string;

  @Column({ type: 'text', nullable: true })
  device_label: string | null;

  @Column({ type: 'text', nullable: true })
  user_agent: string | null;

  @Column({ type: 'text', nullable: true })
  ip: string | null;

  @Column({ type: 'timestamp', nullable: true })
  last_used_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  revoked_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
