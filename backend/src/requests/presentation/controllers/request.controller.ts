import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../auth/presentation/guards/authenticated-user';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { CreateRequestOnBehalfDto } from '../../application/dto/create-request-on-behalf.dto';
import { CreateRequestDto } from '../../application/dto/create-request.dto';
import { CreateRequestResponseDto } from '../../application/dto/create-request-response.dto';
import { CreateRequestOnBehalfUseCase } from '../../application/use-cases/create-request-on-behalf.use-case';
import { CreateRequestUseCase } from '../../application/use-cases/create-request.use-case';

@ApiTags('Requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestController {
  constructor(
    private readonly createRequestUseCase: CreateRequestUseCase,
    private readonly createRequestOnBehalfUseCase: CreateRequestOnBehalfUseCase,
  ) {}

  @Post()
  @Roles('PUBLICO')
  @ApiOperation({ summary: 'Radica una solicitud de consulta' })
  @ApiCreatedResponse({ type: CreateRequestResponseDto })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o fecha deseada no permitida',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo un usuario público puede radicar su propia solicitud',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  create(
    @Body() dto: CreateRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreateRequestResponseDto> {
    return this.createRequestUseCase.execute(dto, user.id);
  }

  @Post('on-behalf')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Registra una solicitud a nombre de un visitante',
    description:
      'El personal del CLENA registra la solicitud de una persona que llega ' +
      'o llama sin cuenta. El solicitante puede asociarse a un usuario ' +
      'existente o registrarse solo con sus datos de contacto. La fecha ' +
      'deseada debe tener al menos 10 días hábiles de anticipación y caer ' +
      'entre lunes y sábado.',
  })
  @ApiCreatedResponse({
    description: 'Solicitud registrada en estado RECIBIDA',
    type: CreateRequestResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos, solicitante incompleto o fecha deseada no permitida',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo PERSONAL o ADMIN pueden registrar para un visitante',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'El usuario asociado o un material no existe',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  createOnBehalf(
    @Body() dto: CreateRequestOnBehalfDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreateRequestResponseDto> {
    return this.createRequestOnBehalfUseCase.execute(dto, user.id);
  }
}
