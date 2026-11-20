import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { MaterialLoanResponseDto } from '../../../materials/application/dto/material-loan-response.dto';
import { PaginatedAppointmentsResponseDto } from '../../application/dto/appointment-list-response.dto';
import { CancelAppointmentResponseDto } from '../../application/dto/cancel-appointment-response.dto';
import { CancelAppointmentDto } from '../../application/dto/cancel-appointment.dto';
import { DeliverMaterialDto } from '../../application/dto/deliver-material.dto';
import { GetRoomOccupancyQueryDto } from '../../application/dto/get-room-occupancy-query.dto';
import { ListAppointmentsQueryDto } from '../../application/dto/list-appointments-query.dto';
import { RescheduleAppointmentDto } from '../../application/dto/reschedule-appointment.dto';
import { RoomCapacityResponseDto } from '../../application/dto/room-capacity-response.dto';
import { RoomOccupancyResponseDto } from '../../application/dto/room-occupancy-response.dto';
import { ScheduleAppointmentResponseDto } from '../../application/dto/schedule-appointment-response.dto';
import { UpdateRoomCapacityDto } from '../../application/dto/update-room-capacity.dto';
import { CancelAppointmentUseCase } from '../../application/use-cases/cancel-appointment.use-case';
import { DeliverMaterialUseCase } from '../../application/use-cases/deliver-material.use-case';
import { GetRoomCapacityUseCase } from '../../application/use-cases/get-room-capacity.use-case';
import { GetRoomOccupancyUseCase } from '../../application/use-cases/get-room-occupancy.use-case';
import { ListAppointmentsUseCase } from '../../application/use-cases/list-appointments.use-case';
import { RescheduleAppointmentUseCase } from '../../application/use-cases/reschedule-appointment.use-case';
import { UpdateRoomCapacityUseCase } from '../../application/use-cases/update-room-capacity.use-case';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentController {
  constructor(
    private readonly listAppointmentsUseCase: ListAppointmentsUseCase,
    private readonly getRoomCapacityUseCase: GetRoomCapacityUseCase,
    private readonly updateRoomCapacityUseCase: UpdateRoomCapacityUseCase,
    private readonly getRoomOccupancyUseCase: GetRoomOccupancyUseCase,
    private readonly rescheduleAppointmentUseCase: RescheduleAppointmentUseCase,
    private readonly cancelAppointmentUseCase: CancelAppointmentUseCase,
    private readonly deliverMaterialUseCase: DeliverMaterialUseCase,
  ) {}

  @Get()
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Lista y filtra las citas agendadas para el calendario',
    description:
      'Devuelve las citas paginadas con su fecha, estado, horario de atención, ' +
      'solicitante, solicitud y materiales reservados. Permite filtrar por ' +
      'material, solicitante, estado y rango de fechas, y ordenar por fecha de ' +
      'la cita o fecha de creación. Solo para PERSONAL y ADMIN (HU-19).',
  })
  @ApiOkResponse({
    description: 'Página de citas agendadas',
    type: PaginatedAppointmentsResponseDto,
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
    description: 'Solo PERSONAL o ADMIN pueden consultar las citas',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  list(
    @Query() query: ListAppointmentsQueryDto,
  ): Promise<PaginatedAppointmentsResponseDto> {
    return this.listAppointmentsUseCase.execute(query);
  }

  @Get('capacity')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Consulta la capacidad diaria actual de la sala de consulta',
    description:
      'Devuelve el límite diario de citas configurado para la sala. Si no ' +
      'se ha guardado una configuración, devuelve 15 citas por día por defecto ' +
      '(HU-20.1). Solo para PERSONAL y ADMIN.',
  })
  @ApiOkResponse({
    description: 'Capacidad diaria vigente de la sala',
    type: RoomCapacityResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo PERSONAL o ADMIN pueden consultar la capacidad',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  getCapacity(): Promise<RoomCapacityResponseDto> {
    return this.getRoomCapacityUseCase.execute();
  }

  @Put('capacity')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Configura la capacidad diaria de la sala de consulta',
    description:
      'Solo para ADMIN. Guarda el nuevo límite diario (entero mayor que 0) y ' +
      'lo aplica a las citas nuevas sin cancelar ni modificar las existentes ' +
      '(HU-20.1, RN-19). PERSONAL y PUBLICO reciben 403.',
  })
  @ApiOkResponse({
    description: 'Capacidad diaria actualizada',
    type: RoomCapacityResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'La capacidad no es un número entero mayor que 0',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo un administrador puede cambiar la capacidad',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  updateCapacity(
    @Body() dto: UpdateRoomCapacityDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RoomCapacityResponseDto> {
    return this.updateRoomCapacityUseCase.execute({
      dailyCapacity: dto.dailyCapacity,
      userId: user.id,
    });
  }

  @Get('occupancy')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Consulta la ocupación diaria de la sala en un rango de fechas',
    description:
      'Devuelve la capacidad diaria vigente y la cantidad de citas activas ' +
      '(PROGRAMADA y CUMPLIDA) por cada día del rango indicado. Solo para ' +
      'PERSONAL y ADMIN (HU-20.1).',
  })
  @ApiOkResponse({
    description: 'Ocupación diaria de la sala en el rango solicitado',
    type: RoomOccupancyResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Rango de fechas inválido o mayor al límite permitido',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo PERSONAL o ADMIN pueden consultar la ocupación',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  getOccupancy(
    @Query() query: GetRoomOccupancyQueryDto,
  ): Promise<RoomOccupancyResponseDto> {
    return this.getRoomOccupancyUseCase.execute({
      from: query.from,
      to: query.to,
    });
  }

  @Patch(':id/reschedule')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Reprograma una cita programada a otro día',
    description:
      'Solo para PERSONAL y ADMIN (HU-21). Mueve una cita PROGRAMADA a otro ' +
      'día hábil de atención (lunes a sábado), revalidando la disponibilidad ' +
      'de los materiales de la solicitud (HU-20) y la capacidad diaria de la ' +
      'sala (HU-20.1). El cambio queda en el historial de estados y se ' +
      'notifica por correo al solicitante (HU-23).',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la cita' })
  @ApiOkResponse({
    description: 'Cita reprogramada y registro guardado en el historial',
    type: ScheduleAppointmentResponseDto,
  })
  @ApiBadRequestResponse({
    description:
      'Identificador o fecha inválidos, la fecha cae en domingo o es igual ' +
      'a la fecha actual (INVALID_APPOINTMENT_DATE)',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo PERSONAL o ADMIN pueden reprogramar una cita',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'La cita no existe (APPOINTMENT_NOT_FOUND)',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'La cita no está PROGRAMADA (APPOINTMENT_NOT_SCHEDULED), un material ya ' +
      'tiene cita ese día (MATERIAL_ALREADY_BOOKED) o no está disponible ' +
      '(MATERIAL_NOT_AVAILABLE), o la sala alcanzó su capacidad diaria ' +
      '(ROOM_CAPACITY_EXCEEDED)',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  reschedule(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RescheduleAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ScheduleAppointmentResponseDto> {
    return this.rescheduleAppointmentUseCase.execute({
      appointmentId: id,
      date: body.date,
      comment: body.comment,
      userId: user.id,
    });
  }

  @Patch(':id/cancel')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Cancela una cita programada y libera el material',
    description:
      'Solo para PERSONAL y ADMIN (HU-21). Marca la cita como CANCELADA, ' +
      'libera el día reservado de sus materiales y devuelve la solicitud a ' +
      'DISPONIBLE (HU-14). El cambio queda en el historial y se notifica por ' +
      'correo al solicitante (HU-23).',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la cita' })
  @ApiOkResponse({
    description: 'Cita cancelada y solicitud devuelta a DISPONIBLE',
    type: CancelAppointmentResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Identificador o comentario inválidos',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Falta el access token o no es válido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo PERSONAL o ADMIN pueden cancelar una cita',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'La cita no existe (APPOINTMENT_NOT_FOUND)',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'La cita no está PROGRAMADA (APPOINTMENT_NOT_SCHEDULED) o la solicitud ' +
      'ya no está AGENDADA (INVALID_STATUS_TRANSITION)',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CancelAppointmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CancelAppointmentResponseDto> {
    return this.cancelAppointmentUseCase.execute({
      appointmentId: id,
      comment: body.comment,
      userId: user.id,
    });
  }

  @Post(':id/materials/:materialId/deliver')
  @Roles('PERSONAL', 'ADMIN')
  @ApiOperation({
    summary: 'Registra la entrega física de un material para una cita del día',
    description:
      'Solo para PERSONAL y ADMIN (HU-72). Para una cita PROGRAMADA del día ' +
      'de hoy (hora America/Bogota), registra la hora de entrega, el ' +
      'funcionario responsable y observaciones opcionales, y cambia el ' +
      'material al estado EN_USO. Permite volver a entregar el mismo material ' +
      'en la misma cita una vez haya sido devuelto.',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la cita' })
  @ApiParam({ name: 'materialId', description: 'Identificador del material' })
  @ApiCreatedResponse({
    description: 'Entrega registrada y material marcado EN_USO',
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
    description: 'Solo PERSONAL o ADMIN pueden registrar entregas',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description:
      'La cita no existe (APPOINTMENT_NOT_FOUND) o el material no pertenece a ' +
      'la cita (APPOINTMENT_MATERIAL_NOT_FOUND)',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'La cita no está PROGRAMADA (APPOINTMENT_NOT_SCHEDULED), no es del día ' +
      'de hoy (APPOINTMENT_NOT_TODAY), el material ya está en uso ' +
      '(MATERIAL_IN_USE) o no está disponible (MATERIAL_NOT_AVAILABLE)',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  deliverMaterial(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('materialId', new ParseUUIDPipe()) materialId: string,
    @Body() body: DeliverMaterialDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MaterialLoanResponseDto> {
    return this.deliverMaterialUseCase.execute({
      appointmentId: id,
      materialId,
      userId: user.id,
      notes: body.notes,
    });
  }
}
