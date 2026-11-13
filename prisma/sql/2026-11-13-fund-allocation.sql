-- Fund allocation: FundBucket and FundTransfer tables. Additive only.
-- Apply with: npx prisma db execute --file prisma/sql/2026-11-13-fund-allocation.sql --schema prisma/schema.prisma
-- (not `prisma db push` - see 2026-10-24-stock-manager.sql for why)
-- Buckets are seeded by the app (55/12/10/10/7/5/1) the first time the Transactions page loads.
BEGIN;

CREATE TABLE IF NOT EXISTS "public"."FundBucket" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SPEND',
    "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FundBucket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."FundTransfer" (
    "id" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FundTransfer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FundTransfer_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "public"."FundBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "FundTransfer_bucketId_month_year_key" ON "public"."FundTransfer"("bucketId", "month", "year");

COMMIT;
