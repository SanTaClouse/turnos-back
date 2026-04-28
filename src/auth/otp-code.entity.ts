import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('otp_code')
@Index(['email', 'consumed_at'])
export class OtpCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column({ length: 6 })
  code: string;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  consumed_at: Date | null;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @CreateDateColumn()
  created_at: Date;
}
