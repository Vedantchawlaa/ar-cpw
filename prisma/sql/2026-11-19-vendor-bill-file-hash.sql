-- Spot the same bill uploaded twice: sha256 of the bill's file
ALTER TABLE "public"."VendorBill" ADD COLUMN IF NOT EXISTS "fileHash" TEXT;
CREATE INDEX IF NOT EXISTS "VendorBill_fileHash_idx" ON "public"."VendorBill" ("fileHash");
-- Fill it in for bills already saved
UPDATE "public"."VendorBill" b SET "fileHash" = encode(sha256(a."data"), 'hex')
FROM "public"."Attachment" a WHERE a."id" = b."attachmentId" AND b."fileHash" IS NULL;
