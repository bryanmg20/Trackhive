
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';

type SeedUser = {
  firstName: string;
  // Optional fields are explicit nulls, so running the seed again clears them
  middleName: string | null;
  lastName: string;
  secondLastName: string | null;
  email: string;
  role: 'ADMIN' | 'PERSONAL' | 'PUBLICO';
};

// Fictitious demo data. Passwords come from environment variables.
// Some users have all four name fields and others only the required ones.
const USERS: SeedUser[] = [
  {
    firstName: 'Admin',
    middleName: null,
    lastName: 'Demo',
    secondLastName: null,
    email: 'admin@example.com',
    role: 'ADMIN',
  },
  {
    firstName: 'Personal',
    middleName: 'Uno',
    lastName: 'Demo',
    secondLastName: 'Prueba',
    email: 'personal1@example.com',
    role: 'PERSONAL',
  },
  {
    firstName: 'Personal',
    middleName: 'Dos',
    lastName: 'Demo',
    secondLastName: null,
    email: 'personal2@example.com',
    role: 'PERSONAL',
  },
  {
    firstName: 'Publico',
    middleName: 'Uno',
    lastName: 'Demo',
    secondLastName: 'Prueba',
    email: 'publico1@example.com',
    role: 'PUBLICO',
  },
  {
    firstName: 'Publico',
    middleName: 'Dos',
    lastName: 'Demo',
    secondLastName: null,
    email: 'publico2@example.com',
    role: 'PUBLICO',
  },
  {
    firstName: 'Publico',
    middleName: null,
    lastName: 'Demo',
    secondLastName: 'Tres',
    email: 'publico3@example.com',
    role: 'PUBLICO',
  },
  {
    firstName: 'Publico',
    middleName: null,
    lastName: 'Demo',
    secondLastName: null,
    email: 'publico4@example.com',
    role: 'PUBLICO',
  },
];

type SeedMaterial = {
  catalogCode: string;
  title: string;
  materialType: 'DOCUMENTO' | 'PERIODICO' | 'PROTOCOLO_NOTARIAL' | 'OTRO';
  author: string | null;
  collection: string;
  status: 'DISPONIBLE' | 'EN_USO' | 'EN_RESTAURACION' | 'NO_CONSULTABLE';
  // Periodicals only
  publicationDate?: string;
  publisher?: string;
  depot: string;
  shelf: string;
  box: string;
};

// Fictitious archive material: every type and status, some without author
const MATERIALS: SeedMaterial[] = [
  // Documents
  {
    catalogCode: 'TH-DOC-0001',
    title: 'Acta de fundación de la villa',
    materialType: 'DOCUMENTO',
    author: 'Cabildo de la Villa',
    collection: 'Actas del Cabildo',
    status: 'DISPONIBLE',
    depot: 'D-01',
    shelf: 'E-01',
    box: 'C-001',
  },
  {
    catalogCode: 'TH-DOC-0002',
    title: 'Acta de sesión ordinaria de 1812',
    materialType: 'DOCUMENTO',
    author: 'Cabildo de la Villa',
    collection: 'Actas del Cabildo',
    status: 'DISPONIBLE',
    depot: 'D-01',
    shelf: 'E-01',
    box: 'C-002',
  },
  {
    catalogCode: 'TH-DOC-0003',
    title: 'Acta sobre el abasto de agua',
    materialType: 'DOCUMENTO',
    author: 'Cabildo de la Villa',
    collection: 'Actas del Cabildo',
    status: 'EN_USO',
    depot: 'D-01',
    shelf: 'E-01',
    box: 'C-003',
  },
  {
    catalogCode: 'TH-DOC-0004',
    title: 'Censo de población del distrito norte',
    materialType: 'DOCUMENTO',
    author: 'Junta de Estadística',
    collection: 'Censos y padrones',
    status: 'DISPONIBLE',
    depot: 'D-01',
    shelf: 'E-02',
    box: 'C-010',
  },
  {
    catalogCode: 'TH-DOC-0005',
    title: 'Padrón de contribuyentes de 1850',
    materialType: 'DOCUMENTO',
    author: null,
    collection: 'Censos y padrones',
    status: 'EN_RESTAURACION',
    depot: 'D-01',
    shelf: 'E-02',
    box: 'C-011',
  },
  {
    catalogCode: 'TH-DOC-0006',
    title: 'Correspondencia del gobernador provincial',
    materialType: 'DOCUMENTO',
    author: 'Lucía Restrepo Arango',
    collection: 'Correspondencia oficial',
    status: 'DISPONIBLE',
    depot: 'D-01',
    shelf: 'E-03',
    box: 'C-020',
  },
  {
    catalogCode: 'TH-DOC-0007',
    title: 'Cartas sobre la construcción del puente',
    materialType: 'DOCUMENTO',
    author: 'Tomás Vélez Ochoa',
    collection: 'Correspondencia oficial',
    status: 'NO_CONSULTABLE',
    depot: 'D-01',
    shelf: 'E-03',
    box: 'C-021',
  },
  {
    catalogCode: 'TH-DOC-0008',
    title: 'Informe de obras públicas',
    materialType: 'DOCUMENTO',
    author: 'Secretaría de Obras',
    collection: 'Obras públicas',
    status: 'DISPONIBLE',
    depot: 'D-02',
    shelf: 'E-01',
    box: 'C-030',
  },
  {
    catalogCode: 'TH-DOC-0009',
    title: 'Planos del mercado municipal',
    materialType: 'DOCUMENTO',
    author: null,
    collection: 'Obras públicas',
    status: 'EN_USO',
    depot: 'D-02',
    shelf: 'E-01',
    box: 'C-031',
  },
  {
    catalogCode: 'TH-DOC-0010',
    title: 'Registro de licencias de comercio',
    materialType: 'DOCUMENTO',
    author: 'Tesorería Municipal',
    collection: 'Hacienda municipal',
    status: 'DISPONIBLE',
    depot: 'D-02',
    shelf: 'E-02',
    box: 'C-040',
  },
  {
    catalogCode: 'TH-DOC-0011',
    title: 'Libro de cuentas de la tesorería',
    materialType: 'DOCUMENTO',
    author: 'Tesorería Municipal',
    collection: 'Hacienda municipal',
    status: 'EN_RESTAURACION',
    depot: 'D-02',
    shelf: 'E-02',
    box: 'C-041',
  },
  {
    catalogCode: 'TH-DOC-0012',
    title: 'Memorial de vecinos sobre el camino real',
    materialType: 'DOCUMENTO',
    author: null,
    collection: 'Correspondencia oficial',
    status: 'DISPONIBLE',
    depot: 'D-01',
    shelf: 'E-03',
    box: 'C-022',
  },
  // Periodicals
  {
    catalogCode: 'TH-PER-0001',
    title: 'El Correo del Valle, edición 1',
    materialType: 'PERIODICO',
    author: null,
    collection: 'Prensa regional',
    status: 'DISPONIBLE',
    publicationDate: '1915-03-21',
    publisher: 'Imprenta del Valle',
    depot: 'D-03',
    shelf: 'E-01',
    box: 'C-100',
  },
  {
    catalogCode: 'TH-PER-0002',
    title: 'El Correo del Valle, edición 52',
    materialType: 'PERIODICO',
    author: null,
    collection: 'Prensa regional',
    status: 'EN_USO',
    publicationDate: '1916-03-18',
    publisher: 'Imprenta del Valle',
    depot: 'D-03',
    shelf: 'E-01',
    box: 'C-101',
  },
  {
    catalogCode: 'TH-PER-0003',
    title: 'La Voz del Comercio, número especial',
    materialType: 'PERIODICO',
    author: 'Ramiro Cárdenas Mejía',
    collection: 'Prensa regional',
    status: 'DISPONIBLE',
    publicationDate: '1922-08-07',
    publisher: 'Editorial Mercantil',
    depot: 'D-03',
    shelf: 'E-01',
    box: 'C-102',
  },
  {
    catalogCode: 'TH-PER-0004',
    title: 'La Voz del Comercio, crónica de la feria',
    materialType: 'PERIODICO',
    author: 'Ramiro Cárdenas Mejía',
    collection: 'Prensa regional',
    status: 'EN_RESTAURACION',
    publicationDate: '1923-12-15',
    publisher: 'Editorial Mercantil',
    depot: 'D-03',
    shelf: 'E-02',
    box: 'C-103',
  },
  {
    catalogCode: 'TH-PER-0005',
    title: 'Gaceta Municipal, decretos de 1930',
    materialType: 'PERIODICO',
    author: null,
    collection: 'Gacetas oficiales',
    status: 'DISPONIBLE',
    publicationDate: '1930-01-02',
    publisher: 'Imprenta Municipal',
    depot: 'D-03',
    shelf: 'E-03',
    box: 'C-110',
  },
  {
    catalogCode: 'TH-PER-0006',
    title: 'Gaceta Municipal, presupuesto anual',
    materialType: 'PERIODICO',
    author: null,
    collection: 'Gacetas oficiales',
    status: 'NO_CONSULTABLE',
    publicationDate: '1931-01-05',
    publisher: 'Imprenta Municipal',
    depot: 'D-03',
    shelf: 'E-03',
    box: 'C-111',
  },
  {
    catalogCode: 'TH-PER-0007',
    title: 'El Eco Obrero, primera página',
    materialType: 'PERIODICO',
    author: 'Elena Duque Salazar',
    collection: 'Prensa regional',
    status: 'DISPONIBLE',
    publicationDate: '1928-05-01',
    publisher: 'Talleres El Eco',
    depot: 'D-03',
    shelf: 'E-02',
    box: 'C-104',
  },
  {
    catalogCode: 'TH-PER-0008',
    title: 'Boletín Cultural de la Villa',
    materialType: 'PERIODICO',
    author: 'Elena Duque Salazar',
    collection: 'Gacetas oficiales',
    status: 'EN_USO',
    publicationDate: '1940-10-12',
    publisher: 'Casa de la Cultura',
    depot: 'D-03',
    shelf: 'E-03',
    box: 'C-112',
  },
  // Notarial protocols
  {
    catalogCode: 'TH-NOT-0001',
    title: 'Escritura de compraventa de la hacienda El Retiro',
    materialType: 'PROTOCOLO_NOTARIAL',
    author: 'Notaría Primera',
    collection: 'Notaría Primera',
    status: 'DISPONIBLE',
    depot: 'D-04',
    shelf: 'E-01',
    box: 'C-200',
  },
  {
    catalogCode: 'TH-NOT-0002',
    title: 'Testamento de Josefa Montoya',
    materialType: 'PROTOCOLO_NOTARIAL',
    author: 'Notaría Primera',
    collection: 'Notaría Primera',
    status: 'EN_RESTAURACION',
    depot: 'D-04',
    shelf: 'E-01',
    box: 'C-201',
  },
  {
    catalogCode: 'TH-NOT-0003',
    title: 'Poder general para pleitos',
    materialType: 'PROTOCOLO_NOTARIAL',
    author: 'Notaría Primera',
    collection: 'Notaría Primera',
    status: 'DISPONIBLE',
    depot: 'D-04',
    shelf: 'E-01',
    box: 'C-202',
  },
  {
    catalogCode: 'TH-NOT-0004',
    title: 'Escritura de constitución de sociedad comercial',
    materialType: 'PROTOCOLO_NOTARIAL',
    author: 'Notaría Segunda',
    collection: 'Notaría Segunda',
    status: 'EN_USO',
    depot: 'D-04',
    shelf: 'E-02',
    box: 'C-210',
  },
  {
    catalogCode: 'TH-NOT-0005',
    title: 'Hipoteca sobre casa de la plaza mayor',
    materialType: 'PROTOCOLO_NOTARIAL',
    author: 'Notaría Segunda',
    collection: 'Notaría Segunda',
    status: 'NO_CONSULTABLE',
    depot: 'D-04',
    shelf: 'E-02',
    box: 'C-211',
  },
  {
    catalogCode: 'TH-NOT-0006',
    title: 'Inventario de bienes de la familia Ortiz',
    materialType: 'PROTOCOLO_NOTARIAL',
    author: null,
    collection: 'Notaría Segunda',
    status: 'DISPONIBLE',
    depot: 'D-04',
    shelf: 'E-02',
    box: 'C-212',
  },
  {
    catalogCode: 'TH-NOT-0007',
    title: 'Carta de libertad de 1821',
    materialType: 'PROTOCOLO_NOTARIAL',
    author: 'Notaría Primera',
    collection: 'Notaría Primera',
    status: 'DISPONIBLE',
    depot: 'D-04',
    shelf: 'E-01',
    box: 'C-203',
  },
  // Other
  {
    catalogCode: 'TH-OTR-0001',
    title: 'Fotografías de la plaza principal',
    materialType: 'OTRO',
    author: 'Estudio Fotográfico Gómez',
    collection: 'Fotografía histórica',
    status: 'DISPONIBLE',
    depot: 'D-05',
    shelf: 'E-01',
    box: 'C-300',
  },
  {
    catalogCode: 'TH-OTR-0002',
    title: 'Mapa de la provincia de 1880',
    materialType: 'OTRO',
    author: null,
    collection: 'Cartografía',
    status: 'EN_RESTAURACION',
    depot: 'D-05',
    shelf: 'E-02',
    box: 'C-310',
  },
  {
    catalogCode: 'TH-OTR-0003',
    title: 'Afiches de las fiestas patronales',
    materialType: 'OTRO',
    author: 'Casa de la Cultura',
    collection: 'Fotografía histórica',
    status: 'NO_CONSULTABLE',
    depot: 'D-05',
    shelf: 'E-01',
    box: 'C-301',
  },
];

type SeedRequestStatus =
  | 'RECIBIDA'
  | 'EN_BUSQUEDA'
  | 'DISPONIBLE'
  | 'AGENDADA'
  | 'ATENDIDA'
  | 'CERRADA'
  | 'RECHAZADA';

type SeedRequest = {
  // Fixed codes from 90001, so they never collide with the real sequence
  trackingCode: string;
  // Email of a public user, or of the visitor registered by the staff
  requesterEmail: string;
  status: SeedRequestStatus;
  deliveryMode: 'PRESENCIAL' | 'DIGITAL';
  desiredDate: string;
  registeredAt: string;
  materialCodes: string[];
  // Only for RECHAZADA; the column holds at most 500 characters (HU-16)
  rejectionReason?: string;
};

const VISITOR_EMAIL = 'visitante@example.com';

// Fictitious requests: every status, public users and one visitor without account
const REQUESTS: SeedRequest[] = [
  {
    trackingCode: 'SOL-2026-90001',
    requesterEmail: 'publico1@example.com',
    status: 'RECIBIDA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-10',
    registeredAt: '2026-11-09T14:00:00Z',
    materialCodes: ['TH-DOC-0001'],
  },
  {
    trackingCode: 'SOL-2026-90002',
    requesterEmail: 'publico2@example.com',
    status: 'RECIBIDA',
    deliveryMode: 'DIGITAL',
    desiredDate: '2026-12-15',
    registeredAt: '2026-11-08T09:30:00Z',
    materialCodes: ['TH-PER-0001', 'TH-PER-0003'],
  },
  {
    trackingCode: 'SOL-2026-90003',
    requesterEmail: 'publico1@example.com',
    status: 'EN_BUSQUEDA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-12',
    registeredAt: '2026-11-05T16:45:00Z',
    materialCodes: ['TH-NOT-0001'],
  },
  {
    trackingCode: 'SOL-2026-90004',
    requesterEmail: VISITOR_EMAIL,
    status: 'EN_BUSQUEDA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-18',
    registeredAt: '2026-11-04T11:15:00Z',
    materialCodes: ['TH-DOC-0006'],
  },
  {
    trackingCode: 'SOL-2026-90005',
    requesterEmail: 'publico3@example.com',
    status: 'DISPONIBLE',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-09',
    registeredAt: '2026-10-30T10:00:00Z',
    materialCodes: ['TH-DOC-0004', 'TH-DOC-0010'],
  },
  {
    trackingCode: 'SOL-2026-90006',
    requesterEmail: 'publico4@example.com',
    status: 'DISPONIBLE',
    deliveryMode: 'DIGITAL',
    desiredDate: '2026-12-02',
    registeredAt: '2026-10-28T15:20:00Z',
    materialCodes: ['TH-OTR-0001'],
  },
  {
    trackingCode: 'SOL-2026-90007',
    requesterEmail: 'publico2@example.com',
    status: 'AGENDADA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-03',
    registeredAt: '2026-10-27T08:50:00Z',
    materialCodes: ['TH-NOT-0003'],
  },
  {
    trackingCode: 'SOL-2026-90008',
    requesterEmail: 'publico1@example.com',
    status: 'AGENDADA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-05',
    registeredAt: '2026-10-26T13:10:00Z',
    materialCodes: ['TH-PER-0007', 'TH-DOC-0002'],
  },
  {
    trackingCode: 'SOL-2026-90009',
    requesterEmail: 'publico3@example.com',
    status: 'ATENDIDA',
    deliveryMode: 'DIGITAL',
    desiredDate: '2026-11-20',
    registeredAt: '2026-10-15T09:00:00Z',
    materialCodes: ['TH-PER-0005'],
  },
  {
    trackingCode: 'SOL-2026-90010',
    requesterEmail: 'publico4@example.com',
    status: 'CERRADA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-11-12',
    registeredAt: '2026-10-05T12:00:00Z',
    materialCodes: ['TH-DOC-0008'],
  },
  {
    trackingCode: 'SOL-2026-90011',
    requesterEmail: 'publico2@example.com',
    status: 'RECHAZADA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-01',
    registeredAt: '2026-11-02T10:30:00Z',
    materialCodes: ['TH-DOC-0005'],
    rejectionReason: 'Material no localizado',
  },
  {
    trackingCode: 'SOL-2026-90012',
    requesterEmail: VISITOR_EMAIL,
    status: 'RECHAZADA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-04',
    registeredAt: '2026-11-03T17:00:00Z',
    materialCodes: ['TH-NOT-0005'],
    rejectionReason: 'Material restringido',
  },
];

const ITEM_STATUS_BY_REQUEST_STATUS: Record<SeedRequestStatus, string> = {
  RECIBIDA: 'PENDIENTE',
  EN_BUSQUEDA: 'PENDIENTE',
  DISPONIBLE: 'LOCALIZADO',
  AGENDADA: 'LOCALIZADO',
  ATENDIDA: 'LOCALIZADO',
  CERRADA: 'LOCALIZADO',
  RECHAZADA: 'NO_LOCALIZADO',
};

type SeedAppointment = {
  trackingCode: string;
  appointmentDate: string;
  status: 'PROGRAMADA' | 'CUMPLIDA' | 'CANCELADA' | 'NO_ASISTIO';
  notes: string | null;
};

// Fictitious appointments across November and December 2026 (never on Sunday)
const APPOINTMENTS: SeedAppointment[] = [
  {
    trackingCode: 'SOL-2026-90010',
    appointmentDate: '2026-11-12',
    status: 'CUMPLIDA',
    notes: 'Consultó el informe de obras públicas en sala.',
  },
  {
    trackingCode: 'SOL-2026-90008',
    appointmentDate: '2026-11-14',
    status: 'NO_ASISTIO',
    notes: 'Solicitó reprogramación para finales de mes.',
  },
  {
    trackingCode: 'SOL-2026-90007',
    appointmentDate: '2026-11-18',
    status: 'PROGRAMADA',
    notes: null,
  },
  {
    trackingCode: 'SOL-2026-90008',
    appointmentDate: '2026-12-05',
    status: 'PROGRAMADA',
    notes: null,
  },
];

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

async function main() {
  const adminPassword = readEnv('SEED_ADMIN_PASSWORD');
  const demoPassword = readEnv('SEED_DEMO_PASSWORD');

  const prisma = new PrismaClient();
  try {
    for (const user of USERS) {
      const password = user.role === 'ADMIN' ? adminPassword : demoPassword;
      const passwordHash = await argon2.hash(password);

      // Upsert by email: running the seed again does not duplicate users
      await prisma.userModel.upsert({
        where: { email: user.email },
        update: { ...user, passwordHash, active: true },
        create: { id: randomUUID(), ...user, passwordHash },
      });
    }

    for (const { publicationDate, publisher, ...material } of MATERIALS) {
      const data = {
        ...material,
        publicationDate: publicationDate ? new Date(publicationDate) : null,
        publisher: publisher ?? null,
      };
      // Upsert by catalog code: running the seed again does not duplicate material
      await prisma.materialModel.upsert({
        where: { catalogCode: material.catalogCode },
        update: data,
        create: { id: randomUUID(), ...data },
      });
    }

    const staff = await prisma.userModel.findUniqueOrThrow({
      where: { email: 'personal1@example.com' },
    });

    // The visitor has no account: the staff registered the request for them
    let visitor = await prisma.requesterModel.findFirst({
      where: { email: VISITOR_EMAIL },
    });
    visitor ??= await prisma.requesterModel.create({
      data: {
        id: randomUUID(),
        userId: null,
        firstName: 'Visitante',
        middleName: null,
        lastName: 'Demo',
        secondLastName: null,
        email: VISITOR_EMAIL,
        phone: '3000000000',
        requesterType: 'CIUDADANO',
        institution: null,
        documentType: null,
        documentNumber: null,
        acceptsDataProcessing: true,
        consentedAt: new Date(),
        privacyPolicyVersion: '1.0',
      },
    });

    let requestsCreated = 0;
    for (const seedRequest of REQUESTS) {
      // Running the seed again does not duplicate requests
      const existing = await prisma.requestModel.findUnique({
        where: { trackingCode: seedRequest.trackingCode },
      });
      if (existing) continue;

      const isVisitor = seedRequest.requesterEmail === VISITOR_EMAIL;
      const user = isVisitor
        ? null
        : await prisma.userModel.findUniqueOrThrow({
            where: { email: seedRequest.requesterEmail },
          });
      const requester = isVisitor
        ? visitor
        : ((await prisma.requesterModel.findUnique({
            where: { userId: user!.id },
          })) ??
          (await prisma.requesterModel.create({
            data: {
              id: randomUUID(),
              userId: user!.id,
              firstName: user!.firstName,
              middleName: user!.middleName,
              lastName: user!.lastName,
              secondLastName: user!.secondLastName,
              email: user!.email,
              phone: null,
              requesterType: 'INVESTIGADOR',
              institution: null,
              documentType: null,
              documentNumber: null,
              acceptsDataProcessing: true,
              consentedAt: new Date(),
              privacyPolicyVersion: '1.0',
            },
          })));

      const materials = await prisma.materialModel.findMany({
        where: { catalogCode: { in: seedRequest.materialCodes } },
        select: { id: true },
      });
      const registeredAt = new Date(seedRequest.registeredAt);
      const attended =
        seedRequest.status === 'ATENDIDA' || seedRequest.status === 'CERRADA';

      await prisma.requestModel.create({
        data: {
          id: randomUUID(),
          trackingCode: seedRequest.trackingCode,
          requesterId: requester.id,
          // A visitor's request is registered by the staff, the others by the user
          createdById: isVisitor ? staff.id : user!.id,
          requestType: 'CONSULTA_SALA',
          originChannel: isVisitor ? 'PRESENCIAL' : 'WEB',
          deliveryMode: seedRequest.deliveryMode,
          purpose: 'INVESTIGACION',
          reason: 'Consulta para un trabajo de investigación',
          requirementDescription: 'Consulta para un trabajo de investigación',
          desiredDate: new Date(seedRequest.desiredDate),
          committedDate:
            seedRequest.status === 'AGENDADA'
              ? new Date(seedRequest.desiredDate)
              : null,
          status: seedRequest.status,
          rejectionReason: seedRequest.rejectionReason ?? null,
          registeredAt,
          attendedAt: attended ? registeredAt : null,
          closedAt: seedRequest.status === 'CERRADA' ? registeredAt : null,
          items: {
            create: materials.map(({ id }) => ({
              id: randomUUID(),
              materialId: id,
              itemStatus: ITEM_STATUS_BY_REQUEST_STATUS[seedRequest.status],
              accessType: 'FISICO',
            })),
          },
        },
      });
      requestsCreated += 1;
    }

    let appointmentsCreated = 0;
    for (const seedAppointment of APPOINTMENTS) {
      const request = await prisma.requestModel.findUnique({
        where: { trackingCode: seedAppointment.trackingCode },
        include: { items: { select: { materialId: true } } },
      });
      if (!request) continue;

      const appointmentDate = new Date(
        `${seedAppointment.appointmentDate}T00:00:00.000Z`,
      );
      const existingAppointment = await prisma.appointmentModel.findFirst({
        where: {
          requestId: request.id,
          appointmentDate,
        },
      });
      if (existingAppointment) continue;

      await prisma.appointmentModel.create({
        data: {
          id: randomUUID(),
          requestId: request.id,
          requesterId: request.requesterId,
          scheduledById: staff.id,
          appointmentDate,
          status: seedAppointment.status,
          notes: seedAppointment.notes,
          materials: {
            // Only a PROGRAMADA appointment holds the day of its materials
            // (HU-20); the seed matches what the API writes
            create: request.items.map(({ materialId }) => ({
              materialId,
              bookedDate:
                seedAppointment.status === 'PROGRAMADA' ? appointmentDate : null,
            })),
          },
        },
      });
      appointmentsCreated += 1;
    }

    console.log(
      `Seed applied: ${USERS.length} users, ${MATERIALS.length} materials, ` +
        `${requestsCreated} new requests (${REQUESTS.length} in the seed), ` +
        `${appointmentsCreated} new appointments (${APPOINTMENTS.length} in the seed)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
