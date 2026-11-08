import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const trimText = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateUserDto {
  @ApiProperty({
    description: 'Nombre completo de la persona investigadora',
    example: 'Ana Pérez',
    maxLength: 120,
  })
  @Transform(trimText)
  @IsString({ message: 'El nombre completo debe ser texto' })
  @IsNotEmpty({ message: 'El nombre completo es obligatorio' })
  @MaxLength(120, {
    message: 'El nombre completo no puede superar los 120 caracteres',
  })
  fullName: string;

  @ApiProperty({
    description: 'Correo electrónico de la cuenta',
    example: 'investigador@ejemplo.com',
    maxLength: 160,
  })
  @Transform(normalizeEmail)
  @IsString({ message: 'El correo debe ser texto' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @MaxLength(160, {
    message: 'El correo no puede superar los 160 caracteres',
  })
  email: string;

  @ApiProperty({
    description: 'Contraseña de la cuenta; se almacena únicamente con hash',
    example: 'secreto123',
    minLength: 8,
    maxLength: 128,
    writeOnly: true,
  })
  @IsString({ message: 'La contraseña debe ser texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  @MinLength(8, {
    message: 'La contraseña debe tener al menos 8 caracteres',
  })
  @MaxLength(128, {
    message: 'La contraseña no puede superar los 128 caracteres',
  })
  @Matches(/\S/, {
    message: 'La contraseña debe contener al menos un carácter visible',
  })
  password: string;
}
