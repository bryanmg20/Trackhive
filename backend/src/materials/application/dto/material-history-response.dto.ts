import { ApiProperty } from '@nestjs/swagger';
import { MATERIAL_STATUSES } from '../../domain/enums/material-status';
import type { MaterialStatus } from '../../domain/enums/material-status';
import { MaterialLoanResponseDto } from './material-loan-response.dto';

export class MaterialHistorySummaryDto {
  @ApiProperty({ example: 'c3f6c8f0-1c2b-4e3d-8f4a-123456789abc' })
  id: string;

  @ApiProperty({ example: 'TH-DOC-0001' })
  catalogCode: string;

  @ApiProperty({ example: 'Acta de fundación de la villa' })
  title: string;

  @ApiProperty({ enum: MATERIAL_STATUSES, example: 'DISPONIBLE' })
  status: MaterialStatus;
}

export class MaterialHistoryResponseDto {
  @ApiProperty({ type: MaterialHistorySummaryDto })
  material: MaterialHistorySummaryDto;

  @ApiProperty({
    description:
      'Último préstamo registrado del material (quién lo tuvo por última vez y cuándo lo devolvió); null si nunca ha sido entregado',
    type: MaterialLoanResponseDto,
    nullable: true,
  })
  lastLoan: MaterialLoanResponseDto | null;

  @ApiProperty({
    description:
      'Historial de entregas y devoluciones del más reciente al más antiguo',
    type: [MaterialLoanResponseDto],
  })
  items: MaterialLoanResponseDto[];

  @ApiProperty({ description: 'Página actual, desde 1', example: 1 })
  page: number;

  @ApiProperty({ description: 'Registros por página', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Total de entregas registradas', example: 2 })
  total: number;
}
