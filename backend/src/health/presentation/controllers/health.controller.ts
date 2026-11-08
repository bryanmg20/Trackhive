import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../auth/presentation/decorators/public.decorator';
import { HealthResponseDto } from '../../application/dto/health-response.dto';
import { GetHealthUseCase } from '../../application/use-cases/get-health.use-case';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly getHealthUseCase: GetHealthUseCase) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Comprueba el estado del sistema y la base de datos',
  })
  @ApiOkResponse({
    description: 'Estado de la API y de la base de datos',
    type: HealthResponseDto,
  })
  async getHealth(): Promise<HealthResponseDto> {
    return this.getHealthUseCase.execute();
  }
}
