import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsUUID, Max, Min } from 'class-validator';
import { MAX_PAGES_PER_RUN } from '../sync-limits';

/** The run and the number of the page the agent sends (HU-137). */
export class SyncPageParamsDto {
  @ApiProperty({
    description: 'Identificador de la corrida que devolvió el inicio',
    format: 'uuid',
  })
  @IsUUID('all', {
    message: 'El identificador de la corrida debe ser un UUID',
  })
  runId: string;

  @ApiProperty({
    description:
      'Número de la página, desde 1. Enviar otra vez el mismo número la reemplaza, ' +
      'así que el agente puede reintentarla.',
    minimum: 1,
    maximum: MAX_PAGES_PER_RUN,
    example: 1,
  })
  @Type(() => Number)
  @IsInt({ message: 'El número de página debe ser un entero' })
  @Min(1, { message: 'El número de página debe ser al menos 1' })
  @Max(MAX_PAGES_PER_RUN, {
    message: `El número de página no puede superar ${MAX_PAGES_PER_RUN}`,
  })
  pageNumber: number;
}
