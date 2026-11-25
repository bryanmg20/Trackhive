import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { DeleteMyAccountDto } from '../../application/dto/delete-my-account.dto';
import { DeleteMyAccountUseCase } from '../../application/use-cases/delete-my-account.use-case';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/presentation/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../../auth/presentation/guards/authenticated-user';
import { ErrorResponseDto } from '../../../common/errors/error-response.dto';
import { CharacterizationDto } from '../../application/dto/characterization.dto';
import { MyProfileResponseDto } from '../../application/dto/my-profile-response.dto';
import { GetMyProfileUseCase } from '../../application/use-cases/get-my-profile.use-case';
import { UpdateMyProfileUseCase } from '../../application/use-cases/update-my-profile.use-case';

@ApiTags('Profile')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ErrorResponseDto })
@Controller('users/me/profile')
export class ProfileController {
  constructor(
    private readonly getProfile: GetMyProfileUseCase,
    private readonly updateProfile: UpdateMyProfileUseCase,
    private readonly deleteAccount: DeleteMyAccountUseCase,
  ) {}

  // All authenticated roles can access their own profile. No client-supplied id.
  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Elimina mi cuenta y anonimiza mis datos (HU-33)' })
  @ApiNoContentResponse({
    description: 'Cuenta eliminada y sesiones invalidadas',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteMyAccountDto,
  ): Promise<void> {
    await this.deleteAccount.execute({
      userId: user.id,
      confirmation: dto.confirmation,
    });
  }

  @Get()
  @ApiOperation({
    summary: 'Consulta mi perfil y mis datos de caracterización',
  })
  @ApiOkResponse({ type: MyProfileResponseDto })
  get(@CurrentUser() user: AuthenticatedUser): Promise<MyProfileResponseDto> {
    return this.getProfile.execute({ userId: user.id });
  }

  @Patch()
  @ApiOperation({ summary: 'Actualiza mis datos de caracterización' })
  @ApiOkResponse({ type: MyProfileResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CharacterizationDto,
  ): Promise<MyProfileResponseDto> {
    return this.updateProfile.execute({
      userId: user.id,
      municipality: dto.municipality,
      ageRange: dto.ageRange,
      populationGroup: dto.populationGroup,
    });
  }
}
