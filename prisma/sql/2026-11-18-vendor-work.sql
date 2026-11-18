-- Vendor work ledger: VendorWork table. Additive only.
-- Apply with the session pooler (see 2026-11-13-fund-allocation.sql); not `prisma db push`.
BEGIN;

CREATE TABLE IF NOT EXISTS "public"."VendorWork" (
    "id" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "nos" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VendorWork_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VendorWork_vendor_idx" ON "public"."VendorWork"("vendor");

COMMIT;
