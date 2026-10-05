-- Supabase Security Hardening: Enable Row Level Security (RLS) on all public tables
-- Protects against unauthorized public PostgREST API access via Supabase anon key.
-- Safe and idempotent: applies to all tables in the public schema.
-- Privileged backend connections (Prisma via postgres role) bypass RLS as intended.

DO $$
DECLARE
    tbl RECORD;
BEGIN
    FOR tbl IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename NOT LIKE '_prisma%'
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.tablename);
    END LOOP;
END $$;
