import { PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

/**
 * Body of `POST /api/v1/users/staff` (HU-05). It reuses the names, email and
 * password rules of the public registration, without the characterization or
 * the privacy consent. There is no role: the server always creates a PERSONAL
 * account, and a `role` field is rejected as not allowed.
 */
export class CreateStaffUserDto extends PickType(CreateUserDto, [
  'firstName',
  'middleName',
  'lastName',
  'secondLastName',
  'email',
  'password',
] as const) {}
