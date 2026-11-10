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
import { PaginatedAppointmentsResponseDto } from '../../application/dto/appointment-list-response.dto';
import { ListAppointmentsQueryDto } from '../../application/dto/list-appointments-query.dto';
import { ListAppointmentsUseCase } from '../../application/use-cases/list-appointments.use-case';

@ApiTags('Appointments')
@ApiBearerAuth()
@Controller('appointments')
export class AppointmentController {
  constructor(
    private readonly listAppointmentsUseCase: ListAppointmentsUseCase,
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
}
