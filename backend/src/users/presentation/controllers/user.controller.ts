import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../../../auth/presentation/decorators/public.decorator';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { CreateUserDto } from '../../application/dto/create-user.dto';
import { UserResponseDto } from '../../application/dto/user-response.dto';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';

@ApiTags('Users')
@Controller('users')
export class UserController {
  constructor(private readonly createUserUseCase: CreateUserUseCase) {}

  // Registration is open: the person has no account yet
  @Public()
  @Post()
  @ApiOperation({
    summary: 'Registra una cuenta de usuario público',
    description:
      'Crea una cuenta con rol PUBLICO, almacena la contraseña con argon2 y ' +
      'rechaza correos ya registrados.',
  })
  @ApiCreatedResponse({
    description: 'Cuenta creada',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o campos no permitidos',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Ya existe una cuenta con ese correo',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    // The controller does NOT talk to the database:
    // it only asks the use case to execute the action.
    // Domain errors are translated by the global filter.
    return this.createUserUseCase.execute({
      firstName: dto.firstName,
      middleName: dto.middleName,
      lastName: dto.lastName,
      secondLastName: dto.secondLastName,
      email: dto.email,
      password: dto.password,
    });
  }
}
