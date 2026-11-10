import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { CreateRequestDto } from './create-request.dto';
import { RequesterInputDto } from './requester-input.dto';

export class CreateRequestOnBehalfDto extends CreateRequestDto {
  @ApiProperty({
    description:
      'Solicitante de la solicitud. Puede ser un usuario existente o solo sus datos de contacto.',
    type: RequesterInputDto,
  })
  @IsDefined({ message: 'Los datos del solicitante son obligatorios' })
  @ValidateNested()
  @Type(() => RequesterInputDto)
  requester: RequesterInputDto;
}
