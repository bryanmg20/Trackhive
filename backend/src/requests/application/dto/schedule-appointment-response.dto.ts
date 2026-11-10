import { ApiProperty } from '@nestjs/swagger';
import { REQUEST_STATUSES } from '../../domain/request-status';
import type { RequestStatus } from '../../domain/request-status';
import { StatusChangeDto } from './change-request-status-response.dto';

export class AppointmentServiceHoursDto {
  @ApiProperty({ description: 'Hora de apertura (Bogotá)', example: '08:00' })
  opensAt: string;

  @ApiProperty({ description: 'Hora de cierre (Bogotá)', example: '17:00' })
  closesAt: string;
}

export class AppointmentRequesterDto {
  @ApiProperty({ example: '7a1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ description: 'Nombre completo', example: 'Juan Pérez' })
  name: string;
}

export class AppointmentMaterialDto {
  @ApiProperty({ example: 'c3f6c8f0-1c2b-4e3d-8f4a-123456789abc' })
  id: string;

  @ApiProperty({ example: 'AHB-PN-1890-001' })
  catalogCode: string;

  @ApiProperty({ example: 'Protocolo notarial de 1890' })
  title: string;
}

export class AppointmentDto {
  @ApiProperty({ example: '9b1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({
    description: 'Día de la cita (YYYY-MM-DD)',
    example: '2026-11-20',
  })
  date: string;

  @ApiProperty({
    type: AppointmentServiceHoursDto,
    description: 'Horario de atención de ese día: la cita no tiene hora',
  })
  serviceHours: AppointmentServiceHoursDto;

  @ApiProperty({ enum: ['PROGRAMADA'], example: 'PROGRAMADA' })
  status: 'PROGRAMADA';

  @ApiProperty({ type: AppointmentRequesterDto })
  requester: AppointmentRequesterDto;

  @ApiProperty({
    type: AppointmentMaterialDto,
    isArray: true,
    description: 'Todos los materiales de la solicitud',
  })
  materials: AppointmentMaterialDto[];
}

export class ScheduleAppointmentResponseDto {
  @ApiProperty({
    description: 'Identificador de la solicitud',
    example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f',
  })
  id: string;

  @ApiProperty({ enum: REQUEST_STATUSES, example: 'AGENDADA' })
  status: RequestStatus;

  @ApiProperty({
    description: 'Estados a los que puede pasar desde AGENDADA (HU-14)',
    enum: REQUEST_STATUSES,
    isArray: true,
    example: ['DISPONIBLE', 'ATENDIDA'],
  })
  allowedTransitions: RequestStatus[];

  @ApiProperty({ type: AppointmentDto })
  appointment: AppointmentDto;

  @ApiProperty({
    type: StatusChangeDto,
    description: 'Registro del paso a AGENDADA en el historial de estados',
  })
  statusChange: StatusChangeDto;
}
