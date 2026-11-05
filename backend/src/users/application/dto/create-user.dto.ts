import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'Correo electrónico del usuario',
    example: 'usuario@ejemplo.com',
    maxLength: 160,
  })
  @IsString({ message: 'El correo debe ser texto' })
  @IsNotEmpty({ message: 'El correo es obligatorio' })
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @MaxLength(160, {
    message: 'El correo no puede superar los 160 caracteres',
  })
  email: string;
}
