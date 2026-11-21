import { Injectable } from '@nestjs/common';
import { DEFAULT_REPORT_RANKING_LIMIT } from '../../../common/pagination';
import type { ExportReportInput } from '../dto/export-report.input';
import type { ReportCsvResponseDto } from '../dto/report-csv-response.dto';
import { ReportCsvMapper } from '../mappers/report-csv.mapper';
import { GetMostRequestedMaterialsUseCase } from './get-most-requested-materials.use-case';
import { GetAttentionTimesUseCase } from './get-attention-times.use-case';

@Injectable()
export class ExportReportUseCase {
  constructor(
    private readonly ranking: GetMostRequestedMaterialsUseCase,
    private readonly attention: GetAttentionTimesUseCase,
  ) {}

  async execute(input: ExportReportInput): Promise<ReportCsvResponseDto> {
    if (input.report === 'most-requested-materials') {
      const limit = input.limit ?? DEFAULT_REPORT_RANKING_LIMIT;
      const report = await this.ranking.execute({
        from: input.from,
        to: input.to,
        limit,
      });
      return ReportCsvMapper.ranking(report, limit);
    }
    const report = await this.attention.execute({
      from: input.from,
      to: input.to,
    });
    return ReportCsvMapper.attention(report);
  }
}
