-- Added by hand: trigram indexes for text search (D-16)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateTable
CREATE TABLE "materials" (
    "id" UUID NOT NULL,
    "catalog_code" VARCHAR(40) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "material_type" VARCHAR(20) NOT NULL,
    "author" VARCHAR(150),
    "collection" VARCHAR(120) NOT NULL,
    "publication_date" DATE,
    "publisher" VARCHAR(150),
    "depot" VARCHAR(40) NOT NULL,
    "shelf" VARCHAR(40) NOT NULL,
    "box" VARCHAR(40) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id"),
    -- Added by hand: Prisma does not generate CHECK constraints
    CONSTRAINT "materials_material_type_check" CHECK ("material_type" IN ('DOCUMENTO', 'PERIODICO', 'PROTOCOLO_NOTARIAL', 'OTRO')),
    CONSTRAINT "materials_status_check" CHECK ("status" IN ('DISPONIBLE', 'EN_USO', 'EN_RESTAURACION', 'NO_CONSULTABLE'))
);

-- CreateIndex
CREATE UNIQUE INDEX "materials_catalog_code_key" ON "materials"("catalog_code");

-- CreateIndex
CREATE INDEX "materials_material_type_idx" ON "materials"("material_type");

-- CreateIndex
CREATE INDEX "materials_title_trgm_idx" ON "materials" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "materials_author_trgm_idx" ON "materials" USING GIN ("author" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "materials_collection_trgm_idx" ON "materials" USING GIN ("collection" gin_trgm_ops);
