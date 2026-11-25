import { Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../auth/presentation/guards/authenticated-user';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { SyncRunResponseDto } from '../../application/dto/sync-run-response.dto';
import { SyncStatusResponseDto } from '../../application/dto/sync-status-response.dto';
import { GetSyncStatusUseCase } from '../../application/use-cases/get-sync-status.use-case';
import { RequestSyncRunUseCase } from '../../application/use-cases/request-sync-run.use-case';

/**
 * «Sincronización con Everything» for the administrator (HU-138, WF-14): the
 * state of the sync and «Sincronizar ahora». Every endpoint of this controller
 * is only for ADMIN: PERSONAL and PUBLICO get 403 from the global RolesGuard
 * (HU-04). The agent has its own endpoints and token (EverythingSyncController).
 */
@ApiTags('Everything')
@ApiBearerAuth()
@Roles('ADMIN')
@ApiUnauthorizedResponse({
  description: 'Falta el access token o no es válido',
  type: ErrorResponseDto,
})
@ApiForbiddenResponse({
  description:
    'Solo un administrador ve el estado de la sincronización y la pide',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Error interno del servidor',
  type: ErrorResponseDto,
})
@Controller('everything')
export class EverythingSyncAdminController {
  constructor(
    private readonly getSyncStatusUseCase: GetSyncStatusUseCase,
    private readonly requestSyncRunUseCase: RequestSyncRunUseCase,
  ) {}

  @Get('sync-status')
  @ApiOperation({
    summary: 'Estado de la sincronización con Everything',
    description:
      'Si la integración está activa (EVERYTHING_AGENT_TOKEN), la corrida pedida ' +
      'o en curso, la última que terminó (cuándo, cuántas carpetas, si terminó ' +
      'bien o con error y el motivo) y la última vez que el agente del CLENA se ' +
      'comunicó con Trackhive. Responde también con la integración desactivada, ' +
      'para que la pantalla lo indique.',
  })
  @ApiOkResponse({
    description: 'Estado de la sincronización',
    type: SyncStatusResponseDto,
  })
  getStatus(): Promise<SyncStatusResponseDto> {
    return this.getSyncStatusUseCase.execute();
  }

  @Post('sync-requests')
  @ApiOperation({
    summary: 'Sincronizar ahora: pide una corrida al agente del CLENA',
    description:
      'Deja una corrida PEDIDA. El agente pregunta cada minuto, mientras el PC ' +
      'del CLENA está encendido, si hay una (GET /everything/sync-runs/requested) ' +
      'y al iniciar la sincronización la toma. Mientras tanto sigue pedida, sin ' +
      'vencer. Si una corrida en curso lleva más de EVERYTHING_RUN_TIMEOUT_MINUTES ' +
      'sin páginas, primero la cierra con error sin marcar nada como no encontrado.',
  })
  @ApiCreatedResponse({
    description: 'Corrida PEDIDA, esperando al agente',
    type: SyncRunResponseDto,
  })
  @ApiConflictResponse({
    description:
      'Ya hay una corrida pedida (SYNC_RUN_ALREADY_REQUESTED) o en curso ' +
      '(SYNC_RUN_ALREADY_RUNNING): no se pide otra',
    type: ErrorResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description:
      'La integración está desactivada: el servidor no tiene ' +
      'EVERYTHING_AGENT_TOKEN (EVERYTHING_SYNC_DISABLED). No se pide nada',
    type: ErrorResponseDto,
  })
  requestSync(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SyncRunResponseDto> {
    return this.requestSyncRunUseCase.execute({ userId: user.id });
  }
}
