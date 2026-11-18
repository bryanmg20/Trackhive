import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../auth/presentation/guards/authenticated-user';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { CreateStaffUserDto } from '../../application/dto/create-staff-user.dto';
import { ListStaffUsersQueryDto } from '../../application/dto/list-staff-users-query.dto';
import {
  PaginatedStaffUsersResponseDto,
  StaffUserResponseDto,
} from '../../application/dto/staff-user-response.dto';
import { UpdateStaffUserDto } from '../../application/dto/update-staff-user.dto';
import { CreateStaffUserUseCase } from '../../application/use-cases/create-staff-user.use-case';
import { ListStaffUsersUseCase } from '../../application/use-cases/list-staff-users.use-case';
import { UpdateStaffUserUseCase } from '../../application/use-cases/update-staff-user.use-case';

/**
 * Staff accounts management (HU-05). Every endpoint of this controller is
 * only for ADMIN: PERSONAL and PUBLICO get 403 from the global RolesGuard.
 */
@ApiTags('Users')
@ApiBearerAuth()
@Roles('ADMIN')
@ApiUnauthorizedResponse({
  description: 'Falta el access token o no es válido',
  type: ErrorResponseDto,
})
@ApiForbiddenResponse({
  description: 'Solo un administrador puede gestionar las cuentas del personal',
  type: ErrorResponseDto,
})
@ApiInternalServerErrorResponse({
  description: 'Error interno del servidor',
  type: ErrorResponseDto,
})
@Controller('users/staff')
export class StaffUserController {
  constructor(
    private readonly listStaffUsersUseCase: ListStaffUsersUseCase,
    private readonly createStaffUserUseCase: CreateStaffUserUseCase,
    private readonly updateStaffUserUseCase: UpdateStaffUserUseCase,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista las cuentas del personal',
    description:
      'Devuelve las cuentas PERSONAL y ADMIN paginadas, con búsqueda por ' +
      'nombre o correo, filtros por rol y estado, y ordenamiento.',
  })
  @ApiOkResponse({
    description: 'Página de cuentas del personal',
    type: PaginatedStaffUsersResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Parámetros de búsqueda inválidos o no permitidos',
    type: ErrorResponseDto,
  })
  async list(
    @Query() query: ListStaffUsersQueryDto,
  ): Promise<PaginatedStaffUsersResponseDto> {
    return this.listStaffUsersUseCase.execute({
      q: query.q,
      role: query.role,
      active: query.active,
      sort: query.sort,
      order: query.order,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post()
  @ApiOperation({
    summary: 'Crea una cuenta del personal',
    description:
      'Crea una cuenta PERSONAL activa, con la contraseña inicial que ' +
      'define el administrador (se guarda con argon2). El rol lo asigna el ' +
      'servidor: no se crean cuentas ADMIN. La cuenta puede iniciar sesión ' +
      'de inmediato.',
  })
  @ApiCreatedResponse({
    description: 'Cuenta creada y activa',
    type: StaffUserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o campos no permitidos, como `role`',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Ya existe una cuenta con ese correo',
    type: ErrorResponseDto,
  })
  async create(@Body() dto: CreateStaffUserDto): Promise<StaffUserResponseDto> {
    return this.createStaffUserUseCase.execute({
      firstName: dto.firstName,
      middleName: dto.middleName,
      lastName: dto.lastName,
      secondLastName: dto.secondLastName,
      email: dto.email,
      password: dto.password,
    });
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Edita, desactiva o reactiva una cuenta del personal',
    description:
      'Cambia los nombres o el correo, y con `active` desactiva o reactiva ' +
      'la cuenta. El rol no se edita: ninguna cuenta pasa de PERSONAL a ' +
      'ADMIN. Una cuenta desactivada no puede iniciar sesión ni renovar su ' +
      'sesión, y conserva sus solicitudes e historial. Un administrador no ' +
      'puede desactivar su propia cuenta.',
  })
  @ApiParam({ name: 'id', description: 'Identificador de la cuenta' })
  @ApiOkResponse({
    description: 'Cuenta con los cambios guardados',
    type: StaffUserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Identificador o datos inválidos, o campos no permitidos',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'No existe una cuenta del personal con ese identificador',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description:
      'El correo ya es de otra cuenta, o el administrador intenta ' +
      'desactivar su propia cuenta',
    type: ErrorResponseDto,
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateStaffUserDto,
    // JwtAuthGuard (global) always sets the user before reaching here
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StaffUserResponseDto> {
    return this.updateStaffUserUseCase.execute({
      userId: id,
      firstName: dto.firstName,
      middleName: dto.middleName,
      lastName: dto.lastName,
      secondLastName: dto.secondLastName,
      email: dto.email,
      active: dto.active,
      changedBy: user.id,
    });
  }
}
