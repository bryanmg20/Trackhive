import { ApiProperty } from '@nestjs/swagger';
import type { UserRole } from '../../domain/user-role';

export class UserResponseDto {
  @ApiProperty({
    description: 'Identificador único del usuario',
    example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f',
  })
  id: string;

  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Ana Pérez',
  })
  fullName: string;

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
