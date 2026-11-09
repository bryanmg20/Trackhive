import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  MaxLength,
  IsUUID,
} from 'class-validator';

export class CreateRequestDto {
  @ApiProperty({
    type: [String],
    example: ['00000000-0000-0000-0000-000000000001'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  materialIds: string[];

  @ApiProperty({ example: 'Consulta para un trabajo de investigación' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason: string;

  @ApiProperty({ example: '2026-12-15' })
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  desiredDate: string;

  @ApiProperty({ enum: ['PRESENCIAL', 'DIGITAL'] })
  @IsIn(['PRESENCIAL', 'DIGITAL'])
  deliveryMode: 'PRESENCIAL' | 'DIGITAL';

  @ApiProperty({
    example: 'Necesito consultar los documentos originales',
    required: false,
  })
  @IsOptional()
  @IsString()
  requirementDescription?: string;
}
