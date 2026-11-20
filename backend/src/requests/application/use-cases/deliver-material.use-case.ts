import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MaterialLoanResponseDto } from '../../../materials/application/dto/material-loan-response.dto';
import { MATERIAL_LOAN_REPOSITORY } from '../../../materials/application/tokens';
import { MaterialLoan } from '../../../materials/domain/entities/material-loan.entity';
import type { IMaterialLoanRepository } from '../../../materials/domain/repositories/material-loan.repository';
import { AppointmentMaterialNotFoundError } from '../../domain/errors/appointment-material-not-found.error';
import { AppointmentNotFoundError } from '../../domain/errors/appointment-not-found.error';
import { AppointmentNotScheduledError } from '../../domain/errors/appointment-not-scheduled.error';
import { AppointmentNotTodayError } from '../../domain/errors/appointment-not-today.error';
import type { IRequestRepository } from '../../domain/repositories/request.repository';
import { todayInBogota } from '../../domain/value-objects/desired-date';
import type { DeliverMaterialInput } from '../dto/deliver-material.input';
import { DateOnlyMapper } from '../mappers/date-only.mapper';
import { DeliverMaterialResponseMapper } from '../mappers/deliver-material-response.mapper';
import { REQUEST_REPOSITORY } from '../tokens';

/**
 * «Registrar entrega de material» (HU-72). For a PROGRAMADA appointment on
 * today's date (America/Bogota), hands one of its booked materials to the
 * requester, records who handed it over and when, and sets the material to EN_USO.
 */
@Injectable()
export class DeliverMaterialUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY)
    private readonly requestRepo: IRequestRepository,
    @Inject(MATERIAL_LOAN_REPOSITORY)
    private readonly materialLoanRepo: IMaterialLoanRepository,
  ) {}

  async execute(input: DeliverMaterialInput): Promise<MaterialLoanResponseDto> {
    const appointment = await this.requestRepo.findAppointmentById(
      input.appointmentId,
    );
    if (!appointment) {
      throw new AppointmentNotFoundError();
    }
    if (appointment.status !== 'PROGRAMADA') {
      throw new AppointmentNotScheduledError();
    }

    const today = DateOnlyMapper.toDto(todayInBogota());
    const appointmentDay = DateOnlyMapper.toDto(appointment.date);
    if (appointmentDay !== today) {
      throw new AppointmentNotTodayError();
    }

    if (!appointment.materialIds.includes(input.materialId)) {
      throw new AppointmentMaterialNotFoundError();
    }

    const loan = MaterialLoan.deliver({
      id: randomUUID(),
      materialId: input.materialId,
      appointmentId: appointment.id,
      handedOverById: input.userId,
      deliveryNotes: input.notes ?? null,
    });

    const saved = await this.materialLoanRepo.deliverMaterial(loan);
    return DeliverMaterialResponseMapper.toDto(saved);
  }
}
