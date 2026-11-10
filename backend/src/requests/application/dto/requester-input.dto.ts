import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { NAME_MAX_LENGTH } from '../../../users/domain/person-name';

const trimText = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const trimOptionalText = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

const REQUESTER_TYPES = [
  'INVESTIGADOR',
  'ESTUDIANTE',
  'DOCENTE',
  'CIUDADANO',
  'ENTIDAD',
] as const;

const DOCUMENT_TYPES = ['CC', 'CE', 'TI', 'PAS', 'NIT'] as const;

export class RequesterInputDto {
  @ApiProperty({
    description:
      'Correo del solicitante. Es obligatorio porque lo identifica y recibe las notificaciones.',
    example: 'visitante@ejemplo.com',
    maxLength: 160,
  })
  @Transform(normalizeEmail)
  @IsString({ message: 'El correo del solicitante debe ser texto' })
  @IsNotEmpty({ message: 'El correo del solicitante es obligatorio' })
  @IsEmail({}, { message: 'El correo del solicitante no es válido' })
  @MaxLength(160, {
    message: 'El correo del solicitante no puede superar los 160 caracteres',
  })
  email: string;

  @ApiPropertyOptional({
    description:
      'Usuario existente al que se asocia la solicitud. Si se envía, los datos personales se toman de la cuenta.',
    example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f',
  })
  @IsOptional()
  @IsUUID('4', { message: 'El usuario asociado no es un UUID válido' })
  userId?: string;

  @ApiPropertyOptional({
    description:
      'Primer nombre. Obligatorio cuando no se asocia un usuario existente.',
    example: 'Ana',
    maxLength: NAME_MAX_LENGTH,
  })
  @Transform(trimText)
  @ValidateIf((requester: RequesterInputDto) => !requester.userId)
  @IsString({ message: 'El primer nombre del solicitante debe ser texto' })
  @IsNotEmpty({ message: 'El primer nombre del solicitante es obligatorio' })
  @MaxLength(NAME_MAX_LENGTH, {
    message: `El primer nombre del solicitante no puede superar los ${NAME_MAX_LENGTH} caracteres`,
  })
  firstName?: string;

  @ApiPropertyOptional({
    description: 'Segundo nombre; opcional',
    example: 'María',
    maxLength: NAME_MAX_LENGTH,
    type: String,
    nullable: true,
  })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'El segundo nombre del solicitante debe ser texto' })
  @MaxLength(NAME_MAX_LENGTH, {
    message: `El segundo nombre del solicitante no puede superar los ${NAME_MAX_LENGTH} caracteres`,
  })
  middleName?: string | null;

  @ApiPropertyOptional({
    description:
      'Primer apellido. Obligatorio cuando no se asocia un usuario existente.',
    example: 'Pérez',
    maxLength: NAME_MAX_LENGTH,
  })
  @Transform(trimText)
  @ValidateIf((requester: RequesterInputDto) => !requester.userId)
  @IsString({ message: 'El primer apellido del solicitante debe ser texto' })
  @IsNotEmpty({ message: 'El primer apellido del solicitante es obligatorio' })
  @MaxLength(NAME_MAX_LENGTH, {
    message: `El primer apellido del solicitante no puede superar los ${NAME_MAX_LENGTH} caracteres`,
  })
  lastName?: string;

  @ApiPropertyOptional({
    description: 'Segundo apellido; opcional',
    example: 'Gómez',
    maxLength: NAME_MAX_LENGTH,
    type: String,
    nullable: true,
  })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'El segundo apellido del solicitante debe ser texto' })
  @MaxLength(NAME_MAX_LENGTH, {
    message: `El segundo apellido del solicitante no puede superar los ${NAME_MAX_LENGTH} caracteres`,
  })
  secondLastName?: string | null;

  @ApiPropertyOptional({
    description: 'Teléfono de contacto; opcional',
    example: '3001234567',
    maxLength: 20,
    type: String,
    nullable: true,
  })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'El teléfono del solicitante debe ser texto' })
  @Matches(/^[0-9+()\s-]{7,20}$/, {
    message: 'El teléfono del solicitante no tiene un formato válido',
  })
  phone?: string | null;

  @ApiPropertyOptional({
    description: 'Tipo de solicitante; por defecto CIUDADANO',
    enum: REQUESTER_TYPES,
    example: 'CIUDADANO',
  })
  @IsOptional()
  @IsIn(REQUESTER_TYPES, {
    message: 'El tipo de solicitante no es válido',
  })
  requesterType?: (typeof REQUESTER_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Institución del solicitante; opcional',
    example: 'Universidad del Norte',
    maxLength: 150,
    type: String,
    nullable: true,
  })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'La institución debe ser texto' })
  @MaxLength(150, {
    message: 'La institución no puede superar los 150 caracteres',
  })
  institution?: string | null;

  @ApiPropertyOptional({
    description: 'Tipo de documento de identidad; opcional',
    enum: DOCUMENT_TYPES,
    example: 'CC',
  })
  @IsOptional()
  @IsIn(DOCUMENT_TYPES, {
    message: 'El tipo de documento no es válido',
  })
  documentType?: (typeof DOCUMENT_TYPES)[number];

  @ApiPropertyOptional({
    description: 'Número de documento de identidad; opcional',
    example: '123456789',
    maxLength: 20,
    type: String,
    nullable: true,
  })
  @Transform(trimOptionalText)
  @IsOptional()
  @IsString({ message: 'El número de documento debe ser texto' })
  @MaxLength(20, {
    message: 'El número de documento no puede superar los 20 caracteres',
  })
  documentNumber?: string | null;
}
