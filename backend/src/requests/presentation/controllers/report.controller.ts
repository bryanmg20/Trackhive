import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { MostRequestedMaterialsQueryDto } from '../../application/dto/most-requested-materials-query.dto';
import { MostRequestedMaterialsResponseDto } from '../../application/dto/most-requested-materials-response.dto';
import { GetMostRequestedMaterialsUseCase } from '../../application/use-cases/get-most-requested-materials.use-case';
import { AttentionTimesQueryDto } from '../../application/dto/attention-times-query.dto';
import { AttentionTimesResponseDto } from '../../application/dto/attention-times-response.dto';
import { GetAttentionTimesUseCase } from '../../application/use-cases/get-attention-times.use-case';
import { ExportReportUseCase } from '../../application/use-cases/export-report.use-case';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportController {
  constructor(
    private readonly getMostRequestedMaterialsUseCase: GetMostRequestedMaterialsUseCase,
    private readonly getAttentionTimesUseCase: GetAttentionTimesUseCase,
    private readonly exportReportUseCase: ExportReportUseCase,
  ) {}

  @Get('most-requested-materials/export')
  @Roles('ADMIN')
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: 'Exportar material más solicitado a CSV (HU-27)',
    description:
      'Mismos filtros, límite y orden que el reporte. UTF-8 con BOM. Ranking vacío: solo encabezados. Solo ADMIN.',
  })
  @ApiOkResponse({
    description: 'Archivo CSV descargable',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiBadRequestResponse({
    description: 'Filtros inválidos',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({
    description: 'Solo ADMIN puede exportar reportes',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({ type: ErrorResponseDto })
  async exportMostRequestedMaterials(
    @Query() query: MostRequestedMaterialsQueryDto,
  ): Promise<StreamableFile> {
    const csv = await this.exportReportUseCase.execute({
      report: 'most-requested-materials',
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
    return new StreamableFile(Buffer.from(csv.content, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${csv.fileName}"`,
    });
  }

  @Get('attention-times/export')
  @Roles('ADMIN')
  @ApiProduces('text/csv')
  @ApiOperation({
    summary: 'Exportar tiempos de atención a CSV (HU-27)',
    description:
      'Mismos filtros y promedios que el reporte. Duraciones en segundos; promedio vacío significa sin datos, no cero. Solo ADMIN.',
  })
  @ApiOkResponse({
    description: 'Archivo CSV descargable',
    schema: { type: 'string', format: 'binary' },
  })
  @ApiBadRequestResponse({
    description: 'Filtros inválidos',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({
    description: 'Solo ADMIN puede exportar reportes',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({ type: ErrorResponseDto })
  async exportAttentionTimes(
    @Query() query: AttentionTimesQueryDto,
  ): Promise<StreamableFile> {
    const csv = await this.exportReportUseCase.execute({
      report: 'attention-times',
      from: query.from,
      to: query.to,
    });
    return new StreamableFile(Buffer.from(csv.content, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${csv.fileName}"`,
    });
  }

  @Get('attention-times')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Tiempos promedio de atención (HU-25)',
    description:
      'Solo ADMIN. Filtra por radicación en días de Bogotá, ambos extremos incluidos. ' +
      'Mide tiempo transcurrido (incluye noches y fines de semana) hasta Atendida, también si luego se cerró. ' +
      'Cada estado excluye solicitudes que no lo recorrieron; las permanencias repetidas se suman por solicitud. ' +
      'El rango no recorta la duración de la atención. Sin observaciones, promedio null y muestra 0.',
  })
  @ApiOkResponse({ type: AttentionTimesResponseDto })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas o rango invertido',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Access token ausente o inválido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo ADMIN puede consultar los tiempos de atención',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({ type: ErrorResponseDto })
  getAttentionTimes(
    @Query() query: AttentionTimesQueryDto,
  ): Promise<AttentionTimesResponseDto> {
    return this.getAttentionTimesUseCase.execute(query);
  }

  @Get('most-requested-materials')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Ranking del material más solicitado',
    description:
      'Devuelve los materiales ordenados por el número de solicitudes que los ' +
      'incluyen, de cualquier estado. Con `from` y `to` solo cuenta las ' +
      'solicitudes registradas en esos días (hora de Bogotá, ambos incluidos). ' +
      'Solo para PERSONAL y ADMIN (HU-26).',
  })
  @ApiOkResponse({
    description: 'Ranking de materiales del periodo',
    type: MostRequestedMaterialsResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Fechas con formato inválido, fecha inicial posterior a la final o límite fuera de rango',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo PERSONAL o ADMIN pueden consultar los reportes',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  getMostRequestedMaterials(
    @Query() query: MostRequestedMaterialsQueryDto,
  ): Promise<MostRequestedMaterialsResponseDto> {
    return this.getMostRequestedMaterialsUseCase.execute({
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
  }
}
