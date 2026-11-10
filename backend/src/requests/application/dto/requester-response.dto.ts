import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequesterResponseDto {
  @ApiPropertyOptional({
    description: 'Identificador del solicitante; null si solo existe la cuenta',
    example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f',
    type: String,
    nullable: true,
  })
  requesterId: string | null;

  @ApiPropertyOptional({
    description: 'Identificador de la cuenta asociada; null si no tiene',
    example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f',
    type: String,
    nullable: true,
  })
  userId: string | null;

  @ApiProperty({ example: 'Ana' })
  firstName: string;

  @ApiPropertyOptional({
    example: 'María',
    type: String,
    nullable: true,
  })
  middleName: string | null;

  @ApiProperty({ example: 'Pérez' })
  lastName: string;

  @ApiPropertyOptional({
    example: 'Gómez',
    type: String,
    nullable: true,
  })
  secondLastName: string | null;

  @ApiProperty({ example: 'visitante@ejemplo.com' })
  email: string;

  @ApiPropertyOptional({
    example: '3001234567',
    type: String,
    nullable: true,
  })
  phone: string | null;

  @ApiPropertyOptional({
    description: 'Tipo de solicitante; null si solo existe la cuenta',
    example: 'CIUDADANO',
    type: String,
    nullable: true,
  })
  requesterType: string | null;

  @ApiPropertyOptional({
    example: 'Universidad del Norte',
    type: String,
    nullable: true,
  })
  institution: string | null;

  @ApiPropertyOptional({
    example: 'CC',
    type: String,
    nullable: true,
  })
  documentType: string | null;

  @ApiPropertyOptional({
    example: '123456789',
    type: String,
    nullable: true,
  })
  documentNumber: string | null;

  @ApiProperty({
    description: 'Tabla donde se encontró el correo',
    enum: ['REQUESTER', 'USER'],
    example: 'REQUESTER',
  })
  foundIn: 'REQUESTER' | 'USER';
}
