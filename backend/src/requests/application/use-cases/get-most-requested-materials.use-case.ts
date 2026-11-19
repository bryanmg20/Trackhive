import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_REPORT_RANKING_LIMIT } from '../../../common/pagination';
import { toReportPeriod } from '../../domain/policies/report-period';
import type { MostRequestedMaterialsInput } from '../dto/most-requested-materials.input';
import { MostRequestedMaterialsResponseDto } from '../dto/most-requested-materials-response.dto';
import { MostRequestedMaterialsResponseMapper } from '../mappers/most-requested-materials-response.mapper';
import type { IRequestQueryService } from '../ports/request-query.port';
import { REQUEST_QUERY_SERVICE } from '../tokens';

/**
 * Ranks the materials by the number of requests registered in a period, so
 * the staff can prioritize their conservation (HU-26).
 */
@Injectable()
export class GetMostRequestedMaterialsUseCase {
  constructor(
    @Inject(REQUEST_QUERY_SERVICE)
    private readonly queries: IRequestQueryService,
  ) {}

  async execute(
    input: MostRequestedMaterialsInput,
  ): Promise<MostRequestedMaterialsResponseDto> {
    const period = toReportPeriod(input.from, input.to);
    const result = await this.queries.findMostRequestedMaterials({
      period,
      limit: input.limit ?? DEFAULT_REPORT_RANKING_LIMIT,
    });
    return MostRequestedMaterialsResponseMapper.toDto(input, result);
  }
}
