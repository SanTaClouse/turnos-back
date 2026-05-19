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

@Entity('export_log')
@Index(['tenant_id', 'created_at'])
export class ExportLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column()
  tenant_id: string;

  @Column('date')
  range_from: string;

  @Column('date')
  range_to: string;

  @Column({ default: 'confirmed' })
  status_filter: string;

  @Column({ type: 'int', default: 0 })
  row_count: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  row_hash: string | null;

  @Column()
  file_name: string;

  @Column({ type: 'varchar', nullable: true })
  exported_by: string | null;

  @Column({ default: 'success' })
  status: 'pending' | 'success' | 'failed';

  @CreateDateColumn()
  created_at: Date;
}
