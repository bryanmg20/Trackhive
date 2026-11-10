import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { FindRequesterQueryDto } from '../../application/dto/find-requester-query.dto';
import { RequesterResponseDto } from '../../application/dto/requester-response.dto';
import { FindRequesterByEmailUseCase } from '../../application/use-cases/find-requester-by-email.use-case';

@ApiTags('Requesters')
@ApiBearerAuth()
@Controller('requesters')
export class RequesterController {
  constructor(
    private readonly findRequesterByEmailUseCase: FindRequesterByEmailUseCase,
  ) {}

  @Get('by-email')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Busca un solicitante por correo',
    description:
      'Devuelve los datos de un solicitante registrado o de una cuenta de ' +
      'usuario con ese correo, para que el personal no los vuelva a pedir. ' +
      'Si no existe, responde 404.',
  })
  @ApiOkResponse({
    description: 'Datos del solicitante',
    type: RequesterResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Correo ausente o inválido',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo PERSONAL o ADMIN pueden buscar solicitantes',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'No existe solicitante ni usuario con ese correo',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  find(@Query() query: FindRequesterQueryDto): Promise<RequesterResponseDto> {
    return this.findRequesterByEmailUseCase.execute(query.email);
  }
}
