-- Performance indexes: speeds up list pages (feed, orders, rentals, swaps, notifications, messages) and foreign-key joins.
-- Safe to re-run: every statement uses IF NOT EXISTS. Index names match what Prisma generates.
-- Note: on a very large production table you may prefer CREATE INDEX CONCURRENTLY run by hand; these tables are small.

CREATE INDEX IF NOT EXISTS "users_createdAt_idx" ON "users"("createdAt");
CREATE INDEX IF NOT EXISTS "users_verificationStatus_verificationSubmittedAt_idx" ON "users"("verificationStatus", "verificationSubmittedAt");
CREATE INDEX IF NOT EXISTS "addresses_userId_idx" ON "addresses"("userId");
CREATE INDEX IF NOT EXISTS "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");
CREATE INDEX IF NOT EXISTS "garments_isActive_lifecycleState_createdAt_idx" ON "garments"("isActive", "lifecycleState", "createdAt");
CREATE INDEX IF NOT EXISTS "garments_listingType_isActive_lifecycleState_createdAt_idx" ON "garments"("listingType", "isActive", "lifecycleState", "createdAt");
CREATE INDEX IF NOT EXISTS "garments_sellerId_createdAt_idx" ON "garments"("sellerId", "createdAt");
CREATE INDEX IF NOT EXISTS "behaviour_events_userId_eventType_createdAt_idx" ON "behaviour_events"("userId", "eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "behaviour_events_garmentId_eventType_createdAt_idx" ON "behaviour_events"("garmentId", "eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "behaviour_events_createdAt_idx" ON "behaviour_events"("createdAt");
CREATE INDEX IF NOT EXISTS "behaviour_signals_garmentId_idx" ON "behaviour_signals"("garmentId");
CREATE INDEX IF NOT EXISTS "circulation_schedules_garmentId_idx" ON "circulation_schedules"("garmentId");
CREATE INDEX IF NOT EXISTS "circulation_schedules_userId_idx" ON "circulation_schedules"("userId");
CREATE INDEX IF NOT EXISTS "orders_buyerId_updatedAt_idx" ON "orders"("buyerId", "updatedAt");
CREATE INDEX IF NOT EXISTS "orders_sellerId_updatedAt_idx" ON "orders"("sellerId", "updatedAt");
CREATE INDEX IF NOT EXISTS "orders_buyerId_status_idx" ON "orders"("buyerId", "status");
CREATE INDEX IF NOT EXISTS "orders_sellerId_status_idx" ON "orders"("sellerId", "status");
CREATE INDEX IF NOT EXISTS "orders_createdAt_idx" ON "orders"("createdAt");
CREATE INDEX IF NOT EXISTS "orders_razorpayOrderId_idx" ON "orders"("razorpayOrderId");
CREATE INDEX IF NOT EXISTS "orders_stripePaymentId_idx" ON "orders"("stripePaymentId");
CREATE INDEX IF NOT EXISTS "order_items_orderId_idx" ON "order_items"("orderId");
CREATE INDEX IF NOT EXISTS "order_items_garmentId_idx" ON "order_items"("garmentId");
CREATE INDEX IF NOT EXISTS "swaps_initiatorId_createdAt_idx" ON "swaps"("initiatorId", "createdAt");
CREATE INDEX IF NOT EXISTS "swaps_receiverId_createdAt_idx" ON "swaps"("receiverId", "createdAt");
CREATE INDEX IF NOT EXISTS "swaps_garmentOffered_idx" ON "swaps"("garmentOffered");
CREATE INDEX IF NOT EXISTS "swaps_garmentWanted_idx" ON "swaps"("garmentWanted");
CREATE INDEX IF NOT EXISTS "swaps_status_createdAt_idx" ON "swaps"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "rentals_renterId_createdAt_idx" ON "rentals"("renterId", "createdAt");
CREATE INDEX IF NOT EXISTS "rentals_garmentId_status_idx" ON "rentals"("garmentId", "status");
CREATE INDEX IF NOT EXISTS "rentals_status_createdAt_idx" ON "rentals"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "rentals_stripeId_idx" ON "rentals"("stripeId");
CREATE INDEX IF NOT EXISTS "posts_userId_createdAt_idx" ON "posts"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "likes_postId_idx" ON "likes"("postId");
CREATE INDEX IF NOT EXISTS "comments_postId_createdAt_idx" ON "comments"("postId", "createdAt");
CREATE INDEX IF NOT EXISTS "comments_userId_idx" ON "comments"("userId");
CREATE INDEX IF NOT EXISTS "follows_followingId_idx" ON "follows"("followingId");
CREATE INDEX IF NOT EXISTS "circular_requests_userId_createdAt_idx" ON "circular_requests"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "circular_requests_garmentId_idx" ON "circular_requests"("garmentId");
CREATE INDEX IF NOT EXISTS "bespoke_requests_userId_idx" ON "bespoke_requests"("userId");
CREATE INDEX IF NOT EXISTS "bespoke_requests_status_createdAt_idx" ON "bespoke_requests"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "style_quiz_answers_userId_idx" ON "style_quiz_answers"("userId");
CREATE INDEX IF NOT EXISTS "reviews_garmentId_createdAt_idx" ON "reviews"("garmentId", "createdAt");
CREATE INDEX IF NOT EXISTS "peer_reviews_reviewerId_idx" ON "peer_reviews"("reviewerId");
CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");
CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_action_createdAt_idx" ON "audit_logs"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "chat_conversations_userId_updatedAt_idx" ON "chat_conversations"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "chat_conversations_garmentId_idx" ON "chat_conversations"("garmentId");
CREATE INDEX IF NOT EXISTS "chat_messages_conversationId_createdAt_idx" ON "chat_messages"("conversationId", "createdAt");

-- Indexes the schema declares but no earlier migration created (the base DB was created with `db push`).
CREATE INDEX IF NOT EXISTS "garments_sellerId_idx" ON "garments"("sellerId");
CREATE INDEX IF NOT EXISTS "garments_isActive_createdAt_idx" ON "garments"("isActive", "createdAt");
CREATE INDEX IF NOT EXISTS "garments_category_isActive_idx" ON "garments"("category", "isActive");
CREATE INDEX IF NOT EXISTS "garments_listingType_isActive_idx" ON "garments"("listingType", "isActive");
CREATE INDEX IF NOT EXISTS "behaviour_events_userId_createdAt_idx" ON "behaviour_events"("userId", "createdAt");

-- Tables that earlier migrations never created (they exist in databases built with `db push`).
-- Guarded so this migration also works on a database built purely from migration history.
DO $$
BEGIN
  IF to_regclass('public.conversations') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "conversations_orderId_idx" ON "conversations"("orderId");
    CREATE INDEX IF NOT EXISTS "conversations_swapId_idx" ON "conversations"("swapId");
    CREATE INDEX IF NOT EXISTS "conversations_rentalId_idx" ON "conversations"("rentalId");
    CREATE INDEX IF NOT EXISTS "conversations_garmentId_idx" ON "conversations"("garmentId");
    CREATE INDEX IF NOT EXISTS "conversations_participant1Id_participant2Id_garmentId_idx" ON "conversations"("participant1Id", "participant2Id", "garmentId");
    CREATE INDEX IF NOT EXISTS "conversations_participant1Id_lastMessageAt_idx" ON "conversations"("participant1Id", "lastMessageAt");
    CREATE INDEX IF NOT EXISTS "conversations_participant2Id_lastMessageAt_idx" ON "conversations"("participant2Id", "lastMessageAt");
    CREATE INDEX IF NOT EXISTS "conversations_type_idx" ON "conversations"("type");
  END IF;
  IF to_regclass('public.direct_messages') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "direct_messages_conversationId_recipientId_readAt_idx" ON "direct_messages"("conversationId", "recipientId", "readAt");
    CREATE INDEX IF NOT EXISTS "direct_messages_senderId_idx" ON "direct_messages"("senderId");
    CREATE INDEX IF NOT EXISTS "direct_messages_conversationId_createdAt_idx" ON "direct_messages"("conversationId", "createdAt");
    CREATE INDEX IF NOT EXISTS "direct_messages_recipientId_readAt_idx" ON "direct_messages"("recipientId", "readAt");
  END IF;
  IF to_regclass('public.upcycle_requests') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "upcycle_requests_userId_idx" ON "upcycle_requests"("userId");
    CREATE INDEX IF NOT EXISTS "upcycle_requests_garmentId_idx" ON "upcycle_requests"("garmentId");
    CREATE INDEX IF NOT EXISTS "upcycle_requests_status_createdAt_idx" ON "upcycle_requests"("status", "createdAt");
  END IF;
  IF to_regclass('public.user_reports') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "user_reports_reporterId_idx" ON "user_reports"("reporterId");
    CREATE INDEX IF NOT EXISTS "user_reports_reportedUserId_idx" ON "user_reports"("reportedUserId");
    CREATE INDEX IF NOT EXISTS "user_reports_status_createdAt_idx" ON "user_reports"("status", "createdAt");
  END IF;
  IF to_regclass('public.payout_accounts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS "payout_accounts_userId_idx" ON "payout_accounts"("userId");
  END IF;
END $$;
