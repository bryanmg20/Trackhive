import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  MaxLength,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { MaterialReferenceDto } from './material-reference.dto';

// Enough for any real request; it only stops an abusive payload
const MAX_REFERENCES = 20;

export class CreateRequestDto {
  @ApiProperty({
    description:
      'Materiales del catálogo. Puede ir vacío si la solicitud trae al menos una referencia (RN-04).',
    type: [String],
    required: false,
    example: ['00000000-0000-0000-0000-000000000001'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsUUID('4', { each: true })
  materialIds?: string[];

  @ApiProperty({
    description:
      'Materiales que no están en el catálogo, descritos por escrito (HU-09.2). Debe haber al menos un material o una referencia (RN-04).',
    type: [MaterialReferenceDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REFERENCES, {
    message: `No se pueden enviar más de ${MAX_REFERENCES} referencias`,
  })
  @ValidateNested({ each: true })
  @Type(() => MaterialReferenceDto)
  references?: MaterialReferenceDto[];

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
