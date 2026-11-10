import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../auth/presentation/guards/authenticated-user';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { ChangeMaterialStatusDto } from '../../application/dto/change-material-status.dto';
import {
  MaterialResponseDto,
  PaginatedMaterialsResponseDto,
} from '../../application/dto/material-response.dto';
import { SearchMaterialsQueryDto } from '../../application/dto/search-materials-query.dto';
import { ChangeMaterialStatusUseCase } from '../../application/use-cases/change-material-status.use-case';
import { SearchMaterialsUseCase } from '../../application/use-cases/search-materials.use-case';

@ApiTags('Materials')
@ApiBearerAuth()
@Controller('materials')
export class MaterialController {
  constructor(
    private readonly searchMaterialsUseCase: SearchMaterialsUseCase,
    private readonly changeMaterialStatusUseCase: ChangeMaterialStatusUseCase,
  ) {}

  // Any signed-in role can search; no @Roles() on purpose
  @Get()
  @ApiOperation({
    summary: 'Lista y busca material del archivo',
    description:
      'Devuelve el material paginado, con filtros por tipo, colección y ' +
      'estado, búsqueda por texto y ordenamiento. La ubicación física solo ' +
      'se incluye para los roles PERSONAL y ADMIN.',
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
    // JwtAuthGuard (global) always sets the user before reaching here
    @Req() request: { user: AuthenticatedUser },
  ): Promise<PaginatedMaterialsResponseDto> {
    return this.searchMaterialsUseCase.execute(query, request.user.role);
  }

  @Patch(':id/status')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Cambia el estado de un material',
    description:
      'Solo para PERSONAL y ADMIN. Guarda el nuevo estado con la fecha, ' +
      'el responsable y un motivo opcional. Un material en restauración o ' +
      'no consultable no se puede agendar (HU-20).',
  })
  @ApiParam({ name: 'id', description: 'Identificador del material' })
  @ApiOkResponse({
    description: 'Material con su nuevo estado',
    type: MaterialResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Identificador, estado o motivo inválidos',
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
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async changeStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ChangeMaterialStatusDto,
    @Req() request: { user: AuthenticatedUser },
  ): Promise<MaterialResponseDto> {
    return this.changeMaterialStatusUseCase.execute({
      materialId: id,
      status: body.status,
      reason: body.reason,
      userId: request.user.id,
    });
  }
}
