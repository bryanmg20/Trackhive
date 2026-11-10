import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

const normalizeEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class FindRequesterQueryDto {
  @ApiProperty({
    description: 'Correo del solicitante que se quiere buscar',
    example: 'visitante@ejemplo.com',
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
}
