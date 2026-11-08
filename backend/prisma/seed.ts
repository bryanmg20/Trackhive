import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';

// Fictitious demo data. Passwords come from environment variables.
const USERS = [
  { fullName: 'Admin Demo', email: 'admin@example.com', role: 'ADMIN' },
  {
    fullName: 'Personal Demo Uno',
    email: 'personal1@example.com',
    role: 'PERSONAL',
  },
  {
    fullName: 'Personal Demo Dos',
    email: 'personal2@example.com',
    role: 'PERSONAL',
  },
  {
    fullName: 'Publico Demo Uno',
    email: 'publico1@example.com',
    role: 'PUBLICO',
  },
  {
    fullName: 'Publico Demo Dos',
    email: 'publico2@example.com',
    role: 'PUBLICO',
  },
  {
    fullName: 'Publico Demo Tres',
    email: 'publico3@example.com',
    role: 'PUBLICO',
  },
  {
    fullName: 'Publico Demo Cuatro',
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

    console.log(
      `Seed applied: ${USERS.length} users, ${MATERIALS.length} materials`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
