import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DatabaseHealthChecker } from '../../application/ports/database-health-checker.port';

@Injectable()
export class PrismaDatabaseHealthChecker implements DatabaseHealthChecker {
  constructor(private readonly prisma: PrismaService) {}

  async isAvailable(): Promise<boolean> {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Database health check timed out')),
            3000,
          ),
        ),
      ]);
      return true;
    } catch {
      return false;
    }
  }
}
