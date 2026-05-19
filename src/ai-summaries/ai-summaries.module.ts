import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonthlySummary } from './monthly-summary.entity';
import { AiSummariesController } from './ai-summaries.controller';
import { AiSummariesService } from './ai-summaries.service';
import { ExportsModule } from '../exports/exports.module';

@Module({
  imports: [TypeOrmModule.forFeature([MonthlySummary]), ExportsModule],
  controllers: [AiSummariesController],
  providers: [AiSummariesService],
  exports: [AiSummariesService],
})
export class AiSummariesModule {}
