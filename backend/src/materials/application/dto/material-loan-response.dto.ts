import { ApiProperty } from '@nestjs/swagger';
import { MATERIAL_STATUSES } from '../../domain/enums/material-status';
import type { MaterialStatus } from '../../domain/enums/material-status';

export class MaterialLoanPersonDto {
  @ApiProperty({ example: '2b1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ description: 'Nombre completo', example: 'Ana Gómez' })
  name: string;
}

export class MaterialLoanAppointmentDto {
  @ApiProperty({ example: '9b1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({
    description: 'Día de la cita (YYYY-MM-DD)',
    example: '2026-11-19',
  })
  date: string;

  @ApiProperty({ example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  requestId: string;

  @ApiProperty({ example: 'SOL-2026-00001' })
  trackingCode: string;
}

export class MaterialLoanResponseDto {
  @ApiProperty({ example: '4f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ example: 'c3f6c8f0-1c2b-4e3d-8f4a-123456789abc' })
  materialId: string;

  @ApiProperty({ example: 'TH-DOC-0001' })
  materialCatalogCode: string;

  @ApiProperty({ example: 'Acta de fundación de la villa' })
  materialTitle: string;

  @ApiProperty({ enum: MATERIAL_STATUSES, example: 'EN_USO' })
  materialStatus: MaterialStatus;

  @ApiProperty({ type: MaterialLoanAppointmentDto })
  appointment: MaterialLoanAppointmentDto;

  @ApiProperty({
    description: 'Solicitante que consultó el material',
    type: MaterialLoanPersonDto,
  })
  requester: MaterialLoanPersonDto;

  @ApiProperty({
    description: 'Fecha y hora en que se entregó el material',
    example: '2026-11-19T14:30:00.000Z',
  })
  handedOverAt: string;

  @ApiProperty({
    description: 'Miembro del personal que entregó el material',
    type: MaterialLoanPersonDto,
  })
  handedOverBy: MaterialLoanPersonDto;

  @ApiProperty({
    description: 'Observaciones de la entrega',
    nullable: true,
    type: String,
    example: 'Entregado en sala con guantes',
  })
  deliveryNotes: string | null;

  @ApiProperty({
    description: 'Fecha y hora de devolución; null mientras siga en uso',
    nullable: true,
    type: String,
    example: '2026-11-19T16:15:00.000Z',
  })
  returnedAt: string | null;

  @ApiProperty({
    description:
      'Miembro del personal que recibió la devolución; null si sigue en uso',
    nullable: true,
    type: MaterialLoanPersonDto,
  })
  returnedBy: MaterialLoanPersonDto | null;

  @ApiProperty({
    description: 'Observaciones de la devolución',
    nullable: true,
    type: String,
    example: null,
  })
  returnNotes: string | null;
}
