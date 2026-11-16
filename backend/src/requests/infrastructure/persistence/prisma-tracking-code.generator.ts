import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ITrackingCodeGenerator } from '../../application/ports/tracking-code-generator.port';

/** SOL-<year>-<number>, from a PostgreSQL sequence (RN-01). */
@Injectable()
export class PrismaTrackingCodeGenerator implements ITrackingCodeGenerator {
  constructor(private readonly prisma: PrismaService) {}

  async next(): Promise<string> {
    const year = new Date().getUTCFullYear();
    // The sequence is race-safe: two concurrent requests never get the same
    // number (unlike count + 1, which collides with the unique index).
    const rows = await this.prisma.$queryRaw<Array<{ value: bigint }>>`
      SELECT nextval('request_tracking_seq') AS value
    `;
    return `SOL-${year}-${String(Number(rows[0].value)).padStart(5, '0')}`;
  }
}
