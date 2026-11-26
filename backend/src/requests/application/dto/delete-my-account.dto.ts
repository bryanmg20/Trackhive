import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean } from 'class-validator';
export class DeleteMyAccountDto {
  @ApiProperty({
    description: 'Confirmación explícita de eliminación irreversible',
    example: true,
  })
  @IsBoolean()
  @Equals(true)
  confirmation: boolean;
}
