-- Planner: PlannerTopic and PlannerCheckpoint tables. Additive only.
-- Apply with: npx prisma db execute --file prisma/sql/2026-11-12-planner.sql --schema prisma/schema.prisma
-- (not `prisma db push` - see 2026-10-24-stock-manager.sql for why)
BEGIN;

CREATE TABLE IF NOT EXISTS "public"."PlannerTopic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'IDEA',
    "description" TEXT,
    "deadline" TIMESTAMP(3),
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlannerTopic_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlannerTopic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PlannerTopic_userId_done_idx" ON "public"."PlannerTopic"("userId", "done");

CREATE TABLE IF NOT EXISTS "public"."PlannerCheckpoint" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PlannerCheckpoint_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PlannerCheckpoint_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "public"."PlannerTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PlannerCheckpoint_topicId_idx" ON "public"."PlannerCheckpoint"("topicId");

COMMIT;
