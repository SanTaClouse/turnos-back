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

export interface InsightCard {
  kind:
    | 'top_resource'
    | 'top_service'
    | 'best_day'
    | 'worst_day'
    | 'loyal_clients'
    | 'top_hour';
  icon: string;
  accent: string;
  accentBg: string;
  title: string;
  body: string;
}

export interface SummaryHero {
  revenue: number;
  prev_revenue: number | null;
  delta_pct: number | null;
  appointments: number;
}

@Entity('monthly_summary')
@Index(['tenant_id', 'month'], { unique: true })
export class MonthlySummary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column()
  tenant_id: string;

  @Column({ length: 7 })
  month: string; // YYYY-MM

  @Column({ type: 'jsonb' })
  hero: SummaryHero;

  @Column({ type: 'jsonb' })
  insights: InsightCard[];

  @Column({ default: 'deterministic-v1' })
  model: string;

  @Column({ type: 'int', nullable: true })
  input_tokens: number | null;

  @Column({ type: 'int', nullable: true })
  output_tokens: number | null;

  @CreateDateColumn()
  generated_at: Date;
}
