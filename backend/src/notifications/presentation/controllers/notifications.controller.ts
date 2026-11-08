import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadGatewayResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../auth/presentation/guards/authenticated-user';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { TestEmailResponseDto } from '../../application/dto/test-email-response.dto';
import { SendTestEmailUseCase } from '../../application/use-cases/send-test-email.use-case';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly sendTestEmailUseCase: SendTestEmailUseCase) {}

  @Post('test-email')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Envía un correo de prueba',
    description:
      'Envía un correo de prueba al correo del administrador que lo pide, ' +
      'para comprobar la configuración SMTP. En desarrollo el correo ' +
      'llega a Mailpit (http://localhost:8025) y no se envía de verdad.',
  })
  @ApiOkResponse({
    description: 'Correo enviado',
    type: TestEmailResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Token de acceso ausente, inválido o vencido',
    type: ErrorResponseDto,
  })
  @ApiForbiddenResponse({
    description: 'Solo un administrador puede enviar el correo de prueba',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'El usuario del token ya no existe',
    type: ErrorResponseDto,
  })
  @ApiBadGatewayResponse({
    description: 'El servidor de correo no aceptó el correo o no responde',
    type: ErrorResponseDto,
  })
  @ApiInternalServerErrorResponse({
    description: 'Error interno del servidor',
    type: ErrorResponseDto,
  })
  async sendTestEmail(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TestEmailResponseDto> {
    return this.sendTestEmailUseCase.execute({ userId: user.id });
  }
}
