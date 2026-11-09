-- Added by hand: trigram indexes for requester name search (D-16)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE "requesters" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "document_type" VARCHAR(5),
    "document_number" VARCHAR(20),
    "first_names" VARCHAR(80) NOT NULL,
    "last_names" VARCHAR(80) NOT NULL,
    "email" VARCHAR(160),
    "phone" VARCHAR(20),
    "requester_type" VARCHAR(15) NOT NULL,
    "institution" VARCHAR(150),
    "accepts_data_processing" BOOLEAN NOT NULL,
    "consented_at" TIMESTAMPTZ NOT NULL,
    "privacy_policy_version" VARCHAR(10) NOT NULL,
    "anonymized_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "requesters_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "requesters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    -- Added by hand: Prisma does not generate CHECK constraints
    CONSTRAINT "requesters_document_type_check" CHECK ("document_type" IS NULL OR "document_type" IN ('CC', 'CE', 'TI', 'PAS', 'NIT')),
    CONSTRAINT "requesters_requester_type_check" CHECK ("requester_type" IN ('INVESTIGADOR', 'ESTUDIANTE', 'DOCENTE', 'CIUDADANO', 'ENTIDAD')),
    CONSTRAINT "requesters_contact_check" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL),
    CONSTRAINT "requesters_accepts_data_processing_check" CHECK ("accepts_data_processing" = true)
);

CREATE UNIQUE INDEX "requesters_user_id_key" ON "requesters"("user_id");
CREATE UNIQUE INDEX "requesters_document_type_document_number_key" ON "requesters"("document_type", "document_number");
CREATE INDEX "requesters_document_number_idx" ON "requesters"("document_number");
CREATE INDEX "requesters_email_idx" ON "requesters"("email");
CREATE INDEX "requesters_name_trgm_idx" ON "requesters" USING GIN ("first_names" gin_trgm_ops, "last_names" gin_trgm_ops);

CREATE TABLE "requests" (
    "id" UUID NOT NULL,
    "tracking_code" VARCHAR(16) NOT NULL,
    "requester_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "assignee_id" UUID,
    "request_type" VARCHAR(25) NOT NULL,
    "origin_channel" VARCHAR(10) NOT NULL,
    "delivery_mode" VARCHAR(10) NOT NULL,
    "purpose" VARCHAR(15) NOT NULL,
    "reason" TEXT,
    "requirement_description" TEXT NOT NULL,
    "desired_date" DATE NOT NULL,
    "committed_date" DATE,
    "priority" VARCHAR(5) NOT NULL DEFAULT 'MEDIA',
    "status" VARCHAR(12) NOT NULL DEFAULT 'RECIBIDA',
    "rejection_reason" VARCHAR(25),
    "notes" TEXT,
    "registered_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attended_at" TIMESTAMPTZ,
    "closed_at" TIMESTAMPTZ,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "requesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "requests_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    -- Added by hand: Prisma does not generate CHECK constraints
    CONSTRAINT "requests_request_type_check" CHECK ("request_type" IN ('CONSULTA_SALA', 'BUSQUEDA_INFORMACION', 'REPRODUCCION')),
    CONSTRAINT "requests_origin_channel_check" CHECK ("origin_channel" IN ('WEB', 'PRESENCIAL', 'CORREO')),
    CONSTRAINT "requests_delivery_mode_check" CHECK ("delivery_mode" IN ('PRESENCIAL', 'DIGITAL')),
    CONSTRAINT "requests_purpose_check" CHECK ("purpose" IN ('INVESTIGACION', 'ACADEMICO', 'TRAMITE', 'GENEALOGIA', 'OTRO')),
    CONSTRAINT "requests_priority_check" CHECK ("priority" IN ('BAJA', 'MEDIA', 'ALTA')),
    CONSTRAINT "requests_status_check" CHECK ("status" IN ('RECIBIDA', 'EN_BUSQUEDA', 'DISPONIBLE', 'AGENDADA', 'ATENDIDA', 'CERRADA', 'RECHAZADA')),
    CONSTRAINT "requests_rejection_reason_check" CHECK (("status" = 'RECHAZADA' AND "rejection_reason" IS NOT NULL) OR ("status" <> 'RECHAZADA' AND "rejection_reason" IS NULL))
);

CREATE UNIQUE INDEX "requests_tracking_code_key" ON "requests"("tracking_code");
CREATE INDEX "requests_requester_id_idx" ON "requests"("requester_id");
CREATE INDEX "requests_created_by_id_idx" ON "requests"("created_by_id");
CREATE INDEX "requests_assignee_id_idx" ON "requests"("assignee_id");
CREATE INDEX "requests_status_committed_date_idx" ON "requests"("status", "committed_date");
CREATE INDEX "requests_registered_at_idx" ON "requests"("registered_at");

CREATE TABLE "request_items" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "item_status" VARCHAR(15) NOT NULL DEFAULT 'PENDIENTE',
    "access_type" VARCHAR(10) NOT NULL DEFAULT 'FISICO',
    "note" TEXT,
    CONSTRAINT "request_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "request_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "request_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    -- Added by hand: Prisma does not generate CHECK constraints
    CONSTRAINT "request_items_item_status_check" CHECK ("item_status" IN ('PENDIENTE', 'LOCALIZADO', 'NO_LOCALIZADO', 'NO_APTO')),
    CONSTRAINT "request_items_access_type_check" CHECK ("access_type" IN ('FISICO', 'DIGITAL'))
);

CREATE UNIQUE INDEX "request_items_request_id_material_id_key" ON "request_items"("request_id", "material_id");
CREATE INDEX "request_items_material_id_idx" ON "request_items"("material_id");

-- Added by hand: race-safe generator for tracking_code (SOL-AAAA-NNNNN)
CREATE SEQUENCE "request_tracking_seq" START WITH 1 INCREMENT BY 1;
