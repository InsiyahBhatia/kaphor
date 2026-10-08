-- Every amount in Kaphor is whole rupees, so new orders default to INR (was USD).
-- Only the column default changes: existing rows are left untouched.
ALTER TABLE "orders" ALTER COLUMN "currency" SET DEFAULT 'INR';
