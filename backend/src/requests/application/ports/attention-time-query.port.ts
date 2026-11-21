import type { AttentionTimeAggregate } from '../../domain/policies/attention-times';
import type { ReportPeriod } from '../../domain/policies/report-period';

export const ATTENTION_TIME_QUERY = Symbol('ATTENTION_TIME_QUERY');

export interface IAttentionTimeQuery {
  summarize(period: ReportPeriod): Promise<AttentionTimeAggregate[]>;
}
