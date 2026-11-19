import { competitionRanks } from '../../domain/policies/report-period';
import type { MostRequestedMaterialsInput } from '../dto/most-requested-materials.input';
import { MostRequestedMaterialsResponseDto } from '../dto/most-requested-materials-response.dto';
import type { MostRequestedMaterialsResult } from '../ports/request-query.port';

/** Translates the ranking of «Material más solicitado» to its DTO (HU-26). */
export class MostRequestedMaterialsResponseMapper {
  static toDto(
    input: MostRequestedMaterialsInput,
    result: MostRequestedMaterialsResult,
  ): MostRequestedMaterialsResponseDto {
    const ranks = competitionRanks(
      result.items.map((item) => item.requestCount),
    );
    return {
      from: input.from ?? null,
      to: input.to ?? null,
      totalRequests: result.totalRequests,
      items: result.items.map((item, index) => ({
        rank: ranks[index],
        materialId: item.materialId,
        catalogCode: item.catalogCode,
        title: item.title,
        materialType: item.materialType,
        requestCount: item.requestCount,
      })),
    };
  }
}
