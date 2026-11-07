import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @ApiProperty({
    description: 'Correo electrónico de la cuenta',
    example: 'investigador@ejemplo.com',
  })
  @Transform(normalizeEmail)
  @IsString({ message: 'El correo debe ser texto' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  email: string;

  // No length rules: a wrong password must get 401, not a 400 that hints at it
  @ApiProperty({
    description: 'Contraseña de la cuenta',
    example: 'secreto123',
    writeOnly: true,
  })
  @IsString({ message: 'La contraseña debe ser texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password: string;
}
