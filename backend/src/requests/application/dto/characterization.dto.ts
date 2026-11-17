import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AGE_RANGES } from '../../domain/enums/age-range';
import { POPULATION_GROUPS } from '../../domain/enums/population-group';

export class CharacterizationDto {
  @ApiProperty({
    description: 'Municipio o distrito de residencia',
    maxLength: 120,
    example: 'Barranquilla',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'El municipio o distrito es obligatorio' })
  @MaxLength(120)
  municipality: string;

  @ApiProperty({
    enum: AGE_RANGES,
    description: 'Rango de edad, sin fecha de nacimiento',
  })
  @IsIn(AGE_RANGES, { message: 'Seleccione un rango de edad válido' })
  ageRange: string;

  @ApiPropertyOptional({
    description:
      'Grupo poblacional; opcional. Se puede omitir o elegir PREFIERO_NO_RESPONDER',
    nullable: true,
    enum: POPULATION_GROUPS,
  })
  @IsOptional()
  @IsIn(POPULATION_GROUPS, {
    message: 'Seleccione un grupo poblacional válido',
  })
  populationGroup?: string | null;
}
