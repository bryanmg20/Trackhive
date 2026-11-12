import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DatabaseHealthChecker } from '../../application/ports/database-health-checker.port';

// Beyond this the database counts as down, even if it answers later
export const DATABASE_HEALTH_CHECK_TIMEOUT_MS = 3000;

@Injectable()
export class PrismaDatabaseHealthChecker implements DatabaseHealthChecker {
  constructor(private readonly prisma: PrismaService) {}

  async isAvailable(): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('Database health check timed out')),
            DATABASE_HEALTH_CHECK_TIMEOUT_MS,
          );
        }),
      ]);
      return true;
    } catch {
      return false;
    } finally {
      // Without this the timer outlives every check that the database wins
      clearTimeout(timer);
    }
  }
}
