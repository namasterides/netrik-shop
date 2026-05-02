-- Netrik Shop - Supabase Schema
-- Idempotent: safe to re-run.

-- Required extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- USERS (only the central admin is stored here for now;
-- manager/chef creds are embedded inside restaurants row.)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL,                     -- 'central'
  user_id     TEXT NOT NULL,
  password    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (type, user_id)
);

-- =========================================================
-- RESTAURANTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.restaurants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  owner_name      TEXT NOT NULL,
  email           TEXT DEFAULT '',
  contact         TEXT NOT NULL,
  address         TEXT DEFAULT '',
  domain          TEXT DEFAULT '',
  logo_url        TEXT DEFAULT '',
  subscription    TEXT NOT NULL DEFAULT 'Pro',
  manager_user_id TEXT UNIQUE NOT NULL,
  manager_password TEXT NOT NULL,
  chef_user_id    TEXT UNIQUE NOT NULL,
  chef_password   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ
);
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_restaurants_manager ON public.restaurants(manager_user_id);
CREATE INDEX IF NOT EXISTS idx_restaurants_chef    ON public.restaurants(chef_user_id);

-- =========================================================
-- MENU
-- =========================================================
CREATE TABLE IF NOT EXISTS public.menu (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  name_es       TEXT DEFAULT '',
  description   TEXT DEFAULT '',
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  category      TEXT DEFAULT 'Mains',
  image         TEXT DEFAULT '',
  video_url     TEXT DEFAULT '',
  available     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_menu_restaurant ON public.menu(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_menu_available  ON public.menu(restaurant_id, available);

-- =========================================================
-- TABLES (named "rest_tables" to avoid the Postgres reserved word "tables")
-- =========================================================
CREATE TABLE IF NOT EXISTS public.rest_tables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  number        TEXT NOT NULL,
  seats         INT NOT NULL DEFAULT 2,
  status        TEXT NOT NULL DEFAULT 'available', -- available | occupied | reserved
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rest_tables_restaurant ON public.rest_tables(restaurant_id);

-- =========================================================
-- ORDERS  (items stored as JSONB array)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id      UUID NOT NULL REFERENCES public.rest_tables(id) ON DELETE CASCADE,
  table_number  TEXT NOT NULL,
  items         JSONB NOT NULL DEFAULT '[]',
  total         NUMERIC(10,2) NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending|preparing|ready|served|paid|cancelled
  allergy       TEXT DEFAULT '',
  spicy_level   TEXT DEFAULT '',
  paid_at       TIMESTAMPTZ,
  payment_status   TEXT NOT NULL DEFAULT 'unpaid', -- unpaid|pending|paid|failed
  payment_reference TEXT DEFAULT '',
  payment_provider  TEXT DEFAULT '',
  payment_method    TEXT DEFAULT '',
  payment_vpa       TEXT DEFAULT '',
  payment_qr        TEXT DEFAULT '',
  payment_created_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ
);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_reference TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_vpa TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_qr TEXT DEFAULT '';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_created_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON public.orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_table      ON public.orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON public.orders(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created    ON public.orders(restaurant_id, created_at DESC);

-- =========================================================
-- CHAT SESSIONS (multi-turn AI Waiter)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  session_id    TEXT PRIMARY KEY,
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id      UUID REFERENCES public.rest_tables(id) ON DELETE CASCADE,
  history       JSONB NOT NULL DEFAULT '[]',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- FEEDBACK
-- =========================================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id      UUID REFERENCES public.rest_tables(id) ON DELETE CASCADE,
  order_id      UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  rating        INT,
  comment       TEXT DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_restaurant ON public.feedback(restaurant_id);

-- =========================================================
-- DISABLE RLS (we handle auth in application layer; key is server-only)
-- =========================================================
ALTER TABLE public.users          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.rest_tables    DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback       DISABLE ROW LEVEL SECURITY;

-- =========================================================
-- GRANT privileges so the anon (JWT) key can read/write
-- =========================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- Seed the central admin user (idempotent)
INSERT INTO public.users (type, user_id, password)
VALUES ('central', 'hello', '123456')
ON CONFLICT (type, user_id) DO NOTHING;
