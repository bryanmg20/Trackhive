-- HU-23: outbox of the emails to the requester (D-10, docs/modelo-datos.md §3).
-- Every status change inserts its row here in the same transaction; a
-- scheduled job sends it through SMTP and retries it if the server fails, so
-- a mail failure never undoes the change.
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "status_history_id" BIGINT,
    "recipient_email" VARCHAR(160) NOT NULL,
    "template" VARCHAR(25) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "html_body" TEXT,
    "delivery_status" VARCHAR(10) NOT NULL DEFAULT 'PENDIENTE',
    "attempts" SMALLINT NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "sent_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "notifications_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "notifications_status_history_id_fkey" FOREIGN KEY ("status_history_id") REFERENCES "status_history"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    -- Added by hand: Prisma does not generate CHECK constraints
    CONSTRAINT "notifications_template_check" CHECK ("template" IN ('CAMBIO_ESTADO')),
    CONSTRAINT "notifications_delivery_status_check" CHECK ("delivery_status" IN ('PENDIENTE', 'ENVIADA', 'FALLIDA')),
    CONSTRAINT "notifications_attempts_check" CHECK ("attempts" >= 0),
    CONSTRAINT "notifications_recipient_email_check" CHECK (btrim("recipient_email") <> ''),
    -- Only a sent email has a sending date
    CONSTRAINT "notifications_sent_at_check" CHECK (("delivery_status" = 'ENVIADA') = ("sent_at" IS NOT NULL))
);

-- One email per status change
CREATE UNIQUE INDEX "notifications_status_history_id_key" ON "notifications"("status_history_id");

-- The job looks for the pending ones whose time has come (§4)
CREATE INDEX "notifications_delivery_status_scheduled_at_idx" ON "notifications"("delivery_status", "scheduled_at");
CREATE INDEX "notifications_request_id_idx" ON "notifications"("request_id");
