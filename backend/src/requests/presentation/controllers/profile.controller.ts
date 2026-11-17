import { Body, Controller, Get, Patch } from '@nestjs/common';
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
  ) {}

  // All authenticated roles can access their own profile. No client-supplied id.
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
