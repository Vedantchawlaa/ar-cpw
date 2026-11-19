-- Round off on a vendor bill (added to the bill total, e.g. 0.20 or -0.30)
ALTER TABLE "public"."VendorBill" ADD COLUMN IF NOT EXISTS "roundOff" DOUBLE PRECISION;
