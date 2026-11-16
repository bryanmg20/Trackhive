import type { Prisma } from '@prisma/client';
import { isAppointmentStatus } from '../../domain/enums/appointment-status';
import { isDeliveryMode } from '../../domain/enums/delivery-mode';
import { isRequestStatus } from '../../domain/enums/request-status';
import type {
  AppointmentListItem,
  MaterialDayBooking,
  RequestDetail,
  RequesterProfile,
  RequestListItem,
} from '../../application/ports/request-query.port';
import type { RequesterRow } from './prisma-requester.mapper';

/** What the listings and the detail load of a request. */
export const REQUEST_WITH_REQUESTER_AND_MATERIALS = {
  requester: true,
  items: { include: { material: true } },
} satisfies Prisma.RequestModelInclude;

type RequestWithRequesterAndMaterials = Prisma.RequestModelGetPayload<{
  include: typeof REQUEST_WITH_REQUESTER_AND_MATERIALS;
}>;

const PERSON_NAME = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  secondLastName: true,
} satisfies Prisma.UserModelSelect;

/** What the calendar loads of an appointment (HU-19). */
export const APPOINTMENT_LIST_INCLUDE = {
  request: {
    select: { id: true, trackingCode: true, status: true, deliveryMode: true },
  },
  requester: {
    select: {
      ...PERSON_NAME,
      email: true,
      phone: true,
      requesterType: true,
      institution: true,
      documentType: true,
      documentNumber: true,
    },
  },
  scheduledBy: { select: PERSON_NAME },
  materials: {
    include: { material: true },
    orderBy: { material: { catalogCode: 'asc' } },
  },
} satisfies Prisma.AppointmentModelInclude;

type AppointmentWithRelations = Prisma.AppointmentModelGetPayload<{
  include: typeof APPOINTMENT_LIST_INCLUDE;
}>;

/** A user account as «buscar solicitante» reads it. */
export interface UserProfileRow {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
  email: string;
}

/** Translates the rows the query service reads into its read models (D-D). */
export class PrismaRequestReadMapper {
  static toListItem(model: RequestWithRequesterAndMaterials): RequestListItem {
    if (!isRequestStatus(model.status) || !isDeliveryMode(model.deliveryMode)) {
      throw new Error(`Request ${model.id} has an invalid stored value`);
    }
    return {
      id: model.id,
      trackingCode: model.trackingCode,
      status: model.status,
      deliveryMode: model.deliveryMode,
      desiredDate: model.desiredDate,
      registeredAt: model.registeredAt,
      rejectionReason: model.rejectionReason,
      requester: {
        firstName: model.requester.firstName,
        middleName: model.requester.middleName,
        lastName: model.requester.lastName,
        secondLastName: model.requester.secondLastName,
        email: model.requester.email,
      },
      materials: model.items.map(({ material }) => ({
        id: material.id,
        catalogCode: material.catalogCode,
        title: material.title,
      })),
    };
  }

  static toDetail(model: RequestWithRequesterAndMaterials): RequestDetail {
    if (!isRequestStatus(model.status) || !isDeliveryMode(model.deliveryMode)) {
      throw new Error(`Request ${model.id} has an invalid stored value`);
    }
    return {
      id: model.id,
      trackingCode: model.trackingCode,
      status: model.status,
      deliveryMode: model.deliveryMode,
      originChannel: model.originChannel,
      reason: model.reason,
      requirementDescription: model.requirementDescription,
      desiredDate: model.desiredDate,
      committedDate: model.committedDate,
      registeredAt: model.registeredAt,
      rejectionReason: model.rejectionReason,
      requester: {
        firstName: model.requester.firstName,
        middleName: model.requester.middleName,
        lastName: model.requester.lastName,
        secondLastName: model.requester.secondLastName,
        email: model.requester.email,
        phone: model.requester.phone,
        requesterType: model.requester.requesterType,
        institution: model.requester.institution,
        documentType: model.requester.documentType,
        documentNumber: model.requester.documentNumber,
      },
      materials: model.items.map(({ material, itemStatus }) => ({
        id: material.id,
        catalogCode: material.catalogCode,
        title: material.title,
        materialType: material.materialType,
        author: material.author,
        collection: material.collection,
        status: material.status,
        location: {
          depot: material.depot,
          shelf: material.shelf,
          box: material.box,
        },
        itemStatus,
      })),
    };
  }

  static toAppointmentListItem(
    model: AppointmentWithRelations,
  ): AppointmentListItem {
    if (
      !isAppointmentStatus(model.status) ||
      !isRequestStatus(model.request.status) ||
      !isDeliveryMode(model.request.deliveryMode)
    ) {
      throw new Error(`Appointment ${model.id} has an invalid stored value`);
    }
    return {
      id: model.id,
      appointmentDate: model.appointmentDate,
      status: model.status,
      notes: model.notes,
      createdAt: model.createdAt,
      request: {
        id: model.request.id,
        trackingCode: model.request.trackingCode,
        status: model.request.status,
        deliveryMode: model.request.deliveryMode,
      },
      requester: model.requester,
      scheduledBy: model.scheduledBy,
      materials: model.materials.map(({ material }) => ({
        id: material.id,
        catalogCode: material.catalogCode,
        title: material.title,
        materialType: material.materialType,
        depot: material.depot,
        shelf: material.shelf,
        box: material.box,
      })),
    };
  }

  static toRequesterProfile(
    requester: Pick<
      RequesterRow,
      | 'id'
      | 'userId'
      | 'firstName'
      | 'middleName'
      | 'lastName'
      | 'secondLastName'
      | 'email'
      | 'phone'
      | 'requesterType'
      | 'institution'
      | 'documentType'
      | 'documentNumber'
    >,
  ): RequesterProfile {
    return {
      requesterId: requester.id,
      userId: requester.userId,
      firstName: requester.firstName,
      middleName: requester.middleName,
      lastName: requester.lastName,
      secondLastName: requester.secondLastName,
      email: requester.email ?? '',
      phone: requester.phone,
      requesterType: requester.requesterType,
      institution: requester.institution,
      documentType: requester.documentType,
      documentNumber: requester.documentNumber,
      foundIn: 'REQUESTER',
    };
  }

  /** A user account without a requester yet: the staff only sees the account. */
  static toUserProfile(user: UserProfileRow): RequesterProfile {
    return {
      requesterId: null,
      userId: user.id,
      firstName: user.firstName,
      middleName: user.middleName,
      lastName: user.lastName,
      secondLastName: user.secondLastName,
      email: user.email.trim().toLowerCase(),
      phone: null,
      requesterType: null,
      institution: null,
      documentType: null,
      documentNumber: null,
      foundIn: 'USER',
    };
  }

  /** A material already booked that day by another appointment (HU-20). */
  static toMaterialDayBooking(
    material: { id: string; catalogCode: string; title: string },
    date: Date,
    trackingCode: string,
  ): MaterialDayBooking {
    return {
      materialId: material.id,
      catalogCode: material.catalogCode,
      title: material.title,
      date,
      trackingCode,
    };
  }
}
