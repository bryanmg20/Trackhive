import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EverythingSynchronizer } from './application/services/everything-synchronizer';
import { LeafFolderParser } from './application/services/leaf-folder-parser';
import { SyncRunExpirer } from './application/services/sync-run-expirer';
import {
  EVERYTHING_SYNC_CONFIG,
  SYNC_AGENT_REPOSITORY,
  SYNC_RUN_REPOSITORY,
} from './application/tokens';
import { GetRequestedSyncRunUseCase } from './application/use-cases/get-requested-sync-run.use-case';
import { GetSyncStatusUseCase } from './application/use-cases/get-sync-status.use-case';
import { RecordAgentContactUseCase } from './application/use-cases/record-agent-contact.use-case';
import { RequestSyncRunUseCase } from './application/use-cases/request-sync-run.use-case';
import { loadCatalogConvention } from './infrastructure/config/catalog-convention.loader';
import { loadEverythingSyncConfig } from './infrastructure/config/everything-sync.config';
import { PrismaSyncAgentRepository } from './infrastructure/persistence/prisma-sync-agent.repository';
import { PrismaSyncRunRepository } from './infrastructure/persistence/prisma-sync-run.repository';
import { EverythingSyncAdminController } from './presentation/controllers/everything-sync-admin.controller';
import { EverythingSyncController } from './presentation/controllers/everything-sync.controller';
import { EverythingAgentGuard } from './presentation/guards/everything-agent.guard';
import { AgentContactInterceptor } from './presentation/interceptors/agent-contact.interceptor';

/**
 * Sync with Everything (E11). The agent (HU-166) sends what Everything
 * indexes to the ingest endpoints, and the backend maps it (HU-135), parses
 * the folder convention (HU-136) and keeps the catalog up to date (HU-137).
 * The administrator sees how the sync is going and asks for «Sincronizar
 * ahora», which the agent takes the next time it asks (HU-138). The backend
 * never calls Everything.
 */
@Module({
  controllers: [EverythingSyncController, EverythingSyncAdminController],
  providers: [
    {
      provide: SYNC_RUN_REPOSITORY,
      useClass: PrismaSyncRunRepository,
    },
    {
      provide: SYNC_AGENT_REPOSITORY,
      useClass: PrismaSyncAgentRepository,
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
    SyncRunExpirer,
    EverythingSynchronizer,
    GetSyncStatusUseCase,
    RequestSyncRunUseCase,
    GetRequestedSyncRunUseCase,
    RecordAgentContactUseCase,
    EverythingAgentGuard,
    AgentContactInterceptor,
  ],
})
export class EverythingModule {}
