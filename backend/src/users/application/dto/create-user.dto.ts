import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { NAME_MAX_LENGTH } from '../../domain/person-name';

const trimText = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

// An optional name sent blank means "not given": it becomes null. It must run
// before @IsOptional, which only skips null and undefined, not ''.
const trimOptionalText = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateUserDto {
  @ApiProperty({
    description: 'Primer nombre',
    example: 'Ana',
    maxLength: NAME_MAX_LENGTH,
  })
  @Transform(trimText)
  @IsString({ message: 'El primer nombre debe ser texto' })
  @IsNotEmpty({ message: 'El primer nombre es obligatorio' })
  @MaxLength(NAME_MAX_LENGTH, {
    message: `El primer nombre no puede superar los ${NAME_MAX_LENGTH} caracteres`,
  })
  firstName: string;

  @ApiPropertyOptional({
    description: 'Segundo nombre. Si se omite o llega vacío, se guarda null',
    example: 'María',
    maxLength: NAME_MAX_LENGTH,
    type: String,
    nullable: true,
  })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'El segundo nombre debe ser texto' })
  @MaxLength(NAME_MAX_LENGTH, {
    message: `El segundo nombre no puede superar los ${NAME_MAX_LENGTH} caracteres`,
  })
  middleName?: string | null;

  @ApiProperty({
    description: 'Primer apellido',
    example: 'Pérez',
    maxLength: NAME_MAX_LENGTH,
  })
  @Transform(trimText)
  @IsString({ message: 'El primer apellido debe ser texto' })
  @IsNotEmpty({ message: 'El primer apellido es obligatorio' })
  @MaxLength(NAME_MAX_LENGTH, {
    message: `El primer apellido no puede superar los ${NAME_MAX_LENGTH} caracteres`,
  })
  lastName: string;

  @ApiPropertyOptional({
    description: 'Segundo apellido. Si se omite o llega vacío, se guarda null',
    example: 'Gómez',
    maxLength: NAME_MAX_LENGTH,
    type: String,
    nullable: true,
  })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'El segundo apellido debe ser texto' })
  @MaxLength(NAME_MAX_LENGTH, {
    message: `El segundo apellido no puede superar los ${NAME_MAX_LENGTH} caracteres`,
  })
  secondLastName?: string | null;

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
