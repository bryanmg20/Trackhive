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
  materialType: 'DOCUMENTO' | 'PERIODICO' | 'PROTOCOLO_NOTARIAL';
  collection: string;
  status: 'DISPONIBLE' | 'EN_USO' | 'EN_RESTAURACION' | 'NO_CONSULTABLE';
  // Periodicals only
  publicationDate?: string;
  publisher?: string;
  // Leaf folder of the simulated tree (dev/manifiesto.json). Without it, the
  // material has no digital copy
  folder?: string;
  // Last time a sync saw it; by default, when the seed runs
  lastSeenAt?: string;
};

// Root of the simulated tree as Everything reports it on Windows
// (dev/docs_simulados placed at C:\trackhive, HU-133). Not the real CLENA
// path, which is on its network drive
const DIGITAL_ROOT = 'C:\\trackhive\\docs_simulados';

// The catalog only grows through the Everything sync (HU-137, HU-165): every
// material is a leaf folder of the simulated tree (HU-133), with the code,
// title, type, collection and folder path of dev/manifiesto.json, so a sync
// against the mock updates them by their code and does not duplicate them
const MATERIALS: SeedMaterial[] = [
  // Correspondence (DOCUMENTO)
  {
    catalogCode: 'DOC-989E83A3',
    title: 'Cartas del cabildo - 1890 a 1895',
    materialType: 'DOCUMENTO',
    collection: 'Correspondencia',
    status: 'DISPONIBLE',
    folder: 'Aha\\Fondo - Correspondencia\\Cartas del cabildo - 1890 a 1895',
  },
  {
    catalogCode: 'DOC-AF12775E',
    title: '1902',
    materialType: 'DOCUMENTO',
    collection: 'Correspondencia',
    status: 'NO_CONSULTABLE',
    folder: 'Aha\\Fondo - Correspondencia\\Telegramas\\1902',
  },
  // Periodicals: some issues lack the publication date
  {
    catalogCode: 'PER-7C52B4D6',
    title: '1925-03 Marzo',
    materialType: 'PERIODICO',
    collection: 'Periódicos',
    status: 'DISPONIBLE',
    publicationDate: '1925-03-01',
    publisher: 'El Correo del Litoral',
    folder:
      'Aha\\Fondo - Periódicos\\El Correo del Litoral\\1925\\1925-03 Marzo',
  },
  {
    catalogCode: 'PER-98EA1A48',
    title: '1925-04 Abril',
    materialType: 'PERIODICO',
    collection: 'Periódicos',
    status: 'EN_RESTAURACION',
    publicationDate: '1925-04-01',
    publisher: 'El Correo del Litoral',
    folder:
      'Aha\\Fondo - Periódicos\\El Correo del Litoral\\1925\\1925-04 Abril',
  },
  {
    catalogCode: 'PER-A0CBF1ED',
    title: 'Suplemento dominical 1926',
    materialType: 'PERIODICO',
    collection: 'Periódicos',
    status: 'DISPONIBLE',
    publisher: 'El Correo del Litoral',
    folder:
      'Aha\\Fondo - Periódicos\\El Correo del Litoral\\Suplemento dominical 1926',
  },
  {
    catalogCode: 'PER-2D9B489C',
    title: 'La Gaceta Ribereña - 1931 a 1933',
    materialType: 'PERIODICO',
    collection: 'Periódicos',
    status: 'DISPONIBLE',
    publisher: 'La Gaceta Ribereña',
    folder: 'Aha\\Fondo - Periódicos\\La Gaceta Ribereña - 1931 a 1933',
  },
  // Notarial protocols: Notaría Primera, 1931
  {
    catalogCode: 'NOT1-1931-0001-0109',
    title: 'Notaría Primera de Barranquilla · 1931 · Escrituras 1–109 (enero)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\1ra - Notaria Primera de Barranquilla - 1815 a 1979\\1931 - Esc 1-1290 (12) +\\1ra-1931 - Esc 0001-0109 - Ene',
  },
  {
    catalogCode: 'NOT1-1931-0110-0206',
    title:
      'Notaría Primera de Barranquilla · 1931 · Escrituras 110–206 (febrero)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\1ra - Notaria Primera de Barranquilla - 1815 a 1979\\1931 - Esc 1-1290 (12) +\\1ra-1931 - Esc 0110-0206 - Feb',
  },
  {
    catalogCode: 'NOT1-1931-0207-0303',
    title:
      'Notaría Primera de Barranquilla · 1931 · Escrituras 207–303 (marzo)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\1ra - Notaria Primera de Barranquilla - 1815 a 1979\\1931 - Esc 1-1290 (12) +\\1ra-1931 - Esc 0207-0303 - Mar',
  },
  {
    catalogCode: 'NOT1-1931-0304-0417',
    title:
      'Notaría Primera de Barranquilla · 1931 · Escrituras 304–417 (abril)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\1ra - Notaria Primera de Barranquilla - 1815 a 1979\\1931 - Esc 1-1290 (12) +\\1ra-1931 - Esc 0304-0417 - Abr',
  },
  {
    catalogCode: 'NOT1-1931-0418-0532',
    title: 'Notaría Primera de Barranquilla · 1931 · Escrituras 418–532 (mayo)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\1ra - Notaria Primera de Barranquilla - 1815 a 1979\\1931 - Esc 1-1290 (12) +\\1ra-1931 - Esc 0418-0532 - May',
  },
  {
    catalogCode: 'NOT1-1931-0533-0660',
    title:
      'Notaría Primera de Barranquilla · 1931 · Escrituras 533–660 (junio)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'EN_RESTAURACION',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\1ra - Notaria Primera de Barranquilla - 1815 a 1979\\1931 - Esc 1-1290 (12) +\\1ra-1931 - Esc 0533-0660 - Jun',
  },
  {
    catalogCode: 'NOT1-1931-0661-0772',
    title:
      'Notaría Primera de Barranquilla · 1931 · Escrituras 661–772 (julio)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\1ra - Notaria Primera de Barranquilla - 1815 a 1979\\1931 - Esc 1-1290 (12) +\\1ra-1931 - Esc 0661-0772 - Jul',
  },
  // Notaría Segunda, 1930 and 1941
  {
    catalogCode: 'NOT2-1930-0001-0061',
    title: 'Notaría Segunda de Barranquilla · 1930 · Escrituras 1–61 (enero)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\2da - Notaria Segunda de Barranquilla - 1874 a 1950 (24)\\1930 - Esc 1-0640 (12)\\2da-1930 - Esc 0001-0061 - Ene',
  },
  {
    catalogCode: 'NOT2-1930-0062-0117',
    title:
      'Notaría Segunda de Barranquilla · 1930 · Escrituras 62–117 (febrero)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\2da - Notaria Segunda de Barranquilla - 1874 a 1950 (24)\\1930 - Esc 1-0640 (12)\\2da-1930 - Esc 0062-0117 - Feb',
  },
  {
    catalogCode: 'NOT2-1930-0118-0161',
    title:
      'Notaría Segunda de Barranquilla · 1930 · Escrituras 118–161 (marzo)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\2da - Notaria Segunda de Barranquilla - 1874 a 1950 (24)\\1930 - Esc 1-0640 (12)\\2da-1930 - Esc 0118-0161 - Mar',
  },
  {
    catalogCode: 'NOT2-1930-0162-0213',
    title:
      'Notaría Segunda de Barranquilla · 1930 · Escrituras 162–213 (abril)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'NO_CONSULTABLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\2da - Notaria Segunda de Barranquilla - 1874 a 1950 (24)\\1930 - Esc 1-0640 (12)\\2da-1930 - Esc 0162-0213 - Abr',
  },
  {
    catalogCode: 'NOT2-1930-0214-0253',
    title: 'Notaría Segunda de Barranquilla · 1930 · Escrituras 214–253 (mayo)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\2da - Notaria Segunda de Barranquilla - 1874 a 1950 (24)\\1930 - Esc 1-0640 (12)\\2da-1930 - Esc 0214-0253 - May',
  },
  {
    catalogCode: 'NOT2-1941-0001-0097',
    title: 'Notaría Segunda de Barranquilla · 1941 · Escrituras 1–97 (enero)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\2da - Notaria Segunda de Barranquilla - 1874 a 1950 (24)\\1941 - Esc 1-1205 (12) +\\2da-1941 - Esc 0001-0097 - Ene',
  },
  {
    catalogCode: 'NOT2-1941-0098-0222',
    title:
      'Notaría Segunda de Barranquilla · 1941 · Escrituras 98–222 (febrero)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\2da - Notaria Segunda de Barranquilla - 1874 a 1950 (24)\\1941 - Esc 1-1205 (12) +\\2da-1941 - Esc 0098-0222 - Feb',
  },
  {
    catalogCode: 'NOT2-1941-0223-0285',
    title:
      'Notaría Segunda de Barranquilla · 1941 · Escrituras 223–285 (marzo)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\2da - Notaria Segunda de Barranquilla - 1874 a 1950 (24)\\1941 - Esc 1-1205 (12) +\\2da-1941 - Esc 0223-0285 - Mar',
  },
  {
    catalogCode: 'NOT2-1941-0286-0382',
    title:
      'Notaría Segunda de Barranquilla · 1941 · Escrituras 286–382 (abril)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'EN_RESTAURACION',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\2da - Notaria Segunda de Barranquilla - 1874 a 1950 (24)\\1941 - Esc 1-1205 (12) +\\2da-1941 - Esc 0286-0382 - Abr',
  },
  {
    catalogCode: 'NOT2-1941-0383-0519',
    title: 'Notaría Segunda de Barranquilla · 1941 · Escrituras 383–519 (mayo)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\2da - Notaria Segunda de Barranquilla - 1874 a 1950 (24)\\1941 - Esc 1-1205 (12) +\\2da-1941 - Esc 0383-0519 - May',
  },
  // Notaría Tercera, 1950
  {
    catalogCode: 'NOT3-1950-0001-0050',
    title: 'Notaría Tercera de Barranquilla · 1950 · Escrituras 1–50 (enero)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\3ra - Notaria Tercera de Barranquilla - 1929 a 1950 (13)\\1950 - Esc 1-3733 (13)\\3ra-1950 - Esc 0001-0050 - Ene',
  },
  {
    catalogCode: 'NOT3-1950-0051-0160',
    title: 'Notaría Tercera de Barranquilla · 1950 · Escrituras 51–160 (enero)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'EN_RESTAURACION',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\3ra - Notaria Tercera de Barranquilla - 1929 a 1950 (13)\\1950 - Esc 1-3733 (13)\\3ra-1950 - Esc 0051-0160 - Ene',
  },
  {
    catalogCode: 'NOT3-1950-0161-0452',
    title:
      'Notaría Tercera de Barranquilla · 1950 · Escrituras 161–452 (febrero)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\3ra - Notaria Tercera de Barranquilla - 1929 a 1950 (13)\\1950 - Esc 1-3733 (13)\\3ra-1950 - Esc 0161-0452 - Feb',
  },
  {
    catalogCode: 'NOT3-1950-0453-0760',
    title:
      'Notaría Tercera de Barranquilla · 1950 · Escrituras 453–760 (marzo)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'NO_CONSULTABLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\3ra - Notaria Tercera de Barranquilla - 1929 a 1950 (13)\\1950 - Esc 1-3733 (13)\\3ra-1950 - Esc 0453-0760 - Mar',
  },
  {
    catalogCode: 'NOT3-1950-0761-1049',
    title:
      'Notaría Tercera de Barranquilla · 1950 · Escrituras 761–1049 (abril)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\3ra - Notaria Tercera de Barranquilla - 1929 a 1950 (13)\\1950 - Esc 1-3733 (13)\\3ra-1950 - Esc 0761-1049 - Abr',
  },
  // Notaría Cuarta, 1955. The first two are in use: handed over in the
  // appointment of SOL-2026-90007 and not returned yet (HU-72)
  {
    catalogCode: 'NOT4-1955-0001-0193',
    title: 'Notaría Cuarta de Barranquilla · 1955 · Escrituras 1–193 (enero)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'EN_USO',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\4ta - Notaria Cuarta de Barranquilla - 1950 a 1960 (12)\\1955 - Esc 1-2410 (12) +\\4ta-1955 - Esc 0001-0193 - Ene',
  },
  {
    catalogCode: 'NOT4-1955-0194-0450',
    title:
      'Notaría Cuarta de Barranquilla · 1955 · Escrituras 194–450 (febrero)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'EN_USO',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\4ta - Notaria Cuarta de Barranquilla - 1950 a 1960 (12)\\1955 - Esc 1-2410 (12) +\\4ta-1955 - Esc 0194-0450 - Feb',
  },
  {
    catalogCode: 'NOT4-1955-0451-0561',
    title: 'Notaría Cuarta de Barranquilla · 1955 · Escrituras 451–561 (marzo)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\4ta - Notaria Cuarta de Barranquilla - 1950 a 1960 (12)\\1955 - Esc 1-2410 (12) +\\4ta-1955 - Esc 0451-0561 - Mar',
  },
  {
    catalogCode: 'NOT4-1955-0562-0837',
    title: 'Notaría Cuarta de Barranquilla · 1955 · Escrituras 562–837 (abril)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\4ta - Notaria Cuarta de Barranquilla - 1950 a 1960 (12)\\1955 - Esc 1-2410 (12) +\\4ta-1955 - Esc 0562-0837 - Abr',
  },
  {
    catalogCode: 'NOT4-1955-0838-1033',
    title: 'Notaría Cuarta de Barranquilla · 1955 · Escrituras 838–1033 (mayo)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    folder:
      'Aha\\Fondo - Notarías\\Notarías\\4ta - Notaria Cuarta de Barranquilla - 1950 a 1960 (12)\\1955 - Esc 1-2410 (12) +\\4ta-1955 - Esc 0838-1033 - May',
  },
  {
    // Not in the simulated tree: a sync saw it once and its folder is gone,
    // so it has no digital copy now
    catalogCode: 'NOT4-1956-0001-0180',
    title: 'Notaría Cuarta de Barranquilla · 1956 · Escrituras 1–180 (enero)',
    materialType: 'PROTOCOLO_NOTARIAL',
    collection: 'Notarías',
    status: 'DISPONIBLE',
    lastSeenAt: '2026-10-01T05:00:00Z',
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

// A material that is not in the catalog, described in writing (HU-09.2)
type SeedReference = (
  | {
      kind: 'PROTOCOLO_NOTARIAL';
      notary: string;
      year: number;
      deedNumber: string;
    }
  | { kind: 'TEXTO_LIBRE'; description: string }
) & {
  // The catalog material the staff associated when the sync brought it, and
  // when. Without it the reference is PENDIENTE
  resolvedWith?: { catalogCode: string; at: string };
};

type SeedRequest = {
  // Fixed codes from 90001, so they never collide with the real sequence
  trackingCode: string;
  // Email of a public user, or of the visitor registered by the staff
  requesterEmail: string;
  status: SeedRequestStatus;
  deliveryMode: 'PRESENCIAL' | 'DIGITAL';
  desiredDate: string;
  registeredAt: string;
  // Catalog materials asked for when the request was registered
  materialCodes: string[];
  references?: SeedReference[];
  // Only for RECHAZADA; the column holds at most 500 characters (HU-16)
  rejectionReason?: string;
  // The changes after RECIBIDA, oldest first, all made by the staff (HU-17).
  // They follow the state machine (D-07) and the last one ends in `status`
  history: SeedStatusChange[];
};

type SeedStatusChange = {
  status: SeedRequestStatus;
  at: string;
  // The change to RECHAZADA takes the rejectionReason of the request
  comment?: string;
};

const VISITOR_EMAIL = 'visitante@example.com';

// Fictitious requests: every status, public users and one visitor without
// account. A DIGITAL request only asks for material with a digital copy, and
// the material of the requests in progress is DISPONIBLE (or EN_USO in its
// appointment)
const REQUESTS: SeedRequest[] = [
  {
    trackingCode: 'SOL-2026-90001',
    requesterEmail: 'publico1@example.com',
    status: 'RECIBIDA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-10',
    registeredAt: '2026-11-09T14:00:00Z',
    materialCodes: ['NOT1-1931-0207-0303'],
    history: [],
  },
  {
    trackingCode: 'SOL-2026-90002',
    requesterEmail: 'publico2@example.com',
    status: 'RECIBIDA',
    deliveryMode: 'DIGITAL',
    desiredDate: '2026-12-15',
    registeredAt: '2026-11-08T09:30:00Z',
    materialCodes: ['PER-7C52B4D6', 'PER-2D9B489C'],
    history: [],
  },
  {
    trackingCode: 'SOL-2026-90003',
    requesterEmail: 'publico1@example.com',
    status: 'EN_BUSQUEDA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-12',
    registeredAt: '2026-11-05T16:45:00Z',
    materialCodes: ['NOT2-1930-0001-0061'],
    history: [{ status: 'EN_BUSQUEDA', at: '2026-11-06T14:00:00Z' }],
  },
  {
    trackingCode: 'SOL-2026-90004',
    requesterEmail: VISITOR_EMAIL,
    status: 'EN_BUSQUEDA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-18',
    registeredAt: '2026-11-04T11:15:00Z',
    materialCodes: ['DOC-989E83A3'],
    history: [{ status: 'EN_BUSQUEDA', at: '2026-11-05T15:30:00Z' }],
  },
  {
    trackingCode: 'SOL-2026-90005',
    requesterEmail: 'publico3@example.com',
    status: 'DISPONIBLE',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-09',
    registeredAt: '2026-10-30T10:00:00Z',
    materialCodes: ['NOT2-1941-0001-0097', 'NOT2-1941-0098-0222'],
    history: [
      { status: 'EN_BUSQUEDA', at: '2026-10-31T14:00:00Z' },
      {
        status: 'DISPONIBLE',
        at: '2026-11-04T16:00:00Z',
        comment: 'Ambos protocolos listos para consultar en sala.',
      },
    ],
  },
  {
    trackingCode: 'SOL-2026-90006',
    requesterEmail: 'publico4@example.com',
    status: 'DISPONIBLE',
    deliveryMode: 'DIGITAL',
    desiredDate: '2026-12-02',
    registeredAt: '2026-10-28T15:20:00Z',
    materialCodes: ['NOT3-1950-0001-0050'],
    history: [
      { status: 'EN_BUSQUEDA', at: '2026-10-29T13:00:00Z' },
      { status: 'DISPONIBLE', at: '2026-11-03T15:00:00Z' },
    ],
  },
  {
    trackingCode: 'SOL-2026-90007',
    requesterEmail: 'publico2@example.com',
    status: 'AGENDADA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-03',
    registeredAt: '2026-10-27T08:50:00Z',
    materialCodes: ['NOT4-1955-0001-0193', 'NOT4-1955-0194-0450'],
    history: [
      { status: 'EN_BUSQUEDA', at: '2026-10-28T14:00:00Z' },
      { status: 'DISPONIBLE', at: '2026-11-03T16:30:00Z' },
      { status: 'AGENDADA', at: '2026-11-06T15:00:00Z' },
    ],
  },
  {
    trackingCode: 'SOL-2026-90008',
    requesterEmail: 'publico1@example.com',
    status: 'AGENDADA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-05',
    registeredAt: '2026-10-26T13:10:00Z',
    materialCodes: ['PER-A0CBF1ED', 'NOT1-1931-0304-0417'],
    history: [
      { status: 'EN_BUSQUEDA', at: '2026-10-27T14:00:00Z' },
      { status: 'DISPONIBLE', at: '2026-10-31T15:00:00Z' },
      { status: 'AGENDADA', at: '2026-11-04T14:30:00Z' },
      {
        status: 'DISPONIBLE',
        at: '2026-11-14T18:00:00Z',
        comment: 'No asistió a la cita; pidió una nueva fecha.',
      },
      { status: 'AGENDADA', at: '2026-11-15T14:00:00Z' },
    ],
  },
  {
    trackingCode: 'SOL-2026-90009',
    requesterEmail: 'publico3@example.com',
    status: 'ATENDIDA',
    deliveryMode: 'DIGITAL',
    desiredDate: '2026-11-20',
    registeredAt: '2026-10-15T09:00:00Z',
    materialCodes: ['NOT1-1931-0110-0206'],
    history: [
      { status: 'EN_BUSQUEDA', at: '2026-10-16T14:00:00Z' },
      { status: 'DISPONIBLE', at: '2026-10-21T15:00:00Z' },
      {
        status: 'ATENDIDA',
        at: '2026-10-22T16:00:00Z',
        comment: 'Copia digital enviada al correo del solicitante.',
      },
    ],
  },
  {
    trackingCode: 'SOL-2026-90010',
    requesterEmail: 'publico4@example.com',
    status: 'CERRADA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-11-12',
    registeredAt: '2026-10-05T12:00:00Z',
    materialCodes: ['NOT2-1930-0062-0117'],
    history: [
      { status: 'EN_BUSQUEDA', at: '2026-10-06T14:00:00Z' },
      { status: 'DISPONIBLE', at: '2026-10-14T15:00:00Z' },
      { status: 'AGENDADA', at: '2026-10-20T14:00:00Z' },
      { status: 'ATENDIDA', at: '2026-11-12T20:00:00Z' },
      { status: 'CERRADA', at: '2026-11-13T14:00:00Z' },
    ],
  },
  {
    trackingCode: 'SOL-2026-90011',
    requesterEmail: 'publico2@example.com',
    status: 'RECHAZADA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-01',
    registeredAt: '2026-11-02T10:30:00Z',
    // Its digital copy is gone and the original was not found either
    materialCodes: ['NOT4-1956-0001-0180'],
    rejectionReason: 'Material no localizado',
    history: [
      { status: 'EN_BUSQUEDA', at: '2026-11-03T14:00:00Z' },
      { status: 'RECHAZADA', at: '2026-11-05T16:00:00Z' },
    ],
  },
  {
    trackingCode: 'SOL-2026-90012',
    requesterEmail: VISITOR_EMAIL,
    status: 'RECHAZADA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-04',
    registeredAt: '2026-11-03T17:00:00Z',
    materialCodes: ['DOC-AF12775E'],
    rejectionReason: 'Material restringido',
    history: [{ status: 'RECHAZADA', at: '2026-11-04T15:00:00Z' }],
  },
  // With written references (HU-09.2): material not digitized yet
  {
    // Only references, both still without material
    trackingCode: 'SOL-2026-90013',
    requesterEmail: 'publico3@example.com',
    status: 'RECIBIDA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-16',
    registeredAt: '2026-11-10T15:00:00Z',
    materialCodes: [],
    references: [
      {
        kind: 'PROTOCOLO_NOTARIAL',
        notary: 'Notaría Quinta de Barranquilla',
        year: 1962,
        deedNumber: '345',
      },
      {
        kind: 'TEXTO_LIBRE',
        description:
          'Plano de loteo del barrio El Prado, hacia 1925, con los nombres de los compradores',
      },
    ],
    history: [],
  },
  {
    // Catalog material and a reference the sync brought afterwards
    trackingCode: 'SOL-2026-90014',
    requesterEmail: 'publico4@example.com',
    status: 'EN_BUSQUEDA',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-11',
    registeredAt: '2026-11-07T10:00:00Z',
    materialCodes: ['NOT2-1941-0223-0285'],
    references: [
      {
        kind: 'PROTOCOLO_NOTARIAL',
        notary: 'Notaría Segunda de Barranquilla',
        year: 1930,
        deedNumber: '140',
        resolvedWith: {
          catalogCode: 'NOT2-1930-0118-0161',
          at: '2026-11-10T16:00:00Z',
        },
      },
    ],
    history: [{ status: 'EN_BUSQUEDA', at: '2026-11-08T14:00:00Z' }],
  },
  {
    // Available with a reference without material: the comment says what is
    // delivered and how (HU-09.2)
    trackingCode: 'SOL-2026-90015',
    requesterEmail: 'publico1@example.com',
    status: 'DISPONIBLE',
    deliveryMode: 'PRESENCIAL',
    desiredDate: '2026-12-14',
    registeredAt: '2026-11-06T09:00:00Z',
    materialCodes: ['NOT1-1931-0418-0532'],
    references: [
      {
        kind: 'TEXTO_LIBRE',
        description:
          'Escritura de compraventa de un lote en el barrio Rebolo, de los años cuarenta',
      },
    ],
    history: [
      { status: 'EN_BUSQUEDA', at: '2026-11-07T14:00:00Z' },
      {
        status: 'DISPONIBLE',
        at: '2026-11-12T15:00:00Z',
        comment:
          'La escritura de Rebolo está localizada en físico y sin digitalizar: se consulta en sala junto con el protocolo.',
      },
    ],
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

/** The text the API writes in the history when it resolves a reference. */
function describeReference(reference: SeedReference): string {
  return reference.kind === 'PROTOCOLO_NOTARIAL'
    ? `Protocolo notarial: ${reference.notary}, año ${reference.year}, escritura ${reference.deedNumber}`
    : reference.description;
}

type SeedLoan = {
  catalogCode: string;
  handedOverAt: string;
  deliveryNotes?: string;
  // Without them the material is still in use (EN_USO)
  returnedAt?: string;
  returnNotes?: string;
};

type SeedAppointment = {
  trackingCode: string;
  appointmentDate: string;
  status: 'PROGRAMADA' | 'CUMPLIDA' | 'CANCELADA' | 'NO_ASISTIO';
  notes: string | null;
  // Physical handovers in the reading room (HU-72), made by the staff
  loans?: SeedLoan[];
};

// Fictitious appointments across November and December 2026 (never on Sunday)
const APPOINTMENTS: SeedAppointment[] = [
  {
    trackingCode: 'SOL-2026-90010',
    appointmentDate: '2026-11-12',
    status: 'CUMPLIDA',
    notes: 'Consultó el protocolo notarial en sala.',
    loans: [
      {
        catalogCode: 'NOT2-1930-0062-0117',
        handedOverAt: '2026-11-12T14:10:00Z',
        returnedAt: '2026-11-12T16:40:00Z',
        returnNotes: 'Devuelto completo y en buen estado.',
      },
    ],
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
    // Both protocols are still in the reading room
    loans: [
      {
        catalogCode: 'NOT4-1955-0001-0193',
        handedOverAt: '2026-11-18T14:05:00Z',
      },
      {
        catalogCode: 'NOT4-1955-0194-0450',
        handedOverAt: '2026-11-18T14:05:00Z',
        deliveryNotes: 'Se entrega con guantes por el estado de las hojas.',
      },
    ],
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

    // The materials count as seen by a sync at seed time
    const seenAt = new Date();
    for (const {
      publicationDate,
      publisher,
      folder,
      lastSeenAt,
      ...material
    } of MATERIALS) {
      const data = {
        ...material,
        // The sync does not know the author
        author: null,
        publicationDate: publicationDate ? new Date(publicationDate) : null,
        publisher: publisher ?? null,
        source: 'EVERYTHING',
        // The path of the leaf folder, not of a file (HU-133)
        digitalPath: folder ? `${DIGITAL_ROOT}\\${folder}` : null,
        lastSeenAt: lastSeenAt ? new Date(lastSeenAt) : seenAt,
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

      const references = seedRequest.references ?? [];
      const resolvedCodes = references.flatMap((reference) =>
        reference.resolvedWith ? [reference.resolvedWith.catalogCode] : [],
      );
      const materials = await prisma.materialModel.findMany({
        where: {
          catalogCode: {
            in: [...seedRequest.materialCodes, ...resolvedCodes],
          },
        },
        select: { id: true, catalogCode: true, title: true },
      });
      const materialByCode = new Map(
        materials.map((material) => [material.catalogCode, material]),
      );
      const materialOf = (catalogCode: string) => {
        const material = materialByCode.get(catalogCode);
        if (!material) {
          throw new Error(
            `${seedRequest.trackingCode}: no material ${catalogCode}`,
          );
        }
        return material;
      };
      const registeredAt = new Date(seedRequest.registeredAt);
      const createdById = isVisitor ? staff.id : user!.id;
      const lastStatus =
        seedRequest.history[seedRequest.history.length - 1]?.status ??
        'RECIBIDA';
      if (lastStatus !== seedRequest.status) {
        throw new Error(
          `${seedRequest.trackingCode}: its history ends in ${lastStatus}`,
        );
      }
      // attended_at and closed_at are the dates of those changes, as the API
      // writes them (HU-15)
      const changedAt = (status: SeedRequestStatus) => {
        const change = seedRequest.history.find((c) => c.status === status);
        return change ? new Date(change.at) : null;
      };
      // The status of the request at a given moment
      const statusAt = (at: string) => {
        const before = seedRequest.history.filter((change) => change.at <= at);
        return before[before.length - 1]?.status ?? 'RECIBIDA';
      };
      // Associating a reference keeps the status of the request and leaves
      // its row in the history (HU-09.2), as the API writes it
      const resolutions = references.flatMap((reference) => {
        if (!reference.resolvedWith) return [];
        const { catalogCode, at } = reference.resolvedWith;
        const status = statusAt(at);
        if (status !== 'RECIBIDA' && status !== 'EN_BUSQUEDA') {
          throw new Error(
            `${seedRequest.trackingCode}: a reference is resolved in ${status}`,
          );
        }
        const material = materialOf(catalogCode);
        return [
          {
            status,
            at,
            comment:
              `Referencia «${describeReference(reference)}» asociada al ` +
              `material ${material.catalogCode} · ${material.title}`,
          },
        ];
      });

      await prisma.requestModel.create({
        data: {
          id: randomUUID(),
          trackingCode: seedRequest.trackingCode,
          requesterId: requester.id,
          // A visitor's request is registered by the staff, the others by the user
          createdById,
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
          attendedAt: changedAt('ATENDIDA'),
          closedAt: changedAt('CERRADA'),
          // The materials asked for and the ones associated to a reference
          items: {
            create: [...seedRequest.materialCodes, ...resolvedCodes].map(
              (catalogCode) => ({
                id: randomUUID(),
                materialId: materialOf(catalogCode).id,
                itemStatus: ITEM_STATUS_BY_REQUEST_STATUS[seedRequest.status],
              }),
            ),
          },
          references: {
            create: references.map((reference) => ({
              id: randomUUID(),
              kind: reference.kind,
              notary:
                reference.kind === 'PROTOCOLO_NOTARIAL'
                  ? reference.notary
                  : null,
              deedYear:
                reference.kind === 'PROTOCOLO_NOTARIAL' ? reference.year : null,
              deedNumber:
                reference.kind === 'PROTOCOLO_NOTARIAL'
                  ? reference.deedNumber
                  : null,
              description:
                reference.kind === 'TEXTO_LIBRE' ? reference.description : null,
              status: reference.resolvedWith ? 'RESUELTA' : 'PENDIENTE',
              materialId: reference.resolvedWith
                ? materialOf(reference.resolvedWith.catalogCode).id
                : null,
              resolvedById: reference.resolvedWith ? staff.id : null,
              resolvedAt: reference.resolvedWith
                ? new Date(reference.resolvedWith.at)
                : null,
              createdAt: registeredAt,
            })),
          },
          // The timeline of the request (HU-17): its registration, then each
          // change, each previous status being the one before it
          statusHistory: {
            create: [
              {
                previousStatus: null,
                newStatus: 'RECIBIDA',
                userId: createdById,
                changedAt: registeredAt,
              },
              ...seedRequest.history.map((change, index) => ({
                previousStatus:
                  index === 0
                    ? 'RECIBIDA'
                    : seedRequest.history[index - 1].status,
                newStatus: change.status,
                userId: staff.id,
                comment:
                  change.comment ??
                  (change.status === 'RECHAZADA'
                    ? (seedRequest.rejectionReason ?? null)
                    : null),
                changedAt: new Date(change.at),
              })),
              ...resolutions.map((resolution) => ({
                previousStatus: resolution.status,
                newStatus: resolution.status,
                userId: staff.id,
                comment: resolution.comment,
                changedAt: new Date(resolution.at),
              })),
            ],
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

      const appointmentId = randomUUID();
      await prisma.appointmentModel.create({
        data: {
          id: appointmentId,
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
                seedAppointment.status === 'PROGRAMADA'
                  ? appointmentDate
                  : null,
            })),
          },
        },
      });
      for (const loan of seedAppointment.loans ?? []) {
        const material = await prisma.materialModel.findUniqueOrThrow({
          where: { catalogCode: loan.catalogCode },
        });
        if (!request.items.some((item) => item.materialId === material.id)) {
          throw new Error(
            `${seedAppointment.trackingCode}: ${loan.catalogCode} is not in its appointment`,
          );
        }
        // An open loan is what keeps the material EN_USO (HU-72)
        if ((material.status === 'EN_USO') !== !loan.returnedAt) {
          throw new Error(
            `${loan.catalogCode}: its status does not match its loan`,
          );
        }
        await prisma.materialLoanModel.create({
          data: {
            id: randomUUID(),
            materialId: material.id,
            appointmentId,
            handedOverAt: new Date(loan.handedOverAt),
            handedOverById: staff.id,
            deliveryNotes: loan.deliveryNotes ?? null,
            returnedAt: loan.returnedAt ? new Date(loan.returnedAt) : null,
            returnedById: loan.returnedAt ? staff.id : null,
            returnNotes: loan.returnNotes ?? null,
          },
        });
      }
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
