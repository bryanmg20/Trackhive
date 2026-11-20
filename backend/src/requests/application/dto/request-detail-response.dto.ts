import { ApiProperty } from '@nestjs/swagger';
import { APPOINTMENT_STATUSES } from '../../domain/enums/appointment-status';
import type { AppointmentStatus } from '../../domain/enums/appointment-status';
import { DELIVERY_MODES } from '../../domain/enums/delivery-mode';
import type { DeliveryMode } from '../../domain/enums/delivery-mode';
import { REQUEST_STATUSES } from '../../domain/enums/request-status';
import type { RequestStatus } from '../../domain/enums/request-status';
import { AppointmentMaterialLoanDto } from './appointment-list-response.dto';
import { AppointmentServiceHoursDto } from './schedule-appointment-response.dto';

export class RequestDetailRequesterDto {
  @ApiProperty({ description: 'Nombre completo', example: 'Juan Carlos Pérez' })
  name: string;

  @ApiProperty({ nullable: true, type: String, example: 'juan@mail.com' })
  email: string | null;

  @ApiProperty({ nullable: true, type: String, example: '3001234567' })
  phone: string | null;

  @ApiProperty({ example: 'INVESTIGADOR' })
  requesterType: string;

  @ApiProperty({ nullable: true, type: String })
  institution: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'CC' })
  documentType: string | null;

  @ApiProperty({ nullable: true, type: String, example: '123456789' })
  documentNumber: string | null;
}

export class RequestDetailLocationDto {
  @ApiProperty({ example: 'D-01' })
  depot: string;

  @ApiProperty({ example: 'E-12' })
  shelf: string;

  @ApiProperty({ example: 'C-034' })
  box: string;
}

export class RequestDetailMaterialDto {
  @ApiProperty({ example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ example: 'TH-DOC-0001' })
  catalogCode: string;

  @ApiProperty({ example: 'Acta de fundación de la villa' })
  title: string;

  @ApiProperty({ example: 'DOCUMENTO' })
  materialType: string;

  @ApiProperty({ nullable: true, type: String })
  author: string | null;

  @ApiProperty({ example: 'Actas del Cabildo' })
  collection: string;

  @ApiProperty({ description: 'Estado del material', example: 'DISPONIBLE' })
  status: string;

  @ApiProperty({
    description: 'Ubicación física; null si el material no la tiene (HU-134)',
    type: RequestDetailLocationDto,
    nullable: true,
  })
  location: RequestDetailLocationDto | null;

  @ApiProperty({
    description: 'Resultado de la búsqueda de este material en la solicitud',
    example: 'PENDIENTE',
  })
  itemStatus: string;
}

export class RequestDetailAppointmentMaterialDto {
  @ApiProperty({ example: 'c3f6c8f0-1c2b-4e3d-8f4a-123456789abc' })
  id: string;

  @ApiProperty({ example: 'TH-DOC-0001' })
  catalogCode: string;

  @ApiProperty({ example: 'Acta de fundación de la villa' })
  title: string;

  @ApiProperty({ example: 'DISPONIBLE' })
  status: string;

  @ApiProperty({ type: AppointmentMaterialLoanDto, nullable: true })
  activeLoan: AppointmentMaterialLoanDto | null;

  @ApiProperty({ type: AppointmentMaterialLoanDto, nullable: true })
  lastLoan: AppointmentMaterialLoanDto | null;
}

export class RequestDetailAppointmentDto {
  @ApiProperty({ example: '9b1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({
    description: 'Día de la cita (YYYY-MM-DD)',
    example: '2026-11-19',
  })
  date: string;

  @ApiProperty({ type: AppointmentServiceHoursDto })
  serviceHours: AppointmentServiceHoursDto;

  @ApiProperty({ enum: APPOINTMENT_STATUSES, example: 'PROGRAMADA' })
  status: AppointmentStatus;

  @ApiProperty({ type: [RequestDetailAppointmentMaterialDto] })
  materials: RequestDetailAppointmentMaterialDto[];
}

export class RequestDetailResponseDto {
  @ApiProperty({ example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ example: 'SOL-2026-00001' })
  trackingCode: string;

  @ApiProperty({ enum: REQUEST_STATUSES })
  status: RequestStatus;

  @ApiProperty({
    description:
      'Estados a los que puede pasar desde el estado actual, según la ' +
      'máquina de estados del dominio (HU-14). Vacío en un estado final.',
    enum: REQUEST_STATUSES,
    isArray: true,
    example: ['EN_BUSQUEDA', 'RECHAZADA'],
  })
  allowedTransitions: RequestStatus[];

  @ApiProperty({ enum: DELIVERY_MODES })
  deliveryMode: DeliveryMode;

  @ApiProperty({ description: 'Canal por el que llegó', example: 'WEB' })
  originChannel: string;

  @ApiProperty({ nullable: true, type: String })
  reason: string | null;

  @ApiProperty()
  requirementDescription: string;

  @ApiProperty({
    description: 'Fecha deseada, formato YYYY-MM-DD',
    example: '2026-12-01',
  })
  desiredDate: string;

  @ApiProperty({
    description: 'Fecha acordada, formato YYYY-MM-DD',
    nullable: true,
    type: String,
  })
  committedDate: string | null;

  @ApiProperty({ example: '2026-11-10T15:00:00.000Z' })
  registeredAt: string;

  @ApiProperty({
    description: 'Motivo del rechazo; solo si está rechazada',
    nullable: true,
    type: String,
  })
  rejectionReason: string | null;

  @ApiProperty({ type: RequestDetailRequesterDto })
  requester: RequestDetailRequesterDto;

  @ApiProperty({ type: [RequestDetailMaterialDto] })
  materials: RequestDetailMaterialDto[];

  @ApiProperty({
    description:
      'Cita PROGRAMADA vigente de la solicitud con el estado de entrega de cada material; null si no tiene cita activa (HU-72)',
    type: RequestDetailAppointmentDto,
    nullable: true,
  })
  activeAppointment: RequestDetailAppointmentDto | null;
}
