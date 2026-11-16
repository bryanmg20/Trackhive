import { LoginResponseDto } from '../dto/login-response.dto';

/** The token pair of a new session → the response of login and refresh. */
export class LoginResponseMapper {
  static toDto(accessToken: string, refreshToken: string): LoginResponseDto {
    return { accessToken, refreshToken };
  }
}
