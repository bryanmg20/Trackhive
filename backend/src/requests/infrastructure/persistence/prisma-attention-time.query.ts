import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { IAttentionTimeQuery } from '../../application/ports/attention-time-query.port';
import { ATTENTION_TIME_STATES } from '../../domain/policies/attention-times';
import type { AttentionTimeAggregate } from '../../domain/policies/attention-times';
import type { ReportPeriod } from '../../domain/policies/report-period';

/** Aggregates in PostgreSQL: no requester identity or full histories leave the DB. */
@Injectable()
export class PrismaAttentionTimeQuery implements IAttentionTimeQuery {
  constructor(private readonly prisma: PrismaService) {}

  summarize({ start, end }: ReportPeriod): Promise<AttentionTimeAggregate[]> {
    const filters = [
      start ? Prisma.sql`r.registered_at >= ${start}` : null,
      end ? Prisma.sql`r.registered_at < ${end}` : null,
    ].filter((value): value is Prisma.Sql => value !== null);
    const period = filters.length
      ? Prisma.sql`AND ${Prisma.join(filters, ' AND ')}`
      : Prisma.empty;
    return this.prisma.$queryRaw<AttentionTimeAggregate[]>`
      WITH completed AS (
        SELECT r.id, r.registered_at AS received_at,
          COALESCE(MIN(h.changed_at), r.attended_at) AS attended_at
        FROM requests r
        LEFT JOIN status_history h ON h.request_id = r.id AND h.new_status = 'ATENDIDA'
        WHERE TRUE
          ${period}
        GROUP BY r.id
        HAVING COALESCE(MIN(h.changed_at), r.attended_at) >= r.registered_at
      ), intervals AS (
        SELECT h.request_id, h.new_status, h.changed_at, c.received_at, c.attended_at,
          LEAD(h.changed_at) OVER (
            PARTITION BY h.request_id ORDER BY h.changed_at, h.id
          ) AS next_at
        FROM status_history h JOIN completed c ON c.id = h.request_id
      ), residence AS (
        SELECT request_id, new_status,
          SUM(EXTRACT(EPOCH FROM (
            LEAST(COALESCE(next_at, attended_at), attended_at) - changed_at
          ))) AS seconds
        FROM intervals
        WHERE new_status IN (${Prisma.join([...ATTENTION_TIME_STATES])})
          AND changed_at >= received_at AND changed_at <= attended_at
        GROUP BY request_id, new_status
      )
      SELECT 'TOTAL' AS state, COUNT(*)::int AS "requestCount",
        AVG(EXTRACT(EPOCH FROM (attended_at - received_at)))::double precision AS "averageSeconds"
      FROM completed
      UNION ALL
      SELECT new_status AS state, COUNT(*)::int AS "requestCount",
        AVG(seconds)::double precision AS "averageSeconds"
      FROM residence GROUP BY new_status`;
  }
}
