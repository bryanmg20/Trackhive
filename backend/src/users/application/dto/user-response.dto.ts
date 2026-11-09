import { ApiProperty } from '@nestjs/swagger';
import { NAME_MAX_LENGTH } from '../../domain/person-name';
import type { UserRole } from '../../domain/user-role';

export class UserResponseDto {
  @ApiProperty({
    description: 'Identificador único del usuario',
    example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f',
  })
  id: string;

  @ApiProperty({
    description: 'Primer nombre',
    example: 'Ana',
    maxLength: NAME_MAX_LENGTH,
  })
  firstName: string;

  @ApiProperty({
    description: 'Segundo nombre; null si no tiene',
    example: 'María',
    maxLength: NAME_MAX_LENGTH,
    type: String,
    nullable: true,
  })
  middleName: string | null;

  @ApiProperty({
    description: 'Primer apellido',
    example: 'Pérez',
    maxLength: NAME_MAX_LENGTH,
  })
  lastName: string;

  @ApiProperty({
    description: 'Segundo apellido; null si no tiene',
    example: 'Gómez',
    maxLength: NAME_MAX_LENGTH,
    type: String,
    nullable: true,
  })
  secondLastName: string | null;

  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'investigador@ejemplo.com',
  })
  email: string;

  @ApiProperty({
    description: 'Rol asignado por el servidor',
    enum: ['ADMIN', 'PERSONAL', 'PUBLICO'],
    example: 'PUBLICO',
  })
  role: UserRole;
}
