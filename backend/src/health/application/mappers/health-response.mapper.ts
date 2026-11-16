import { HealthResponseDto } from '../dto/health-response.dto';

/** Whether the database answers → the health response (HU-38). */
export class HealthResponseMapper {
  static toDto(databaseAvailable: boolean): HealthResponseDto {
    return {
      status: databaseAvailable ? 'ok' : 'degraded',
      database: databaseAvailable ? 'up' : 'down',
    };
  }
}
