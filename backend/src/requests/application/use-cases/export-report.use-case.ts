import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_REPORT_RANKING_LIMIT } from '../../../common/pagination';
import { toReportPeriod } from '../../domain/policies/report-period';
import type { ExportReportInput } from '../dto/export-report.input';
import type { ReportCsvResponseDto } from '../dto/report-csv-response.dto';
import { ReportCsvMapper } from '../mappers/report-csv.mapper';
import { AttentionTimesResponseMapper } from '../mappers/attention-times-response.mapper';
import { MostRequestedMaterialsResponseMapper } from '../mappers/most-requested-materials-response.mapper';
import { ATTENTION_TIME_QUERY } from '../ports/attention-time-query.port';
import type { IAttentionTimeQuery } from '../ports/attention-time-query.port';
import type { IRequestQueryService } from '../ports/request-query.port';
import { REQUEST_QUERY_SERVICE } from '../tokens';

@Injectable()
export class ExportReportUseCase {
  constructor(
    @Inject(REQUEST_QUERY_SERVICE)
    private readonly queries: IRequestQueryService,
    @Inject(ATTENTION_TIME_QUERY)
    private readonly attentionQuery: IAttentionTimeQuery,
  ) {}

  async execute(input: ExportReportInput): Promise<ReportCsvResponseDto> {
    const period = toReportPeriod(input.from, input.to);
    if (input.report === 'most-requested-materials') {
      const limit = input.limit ?? DEFAULT_REPORT_RANKING_LIMIT;
      const result = await this.queries.findMostRequestedMaterials({
        period,
        limit,
      });
      const report = MostRequestedMaterialsResponseMapper.toDto(
        { from: input.from, to: input.to, limit },
        result,
      );
      return ReportCsvMapper.ranking(report, limit);
    }
    const rows = await this.attentionQuery.summarize(period);
    const report = AttentionTimesResponseMapper.toDto(
      { from: input.from, to: input.to },
      rows,
    );
    return ReportCsvMapper.attention(report);
  }
}
