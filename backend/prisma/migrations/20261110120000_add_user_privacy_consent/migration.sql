-- AlterTable
ALTER TABLE "users"
    ADD COLUMN "privacy_policy_accepted_at" TIMESTAMPTZ,
    ADD COLUMN "privacy_policy_version" VARCHAR(10);

-- Added by hand: Prisma does not generate CHECK constraints.
-- The consent record is either complete (date + version) or absent (seeded accounts).
ALTER TABLE "users"
    ADD CONSTRAINT "users_privacy_consent_check" CHECK (
        ("privacy_policy_accepted_at" IS NULL AND "privacy_policy_version" IS NULL)
        OR
        ("privacy_policy_accepted_at" IS NOT NULL AND "privacy_policy_version" IS NOT NULL)
    );
