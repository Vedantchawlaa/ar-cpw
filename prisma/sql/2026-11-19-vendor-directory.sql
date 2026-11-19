-- Vendor directory: Vendor table. Additive only.
-- Apply with the session pooler (see 2026-11-13-fund-allocation.sql); not `prisma db push`.
BEGIN;

CREATE TABLE IF NOT EXISTS "public"."Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Vendor_name_key" ON "public"."Vendor"("name");

COMMIT;
