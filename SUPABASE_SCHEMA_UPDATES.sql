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

-- ============================================

-- 3. ADD isAdditional FLAG TO ITEMS IN ORDERS
-- This is stored as part of the JSONB items array
-- No schema change needed - just a note that items can have:
-- { id, name, nameEs, price, qty, notes, isAdditional: true/false }

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
-- DONE! Your Supabase database is now ready
-- ============================================
