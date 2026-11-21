import { Inject, Injectable } from '@nestjs/common';
import { toReportPeriod } from '../../domain/policies/report-period';
import type { AttentionTimesInput } from '../dto/attention-times.input';
import type { AttentionTimesResponseDto } from '../dto/attention-times-response.dto';
import { AttentionTimesResponseMapper } from '../mappers/attention-times-response.mapper';
import { ATTENTION_TIME_QUERY } from '../ports/attention-time-query.port';
import type { IAttentionTimeQuery } from '../ports/attention-time-query.port';

@Injectable()
export class GetAttentionTimesUseCase {
  constructor(
    @Inject(ATTENTION_TIME_QUERY) private readonly query: IAttentionTimeQuery,
  ) {}

  async execute(
    input: AttentionTimesInput,
  ): Promise<AttentionTimesResponseDto> {
    const rows = await this.query.summarize(
      toReportPeriod(input.from, input.to),
    );
    return AttentionTimesResponseMapper.toDto(input, rows);
  }
}
