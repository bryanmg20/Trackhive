import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'crypto';

// Datos ficticios para la demo. Las contraseñas salen de variables de entorno.
const USUARIOS = [
  { nombreCompleto: 'Admin Demo', email: 'admin@example.com', rol: 'ADMIN' },
  {
    nombreCompleto: 'Personal Demo Uno',
    email: 'personal1@example.com',
    rol: 'PERSONAL',
  },
  {
    nombreCompleto: 'Personal Demo Dos',
    email: 'personal2@example.com',
    rol: 'PERSONAL',
  },
  {
    nombreCompleto: 'Publico Demo Uno',
    email: 'publico1@example.com',
    rol: 'PUBLICO',
  },
  {
    nombreCompleto: 'Publico Demo Dos',
    email: 'publico2@example.com',
    rol: 'PUBLICO',
  },
  {
    nombreCompleto: 'Publico Demo Tres',
    email: 'publico3@example.com',
    rol: 'PUBLICO',
  },
  {
    nombreCompleto: 'Publico Demo Cuatro',
    email: 'publico4@example.com',
    rol: 'PUBLICO',
  },
];

function leerVariable(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}`);
  }
  return valor;
}

async function main() {
  const claveAdmin = leerVariable('SEED_ADMIN_PASSWORD');
  const claveDemo = leerVariable('SEED_DEMO_PASSWORD');

  const prisma = new PrismaClient();
  try {
    for (const usuario of USUARIOS) {
      const clave = usuario.rol === 'ADMIN' ? claveAdmin : claveDemo;
      const passwordHash = await argon2.hash(clave);

      // upsert por correo: ejecutar la semilla varias veces no duplica usuarios
      await prisma.userModel.upsert({
        where: { email: usuario.email },
        update: { ...usuario, passwordHash, activo: true },
        create: { id: randomUUID(), ...usuario, passwordHash },
      });
    }
    console.log(`Semilla aplicada: ${USUARIOS.length} usuarios`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
