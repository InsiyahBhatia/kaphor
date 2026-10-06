-- Baseline for tables/enums that were originally created with `prisma db push` and never had a migration.
-- Everything is idempotent (IF NOT EXISTS / guarded), so it is a no-op on databases that already have them
-- and creates them on a fresh database built with `prisma migrate deploy`.

-- Enums
DO $$ BEGIN
  CREATE TYPE "ConversationType" AS ENUM ('SALE', 'SWAP', 'RENTAL', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "UpcycleRequestStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- conversations
CREATE TABLE IF NOT EXISTS "conversations" (
    "id" TEXT NOT NULL,
    "participant1Id" TEXT NOT NULL,
    "participant2Id" TEXT NOT NULL,
    "garmentId" TEXT,
    "type" "ConversationType" NOT NULL DEFAULT 'SALE',
    "orderId" TEXT,
    "swapId" TEXT,
    "rentalId" TEXT,
    "lastMessageText" TEXT,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- direct_messages
CREATE TABLE IF NOT EXISTS "direct_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

-- upcycle_requests
CREATE TABLE IF NOT EXISTS "upcycle_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "garmentId" TEXT NOT NULL,
    "suggestionIndex" INTEGER,
    "customIdea" TEXT,
    "notes" TEXT,
    "images" TEXT[],
    "status" "UpcycleRequestStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "estimatedCost" DOUBLE PRECISION,
    "estimatedDays" INTEGER,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "upcycle_requests_pkey" PRIMARY KEY ("id")
);

-- user_reports
CREATE TABLE IF NOT EXISTS "user_reports" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reportedUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_reports_pkey" PRIMARY KEY ("id")
);

-- payout_accounts
CREATE TABLE IF NOT EXISTS "payout_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "upiId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payout_accounts_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "conversations_participant1Id_participant2Id_garmentId_idx" ON "conversations"("participant1Id", "participant2Id", "garmentId");
CREATE INDEX IF NOT EXISTS "conversations_participant1Id_lastMessageAt_idx" ON "conversations"("participant1Id", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "conversations_participant2Id_lastMessageAt_idx" ON "conversations"("participant2Id", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "conversations_type_idx" ON "conversations"("type");
CREATE INDEX IF NOT EXISTS "conversations_orderId_idx" ON "conversations"("orderId");
CREATE INDEX IF NOT EXISTS "conversations_swapId_idx" ON "conversations"("swapId");
CREATE INDEX IF NOT EXISTS "conversations_rentalId_idx" ON "conversations"("rentalId");
CREATE INDEX IF NOT EXISTS "conversations_garmentId_idx" ON "conversations"("garmentId");

CREATE INDEX IF NOT EXISTS "direct_messages_conversationId_createdAt_idx" ON "direct_messages"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "direct_messages_recipientId_readAt_idx" ON "direct_messages"("recipientId", "readAt");
CREATE INDEX IF NOT EXISTS "direct_messages_conversationId_recipientId_readAt_idx" ON "direct_messages"("conversationId", "recipientId", "readAt");
CREATE INDEX IF NOT EXISTS "direct_messages_senderId_idx" ON "direct_messages"("senderId");

CREATE INDEX IF NOT EXISTS "upcycle_requests_userId_idx" ON "upcycle_requests"("userId");
CREATE INDEX IF NOT EXISTS "upcycle_requests_garmentId_idx" ON "upcycle_requests"("garmentId");
CREATE INDEX IF NOT EXISTS "upcycle_requests_status_createdAt_idx" ON "upcycle_requests"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "user_reports_reportedUserId_idx" ON "user_reports"("reportedUserId");
CREATE INDEX IF NOT EXISTS "user_reports_reporterId_idx" ON "user_reports"("reporterId");
CREATE INDEX IF NOT EXISTS "user_reports_status_createdAt_idx" ON "user_reports"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "payout_accounts_userId_idx" ON "payout_accounts"("userId");

-- Foreign keys (added only when missing)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_participant1Id_fkey') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant1Id_fkey" FOREIGN KEY ("participant1Id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_participant2Id_fkey') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_participant2Id_fkey" FOREIGN KEY ("participant2Id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_garmentId_fkey') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "garments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_orderId_fkey') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_swapId_fkey') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_swapId_fkey" FOREIGN KEY ("swapId") REFERENCES "swaps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversations_rentalId_fkey') THEN
    ALTER TABLE "conversations" ADD CONSTRAINT "conversations_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "rentals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'direct_messages_conversationId_fkey') THEN
    ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'direct_messages_senderId_fkey') THEN
    ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'direct_messages_recipientId_fkey') THEN
    ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'upcycle_requests_userId_fkey') THEN
    ALTER TABLE "upcycle_requests" ADD CONSTRAINT "upcycle_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'upcycle_requests_garmentId_fkey') THEN
    ALTER TABLE "upcycle_requests" ADD CONSTRAINT "upcycle_requests_garmentId_fkey" FOREIGN KEY ("garmentId") REFERENCES "garments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_reports_reporterId_fkey') THEN
    ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_reports_reportedUserId_fkey') THEN
    ALTER TABLE "user_reports" ADD CONSTRAINT "user_reports_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payout_accounts_userId_fkey') THEN
    ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
