import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { MAX_SYNC_ERROR_LENGTH } from '../../domain/entities/sync-run.entity';
import { SYNC_RUN_RESULTS } from '../../domain/enums/sync-run-status';
import type { SyncRunResult } from '../../domain/enums/sync-run-status';
import { MAX_PAGES_PER_RUN } from '../sync-limits';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** How the agent closes a run (HU-137). */
export class CloseSyncRunDto {
  @ApiProperty({
    description:
      'OK si el agente envió todas las páginas de todas las raíces sin errores; ' +
      'ERROR si algo falló (Everything no respondió, se agotaron los reintentos…). ' +
      'Solo una corrida OK y completa marca «copia digital no encontrada».',
    enum: SYNC_RUN_RESULTS,
    example: 'OK',
  })
  @IsIn(SYNC_RUN_RESULTS, {
    message: `El resultado debe ser uno de: ${SYNC_RUN_RESULTS.join(', ')}`,
  })
  result: SyncRunResult;

  @ApiPropertyOptional({
    description:
      'Obligatorio con OK: cuántas páginas envió el agente, numeradas desde 1. ' +
      'Si no llegaron exactamente esas, la corrida termina con error.',
    minimum: 1,
    maximum: MAX_PAGES_PER_RUN,
    example: 4,
  })
  @ValidateIf(
    (dto: CloseSyncRunDto) =>
      dto.result === 'OK' || dto.pageCount !== undefined,
  )
  @IsInt({ message: 'El número de páginas debe ser un entero' })
  @Min(1, { message: 'El número de páginas debe ser al menos 1' })
  @Max(MAX_PAGES_PER_RUN, {
    message: `El número de páginas no puede superar ${MAX_PAGES_PER_RUN}`,
  })
  pageCount?: number;

  @ApiPropertyOptional({
    description: 'Obligatorio con ERROR: qué falló',
    maxLength: MAX_SYNC_ERROR_LENGTH,
    example: 'Everything no respondió en 30 s',
  })
  @ValidateIf(
    (dto: CloseSyncRunDto) =>
      dto.result === 'ERROR' || dto.errorMessage !== undefined,
  )
  @Transform(trim)
  @IsString({ message: 'El motivo del error debe ser texto' })
  @IsNotEmpty({ message: 'El motivo del error es obligatorio' })
  @MaxLength(MAX_SYNC_ERROR_LENGTH, {
    message: `El motivo del error no puede superar los ${MAX_SYNC_ERROR_LENGTH} caracteres`,
  })
  errorMessage?: string;
}
