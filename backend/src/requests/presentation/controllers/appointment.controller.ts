import { Body, Controller, Get, Put, Query } from '@nestjs/common';
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
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../auth/presentation/guards/authenticated-user';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { PaginatedAppointmentsResponseDto } from '../../application/dto/appointment-list-response.dto';
import { GetRoomOccupancyQueryDto } from '../../application/dto/get-room-occupancy-query.dto';
import { ListAppointmentsQueryDto } from '../../application/dto/list-appointments-query.dto';
import { RoomCapacityResponseDto } from '../../application/dto/room-capacity-response.dto';
import { RoomOccupancyResponseDto } from '../../application/dto/room-occupancy-response.dto';
import { UpdateRoomCapacityDto } from '../../application/dto/update-room-capacity.dto';
import { GetRoomCapacityUseCase } from '../../application/use-cases/get-room-capacity.use-case';
import { GetRoomOccupancyUseCase } from '../../application/use-cases/get-room-occupancy.use-case';
import { ListAppointmentsUseCase } from '../../application/use-cases/list-appointments.use-case';
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
}
