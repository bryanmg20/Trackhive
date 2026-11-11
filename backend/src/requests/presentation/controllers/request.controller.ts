import {
  Body,
  Controller,
  Get,
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
  ApiCreatedResponse,
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
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../auth/presentation/guards/authenticated-user';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { ChangeRequestStatusResponseDto } from '../../application/dto/change-request-status-response.dto';
import { ChangeRequestStatusDto } from '../../application/dto/change-request-status.dto';
import { CreateRequestOnBehalfDto } from '../../application/dto/create-request-on-behalf.dto';
import { CreateRequestDto } from '../../application/dto/create-request.dto';
import { ListMyRequestsQueryDto } from '../../application/dto/list-my-requests-query.dto';
import { ListRequestsQueryDto } from '../../application/dto/list-requests-query.dto';
import { PaginatedMyRequestsResponseDto } from '../../application/dto/my-request-list-response.dto';
import { RequestDetailResponseDto } from '../../application/dto/request-detail-response.dto';
import { ScheduleAppointmentResponseDto } from '../../application/dto/schedule-appointment-response.dto';
import { ScheduleAppointmentDto } from '../../application/dto/schedule-appointment.dto';
import { PaginatedRequestsResponseDto } from '../../application/dto/request-list-response.dto';
import { CreateRequestResponseDto } from '../../application/dto/create-request-response.dto';
import { ChangeRequestStatusUseCase } from '../../application/use-cases/change-request-status.use-case';
import { ScheduleAppointmentUseCase } from '../../application/use-cases/schedule-appointment.use-case';
import { CreateRequestOnBehalfUseCase } from '../../application/use-cases/create-request-on-behalf.use-case';
import { CreateRequestUseCase } from '../../application/use-cases/create-request.use-case';
import { GetRequestDetailUseCase } from '../../application/use-cases/get-request-detail.use-case';
import { ListMyRequestsUseCase } from '../../application/use-cases/list-my-requests.use-case';
import { ListRequestsUseCase } from '../../application/use-cases/list-requests.use-case';

@ApiTags('Requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestController {
  constructor(
    private readonly createRequestUseCase: CreateRequestUseCase,
    private readonly createRequestOnBehalfUseCase: CreateRequestOnBehalfUseCase,
    private readonly listRequestsUseCase: ListRequestsUseCase,
    private readonly getRequestDetailUseCase: GetRequestDetailUseCase,
    private readonly listMyRequestsUseCase: ListMyRequestsUseCase,
    private readonly changeRequestStatusUseCase: ChangeRequestStatusUseCase,
    private readonly scheduleAppointmentUseCase: ScheduleAppointmentUseCase,
  ) {}

  @Get()
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Lista y filtra las solicitudes',
    description:
      'Devuelve las solicitudes paginadas, con filtros por estado, rango de ' +
      'fecha deseada, solicitante y material, y ordenamiento por fecha de ' +
      'radicación o fecha deseada. Solo para PERSONAL y ADMIN.',
  })
  @ApiOkResponse({
    description: 'Página de solicitudes',
    type: PaginatedRequestsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de búsqueda inválidos o no permitidos',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo PERSONAL o ADMIN pueden listar las solicitudes',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  list(
    @Query() query: ListRequestsQueryDto,
  ): Promise<PaginatedRequestsResponseDto> {
    return this.listRequestsUseCase.execute(query);
  }

  // Must stay above @Get(':id'): Express matches routes in declaration order,
  // so below it "mine" would reach the detail endpoint as an id (HU-11)
  @Get('mine')
  @Roles('PUBLICO')
  @ApiOperation({
    summary: 'Lista mis solicitudes',
    description:
      'Devuelve solo las solicitudes del usuario público que inicia sesión ' +
      '(las que radicó y las que el personal registró a su nombre), ' +
      'paginadas, con filtro por estado y ordenamiento por fecha de ' +
      'radicación o fecha deseada. Solo para PUBLICO.',
  })
  @ApiOkResponse({
    description: 'Página de mis solicitudes',
    type: PaginatedMyRequestsResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de búsqueda inválidos o no permitidos',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo un usuario público puede consultar sus solicitudes',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  listMine(
    @Query() query: ListMyRequestsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedMyRequestsResponseDto> {
    return this.listMyRequestsUseCase.execute(query, user.id);
  }

  @Get(':id')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Detalle de una solicitud',
    description:
      'Devuelve la solicitud completa: datos del solicitante, material ' +
      'pedido con su ubicación, motivo, fecha deseada y estado actual. ' +
      'Solo para PERSONAL y ADMIN.',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la solicitud' })
  @ApiOkResponse({
    description: 'Detalle de la solicitud',
    type: RequestDetailResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'El identificador no es un UUID',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo PERSONAL o ADMIN pueden ver una solicitud',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'La solicitud no existe',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  detail(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RequestDetailResponseDto> {
    return this.getRequestDetailUseCase.execute(id);
  }

  @Patch(':id/status')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Cambia el estado de una solicitud',
    description:
      'Solo para PERSONAL y ADMIN. Aplica una transición válida de la ' +
      'máquina de estados (HU-14) y guarda en el historial el estado ' +
      'anterior, el nuevo, la fecha y hora, el responsable (el usuario del ' +
      'token) y un comentario opcional. Desde AGENDADA, ATENDIDA indica que ' +
      'el solicitante asistió y DISPONIBLE que no asistió. Para RECHAZADA el ' +
      'comentario es el motivo y es obligatorio (HU-16). El solicitante ' +
      'recibe un correo con el nuevo estado, el material y, si se rechaza, ' +
      'el motivo; se envía en segundo plano, así que un fallo del servidor ' +
      'de correo no cambia la respuesta (HU-23).',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la solicitud' })
  @ApiOkResponse({
    description: 'Nuevo estado y registro guardado en el historial',
    type: ChangeRequestStatusResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Identificador, estado o comentario inválidos',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo PERSONAL o ADMIN pueden cambiar el estado',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'La solicitud no existe',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'La transición no está permitida desde el estado actual ' +
      '(INVALID_STATUS_TRANSITION) u otra persona cambió el estado primero ' +
      '(REQUEST_STATUS_CONFLICT)',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  changeStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ChangeRequestStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChangeRequestStatusResponseDto> {
    return this.changeRequestStatusUseCase.execute({
      requestId: id,
      status: body.status,
      comment: body.comment,
      userId: user.id,
    });
  }

  @Post(':id/appointments')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Agenda la cita de consulta de una solicitud',
    description:
      'Solo para PERSONAL y ADMIN. La solicitud debe estar DISPONIBLE y con ' +
      'entrega presencial. La cita es por día, sin hora: registra la fecha, ' +
      'el solicitante y todos los materiales de la solicitud, y la persona ' +
      'puede consultar el material durante todo el horario de atención de ' +
      'ese día (lunes a viernes 8:00-17:00, sábados 9:00-13:00). Los ' +
      'domingos no se atiende. No se agenda un material que ya tiene cita ' +
      'ese día ni uno en restauración o no consultable; el estado en uso no ' +
      'bloquea (HU-20). La solicitud pasa a AGENDADA y el cambio queda en ' +
      'el historial con el responsable (el usuario del token). El ' +
      'solicitante recibe un correo con el día y el horario de la cita (HU-23).',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la solicitud' })
  @ApiCreatedResponse({
    description: 'Cita agendada y solicitud en AGENDADA',
    type: ScheduleAppointmentResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Identificador o fecha inválidos, o la fecha cae en domingo ' +
      '(INVALID_APPOINTMENT_DATE)',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo PERSONAL o ADMIN pueden agendar una cita',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'La solicitud no existe',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'La solicitud no está DISPONIBLE o su entrega es digital ' +
      '(INVALID_STATUS_TRANSITION), u otra persona cambió el estado primero ' +
      '(REQUEST_STATUS_CONFLICT), o un material de la solicitud ya tiene ' +
      'cita ese día (MATERIAL_ALREADY_BOOKED) o está en restauración o no ' +
      'consultable (MATERIAL_NOT_AVAILABLE) (HU-20)',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  scheduleAppointment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: ScheduleAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ScheduleAppointmentResponseDto> {
    return this.scheduleAppointmentUseCase.execute({
      requestId: id,
      date: body.date,
      userId: user.id,
    });
  }

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
