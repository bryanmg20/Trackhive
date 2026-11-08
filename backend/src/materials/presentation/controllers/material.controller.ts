import { Controller, Get, Query, Req } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../../../auth/presentation/guards/authenticated-user';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { PaginatedMaterialsResponseDto } from '../../application/dto/material-response.dto';
import { SearchMaterialsQueryDto } from '../../application/dto/search-materials-query.dto';
import { SearchMaterialsUseCase } from '../../application/use-cases/search-materials.use-case';

@ApiTags('Materials')
@ApiBearerAuth()
@Controller('materials')
export class MaterialController {
  constructor(
    private readonly searchMaterialsUseCase: SearchMaterialsUseCase,
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
}
