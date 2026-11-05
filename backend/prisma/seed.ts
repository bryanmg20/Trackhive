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
    console.log(`Seed applied: ${USERS.length} users`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
