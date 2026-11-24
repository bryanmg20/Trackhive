import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EverythingSynchronizer } from './application/services/everything-synchronizer';
import { LeafFolderParser } from './application/services/leaf-folder-parser';
import {
  EVERYTHING_SYNC_CONFIG,
  SYNC_RUN_REPOSITORY,
} from './application/tokens';
import { loadCatalogConvention } from './infrastructure/config/catalog-convention.loader';
import { loadEverythingSyncConfig } from './infrastructure/config/everything-sync.config';
import { PrismaSyncRunRepository } from './infrastructure/persistence/prisma-sync-run.repository';
import { EverythingSyncController } from './presentation/controllers/everything-sync.controller';
import { EverythingAgentGuard } from './presentation/guards/everything-agent.guard';

/**
 * Sync with Everything (E11). The agent (HU-166) sends what Everything
 * indexes to the ingest endpoints, and the backend maps it (HU-135), parses
 * the folder convention (HU-136) and keeps the catalog up to date (HU-137).
 * The backend never calls Everything.
 */
@Module({
  controllers: [EverythingSyncController],
  providers: [
    {
      provide: SYNC_RUN_REPOSITORY,
      useClass: PrismaSyncRunRepository,
    },
    {
      // A short token or a wrong timeout stops the backend at startup (D-23)
      provide: EVERYTHING_SYNC_CONFIG,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        loadEverythingSyncConfig((key) => config.get<string>(key)),
    },
    {
      // config/catalog-convention.json, checked once at startup (HU-136)
      provide: LeafFolderParser,
      useFactory: () => new LeafFolderParser(loadCatalogConvention()),
    },
    EverythingSynchronizer,
    EverythingAgentGuard,
  ],
})
export class EverythingModule {}
