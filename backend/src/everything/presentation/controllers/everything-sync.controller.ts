import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { CloseSyncRunDto } from '../../application/dto/close-sync-run.dto';
import { RequestedSyncRunResponseDto } from '../../application/dto/requested-sync-run-response.dto';
import { SyncPageParamsDto } from '../../application/dto/sync-page-params.dto';
import { SyncPageResponseDto } from '../../application/dto/sync-page-response.dto';
import {
  ClosedSyncRunResponseDto,
  SyncRunResponseDto,
} from '../../application/dto/sync-run-response.dto';
import { EverythingSynchronizer } from '../../application/services/everything-synchronizer';
import { MAX_RESULTS_PER_PAGE } from '../../application/sync-limits';
import { GetRequestedSyncRunUseCase } from '../../application/use-cases/get-requested-sync-run.use-case';
import { EverythingAgentAuth } from '../decorators/everything-agent-auth.decorator';

const INTERNAL_ERROR = {
  description: 'Error interno del servidor',
  type: ErrorResponseDto,
};

/** A page as Everything answers it, only for the documentation. */
const EVERYTHING_PAGE_SCHEMA = {
  type: 'object',
  required: ['totalResults', 'results'],
  properties: {
    totalResults: { type: 'integer', minimum: 0 },
    results: {
      type: 'array',
      maxItems: MAX_RESULTS_PER_PAGE,
      items: {
        type: 'object',
        required: ['type', 'name', 'path', 'size', 'date_modified'],
        properties: {
          type: { type: 'string', enum: ['folder', 'file'] },
          name: { type: 'string' },
          path: { type: 'string' },
          size: { type: 'string' },
          date_modified: { type: 'string' },
        },
      },
    },
  },
  example: {
    totalResults: 124,
    results: [
      {
        type: 'folder',
        name: '1ra-1931 - Esc 0001-0109 - Ene',
        path: 'C:\\trackhive\\docs_simulados\\Aha\\Fondo - Notarías\\Notarías\\1ra - Notaria Primera de Barranquilla - 1815 a 1979\\1931 - Esc 1-1290 (12) +',
        size: '',
        date_modified: '134396687063922382',
      },
    ],
  },
};

/**
 * Endpoints of the Everything agent (HU-137, HU-166), with its token. Each
 * ingest endpoint calls one operation of EverythingSynchronizer, and the
 * question whether a run is requested calls its use case (HU-138); nothing
 * else.
 */
@ApiTags('Everything')
@EverythingAgentAuth()
@Controller('everything/sync-runs')
export class EverythingSyncController {
  constructor(
    private readonly synchronizer: EverythingSynchronizer,
    private readonly getRequestedSyncRunUseCase: GetRequestedSyncRunUseCase,
  ) {}

  @Get('requested')
  @ApiOperation({
    summary: 'Dice si un administrador pidió «Sincronizar ahora»',
    description:
      'Solo para el agente de Everything (HU-166), con su token. El agente lo ' +
      'pregunta cada minuto mientras el PC del CLENA está encendido. Si hay una ' +
      'corrida PEDIDA (HU-138), inicia la sincronización (POST ' +
      '/everything/sync-runs), y ese inicio la toma. Cada llamada del agente ' +
      'queda como su último contacto.',
  })
  @ApiOkResponse({
    description: 'Si hay una corrida pedida y desde cuándo',
    type: RequestedSyncRunResponseDto,
  })
  @ApiInternalServerErrorResponse(INTERNAL_ERROR)
  findRequested(): Promise<RequestedSyncRunResponseDto> {
    return this.getRequestedSyncRunUseCase.execute();
  }

  @Post()
  @ApiOperation({
    summary: 'Inicia una corrida de sincronización con Everything',
    description:
      'Solo para el agente de Everything (HU-166), con su token. Si un ' +
      'administrador pidió «Sincronizar ahora» (HU-138), esa corrida PEDIDA pasa ' +
      'a EN_CURSO; si no, crea una corrida EN_CURSO en sync_runs. Si otra corrida ' +
      'lleva más de EVERYTHING_RUN_TIMEOUT_MINUTES sin recibir páginas, primero la ' +
      'cierra con error, sin marcar nada como no encontrado.',
  })
  @ApiCreatedResponse({
    description: 'Corrida EN_CURSO',
    type: SyncRunResponseDto,
  })
  @ApiConflictResponse({
    description:
      'Ya hay una corrida en curso que no ha vencido (SYNC_RUN_ALREADY_RUNNING)',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse(INTERNAL_ERROR)
  startRun(): Promise<SyncRunResponseDto> {
    return this.synchronizer.startRun();
  }

  @Put(':runId/pages/:pageNumber')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Envía una página de Everything a la corrida',
    description:
      'El cuerpo es la respuesta del servidor HTTP de Everything sin transformar ' +
      '(búsqueda folder: + raíz, con path_column, size_column y ' +
      `date_modified_column). Como máximo ${MAX_RESULTS_PER_PAGE} resultados y ` +
      '100 kB. La página se valida y se guarda en su transacción; los materiales ' +
      'se crean o actualizan al cerrar la corrida completa, porque las carpetas ' +
      'hoja y los códigos repetidos solo se conocen con todas las páginas. Enviar ' +
      'otra vez el mismo número reemplaza la página.',
  })
  @ApiBody({
    description: 'Página de Everything sin transformar',
    schema: EVERYTHING_PAGE_SCHEMA,
  })
  @ApiOkResponse({
    description: 'Página guardada hasta el cierre de la corrida',
    type: SyncPageResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'La página no tiene la forma de Everything (INVALID_EVERYTHING_PAGE) o los ' +
      'parámetros no son válidos (VALIDATION_ERROR). No se guarda nada',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'La corrida no existe (SYNC_RUN_NOT_FOUND)',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'La corrida ya terminó (SYNC_RUN_NOT_RUNNING) o venció (SYNC_RUN_EXPIRED)',
    type: ErrorResponseDto,
  })
  @ApiPayloadTooLargeResponse({
    description:
      `Más de ${MAX_RESULTS_PER_PAGE} resultados (EVERYTHING_PAGE_TOO_LARGE) o un ` +
      'cuerpo de más de 100 kB (PAYLOAD_TOO_LARGE). No se guarda nada',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse(INTERNAL_ERROR)
  receivePage(
    @Param() params: SyncPageParamsDto,
    @Body() page: unknown,
  ): Promise<SyncPageResponseDto> {
    return this.synchronizer.receivePage({
      runId: params.runId,
      pageNumber: params.pageNumber,
      page,
    });
  }

  @Post(':runId/close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cierra la corrida de sincronización',
    description:
      'Con result ERROR la corrida termina con error y no cambia ningún material. ' +
      'Con result OK y pageCount, si llegaron exactamente las páginas 1..pageCount, ' +
      'parsea todas las carpetas (HU-136), crea o actualiza cada material por su ' +
      'código de catalogación (una transacción por página) y marca como «copia ' +
      'digital no encontrada» los materiales de Everything que no aparecieron. ' +
      'Ningún material se borra. Si faltan páginas o no llegó ninguna carpeta hoja, ' +
      'termina con error y no marca nada.',
  })
  @ApiParam({ name: 'runId', description: 'Identificador de la corrida' })
  @ApiOkResponse({
    description: 'Corrida cerrada (OK o ERROR) con lo que hizo en el catálogo',
    type: ClosedSyncRunResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Cuerpo o identificador inválidos (VALIDATION_ERROR)',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'La corrida no existe (SYNC_RUN_NOT_FOUND)',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'La corrida ya terminó (SYNC_RUN_NOT_RUNNING) o venció (SYNC_RUN_EXPIRED)',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse(INTERNAL_ERROR)
  closeRun(
    @Param('runId', new ParseUUIDPipe()) runId: string,
    @Body() body: CloseSyncRunDto,
  ): Promise<ClosedSyncRunResponseDto> {
    return this.synchronizer.closeRun({
      runId,
      result: body.result,
      pageCount: body.pageCount,
      errorMessage: body.errorMessage,
    });
  }
}
