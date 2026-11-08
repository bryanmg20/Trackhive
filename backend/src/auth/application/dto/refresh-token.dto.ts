import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsNotEmpty, IsString } from 'class-validator';

/** Body of the refresh and logout endpoints. */
export class RefreshTokenDto {
  @ApiProperty({
    description:
      'Refresh token recibido al iniciar sesión o en la última renovación',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: 'El refresh token debe ser texto' })
  @IsNotEmpty({ message: 'El refresh token es obligatorio' })
  @IsJWT({ message: 'El refresh token no tiene un formato válido' })
  refreshToken: string;
}
