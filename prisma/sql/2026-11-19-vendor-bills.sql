-- Vendor bills: VendorBill table and VendorWork.billId. Additive only.
-- Apply with the session pooler (see 2026-11-13-fund-allocation.sql); not `prisma db push`.
BEGIN;

CREATE TABLE IF NOT EXISTS "public"."VendorBill" (
    "id" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "refNo" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "gstPercent" DOUBLE PRECISION,
    "notes" TEXT,
    "attachmentId" TEXT,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VendorBill_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VendorBill_vendor_idx" ON "public"."VendorBill"("vendor");

ALTER TABLE "public"."VendorWork" ADD COLUMN IF NOT EXISTS "billId" TEXT;
CREATE INDEX IF NOT EXISTS "VendorWork_billId_idx" ON "public"."VendorWork"("billId");

COMMIT;
