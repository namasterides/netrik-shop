# 🧪 TESTING GUIDE - Verify Everything Works

## Test 1: Bot Captures Instructions ✅

### How to Test:
1. Go to `/order/table_demo_1` (or any table)
2. Say: **"I want truffle pasta"**
3. Bot should ask: **"Any allergies?"**
4. Reply: **"peanut allergy"**
5. Bot asks: **"How spicy?"**
6. Reply: **"mild"**
7. Bot asks: **"Any extra notes?"**
8. Reply: **"no onions please"**
9. Bot shows summary with ALL instructions
10. Confirm order

### Expected Result:
Order saved with:
```json
{
  "allergy": "peanut allergy",
  "spicy_level": "mild",
  "notes": "no onions please"
}
```

---

## Test 2: Instructions Visible on Chef Dashboard ✅

### How to Test:
1. Login as Chef (`chef_demo` / `123456`)
2. Check order card
3. Should see:
   - ⚠️ **Allergy:** peanut allergy (red)
   - 🌶️ **Spice:** mild (orange)
   - ✍️ **Notes:** no onions please (blue)

---

## Test 3: Server Account Creation ✅

### How to Test (Demo Mode):
```bash
curl -X POST http://localhost:3000/api/restaurants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Restaurant",
    "ownerName": "Owner",
    "email": "test@test.com",
    "contact": "+1234567890"
  }'
```

### Expected Response:
```json
{
  "restaurant": { ... },
  "servers": [
    {
      "id": "srv_xxx",
      "name": "Server 1",
      "user_id": "server1_test_restaurant_xxx",
      "password": "123456"
    },
    {
      "id": "srv_xxx",
      "name": "Server 2",
      "user_id": "server2_test_restaurant_xxx",
      "password": "789012"
    }
  ]
}
```

---

## Test 4: Server Login & Dashboard ✅

### How to Test:
1. Login as Server (`server1` / `123456`)
2. Should see assigned tables (Table 1, Table 2)
3. Real-time order updates
4. Special instructions visible

---

## Test 5: KOT Auto-Print ✅

### How to Test:
1. Login as Chef
2. Place order from customer page
3. Chef dashboard should auto-trigger `window.print()`
4. Print preview shows order with instructions

---

## Test 6: Additional Items Marking ✅

### How to Test:
1. Place initial order (e.g., pasta)
2. After order placed, add more items
3. Chef sees **[ADDITIONAL]** tag on new items
4. Print shows additional items marked in orange

---

## 🔧 If Tests Fail

### Bot not asking questions?
- Check `lib/nlu.js` - Questions triggered when items added
- Verify conversation flow in browser console

### Instructions not saving?
- Check database has columns: `allergy`, `spicy_level`, `notes`
- Run SQL from `SUPABASE_SCHEMA_UPDATES.sql`

### Server login fails?
- Check `servers` table exists
- Verify credentials in database
- Check demo mode vs Supabase mode

### Instructions not visible?
- Check `app/chef/page.js` lines 139-144
- Verify order object has fields
- Check API response includes instructions

---

## ✅ All Tests Should Pass

If all tests pass, your app is **production-ready**!
