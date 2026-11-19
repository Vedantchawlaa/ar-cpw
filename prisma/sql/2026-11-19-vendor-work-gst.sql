-- Vendor ledger: GST % and bill / ref no. on each line. Additive only.
-- Apply with the session pooler (see 2026-11-13-fund-allocation.sql); not `prisma db push`.
ALTER TABLE "public"."VendorWork" ADD COLUMN IF NOT EXISTS "gstPercent" DOUBLE PRECISION;
ALTER TABLE "public"."VendorWork" ADD COLUMN IF NOT EXISTS "refNo" TEXT;
