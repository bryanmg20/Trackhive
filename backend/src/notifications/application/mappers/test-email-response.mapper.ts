import { TestEmailResponseDto } from '../dto/test-email-response.dto';

/** The address the test email went to → the response of the endpoint. */
export class TestEmailResponseMapper {
  static toDto(sentTo: string): TestEmailResponseDto {
    return { sentTo };
  }
}
