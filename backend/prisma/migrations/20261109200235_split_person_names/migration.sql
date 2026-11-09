-- Issue #96: users and requesters store the name in four fields:
-- first_name, middle_name (optional), last_name, second_last_name (optional).
--
-- Written by hand. The migration Prisma generates drops the old columns and
-- adds NOT NULL columns without values: it fails when the tables have rows,
-- and the names would be lost. Here the new columns are filled from the old
-- ones before dropping them. Everything runs in one transaction, so a failure
-- leaves the database as it was.

BEGIN;

-- 1. New columns, nullable until they are filled
ALTER TABLE "users"
    ADD COLUMN "first_name" VARCHAR(40),
    ADD COLUMN "middle_name" VARCHAR(40),
    ADD COLUMN "last_name" VARCHAR(40),
    ADD COLUMN "second_last_name" VARCHAR(40);

ALTER TABLE "requesters"
    ADD COLUMN "first_name" VARCHAR(40),
    ADD COLUMN "middle_name" VARCHAR(40),
    ADD COLUMN "last_name" VARCHAR(40),
    ADD COLUMN "second_last_name" VARCHAR(40);

-- 2. Fill them from the old columns. Repeated spaces are collapsed into one,
-- and LEFT(..., 40) keeps long values within the new limit.

-- users.full_name: the first word goes to first_name and the rest to
-- last_name. With a single word, it is repeated in last_name.
WITH parts AS (
    SELECT
        "id",
        regexp_split_to_array(btrim(regexp_replace("full_name", '\s+', ' ', 'g')), ' ') AS words
    FROM "users"
)
UPDATE "users" AS u
SET
    "first_name" = LEFT(p.words[1], 40),
    "last_name" = LEFT(COALESCE(NULLIF(array_to_string(p.words[2:], ' '), ''), p.words[1]), 40)
FROM parts AS p
WHERE p."id" = u."id";

-- requesters: the first word of first_names goes to first_name and the rest
-- to middle_name; the first word of last_names goes to last_name and the rest
-- to second_last_name. Nothing left over means NULL.
WITH parts AS (
    SELECT
        "id",
        regexp_split_to_array(btrim(regexp_replace("first_names", '\s+', ' ', 'g')), ' ') AS names,
        regexp_split_to_array(btrim(regexp_replace("last_names", '\s+', ' ', 'g')), ' ') AS surnames
    FROM "requesters"
)
UPDATE "requesters" AS r
SET
    "first_name" = LEFT(p.names[1], 40),
    "middle_name" = LEFT(NULLIF(array_to_string(p.names[2:], ' '), ''), 40),
    "last_name" = LEFT(p.surnames[1], 40),
    "second_last_name" = LEFT(NULLIF(array_to_string(p.surnames[2:], ' '), ''), 40)
FROM parts AS p
WHERE p."id" = r."id";

-- 3. First name and last name are required
ALTER TABLE "users"
    ALTER COLUMN "first_name" SET NOT NULL,
    ALTER COLUMN "last_name" SET NOT NULL;

ALTER TABLE "requesters"
    ALTER COLUMN "first_name" SET NOT NULL,
    ALTER COLUMN "last_name" SET NOT NULL;

-- 4. Drop the old columns and the name index that used them
DROP INDEX "requesters_name_trgm_idx";

ALTER TABLE "users" DROP COLUMN "full_name";

ALTER TABLE "requesters"
    DROP COLUMN "first_names",
    DROP COLUMN "last_names";

-- 5. Name search index over the four new columns (D-16)
CREATE INDEX "requesters_name_trgm_idx" ON "requesters" USING GIN ("first_name" gin_trgm_ops, "middle_name" gin_trgm_ops, "last_name" gin_trgm_ops, "second_last_name" gin_trgm_ops);

COMMIT;
