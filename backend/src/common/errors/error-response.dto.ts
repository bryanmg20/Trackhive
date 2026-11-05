import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorDetail } from './error-detail';

export class ErrorDetailDto implements ErrorDetail {
  @ApiProperty({
    description: 'Campo de la petición que no pasó la validación',
    example: 'email',
  })
  field: string;

  @ApiProperty({
    description: 'Motivos por los que el campo es inválido',
    type: [String],
    example: ['El correo no tiene un formato válido'],
  })
  messages: string[];
}

/** Uniform format for every API error response. */
export class ErrorResponseDto {
  @ApiProperty({ description: 'Código HTTP', example: 400 })
  statusCode: number;

  @ApiProperty({
    description: 'Código estable para que el cliente reaccione por tipo',
    example: 'VALIDATION_ERROR',
  })
  code: string;

  @ApiProperty({
    description: 'Mensaje legible para la persona usuaria',
    example: 'La petición contiene datos inválidos',
  })
  message: string;

  @ApiPropertyOptional({
    description: 'Errores por campo; solo aparece en validaciones de entrada',
    type: [ErrorDetailDto],
  })
  details?: ErrorDetailDto[];

  @ApiProperty({
    description: 'Momento en que ocurrió el error (ISO 8601, UTC)',
    example: '2026-11-04T15:00:00.000Z',
  })
  timestamp: string;

  @ApiProperty({
    description: 'Ruta solicitada',
    example: '/api/v1/users',
  })
  path: string;
}
