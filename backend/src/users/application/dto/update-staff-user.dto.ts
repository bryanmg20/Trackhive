import { ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { IsBoolean, ValidateIf } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

// Not sent means "no change"; null is not a valid value for this field
const isSent = (_dto: object, value: unknown): boolean => value !== undefined;

/**
 * Body of `PATCH /api/v1/users/staff/:id` (HU-05). Every field is optional:
 * only the ones sent change. The password and the role are not edited here,
 * so no account can be changed from PERSONAL to ADMIN.
 */
export class UpdateStaffUserDto extends PartialType(
  PickType(CreateUserDto, [
    'firstName',
    'middleName',
    'lastName',
    'secondLastName',
    'email',
  ] as const),
) {
  @ApiPropertyOptional({
    description:
      'false desactiva la cuenta (no puede iniciar sesión); true la reactiva',
    example: false,
  })
  @ValidateIf(isSent)
  @IsBoolean({ message: 'El estado de la cuenta debe ser true o false' })
  active?: boolean;
}
