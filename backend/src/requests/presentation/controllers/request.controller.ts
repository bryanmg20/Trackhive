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
import { RequestHistoryResponseDto } from '../../application/dto/request-history-response.dto';
import { ScheduleAppointmentResponseDto } from '../../application/dto/schedule-appointment-response.dto';
import { ScheduleAppointmentDto } from '../../application/dto/schedule-appointment.dto';
import { PaginatedRequestsResponseDto } from '../../application/dto/request-list-response.dto';
import { ResolveReferenceResponseDto } from '../../application/dto/request-reference-response.dto';
import { ResolveReferenceDto } from '../../application/dto/resolve-reference.dto';
import { CreateRequestResponseDto } from '../../application/dto/create-request-response.dto';
import { ChangeRequestStatusUseCase } from '../../application/use-cases/change-request-status.use-case';
import { ScheduleAppointmentUseCase } from '../../application/use-cases/schedule-appointment.use-case';
import { CreateRequestOnBehalfUseCase } from '../../application/use-cases/create-request-on-behalf.use-case';
import { CreateRequestUseCase } from '../../application/use-cases/create-request.use-case';
import { GetRequestDetailUseCase } from '../../application/use-cases/get-request-detail.use-case';
import { GetRequestHistoryUseCase } from '../../application/use-cases/get-request-history.use-case';
import { ListMyRequestsUseCase } from '../../application/use-cases/list-my-requests.use-case';
import { ListRequestsUseCase } from '../../application/use-cases/list-requests.use-case';
import { ResolveReferenceUseCase } from '../../application/use-cases/resolve-reference.use-case';

@ApiTags('Requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestController {
  constructor(
    private readonly createRequestUseCase: CreateRequestUseCase,
    private readonly createRequestOnBehalfUseCase: CreateRequestOnBehalfUseCase,
    private readonly listRequestsUseCase: ListRequestsUseCase,
    private readonly getRequestDetailUseCase: GetRequestDetailUseCase,
    private readonly getRequestHistoryUseCase: GetRequestHistoryUseCase,
    private readonly listMyRequestsUseCase: ListMyRequestsUseCase,
    private readonly changeRequestStatusUseCase: ChangeRequestStatusUseCase,
    private readonly scheduleAppointmentUseCase: ScheduleAppointmentUseCase,
    private readonly resolveReferenceUseCase: ResolveReferenceUseCase,
  ) {}

  @Get()
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Lista y filtra las solicitudes',
    description:
      'Devuelve las solicitudes paginadas, con filtros por estado, rango de ' +
      'fecha deseada, solicitante, material y referencias por resolver ' +
      '(solicitudes Recibida o En búsqueda con alguna referencia sin ' +
      'material asociado, HU-09.2), y ordenamiento por fecha de radicación o fecha ' +
      'deseada. Solo para PERSONAL y ADMIN.',
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
    return this.listMyRequestsUseCase.execute({ ...query, userId: user.id });
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
    return this.getRequestDetailUseCase.execute({ id });
  }

  // No @Roles(): any session may ask, and the use case decides (HU-04, HU-17)
  @Get(':id/history')
  @ApiOperation({
    summary: 'Historial de estados de una solicitud',
    description:
      'Devuelve cada cambio de estado de la solicitud, del más antiguo al ' +
      'más reciente: estado anterior (vacío en el registro), estado nuevo, ' +
      'fecha y hora, responsable y observación. El historial no se puede ' +
      'editar ni borrar. PERSONAL y ADMIN ven el de cualquier solicitud, con ' +
      'el nombre de quien hizo cada cambio. Un usuario PUBLICO solo ve el de ' +
      'sus propias solicitudes, sin los registros marcados como internos y ' +
      'con «Personal del CLENA» como responsable de los cambios del personal.',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la solicitud' })
  @ApiOkResponse({
    description: 'Historial de la solicitud',
    type: RequestHistoryResponseDto,
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
    description:
      'Un usuario público pidió una solicitud que no es suya ' +
      '(REQUEST_ACCESS_FORBIDDEN)',
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
  history(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestHistoryResponseDto> {
    return this.getRequestHistoryUseCase.execute({
      requestId: id,
      viewer: { id: user.id, role: user.role },
    });
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
      'comentario es el motivo y es obligatorio (HU-16). De EN_BUSQUEDA a ' +
      'DISPONIBLE con referencias sin material asociado el comentario también ' +
      'es obligatorio: explica qué se entrega y cómo (HU-09.2). El solicitante ' +
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
    description:
      'Identificador, estado o comentario inválidos, rechazo sin motivo ' +
      '(REJECTION_REASON_REQUIRED) o Disponible desde En búsqueda con ' +
      'referencias sin material asociado y sin comentario ' +
      '(DELIVERY_COMMENT_REQUIRED, HU-09.2)',
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
      'cita ese día (MATERIAL_ALREADY_BOOKED), está en restauración o no ' +
      'consultable (MATERIAL_NOT_AVAILABLE) (HU-20), o la sala alcanzó su ' +
      'capacidad diaria de citas (ROOM_CAPACITY_EXCEEDED) (HU-20.1)',
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

  @Patch(':id/references/:referenceId')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Asocia un material del catálogo a una referencia pendiente',
    description:
      'Solo para PERSONAL y ADMIN (HU-09.2). La referencia escrita de un ' +
      'material que no estaba en el catálogo pasa a RESUELTA con el material ' +
      'indicado, normalmente el que trajo la sincronización tras ' +
      'digitalizarlo. El material se suma a la solicitud y el cambio queda ' +
      'en el historial con el responsable (el usuario del token). Solo ' +
      'mientras la solicitud está RECIBIDA o EN_BUSQUEDA.',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la solicitud' })
  @ApiParam({
    name: 'referenceId',
    description: 'Identificador de la referencia',
  })
  @ApiOkResponse({
    description: 'Referencia resuelta y registro guardado en el historial',
    type: ResolveReferenceResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Identificador o material inválidos',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo PERSONAL o ADMIN pueden asociar un material',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description:
      'La solicitud (REQUEST_NOT_FOUND), la referencia ' +
      '(MATERIAL_REFERENCE_NOT_FOUND) o el material ' +
      '(REQUEST_MATERIAL_NOT_FOUND) no existen',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'La referencia ya tiene material (MATERIAL_REFERENCE_ALREADY_RESOLVED), ' +
      'la solicitud ya no está RECIBIDA ni EN_BUSQUEDA ' +
      '(MATERIAL_REFERENCE_NOT_RESOLVABLE) u otra persona cambió su estado ' +
      'primero (REQUEST_STATUS_CONFLICT)',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  resolveReference(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('referenceId', new ParseUUIDPipe()) referenceId: string,
    @Body() body: ResolveReferenceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResolveReferenceResponseDto> {
    return this.resolveReferenceUseCase.execute({
      requestId: id,
      referenceId,
      materialId: body.materialId,
      userId: user.id,
    });
  }

  @Post()
  @Roles('PUBLICO')
  @ApiOperation({
    summary: 'Radica una solicitud de consulta',
    description:
      'Pide al menos un material del catálogo o una referencia escrita de ' +
      'uno que aún no está (RN-04, HU-09.2): un protocolo notarial por ' +
      'notaría, año y número de escritura, o cualquier otro material en ' +
      'texto libre.',
  })
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
    return this.createRequestUseCase.execute({ ...dto, userId: user.id });
  }

  @Post('on-behalf')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Registra una solicitud a nombre de un visitante',
    description:
      'El personal del CLENA registra la solicitud de una persona que llega ' +
      'o llama sin cuenta. El solicitante puede asociarse a un usuario ' +
      'existente o registrarse solo con sus datos de contacto. Pide al ' +
      'menos un material del catálogo o una referencia escrita (RN-04, ' +
      'HU-09.2). La fecha ' +
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
    return this.createRequestOnBehalfUseCase.execute({
      ...dto,
      createdById: user.id,
    });
  }
}
