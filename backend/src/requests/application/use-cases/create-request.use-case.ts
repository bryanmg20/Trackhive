import { Inject, Injectable } from '@nestjs/common';
import { CreateRequestResponseDto } from '../dto/create-request-response.dto';
import type { RequestRepository } from '../ports/request.repository.port';
import { REQUEST_REPOSITORY } from '../tokens';
import { DesiredDateError } from '../../domain/errors/desired-date-invalid.error';

export interface CreateRequestInput {
  materialIds: string[];
  reason: string;
  desiredDate: string;
  deliveryMode: 'PRESENCIAL' | 'DIGITAL';
  requirementDescription?: string;
}

export const minimumBusinessDays = 10;

export function isAttendedDate(date: Date): boolean {
  return date.getDay() !== 0 && date.getDay() !== 6;
}

export function addBusinessDays(from: Date, amount: number): Date {
  const result = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  let added = 0;
  while (added < amount) {
    result.setUTCDate(result.getUTCDate() + 1);
    if (result.getUTCDay() !== 0 && result.getUTCDay() !== 6) {
      added++;
    }
  }
  return result;
}

@Injectable()
export class CreateRequestUseCase {
  constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: RequestRepository,
  ) {}

  async execute(
    input: CreateRequestInput,
    userId: string,
  ): Promise<CreateRequestResponseDto> {
    const today = new Date();
    const desired = new Date(`${input.desiredDate}T00:00:00Z`);
    const minimum = addBusinessDays(today, minimumBusinessDays);
    const desiredKey = desired.toISOString().slice(0, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.desiredDate) ||
      Number.isNaN(desired.getTime()) ||
      desiredKey !== input.desiredDate
    ) {
      throw new DesiredDateError(
        'La fecha deseada no tiene un formato válido.',
      );
    }
    if (
      !isAttendedDate(desired) ||
      desiredKey < new Date(minimum).toISOString().slice(0, 10)
    ) {
      throw new DesiredDateError(
        'La fecha debe ser posterior al plazo de 10 días hábiles y corresponder a un día de atención (lunes a viernes). El CLENA necesita este tiempo para certificar la veracidad del documento.',
      );
    }
    if (input.materialIds.length === 0) {
      throw new DesiredDateError('Debe seleccionar al menos un material.');
    }

    return this.repository.create({ ...input, createdById: userId });
  }
}
