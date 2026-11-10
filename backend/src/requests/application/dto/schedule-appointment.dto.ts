import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class ScheduleAppointmentDto {
  @ApiProperty({
    description:
      'Día de la cita (YYYY-MM-DD), sin hora: el solicitante puede ' +
      'consultar el material durante todo el horario de atención de ese día ' +
      '(lunes a viernes 8:00-17:00, sábados 9:00-13:00). No se aceptan ' +
      'domingos.',
    example: '2026-11-20',
  })
  @IsString({ message: 'La fecha de la cita debe ser texto' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha de la cita debe tener el formato YYYY-MM-DD',
  })
  date: string;
}
