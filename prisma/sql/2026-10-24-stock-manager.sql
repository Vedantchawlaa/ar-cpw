-- Stock manager: stock type + alert level on Product, and the StockPiece /
-- StockMovement tables. Additive only.
-- Applied with `prisma db execute` instead of `prisma db push`: the schema's
-- datasource lists the Supabase "auth" schema, so a push would try to drop
-- Supabase's auth tables (and public."profiles") that Prisma does not model.
BEGIN;

ALTER TABLE "public"."Product"
  ADD COLUMN IF NOT EXISTS "lowStockAt" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "stockKind" TEXT NOT NULL DEFAULT 'ACCESSORY';

CREATE TABLE IF NOT EXISTS "public"."StockPiece" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "length" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "source" TEXT NOT NULL DEFAULT 'PURCHASE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    CONSTRAINT "StockPiece_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StockPiece_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "public"."StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "pieceId" TEXT,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "userId" TEXT,
    "measurementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "StockPiece_productId_status_idx" ON "public"."StockPiece"("productId", "status");
CREATE INDEX IF NOT EXISTS "StockMovement_productId_createdAt_idx" ON "public"."StockMovement"("productId", "createdAt");

COMMIT;
