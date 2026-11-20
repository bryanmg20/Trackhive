import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AppointmentLoanCounts } from '../../domain/policies/appointment-loans';
import { REFERENCE_RESOLVABLE_STATUSES } from '../../domain/policies/reference-resolution';
import { ACTIVE_CAPACITY_APPOINTMENT_STATUSES } from '../../domain/policies/room-capacity';
import type { DayOccupancyCount } from '../../domain/value-objects/room-capacity';
import type {
  AppointmentListCriteria,
  AppointmentListResult,
  IRequestQueryService,
  MostRequestedMaterialsCriteria,
  MostRequestedMaterialsResult,
  MyRequestListCriteria,
  RequestDetail,
  RequestHistory,
  RequestListCriteria,
  RequestListResult,
  RequestNotificationContext,
  RequesterProfile,
  SchedulingConflicts,
} from '../../application/ports/request-query.port';
import {
  APPOINTMENT_LIST_INCLUDE,
  type MaterialRequestCountRow,
  PrismaRequestReadMapper,
  REQUEST_DETAIL_INCLUDE,
  REQUEST_HISTORY_SELECT,
  REQUEST_WITH_REQUESTER_AND_MATERIALS,
} from '../mappers/prisma-request-read.mapper';
import { findSchedulingConflicts } from './scheduling-conflicts.query';

/** The reads of requests that are not the Request entity (D-D). */
@Injectable()
export class PrismaRequestQueryService implements IRequestQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findRequesterByEmail(email: string): Promise<RequesterProfile | null> {
    const requester = await this.prisma.requesterModel.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    });
    if (requester) {
      return PrismaRequestReadMapper.toRequesterProfile(requester);
    }

    const user = await this.prisma.userModel.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    return user ? PrismaRequestReadMapper.toUserProfile(user) : null;
  }

  async list(criteria: RequestListCriteria): Promise<RequestListResult> {
    return this.findPage(this.buildListWhere(criteria), criteria);
  }

  async listAppointments(
    criteria: AppointmentListCriteria,
  ): Promise<AppointmentListResult> {
    const where = this.buildAppointmentListWhere(criteria);
    const [models, total] = await this.prisma.$transaction([
      this.prisma.appointmentModel.findMany({
        where,
        orderBy: [{ [criteria.sort]: criteria.order }, { id: 'asc' }],
        skip: (criteria.page - 1) * criteria.limit,
        take: criteria.limit,
        include: APPOINTMENT_LIST_INCLUDE,
      }),
      this.prisma.appointmentModel.count({ where }),
    ]);

    return {
      items: models.map((model) =>
        PrismaRequestReadMapper.toAppointmentListItem(model),
      ),
      total,
    };
  }

  async listByRequesterUser(
    userId: string,
    criteria: MyRequestListCriteria,
  ): Promise<RequestListResult> {
    // Filter by the account linked to the requester, never by the email: a
    // visitor's requester can share an email without being this user (HU-11)
    return this.findPage(
      { AND: [{ requester: { userId } }, this.buildListWhere(criteria)] },
      criteria,
    );
  }

  private async findPage(
    where: Prisma.RequestModelWhereInput,
    criteria: Pick<RequestListCriteria, 'sort' | 'order' | 'page' | 'limit'>,
  ): Promise<RequestListResult> {
    // Same filter for the page and the total, in one transaction
    const [models, total] = await this.prisma.$transaction([
      this.prisma.requestModel.findMany({
        where,
        orderBy: [{ [criteria.sort]: criteria.order }, { id: 'asc' }],
        skip: (criteria.page - 1) * criteria.limit,
        take: criteria.limit,
        include: REQUEST_WITH_REQUESTER_AND_MATERIALS,
      }),
      this.prisma.requestModel.count({ where }),
    ]);

    return {
      items: models.map((model) => PrismaRequestReadMapper.toListItem(model)),
      total,
    };
  }

  async findDetail(id: string): Promise<RequestDetail | null> {
    const model = await this.prisma.requestModel.findUnique({
      where: { id },
      include: REQUEST_DETAIL_INCLUDE,
    });
    return model ? PrismaRequestReadMapper.toDetail(model) : null;
  }

  async findHistory(id: string): Promise<RequestHistory | null> {
    const model = await this.prisma.requestModel.findUnique({
      where: { id },
      select: REQUEST_HISTORY_SELECT,
    });
    return model ? PrismaRequestReadMapper.toHistory(model) : null;
  }

  async findNotificationContext(
    id: string,
  ): Promise<RequestNotificationContext | null> {
    const model = await this.prisma.requestModel.findUnique({
      where: { id },
      select: {
        trackingCode: true,
        requester: {
          select: { firstName: true, lastName: true, email: true },
        },
        items: {
          select: { material: { select: { catalogCode: true, title: true } } },
          orderBy: { material: { catalogCode: 'asc' } },
        },
      },
    });
    return model ? PrismaRequestReadMapper.toNotificationContext(model) : null;
  }

  findSchedulingConflicts(
    requestId: string,
    date: Date,
  ): Promise<SchedulingConflicts> {
    return findSchedulingConflicts(this.prisma, requestId, date);
  }

  async findMissingMaterialIds(
    materialIds: readonly string[],
  ): Promise<string[]> {
    const uniqueIds = [...new Set(materialIds)];
    const existing = await this.prisma.materialModel.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    const found = new Set(existing.map(({ id }) => id));
    return uniqueIds.filter((id) => !found.has(id));
  }

  private buildListWhere(
    criteria: RequestListCriteria,
  ): Prisma.RequestModelWhereInput {
    const and: Prisma.RequestModelWhereInput[] = [];

    if (criteria.status) {
      and.push({ status: criteria.status });
    }
    if (criteria.desiredFrom || criteria.desiredTo) {
      and.push({
        desiredDate: {
          ...(criteria.desiredFrom && {
            gte: new Date(`${criteria.desiredFrom}T00:00:00.000Z`),
          }),
          ...(criteria.desiredTo && {
            lte: new Date(`${criteria.desiredTo}T00:00:00.000Z`),
          }),
        },
      });
    }
    // Every word must match some field, so "juan pérez" finds "Juan Carlos Pérez"
    for (const word of criteria.requester?.split(/\s+/).filter(Boolean) ?? []) {
      const text = { contains: word, mode: 'insensitive' as const };
      and.push({
        requester: {
          OR: [
            { firstName: text },
            { middleName: text },
            { lastName: text },
            { secondLastName: text },
            { email: text },
            { documentNumber: text },
          ],
        },
      });
    }
    if (criteria.material) {
      const text = {
        contains: criteria.material,
        mode: 'insensitive' as const,
      };
      and.push({
        items: {
          some: { material: { OR: [{ title: text }, { catalogCode: text }] } },
        },
      });
    }
    // HU-09.2: the requests whose references the staff can still resolve.
    // Past EN_BUSQUEDA a reference without material stays so for good, and
    // the listing would fill up with requests nobody can act on
    if (criteria.pendingReferences) {
      and.push({
        status: { in: [...REFERENCE_RESOLVABLE_STATUSES] },
        references: { some: { status: 'PENDIENTE' } },
      });
    }
    return and.length > 0 ? { AND: and } : {};
  }

  private buildAppointmentListWhere(
    criteria: AppointmentListCriteria,
  ): Prisma.AppointmentModelWhereInput {
    const and: Prisma.AppointmentModelWhereInput[] = [];

    if (criteria.status) {
      and.push({ status: criteria.status });
    }
    if (criteria.from || criteria.to) {
      and.push({
        appointmentDate: {
          ...(criteria.from && {
            gte: new Date(`${criteria.from}T00:00:00.000Z`),
          }),
          ...(criteria.to && {
            lte: new Date(`${criteria.to}T00:00:00.000Z`),
          }),
        },
      });
    }
    for (const word of criteria.requester?.split(/\s+/).filter(Boolean) ?? []) {
      const text = { contains: word, mode: 'insensitive' as const };
      and.push({
        requester: {
          OR: [
            { firstName: text },
            { middleName: text },
            { lastName: text },
            { secondLastName: text },
            { email: text },
            { documentNumber: text },
          ],
        },
      });
    }
    if (criteria.material) {
      const text = {
        contains: criteria.material,
        mode: 'insensitive' as const,
      };
      and.push({
        materials: {
          some: { material: { OR: [{ title: text }, { catalogCode: text }] } },
        },
      });
    }
    return and.length > 0 ? { AND: and } : {};
  }

  async countActiveAppointmentsOnDate(date: Date): Promise<number> {
    return this.prisma.appointmentModel.count({
      where: {
        appointmentDate: date,
        status: { in: [...ACTIVE_CAPACITY_APPOINTMENT_STATUSES] },
      },
    });
  }

  async countActiveAppointmentsByDateRange(
    from: Date,
    to: Date,
  ): Promise<DayOccupancyCount[]> {
    const rows = await this.prisma.appointmentModel.groupBy({
      by: ['appointmentDate'],
      where: {
        appointmentDate: { gte: from, lte: to },
        status: { in: [...ACTIVE_CAPACITY_APPOINTMENT_STATUSES] },
      },
      _count: { _all: true },
      orderBy: { appointmentDate: 'asc' },
    });
    return rows.map((row) => ({
      date: row.appointmentDate.toISOString().slice(0, 10),
      occupied: row._count._all,
    }));
  }

  async findMostRequestedMaterials(
    criteria: MostRequestedMaterialsCriteria,
  ): Promise<MostRequestedMaterialsResult> {
    const { start, end } = criteria.period;
    const conditions = [
      start ? Prisma.sql`r.registered_at >= ${start}` : null,
      end ? Prisma.sql`r.registered_at < ${end}` : null,
    ].filter((condition): condition is Prisma.Sql => condition !== null);
    const where = conditions.length
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    const [rows, totals] = await this.prisma.$transaction([
      // request_items is unique per (request, material): one row = one request
      this.prisma.$queryRaw<MaterialRequestCountRow[]>`
        SELECT m.id AS material_id, m.catalog_code, m.title, m.material_type,
               COUNT(*)::int AS request_count
        FROM request_items ri
        JOIN requests r ON r.id = ri.request_id
        JOIN materials m ON m.id = ri.material_id
        ${where}
        GROUP BY m.id
        ORDER BY request_count DESC, m.title ASC, m.id ASC
        LIMIT ${criteria.limit}`,
      this.prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total FROM requests r ${where}`,
    ]);

    return {
      items: rows.map((row) =>
        PrismaRequestReadMapper.toMaterialRequestCount(row),
      ),
      totalRequests: Number(totals[0]?.total ?? 0),
    };
  }

  async countAppointmentLoans(
    appointmentId: string,
  ): Promise<AppointmentLoanCounts> {
    const [totalLoans, openLoans] = await this.prisma.$transaction([
      this.prisma.materialLoanModel.count({ where: { appointmentId } }),
      this.prisma.materialLoanModel.count({
        where: { appointmentId, returnedAt: null },
      }),
    ]);
    return { totalLoans, openLoans };
  }

  async countScheduledAppointmentLoansByRequest(
    requestId: string,
  ): Promise<AppointmentLoanCounts> {
    const where: Prisma.MaterialLoanModelWhereInput = {
      appointment: { requestId, status: 'PROGRAMADA' },
    };
    const [totalLoans, openLoans] = await this.prisma.$transaction([
      this.prisma.materialLoanModel.count({ where }),
      this.prisma.materialLoanModel.count({
        where: { ...where, returnedAt: null },
      }),
    ]);
    return { totalLoans, openLoans };
  }
}
