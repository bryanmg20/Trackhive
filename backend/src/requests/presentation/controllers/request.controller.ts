import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import { Roles } from '../../../auth/presentation/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../../auth/presentation/guards/authenticated-user';
import { CreateRequestDto } from '../../application/dto/create-request.dto';
import { CreateRequestResponseDto } from '../../application/dto/create-request-response.dto';
import { CreateRequestUseCase } from '../../application/use-cases/create-request.use-case';

@ApiTags('Requests')
@Controller('requests')
export class RequestController {
  constructor(private readonly createRequestUseCase: CreateRequestUseCase) {}

  @Post()
  @Roles('PUBLICO')
  @ApiOperation({ summary: 'Radica una solicitud de consulta' })
  @ApiCreatedResponse({ type: CreateRequestResponseDto })
  create(
    @Body() dto: CreateRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreateRequestResponseDto> {
    return this.createRequestUseCase.execute(dto, user.id);
  }
}
