-- HU-20.1 (RN-19): singleton configuration for the daily appointment
-- capacity of the reading room. When the table has no row, the application
-- defaults to 15 appointments per day.
CREATE TABLE "reading_room_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "daily_capacity" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_id" UUID,

    CONSTRAINT "reading_room_config_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reading_room_config_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    -- Added by hand: Prisma does not generate CHECK constraints
    CONSTRAINT "reading_room_config_singleton_check" CHECK ("id" = 1),
    CONSTRAINT "reading_room_config_daily_capacity_check" CHECK ("daily_capacity" > 0)
);
