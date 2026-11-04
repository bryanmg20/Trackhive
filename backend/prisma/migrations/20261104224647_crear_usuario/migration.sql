-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "nombre_completo" VARCHAR(120) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "rol" VARCHAR(10) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_acceso" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id"),
    -- Agregado a mano: Prisma no genera CHECK
    CONSTRAINT "usuario_rol_check" CHECK ("rol" IN ('ADMIN', 'PERSONAL', 'PUBLICO'))
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");
