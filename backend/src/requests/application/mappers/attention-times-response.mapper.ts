import { summarizeAttentionTimes } from '../../domain/policies/attention-times';
import type { AttentionTimeAggregate } from '../../domain/policies/attention-times';
import type { AttentionTimesInput } from '../dto/attention-times.input';
import type { AttentionTimesResponseDto } from '../dto/attention-times-response.dto';

export class AttentionTimesResponseMapper {
  static toDto(
    input: AttentionTimesInput,
    rows: readonly AttentionTimeAggregate[],
  ): AttentionTimesResponseDto {
    return {
      from: input.from ?? null,
      to: input.to ?? null,
      ...summarizeAttentionTimes(rows),
    };
  }
}
