import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AGE_RANGES } from '../../domain/enums/age-range';
import { POPULATION_GROUPS } from '../../domain/enums/population-group';

export class MyProfileResponseDto {
  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  municipality: string | null;

  @ApiPropertyOptional({ nullable: true, enum: AGE_RANGES })
  ageRange: string | null;

  @ApiPropertyOptional({ nullable: true, enum: POPULATION_GROUPS })
  populationGroup: string | null;
}
