-- ============================================
-- SUPABASE SCHEMA UPDATES FOR PRODUCTION
-- Run these queries in your Supabase SQL Editor
-- ============================================

-- 1. CREATE SERVERS TABLE (for Waiter/Server role)
-- This table stores waiter accounts for each restaurant
CREATE TABLE IF NOT EXISTS servers (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  user_id TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  assigned_table_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_servers_restaurant_id ON servers(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_servers_user_id ON servers(user_id);

-- Enable Row Level Security (RLS)
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow read for authenticated users
CREATE POLICY "Allow read access to servers" ON servers
  FOR SELECT USING (true);

-- RLS Policy: Allow insert for service role
CREATE POLICY "Allow insert for service role" ON servers
  FOR INSERT WITH CHECK (true);

-- ============================================

-- 2. ADD NOTES COLUMN TO ORDERS TABLE (if not exists)
-- This stores general special instructions from customers
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'notes'
  ) THEN
    ALTER TABLE orders ADD COLUMN notes TEXT DEFAULT '';
  END IF;
END $$;

-- Add preference & avoid fields (what they want / don't want)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'preference'
  ) THEN
    ALTER TABLE orders ADD COLUMN preference TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'avoid'
  ) THEN
    ALTER TABLE orders ADD COLUMN avoid TEXT DEFAULT '';
  END IF;
END $$;

-- ============================================

-- 3. ADD isAdditional FLAG TO ITEMS IN ORDERS
-- This is stored as part of the JSONB items array
-- No schema change needed - just a note that items can have:
-- { id, name, nameEs, price, qty, notes, isAdditional: true/false }

-- ============================================

-- 3.5. ADD UPI FIELDS TO RESTAURANTS TABLE
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'upi_id'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN upi_id TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurants' AND column_name = 'upi_qr_code'
  ) THEN
    ALTER TABLE restaurants ADD COLUMN upi_qr_code TEXT DEFAULT '';
  END IF;
END $$;

-- ============================================

-- 4. VERIFY EXISTING TABLES HAVE REQUIRED COLUMNS

-- Check orders table has all required fields
DO $$ 
BEGIN
  -- allergy column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'allergy'
  ) THEN
    ALTER TABLE orders ADD COLUMN allergy TEXT DEFAULT '';
  END IF;
  
  -- spicy_level column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'spicy_level'
  ) THEN
    ALTER TABLE orders ADD COLUMN spicy_level TEXT DEFAULT '';
  END IF;
END $$;

-- ============================================
-- 7. ADD TIP + SPLIT FIELDS TO ORDERS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'tip_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN tip_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'tip_percent'
  ) THEN
    ALTER TABLE orders ADD COLUMN tip_percent NUMERIC(5,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'split_count'
  ) THEN
    ALTER TABLE orders ADD COLUMN split_count INT DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'total_with_tip'
  ) THEN
    ALTER TABLE orders ADD COLUMN total_with_tip NUMERIC(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================

-- 5. CREATE FUNCTION TO AUTO-UPDATE updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to servers table
DROP TRIGGER IF EXISTS update_servers_updated_at ON servers;
CREATE TRIGGER update_servers_updated_at
  BEFORE UPDATE ON servers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION QUERIES
-- Run these to verify everything is set up correctly
-- ============================================

-- ============================================
-- AI WAITER: MENU TAG COLUMNS (mood / taste / dietary)
-- These let the AI match dishes to a guest's vibe instead of guessing.
-- ============================================
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS mood_tags    TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS taste_tags   TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] NOT NULL DEFAULT '{}';

-- Optional: GIN indexes for fast tag-based filtering on large menus.
CREATE INDEX IF NOT EXISTS idx_menu_mood_tags    ON public.menu USING GIN (mood_tags);
CREATE INDEX IF NOT EXISTS idx_menu_taste_tags   ON public.menu USING GIN (taste_tags);
CREATE INDEX IF NOT EXISTS idx_menu_dietary_tags ON public.menu USING GIN (dietary_tags);

-- ============================================
-- MENU PROMOTION
-- Managers can flag a dish as promoted. The AI Waiter recommends promoted dishes
-- more aggressively, and the customer menu UI highlights them with a "Promoted" ribbon.
-- ============================================
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS promoted        BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS promoted_at     TIMESTAMPTZ;
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS promotion_label TEXT DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_menu_promoted ON public.menu (restaurant_id, promoted) WHERE promoted = TRUE;

-- Verify servers table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'servers'
ORDER BY ordinal_position;

-- Verify orders table has notes, allergy, spicy_level
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name IN ('notes', 'allergy', 'spicy_level');

-- Check if servers table is empty (should be empty initially)
SELECT COUNT(*) as server_count FROM servers;

-- ============================================
-- 6. CREATE FEEDBACK TABLE
-- This table stores customer feedback ratings and comments
-- ============================================
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id TEXT,
  order_id TEXT,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  nps INTEGER,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_feedback_restaurant_id ON feedback(restaurant_id);

-- Enable Row Level Security (RLS)
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow read for authenticated users
CREATE POLICY "Allow read access to feedback" ON feedback
  FOR SELECT USING (true);

-- RLS Policy: Allow insert for service role
CREATE POLICY "Allow insert for service role on feedback" ON feedback
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 7. SUPPORT MESSAGES METADATA
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_messages' AND column_name = 'table_id'
  ) THEN
    ALTER TABLE support_messages ADD COLUMN table_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_messages' AND column_name = 'order_id'
  ) THEN
    ALTER TABLE support_messages ADD COLUMN order_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_messages' AND column_name = 'priority'
  ) THEN
    ALTER TABLE support_messages ADD COLUMN priority TEXT DEFAULT 'normal';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'support_messages' AND column_name = 'source'
  ) THEN
    ALTER TABLE support_messages ADD COLUMN source TEXT DEFAULT 'dashboard';
  END IF;
END $$;

-- ============================================
-- DONE! Your Supabase database is now ready
-- ============================================
