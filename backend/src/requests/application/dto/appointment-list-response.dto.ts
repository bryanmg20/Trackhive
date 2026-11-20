import { ApiProperty } from '@nestjs/swagger';
import { APPOINTMENT_STATUSES } from '../../domain/enums/appointment-status';
import type { AppointmentStatus } from '../../domain/enums/appointment-status';
import { DELIVERY_MODES } from '../../domain/enums/delivery-mode';
import type { DeliveryMode } from '../../domain/enums/delivery-mode';
import { REQUEST_STATUSES } from '../../domain/enums/request-status';
import type { RequestStatus } from '../../domain/enums/request-status';
import { AppointmentServiceHoursDto } from './schedule-appointment-response.dto';

export class AppointmentLocationDto {
  @ApiProperty({ example: 'D-01' })
  depot: string;

  @ApiProperty({ example: 'E-01' })
  shelf: string;

  @ApiProperty({ example: 'C-001' })
  box: string;
}

export class AppointmentLoanActorDto {
  @ApiProperty({ example: '2b1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ description: 'Nombre completo', example: 'Ana Gómez' })
  name: string;
}

export class AppointmentMaterialLoanDto {
  @ApiProperty({ example: '4f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ example: '2026-11-19T14:30:00.000Z' })
  handedOverAt: string;

  @ApiProperty({ type: AppointmentLoanActorDto })
  handedOverBy: AppointmentLoanActorDto;

  @ApiProperty({ nullable: true, type: String, example: null })
  deliveryNotes: string | null;

  @ApiProperty({ nullable: true, type: String, example: null })
  returnedAt: string | null;

  @ApiProperty({ nullable: true, type: AppointmentLoanActorDto })
  returnedBy: AppointmentLoanActorDto | null;

  @ApiProperty({ nullable: true, type: String, example: null })
  returnNotes: string | null;
}

export class AppointmentListMaterialDto {
  @ApiProperty({ example: 'c3f6c8f0-1c2b-4e3d-8f4a-123456789abc' })
  id: string;

  @ApiProperty({ example: 'TH-DOC-0001' })
  catalogCode: string;

  @ApiProperty({ example: 'Acta de fundación de la villa' })
  title: string;

  @ApiProperty({ example: 'DOCUMENTO' })
  materialType: string;

  @ApiProperty({
    description: 'Estado actual del material',
    example: 'DISPONIBLE',
  })
  status: string;

  @ApiProperty({
    description: 'Ubicación física; null si el material no la tiene (HU-134)',
    type: AppointmentLocationDto,
    nullable: true,
  })
  location: AppointmentLocationDto | null;

  @ApiProperty({
    description:
      'Préstamo abierto en esta cita; null si no está en uso en esta cita (HU-72)',
    type: AppointmentMaterialLoanDto,
    nullable: true,
  })
  activeLoan: AppointmentMaterialLoanDto | null;

  @ApiProperty({
    description:
      'Último préstamo registrado de este material en esta cita (HU-72)',
    type: AppointmentMaterialLoanDto,
    nullable: true,
  })
  lastLoan: AppointmentMaterialLoanDto | null;
}

export class AppointmentListRequestDto {
  @ApiProperty({ example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ example: 'SOL-2026-00001' })
  trackingCode: string;

  @ApiProperty({ enum: REQUEST_STATUSES, example: 'AGENDADA' })
  status: RequestStatus;

  @ApiProperty({ enum: DELIVERY_MODES, example: 'PRESENCIAL' })
  deliveryMode: DeliveryMode;
}

export class AppointmentListRequesterDto {
  @ApiProperty({ example: '7a1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ description: 'Nombre completo', example: 'Juan Carlos Pérez' })
  name: string;

  @ApiProperty({ nullable: true, type: String, example: 'juan@mail.com' })
  email: string | null;

  @ApiProperty({ nullable: true, type: String, example: '3001234567' })
  phone: string | null;

  @ApiProperty({ example: 'INVESTIGADOR' })
  requesterType: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Universidad del Norte',
  })
  institution: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'CC' })
  documentType: string | null;

  @ApiProperty({ nullable: true, type: String, example: '123456789' })
  documentNumber: string | null;
}

export class AppointmentScheduledByDto {
  @ApiProperty({ example: '2b1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ description: 'Nombre completo', example: 'Ana Gómez' })
  name: string;
}

export class AppointmentListItemDto {
  @ApiProperty({ example: '9b1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({
    description: 'Día de la cita (YYYY-MM-DD)',
    example: '2026-11-20',
  })
  date: string;

  @ApiProperty({
    type: AppointmentServiceHoursDto,
    description: 'Horario de atención de ese día',
  })
  serviceHours: AppointmentServiceHoursDto;

  @ApiProperty({ enum: APPOINTMENT_STATUSES, example: 'PROGRAMADA' })
  status: AppointmentStatus;

  @ApiProperty({ nullable: true, type: String, example: null })
  notes: string | null;

  @ApiProperty({
    description: 'Fecha y hora en que se agendó la cita',
    example: '2026-11-10T15:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({ type: AppointmentListRequestDto })
  request: AppointmentListRequestDto;

  @ApiProperty({ type: AppointmentListRequesterDto })
  requester: AppointmentListRequesterDto;

  @ApiProperty({ type: AppointmentScheduledByDto })
  scheduledBy: AppointmentScheduledByDto;

  @ApiProperty({ type: [AppointmentListMaterialDto] })
  materials: AppointmentListMaterialDto[];
}

export class PaginatedAppointmentsResponseDto {
  @ApiProperty({ type: [AppointmentListItemDto] })
  items: AppointmentListItemDto[];

  @ApiProperty({ description: 'Página actual, desde 1', example: 1 })
  page: number;

  @ApiProperty({ description: 'Citas por página', example: 20 })
  limit: number;

  @ApiProperty({
    description: 'Total de citas que cumplen los filtros',
    example: 4,
  })
  total: number;
}
