import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { MostRequestedMaterialsQueryDto } from '../../application/dto/most-requested-materials-query.dto';
import { MostRequestedMaterialsResponseDto } from '../../application/dto/most-requested-materials-response.dto';
import { GetMostRequestedMaterialsUseCase } from '../../application/use-cases/get-most-requested-materials.use-case';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportController {
  constructor(
    private readonly getMostRequestedMaterialsUseCase: GetMostRequestedMaterialsUseCase,
  ) {}

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
