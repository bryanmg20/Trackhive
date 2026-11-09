ALTER TABLE "requesters"
    ADD CONSTRAINT "requesters_document_type_check"
        CHECK ("document_type" IS NULL OR "document_type" IN ('CC', 'CE', 'TI', 'PAS', 'NIT')),
    ADD CONSTRAINT "requesters_requester_type_check"
        CHECK ("requester_type" IN ('INVESTIGADOR', 'ESTUDIANTE', 'DOCENTE', 'CIUDADANO', 'ENTIDAD')),
    ADD CONSTRAINT "requesters_contact_check"
        CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);

CREATE INDEX "requesters_name_trgm_idx"
    ON "requesters" USING GIN ("first_names" gin_trgm_ops, "last_names" gin_trgm_ops);

ALTER TABLE "requests"
    ADD CONSTRAINT "requests_assignee_id_fkey"
        FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "requests_request_type_check"
        CHECK ("request_type" IN ('CONSULTA_SALA', 'BUSQUEDA_INFORMACION', 'REPRODUCCION')),
    ADD CONSTRAINT "requests_origin_channel_check"
        CHECK ("origin_channel" IN ('WEB', 'PRESENCIAL', 'CORREO')),
    ADD CONSTRAINT "requests_delivery_mode_check"
        CHECK ("delivery_mode" IN ('PRESENCIAL', 'DIGITAL')),
    ADD CONSTRAINT "requests_purpose_check"
        CHECK ("purpose" IN ('INVESTIGACION', 'ACADEMICO', 'TRAMITE', 'GENEALOGIA', 'OTRO')),
    ADD CONSTRAINT "requests_priority_check"
        CHECK ("priority" IN ('BAJA', 'MEDIA', 'ALTA')),
    ADD CONSTRAINT "requests_status_check"
        CHECK ("status" IN ('RECIBIDA', 'EN_BUSQUEDA', 'DISPONIBLE', 'AGENDADA', 'ATENDIDA', 'CERRADA', 'RECHAZADA')),
    ADD CONSTRAINT "requests_rejection_reason_check"
        CHECK (("status" = 'RECHAZADA' AND "rejection_reason" IS NOT NULL) OR ("status" <> 'RECHAZADA' AND "rejection_reason" IS NULL));

CREATE INDEX "requests_assignee_id_idx" ON "requests"("assignee_id");
CREATE INDEX "requests_registered_at_idx" ON "requests"("registered_at");

ALTER TABLE "request_items"
    DROP CONSTRAINT "request_items_request_id_fkey",
    ADD CONSTRAINT "request_items_request_id_fkey"
        FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "request_items_item_status_check"
        CHECK ("item_status" IN ('PENDIENTE', 'LOCALIZADO', 'NO_LOCALIZADO', 'NO_APTO')),
    ADD CONSTRAINT "request_items_access_type_check"
        CHECK ("access_type" IN ('FISICO', 'DIGITAL'));
