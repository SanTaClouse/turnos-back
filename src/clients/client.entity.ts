import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToMany,
  OneToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Appointment } from '../appointments/appointment.entity';

@Entity('client')
@Index(['phone'], { unique: true })
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  picture: string;

  @Column({ nullable: true })
  auth0_id: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToMany(() => Tenant, (tenant) => tenant.clients)
  @JoinTable({
    name: 'tenant_client',
    joinColumn: { name: 'client_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tenant_id', referencedColumnName: 'id' },
  })
  tenants: Tenant[];

  @OneToMany(() => Appointment, (appointment) => appointment.client)
  appointments: Appointment[];
}
