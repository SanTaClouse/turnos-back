import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockedSlot } from './blocked-slot.entity';
import { BlockedSlotsController } from './blocked-slots.controller';
import { BlockedSlotsService } from './blocked-slots.service';

@Module({
  imports: [TypeOrmModule.forFeature([BlockedSlot])],
  controllers: [BlockedSlotsController],
  providers: [BlockedSlotsService],
  exports: [BlockedSlotsService],
})
export class BlockedSlotsModule {}
