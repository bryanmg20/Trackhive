import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../auth/presentation/guards/authenticated-user';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { ChangeMaterialStatusDto } from '../../application/dto/change-material-status.dto';
import { MaterialHistoryQueryDto } from '../../application/dto/material-history-query.dto';
import { MaterialHistoryResponseDto } from '../../application/dto/material-history-response.dto';
import { MaterialLoanResponseDto } from '../../application/dto/material-loan-response.dto';
import {
  MaterialResponseDto,
  PaginatedMaterialsResponseDto,
} from '../../application/dto/material-response.dto';
import { ReturnMaterialDto } from '../../application/dto/return-material.dto';
import { SearchMaterialsQueryDto } from '../../application/dto/search-materials-query.dto';
import { ChangeMaterialStatusUseCase } from '../../application/use-cases/change-material-status.use-case';
import { GetMaterialHistoryUseCase } from '../../application/use-cases/get-material-history.use-case';
import { ReturnMaterialUseCase } from '../../application/use-cases/return-material.use-case';
import { SearchMaterialsUseCase } from '../../application/use-cases/search-materials.use-case';

@ApiTags('Materials')
@ApiBearerAuth()
@Controller('materials')
export class MaterialController {
  constructor(
    private readonly searchMaterialsUseCase: SearchMaterialsUseCase,
    private readonly changeMaterialStatusUseCase: ChangeMaterialStatusUseCase,
    private readonly returnMaterialUseCase: ReturnMaterialUseCase,
    private readonly getMaterialHistoryUseCase: GetMaterialHistoryUseCase,
  ) {}

  // Any signed-in role can search; no @Roles() on purpose
  @Get()
  @ApiOperation({
    summary: 'Lista y busca material del archivo',
    description:
      'Devuelve el material paginado, con filtros por tipo, colección y ' +
      'estado, búsqueda por texto y ordenamiento. Incluye si tiene copia ' +
      'digital; solo PERSONAL y ADMIN ven el nombre de carpeta y la marca de ' +
      'revisión, nunca la ruta completa (HU-140).',
  })
  @ApiOkResponse({
    description: 'Página de materiales',
    type: PaginatedMaterialsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de búsqueda inválidos o no permitidos',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async search(
    @Query() query: SearchMaterialsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedMaterialsResponseDto> {
    return this.searchMaterialsUseCase.execute({
      ...query,
      viewerRole: user.role,
    });
  }

  @Patch(':id/status')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Cambia el estado manual de un material',
    description:
      'Solo para PERSONAL y ADMIN. Guarda el nuevo estado manual ' +
      '(DISPONIBLE, EN_RESTAURACION o NO_CONSULTABLE) con la fecha, el ' +
      'responsable y un motivo opcional. Desde HU-72, EN_USO solo cambia ' +
      'con la entrega y devolución en sala y no puede modificarse manualmente ' +
      'mientras el material esté EN_USO.',
  })
  @ApiParam({ name: 'id', description: 'Identificador del material' })
  @ApiOkResponse({
    description: 'Material con su nuevo estado',
    type: MaterialResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Identificador, estado manual o motivo inválidos',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'El rol no puede cambiar el estado de un material',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'El material no existe',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'El material está EN_USO actualmente y debe devolverse primero (MATERIAL_IN_USE)',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async changeStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ChangeMaterialStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MaterialResponseDto> {
    return this.changeMaterialStatusUseCase.execute({
      materialId: id,
      status: body.status,
      reason: body.reason,
      userId: user.id,
      viewerRole: user.role,
    });
  }

  @Post(':id/return')
  @HttpCode(HttpStatus.OK)
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Registra la devolución de un material en uso',
    description:
      'Solo para PERSONAL y ADMIN (HU-72). Cierra el préstamo abierto del ' +
      'material registrando la hora de devolución, quién la recibió y ' +
      'observaciones opcionales, y devuelve el material al estado DISPONIBLE.',
  })
  @ApiParam({ name: 'id', description: 'Identificador del material' })
  @ApiOkResponse({
    description: 'Préstamo cerrado con hora y responsable de devolución',
    type: MaterialLoanResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Identificador u observaciones inválidos',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo PERSONAL o ADMIN pueden registrar devoluciones',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'El material no existe (MATERIAL_NOT_FOUND)',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'El material no está EN_USO ni tiene un préstamo abierto (MATERIAL_NOT_IN_USE)',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async registerReturn(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ReturnMaterialDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MaterialLoanResponseDto> {
    return this.returnMaterialUseCase.execute({
      materialId: id,
      userId: user.id,
      notes: body.notes,
    });
  }

  @Get(':id/history')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Consulta el historial de entregas y devoluciones de un material',
    description:
      'Solo para PERSONAL y ADMIN (HU-72). Devuelve el resumen del último ' +
      'préstamo (quién lo tuvo por última vez y a qué hora lo devolvió) y el ' +
      'historial paginado ordenado del más reciente al más antiguo.',
  })
  @ApiParam({ name: 'id', description: 'Identificador del material' })
  @ApiOkResponse({
    description: 'Historial de custodia del material',
    type: MaterialHistoryResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Identificador o parámetros de paginación inválidos',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description:
      'Solo PERSONAL o ADMIN pueden consultar el historial de custodia',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'El material no existe (MATERIAL_NOT_FOUND)',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async getHistory(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() query: MaterialHistoryQueryDto,
  ): Promise<MaterialHistoryResponseDto> {
    return this.getMaterialHistoryUseCase.execute({
      materialId: id,
      page: query.page,
      limit: query.limit,
    });
  }
}
