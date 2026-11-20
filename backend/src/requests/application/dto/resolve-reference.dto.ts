import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ResolveReferenceDto {
  @ApiProperty({
    description:
      'Material del catálogo que corresponde a la referencia, normalmente el que trajo la sincronización tras digitalizarlo',
    example: '3f1c2a9e-7b4d-4c1a-9e2f-1a2b3c4d5e6f',
  })
  @IsUUID('4', { message: 'El material no es un UUID válido' })
  materialId: string;
}
