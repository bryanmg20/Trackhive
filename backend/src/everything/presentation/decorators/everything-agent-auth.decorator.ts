import { applyDecorators, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiServiceUnavailableResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Public } from '../../../auth/presentation/decorators/public.decorator';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { AGENT_BEARER_AUTH } from '../../../common/swagger/setup-swagger';
import { EverythingAgentGuard } from '../guards/everything-agent.guard';

/**
 * The endpoints of the Everything agent (HU-137): no user session (the
 * global JwtAuthGuard and RolesGuard let them through), the token of the
 * agent instead, checked by its own guard.
 */
export const EverythingAgentAuth = (): ReturnType<typeof applyDecorators> =>
  applyDecorators(
    Public(),
    UseGuards(EverythingAgentGuard),
    ApiBearerAuth(AGENT_BEARER_AUTH),
    ApiUnauthorizedResponse({
      description:
        'Falta el token del agente o no es válido (INVALID_AGENT_TOKEN). No se guarda nada',
      type: ErrorResponseDto,
    }),
    ApiServiceUnavailableResponse({
      description:
        'La sincronización está desactivada: el backend no tiene EVERYTHING_AGENT_TOKEN ' +
        '(EVERYTHING_SYNC_DISABLED). No se acepta nada',
      type: ErrorResponseDto,
    }),
  );
