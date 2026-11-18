import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

/** A staff account as the administrator sees it (HU-05). */
export class StaffUserResponseDto extends UserResponseDto {
  @ApiProperty({
    description:
      'false si la cuenta está desactivada y no puede iniciar sesión',
    example: true,
  })
  active: boolean;
}

export class PaginatedStaffUsersResponseDto {
  @ApiProperty({ type: [StaffUserResponseDto] })
  items: StaffUserResponseDto[];

  @ApiProperty({ description: 'Página actual, desde 1', example: 1 })
  page: number;

  @ApiProperty({ description: 'Cuentas por página', example: 20 })
  limit: number;

  @ApiProperty({
    description: 'Total de cuentas que cumplen los filtros',
    example: 3,
  })
  total: number;
}
