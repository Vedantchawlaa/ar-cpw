-- Sales CRM (Sales Funnel > Call Manager > Lead Management). Additive, plus one relaxation:
-- Lead.lastContacted becomes nullable (a new lead has not been contacted yet).
-- Apply with: npx prisma db execute --file prisma/sql/2026-11-21-sales-crm.sql --schema prisma/schema.prisma
-- (not `prisma db push` - see 2026-10-24-stock-manager.sql for why)
BEGIN;

-- ---------------------------------------------------------------- User
ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "salesRole" TEXT,
  ADD COLUMN IF NOT EXISTS "managerId" TEXT,
  ADD COLUMN IF NOT EXISTS "phone" TEXT;
DO $$ BEGIN
  ALTER TABLE "public"."User" ADD CONSTRAINT "User_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."User" ADD CONSTRAINT "User_salesRole_check" CHECK ("salesRole" IS NULL OR "salesRole" IN ('MANAGER', 'EXECUTIVE'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "User_managerId_idx" ON "public"."User"("managerId");

-- ---------------------------------------------------------------- Lead
ALTER TABLE "public"."Lead"
  ALTER COLUMN "lastContacted" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "leadNo" INTEGER,
  ADD COLUMN IF NOT EXISTS "altPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "whatsapp" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "productInterest" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS "assignedToId" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lostReason" TEXT;

-- Lead IDs: existing leads numbered from 1001 in the order they were created
CREATE SEQUENCE IF NOT EXISTS "public"."Lead_leadNo_seq" OWNED BY "public"."Lead"."leadNo";
WITH numbered AS (
  SELECT "id", 1000 + ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS n FROM "public"."Lead" WHERE "leadNo" IS NULL
)
UPDATE "public"."Lead" l SET "leadNo" = numbered.n + COALESCE((SELECT MAX("leadNo") - 1000 FROM "public"."Lead"), 0)
FROM numbered WHERE l."id" = numbered."id";
SELECT setval('"public"."Lead_leadNo_seq"', GREATEST(COALESCE((SELECT MAX("leadNo") FROM "public"."Lead"), 1000), 1000));
ALTER TABLE "public"."Lead" ALTER COLUMN "leadNo" SET DEFAULT nextval('"public"."Lead_leadNo_seq"');
ALTER TABLE "public"."Lead" ALTER COLUMN "leadNo" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Lead_leadNo_key" ON "public"."Lead"("leadNo");

-- Existing leads were all worked already: the staff member who created one owns it,
-- and it counts as Contacted (or Quotation Sent when a quotation was shared).
UPDATE "public"."Lead" l SET "assignedToId" = l."userId", "assignedAt" = l."createdAt"
FROM "public"."User" u
WHERE l."assignedToId" IS NULL AND l."userId" = u."id" AND u."role" IN ('admin', 'user');
UPDATE "public"."Lead" SET "status" = CASE WHEN "quotationShared" THEN 'QUOTATION_SENT' ELSE 'CONTACTED' END
WHERE "status" = 'NEW' AND "lastContacted" IS NOT NULL AND "createdAt" < now();

DO $$ BEGIN
  ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_status_check" CHECK ("status" IN ('NEW','ASSIGNED','CONTACTED','INTERESTED','QUOTATION_SENT','FOLLOW_UP','NEGOTIATION','CONVERTED','LOST'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "Lead_assignedToId_status_idx" ON "public"."Lead"("assignedToId", "status");
CREATE INDEX IF NOT EXISTS "Lead_status_idx" ON "public"."Lead"("status");
CREATE INDEX IF NOT EXISTS "Lead_nextContactDate_idx" ON "public"."Lead"("nextContactDate");
CREATE INDEX IF NOT EXISTS "Lead_createdAt_idx" ON "public"."Lead"("createdAt");

-- ---------------------------------------------------------------- LeadStatusHistory
CREATE TABLE IF NOT EXISTS "public"."LeadStatusHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadStatusHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LeadStatusHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LeadStatusHistory_leadId_createdAt_idx" ON "public"."LeadStatusHistory"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadStatusHistory_toStatus_createdAt_idx" ON "public"."LeadStatusHistory"("toStatus", "createdAt");

-- ---------------------------------------------------------------- LeadAssignment
CREATE TABLE IF NOT EXISTS "public"."LeadAssignment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadAssignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LeadAssignment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LeadAssignment_leadId_createdAt_idx" ON "public"."LeadAssignment"("leadId", "createdAt");

-- ---------------------------------------------------------------- LeadActivity
CREATE TABLE IF NOT EXISTS "public"."LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LeadActivity_leadId_createdAt_idx" ON "public"."LeadActivity"("leadId", "createdAt");

-- ---------------------------------------------------------------- LeadFollowUp
CREATE TABLE IF NOT EXISTS "public"."LeadFollowUp" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "outcome" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadFollowUp_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LeadFollowUp_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LeadFollowUp_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LeadFollowUp_status_check" CHECK ("status" IN ('PENDING','DONE','RESCHEDULED','CANCELLED'))
);
CREATE INDEX IF NOT EXISTS "LeadFollowUp_assignedToId_status_dueAt_idx" ON "public"."LeadFollowUp"("assignedToId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "LeadFollowUp_leadId_idx" ON "public"."LeadFollowUp"("leadId");
CREATE INDEX IF NOT EXISTS "LeadFollowUp_status_dueAt_idx" ON "public"."LeadFollowUp"("status", "dueAt");

-- Existing reminders (Lead.nextContactDate) become pending follow-ups, so nothing is lost
INSERT INTO "public"."LeadFollowUp" ("id", "leadId", "assignedToId", "createdById", "dueAt", "notes", "status", "updatedAt")
SELECT gen_random_uuid()::text, l."id", l."assignedToId", l."userId", l."nextContactDate", 'Carried over from the lead''s next contact date', 'PENDING', now()
FROM "public"."Lead" l
WHERE l."nextContactDate" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "public"."LeadFollowUp" f WHERE f."leadId" = l."id");

-- ---------------------------------------------------------------- CallLog
CREATE TABLE IF NOT EXISTS "public"."CallLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "userId" TEXT,
    "phone" TEXT NOT NULL,
    "phoneKey" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "provider" TEXT,
    "externalId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "answeredAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSec" INTEGER,
    "talkSec" INTEGER,
    "recordingUrl" TEXT,
    "notes" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CallLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CallLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CallLog_direction_check" CHECK ("direction" IN ('OUTGOING','INCOMING')),
    CONSTRAINT "CallLog_status_check" CHECK ("status" IN ('CONNECTED','MISSED','REJECTED','NOT_ANSWERED','BUSY','FAILED')),
    CONSTRAINT "CallLog_source_check" CHECK ("source" IN ('DEVICE','PROVIDER','MANUAL')),
    CONSTRAINT "CallLog_duration_check" CHECK (("durationSec" IS NULL OR "durationSec" >= 0) AND ("talkSec" IS NULL OR "talkSec" >= 0)),
    -- a self-reported call never carries talk time
    CONSTRAINT "CallLog_manual_talk_check" CHECK ("source" <> 'MANUAL' OR "talkSec" IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS "CallLog_source_externalId_key" ON "public"."CallLog"("source", "externalId");
CREATE INDEX IF NOT EXISTS "CallLog_userId_startedAt_idx" ON "public"."CallLog"("userId", "startedAt");
CREATE INDEX IF NOT EXISTS "CallLog_leadId_startedAt_idx" ON "public"."CallLog"("leadId", "startedAt");
CREATE INDEX IF NOT EXISTS "CallLog_startedAt_idx" ON "public"."CallLog"("startedAt");
CREATE INDEX IF NOT EXISTS "CallLog_phoneKey_idx" ON "public"."CallLog"("phoneKey");

-- ---------------------------------------------------------------- WorkSession / WorkStatusEvent
CREATE TABLE IF NOT EXISTS "public"."WorkSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "endNote" TEXT,
    CONSTRAINT "WorkSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkSession_range_check" CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt")
);
CREATE INDEX IF NOT EXISTS "WorkSession_userId_startedAt_idx" ON "public"."WorkSession"("userId", "startedAt");
-- one open session per person, even when two tabs click Start Work together
CREATE UNIQUE INDEX IF NOT EXISTS "WorkSession_one_open_per_user" ON "public"."WorkSession"("userId") WHERE "endedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "public"."WorkStatusEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    CONSTRAINT "WorkStatusEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkStatusEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkStatusEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."WorkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkStatusEvent_status_check" CHECK ("status" IN ('AVAILABLE','ON_CALL','BREAK','LUNCH','MEETING')),
    CONSTRAINT "WorkStatusEvent_range_check" CHECK ("endedAt" IS NULL OR "endedAt" >= "startedAt")
);
CREATE INDEX IF NOT EXISTS "WorkStatusEvent_userId_startedAt_idx" ON "public"."WorkStatusEvent"("userId", "startedAt");
CREATE INDEX IF NOT EXISTS "WorkStatusEvent_sessionId_idx" ON "public"."WorkStatusEvent"("sessionId");
CREATE UNIQUE INDEX IF NOT EXISTS "WorkStatusEvent_one_open_per_user" ON "public"."WorkStatusEvent"("userId") WHERE "endedAt" IS NULL;

COMMIT;
