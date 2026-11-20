-- HU-165: the catalog only grows through the Everything sync, and the
-- original is found by the convention of its catalog code (notary, year and
-- deed range). The physical location (depot, shelf and box) goes away.

-- AlterTable
ALTER TABLE "materials" DROP CONSTRAINT "materials_location_check",
DROP COLUMN "depot",
DROP COLUMN "shelf",
DROP COLUMN "box";

-- AlterTable: access_type was always FISICO and nothing read it
ALTER TABLE "request_items" DROP CONSTRAINT "request_items_access_type_check",
DROP COLUMN "access_type";
