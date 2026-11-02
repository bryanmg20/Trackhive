import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { CreateUserDto } from '../../application/dto/create-user.dto';
import { UserResponseDto } from '../../application/dto/user-response.dto';
import { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import { InvalidEmailError } from '../../domain/errors/invalid-email.error';

@Controller('users')
export class UserController {
  constructor(private readonly createUserUseCase: CreateUserUseCase) {}

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    // El controlador NO habla con la base de datos.
    // Solo le pide al Caso de Uso que ejecute la acción.
    try {
      return await this.createUserUseCase.execute(dto.email);
    } catch (error) {
      if (error instanceof InvalidEmailError) {
        throw new BadRequestException(error.message); // Dominio → HTTP 400
      }
      throw error;
    }
  }
}
