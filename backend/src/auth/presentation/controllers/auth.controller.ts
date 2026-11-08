import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { LoginDto } from '../../application/dto/login.dto';
import { LoginResponseDto } from '../../application/dto/login-response.dto';
import { RefreshTokenDto } from '../../application/dto/refresh-token.dto';
import { LoginUseCase } from '../../application/use-cases/login.use-case';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '../../application/use-cases/refresh-session.use-case';
import { Public } from '../decorators/public.decorator';

@ApiTags('Auth')
// Login, refresh and logout run without an access token
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshSessionUseCase: RefreshSessionUseCase,
    private readonly logoutUseCase: LogoutUseCase,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inicia sesión',
    description:
      'Valida correo y contraseña de una cuenta activa y devuelve un ' +
      'access token y un refresh token.',
  })
  @ApiOkResponse({
    description: 'Sesión iniciada',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o campos no permitidos',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Correo o contraseña incorrectos',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    // Domain errors are translated to HTTP by the global filter
    return this.loginUseCase.execute({
      email: dto.email,
      password: dto.password,
    });
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renueva la sesión',
    description:
      'Recibe un refresh token vigente y devuelve un access token y un ' +
      'refresh token nuevos. El refresh token enviado queda revocado: si ' +
      'se vuelve a usar, se cierran todas las sesiones del usuario.',
  })
  @ApiOkResponse({
    description: 'Sesión renovada',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Falta el refresh token o no tiene formato de JWT',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh token vencido, revocado o desconocido',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async refresh(@Body() dto: RefreshTokenDto): Promise<LoginResponseDto> {
    return this.refreshSessionUseCase.execute({
      refreshToken: dto.refreshToken,
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Cierra la sesión',
    description:
      'Revoca el refresh token para que no pueda renovar la sesión. ' +
      'Responde 204 aunque el token ya estuviera revocado o no exista.',
  })
  @ApiNoContentResponse({ description: 'Sesión cerrada' })
  @ApiBadRequestResponse({
    description: 'Falta el refresh token o no tiene formato de JWT',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.logoutUseCase.execute({ refreshToken: dto.refreshToken });
  }
}
