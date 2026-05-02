# 🚀 PRODUCTION DEPLOYMENT GUIDE - Supabase Integration

## ⚠️ CRITICAL: You Must Configure Supabase

Your app is currently running in **DEMO MODE**. For production on Vercel, you MUST set up Supabase.

---

## 📋 Step 1: Run SQL Queries in Supabase

**Go to your Supabase dashboard → SQL Editor**

Copy and paste the queries from `/app/SUPABASE_SCHEMA_UPDATES.sql` and run them.

This will create:
- ✅ `servers` table (for waiter accounts)
- ✅ `notes`, `allergy`, `spicy_level` columns in orders table
- ✅ Indexes and RLS policies

---

## 📋 Step 2: Update Environment Variables

### On Vercel:

Go to your Vercel project → Settings → Environment Variables

**Add these variables:**

```bash
# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Database URL (if using Supabase Postgres directly)
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

# Remove or set to false
NETRIK_DEMO_MODE=false

# Optional: Email Configuration (for onboarding emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

### Locally (for development):

Update `/app/.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NETRIK_DEMO_MODE=false
```

---

## 📋 Step 3: Verify Supabase Tables

Your Supabase database should have these tables:

### Required Tables:

1. **users** - Central admin users
2. **restaurants** - Restaurant details
3. **rest_tables** - Tables in each restaurant
4. **menu** - Menu items
5. **orders** - Customer orders
6. **feedback** - Customer feedback
7. **servers** ⭐ NEW - Waiter accounts

### Orders Table Must Have:
- `id` (text, primary key)
- `restaurant_id` (text)
- `table_id` (text)
- `items` (jsonb) - Array of {id, name, nameEs, price, qty, notes, isAdditional}
- `total` (numeric)
- `status` (text)
- `allergy` (text) ⭐ NEW
- `spicy_level` (text) ⭐ NEW
- `notes` (text) ⭐ NEW - General instructions
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

---

## 📋 Step 4: How It Works in Production

### Restaurant Creation Flow:

1. **Central Admin** creates restaurant via dashboard
2. **Backend automatically generates:**
   - 1 Manager account
   - 1 Chef account
   - 2 Server accounts ⭐ NEW
3. **Credentials sent via email** (if SMTP configured)
4. **Restaurant owner** shares credentials with staff

### Customer Ordering Flow:

1. Customer scans QR code → `/order/[tableId]`
2. **Local NLU bot** asks questions:
   - What would you like to order?
   - Any allergies?
   - How spicy?
   - Any special instructions/notes?
3. All data captured in `orders` table:
   ```json
   {
     "allergy": "peanut allergy",
     "spicy_level": "mild",
     "notes": "no onions, extra cheese"
   }
   ```

### Waiter (Server) Dashboard:

1. Login with server credentials
2. See assigned tables
3. Real-time order updates
4. View special instructions (allergy, spice, notes)

---

## 🔍 Verification Checklist

After deployment, verify:

- [ ] Central Admin can login (`hello` / `123456`)
- [ ] Can create new restaurant
- [ ] Server credentials generated automatically
- [ ] Chef can login and see orders
- [ ] Server can login and see assigned tables
- [ ] Customer can order at `/order/[tableId]`
- [ ] **NLU bot asks for allergy, spice, notes**
- [ ] **Special instructions visible on chef/server dashboard**
- [ ] Orders saved to Supabase (not demo mode)

---

## 🐛 Troubleshooting

### Bot not asking for instructions?

**Check:** `lib/nlu.js` - Questions are asked when user adds items:
1. First: "Any allergies?"
2. Then: "How spicy?"
3. Finally: "Any notes for the chef?"

### Instructions not saving?

**Check:** Orders table has columns:
- `allergy` (text)
- `spicy_level` (text)
- `notes` (text)

Run verification query:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND column_name IN ('allergy', 'spicy_level', 'notes');
```

### Server login not working?

**Check:** 
1. `servers` table exists in Supabase
2. Servers created when restaurant was created
3. Run: `SELECT * FROM servers WHERE restaurant_id = 'your-restaurant-id';`

---

## ✅ Once Configured

Your app will be **100% production-ready** with:

- ✅ Real Supabase database (no demo mode)
- ✅ Automatic server credential generation
- ✅ Local NLU bot capturing all instructions
- ✅ Special instructions visible everywhere
- ✅ Real-time updates
- ✅ KOT auto-print
- ✅ Multi-waiter support

---

## 📞 Need Help?

If you encounter issues:
1. Check Supabase logs
2. Check Vercel function logs
3. Verify environment variables are set
4. Test locally first with `.env.local`
