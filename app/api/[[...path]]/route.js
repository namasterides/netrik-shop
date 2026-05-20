import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import {
  getSupabase,
  restaurantToApi,
  restaurantToApiWithCreds,
  menuToApi,
  tableToApi,
  orderToApi,
} from '@/lib/supabase';
import { llmChat, universalWaiterChat } from '@/lib/llm';
import { nluRespond } from '@/lib/nlu';
import { sendRestaurantOnboardingEmail } from '@/lib/mailer';
import {
  readSession,
  requireSession,
  attachSession,
  clearSession,
} from '@/lib/auth';
import { createCheckoutSession, getSessionStatus, handleWebhookEvent, verifyWebhookSignature } from '@/lib/stripe';

// Try Gemini first; fall back to local NLU on missing key, error, or empty reply.
async function aiWaiterReply({ message, menu, cart, allergy, preference, avoid, notes, stage, restaurantName, history, language }) {
  const lowerMsg = String(message || '').toLowerCase().trim();
  
  // Adaptive Model Usage: Route simple intents directly to fast local NLU
  if (/^(menu|show me the menu|what do you have|bill|check|checkout|pay)$/i.test(lowerMsg)) {
    return nluRespond({ message, menu, cart, allergy, preference, avoid, notes, stage, restaurantName, history, language });
  }

  let ai = null;
  try {
    ai = await universalWaiterChat({
      context: { restaurantName, menu, cart, allergy, preference, avoid, notes, stage, language },
      history,
      userMessage: message,
    });
  } catch (e) {
    console.error('Universal waiter failed, using NLU fallback:', e?.message || e);
  }

  if (!ai || !ai.reply) {
    ai = nluRespond({ message, menu, cart, allergy, preference, avoid, notes, stage, restaurantName, history, language });
  }

  const actions = ai.actions || {};

  // Guardrail: Payment only allowed if order is placed
  if (actions.pay_now && stage === 'browsing') {
    delete actions.pay_now;
    ai.reply = "Please place your order first before paying.";
  }

  // Guardrail: State Machine Hardening
  // Server is the source of truth for required questions before order placement
  if (actions.place_order) {
    if (!allergy || allergy === '(not asked yet)') {
      delete actions.place_order;
      ai.reply = "Before I send that to the kitchen, do you have any allergies I should know about? (or say 'none')";
    } else if (!preference || preference === '(not asked yet)') {
      delete actions.place_order;
      ai.reply = "Got the allergy info. What do you *want* the chef to do? (e.g. extra cheese, well done, or 'none')";
    } else if (!avoid || avoid === '(not asked yet)') {
      delete actions.place_order;
      ai.reply = "Anything you *don’t want* in the food? (e.g. no onions, or 'none')";
    } else if (!notes || notes === '(not asked yet)') {
      delete actions.place_order;
      ai.reply = "Any final chef notes? (e.g. sauce on the side, or 'no')";
    }
  }

  return ai;
}

const json = (data, status = 200) => NextResponse.json(data, { status });
const err = (message, status = 400) => NextResponse.json({ error: message }, { status });
// Generic safe error: log details server-side, return opaque message to client.
function safeErr(label, e, status = 500, msg = 'Server error') {
  console.error('[api]', label, e?.message || e);
  return NextResponse.json({ error: msg }, { status });
}

const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 18) || 'rest';
const rand = (n = 4) => randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n);
// Strong default password: 12 url-safe chars from cryptographic randomness.
const randPwd = () => randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 12);
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@netrik.shop';
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || '';

const ALLOWED_ORDER_STATUSES = new Set(['pending', 'preparing', 'ready', 'served', 'paid', 'cancelled']);

const DEMO_MENU_IMAGE = 'https://images.pexels.com/photos/35420084/pexels-photo-35420084.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';
const RANDOM_FOOD_IMAGES = [
  'https://images.unsplash.com/photo-1544025162-811114bd020f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80',
];
const getRandomFoodImage = () => RANDOM_FOOD_IMAGES[Math.floor(Math.random() * RANDOM_FOOD_IMAGES.length)];
const DEMO_DB_KEY = '_netrik_demo_db';
const DEMO_MODE_ENABLED = String(process.env.NETRIK_DEMO_MODE || process.env.DEMO_MODE || '').toLowerCase() === 'true';

const nowIso = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${randomBytes(6).toString('hex')}`;
const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeImage = (image) => String(image || '').trim();

const DEMO_UPI_PAYEE = 'Netrik Shop';
const DEMO_UPI_VPA = 'netrik@upi';
const DEMO_UPI_AUTO_SETTLE_MS = 9000;

const toAmount = (value) => Number.parseFloat(value || 0).toFixed(2);

// Cap free-text fields to a sane upper bound so a malicious client cannot
// post megabytes of data. Returned value is always a string.
const clampStr = (v, max = 500) => {
  if (v == null) return '';
  const s = typeof v === 'string' ? v : String(v);
  return s.slice(0, max);
};

function resolvePublicAppUrl(request) {
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    return `${proto}://${forwardedHost}`;
  }
  try {
    const url = new URL(request.url);
    return `${url.protocol}//${url.host}`;
  } catch {
    return 'http://localhost:3000';
  }
}

// Normalize a tag list: accepts array or comma-separated string,
// trims, lowercases, dedupes, caps to 8 entries × 24 chars each.
const normalizeTagList = (input) => {
  if (input == null) return [];
  const arr = Array.isArray(input)
    ? input
    : String(input).split(/[,\n]/);
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const t = String(raw || '').trim().toLowerCase().slice(0, 24);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 8) break;
  }
  return out;
};

const makeUpiReference = () => `UPI${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString('hex').toUpperCase()}`;
const buildUpiUri = ({ vpa, name, amount, reference }) => {
  const params = new URLSearchParams({
    pa: vpa,
    pn: name,
    am: amount,
    cu: 'INR',
    tn: reference,
  });
  return `upi://pay?${params.toString()}`;
};

const buildUpiPayment = (row) => ({
  reference: row.payment_reference || '',
  vpa: row.payment_vpa || DEMO_UPI_VPA,
  payee: DEMO_UPI_PAYEE,
  amount: toAmount(row.total_with_tip ?? row.total),
  status: row.payment_status || (row.status === 'paid' ? 'paid' : 'unpaid'),
  upiUri: row.payment_qr || '',
  createdAt: row.payment_created_at || null,
});

const ensureDemoUpiPayment = (row) => {
  if (!row.payment_reference) row.payment_reference = makeUpiReference();
  if (!row.payment_vpa) row.payment_vpa = DEMO_UPI_VPA;
  if (!row.payment_provider) row.payment_provider = 'demo-upi';
  if (!row.payment_method) row.payment_method = 'upi';
  if (!row.payment_created_at) row.payment_created_at = nowIso();
  if (!row.payment_qr) {
    row.payment_qr = buildUpiUri({
      vpa: row.payment_vpa,
      name: DEMO_UPI_PAYEE,
      amount: toAmount(row.total_with_tip ?? row.total),
      reference: row.payment_reference,
    });
  }
  if (row.status === 'paid') row.payment_status = 'paid';
  else if (!row.payment_status || row.payment_status === 'unpaid') row.payment_status = 'pending';
};

const maybeAutoSettleDemoUpi = (row) => {
  if (row.payment_status !== 'pending') return false;
  const started = new Date(row.payment_created_at || row.created_at || nowIso()).getTime();
  if (Date.now() - started < DEMO_UPI_AUTO_SETTLE_MS) return false;
  row.payment_status = 'paid';
  row.status = 'paid';
  row.paid_at = nowIso();
  row.updated_at = nowIso();
  return true;
};

async function readJsonSafe(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function onboardingPayload(restaurantWithCreds) {
  if (!restaurantWithCreds) return null;
  return {
    restaurantName: restaurantWithCreds.name,
    ownerName: restaurantWithCreds.ownerName,
    toEmail: restaurantWithCreds.email,
    subscription: restaurantWithCreds.subscription,
    domain: restaurantWithCreds.domain,
    address: restaurantWithCreds.address,
    contact: restaurantWithCreds.contact,
    managerCreds: restaurantWithCreds.managerCreds,
    chefCreds: restaurantWithCreds.chefCreds,
    supportEmail: SUPPORT_EMAIL,
    supportPhone: SUPPORT_PHONE,
  };
}

// Build a session payload from a user record.
const sessionForUser = (user) => {
  const base = { type: user.type, userId: user.userId };
  if (user.restaurantId) base.restaurantId = user.restaurantId;
  if (user.serverId) base.serverId = user.serverId;
  return base;
};

// Server-side total recalculation. NEVER trust client-supplied prices.
// items: [{ id, qty, notes? }] from client; menu: rows from DB.
function rebuildOrderItems(clientItems, menuRows) {
  const menuById = new Map();
  for (const m of menuRows) menuById.set(m.id, m);
  const items = [];
  let total = 0;
  for (const raw of (clientItems || [])) {
    const m = menuById.get(raw?.id);
    if (!m) continue;                                  // ignore unknown items
    if (m.available === false) continue;               // ignore unavailable
    const qty = Math.max(1, Math.min(99, parseInt(raw?.qty, 10) || 1));
    const price = parseFloat(m.price) || 0;
    items.push({
      id: m.id,
      name: m.name,
      nameEs: m.name_es || '',
      price,
      qty,
      notes: clampStr(raw?.notes, 240),
    });
    total += price * qty;
  }
  return { items, total: Math.round(total * 100) / 100 };
}

function getDemoDb() {
  if (global[DEMO_DB_KEY]) return global[DEMO_DB_KEY];

  const createdAt = nowIso();
  const demoRestaurantId = 'rest_demo_1';
  const demoTables = Array.from({ length: 8 }, (_, i) => ({
    id: `table_demo_${i + 1}`,
    restaurant_id: demoRestaurantId,
    number: String(i + 1),
    seats: i % 2 === 0 ? 4 : 2,
    status: 'available',
    created_at: createdAt,
  }));

  global[DEMO_DB_KEY] = {
    users: [
      { id: 'user_demo_central', type: 'central', user_id: 'hello', password: '123456', created_at: createdAt },
    ],
    restaurants: [
      {
        id: demoRestaurantId,
        name: 'Netrik Demo Bistro',
        owner_name: 'Demo Owner',
        email: 'owner@demo-bistro.com',
        contact: '+1 555 0100',
        address: '12 Demo Street',
        domain: 'demo.netrik.shop',
        logo_url: '',
        subscription: 'Pro',
        manager_user_id: 'manager_demo',
        manager_password: '123456',
        chef_user_id: 'chef_demo',
        chef_password: '123456',
        created_at: createdAt,
        updated_at: createdAt,
      },
    ],
    menu: [
      {
        id: 'menu_demo_1',
        restaurant_id: demoRestaurantId,
        name: 'Truffle Pasta',
        name_es: 'Pasta de Trufa',
        description: 'Creamy truffle pasta with parmesan and cracked pepper.',
        price: 18.5,
        category: 'Mains',
        image: DEMO_MENU_IMAGE,
        video_url: 'https://videos.pexels.com/video-files/3255275/3255275-hd_1920_1080_30fps.mp4',
        available: true,
        created_at: createdAt,
      },
      {
        id: 'menu_demo_2',
        restaurant_id: demoRestaurantId,
        name: 'Smoked Salmon Toast',
        name_es: 'Tostada de Salmon Ahumado',
        description: 'Sourdough toast with smoked salmon, dill cream, and lemon zest.',
        price: 14,
        category: 'Starters',
        image: DEMO_MENU_IMAGE,
        video_url: 'https://videos.pexels.com/video-files/2620043/2620043-hd_1920_1080_30fps.mp4',
        available: true,
        created_at: createdAt,
      },
      {
        id: 'menu_demo_3',
        restaurant_id: demoRestaurantId,
        name: 'Chocolate Lava Cake',
        name_es: 'Pastel de Lava de Chocolate',
        description: 'Warm chocolate center served with vanilla cream.',
        price: 9,
        category: 'Desserts',
        image: DEMO_MENU_IMAGE,
        video_url: '',
        available: true,
        created_at: createdAt,
      },
      {
        id: 'menu_demo_4',
        restaurant_id: demoRestaurantId,
        name: 'Citrus Mint Cooler',
        name_es: 'Refresco de Menta y Citricos',
        description: 'Fresh citrus, mint, and sparkling water.',
        price: 6,
        category: 'Drinks',
        image: DEMO_MENU_IMAGE,
        video_url: '',
        available: true,
        created_at: createdAt,
      },
    ],
    rest_tables: demoTables,
    orders: [],
    feedback: [],
    chat_sessions: [],
    servers: [
      { id: 'srv_demo_1', restaurant_id: demoRestaurantId, name: 'Aarav', user_id: 'server1', password: '123456', assigned_table_ids: ['table_demo_1', 'table_demo_2'], created_at: createdAt },
      { id: 'srv_demo_2', restaurant_id: demoRestaurantId, name: 'Maya', user_id: 'server2', password: '123456', assigned_table_ids: ['table_demo_3', 'table_demo_4'], created_at: createdAt },
      { id: 'srv_demo_3', restaurant_id: demoRestaurantId, name: 'Liam', user_id: 'server3', password: '123456', assigned_table_ids: ['table_demo_5', 'table_demo_6'], created_at: createdAt },
      { id: 'srv_demo_4', restaurant_id: demoRestaurantId, name: 'Sofia', user_id: 'server4', password: '123456', assigned_table_ids: ['table_demo_7', 'table_demo_8'], created_at: createdAt },
    ],
  };

  return global[DEMO_DB_KEY];
}

async function handleDemoRequest(path, method, request) {
  const db = getDemoDb();

  // ============ AUTH ============
  if (path === 'auth/login' && method === 'POST') {
    const { type, userId, password } = await request.json();
    if (!type || !userId || !password) return err('Missing fields');

    if (type === 'central') {
      const data = db.users.find((u) => u.type === 'central' && u.user_id === userId && u.password === password);
      if (!data) return err('Invalid credentials', 401);
      const user = { id: data.id, type: 'central', userId: data.user_id, demoMode: true };
      return attachSession(json({ user }), sessionForUser(user));
    }

    if (type === 'server') {
      const srv = (db.servers || []).find((s) => s.user_id === userId && s.password === password);
      if (!srv) return err('Invalid credentials', 401);
      const rest = db.restaurants.find((r) => r.id === srv.restaurant_id);
      const user = {
        type: 'server', userId, serverId: srv.id, serverName: srv.name,
        restaurantId: srv.restaurant_id, restaurantName: rest?.name,
        assignedTableIds: srv.assigned_table_ids || [],
        demoMode: true,
      };
      return attachSession(json({ user }), sessionForUser(user));
    }

    const rest = db.restaurants.find((r) => (
      (type === 'manager' && r.manager_user_id === userId && r.manager_password === password) ||
      (type === 'chef' && r.chef_user_id === userId && r.chef_password === password)
    ));
    if (!rest) return err('Invalid credentials', 401);
    const user = { type, userId, restaurantId: rest.id, restaurantName: rest.name, demoMode: true };
    return attachSession(json({ user }), sessionForUser(user));
  }

  // ============ SERVER (waiter) ENDPOINTS ============
  if (path === 'server/me' && method === 'GET') {
    const session = readSession(request);
    if (!session || session.type !== 'server') return err('Unauthorized', 401);
    const srv = (db.servers || []).find((s) => s.id === session.serverId);
    if (!srv) return err('Not found', 404);
    const tables = (db.rest_tables || []).filter((t) => (srv.assigned_table_ids || []).includes(t.id));
    const rest = db.restaurants.find((r) => r.id === srv.restaurant_id);
    return json({
      server: { id: srv.id, name: srv.name, userId: srv.user_id, restaurantId: srv.restaurant_id, restaurantName: rest?.name, assignedTableIds: srv.assigned_table_ids || [] },
      tables: tables.map((t) => ({ id: t.id, number: t.number, seats: t.seats, status: t.status, restaurantId: t.restaurant_id })),
    });
  }

  if (path === 'server/orders' && method === 'GET') {
    const session = readSession(request);
    if (!session || session.type !== 'server') return err('Unauthorized', 401);
    const srv = (db.servers || []).find((s) => s.id === session.serverId);
    if (!srv) return err('Not found', 404);
    const assigned = new Set(srv.assigned_table_ids || []);
    const orders = (db.orders || [])
      .filter((o) => o.restaurant_id === srv.restaurant_id && assigned.has(o.table_id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(orderToApi);
    return json({ orders });
  }

  // ============ RESTAURANTS ============
  if (path === 'restaurants' && method === 'GET') {
    const guard = requireSession(request, { roles: ['central'] });
    if (!guard.ok) return guard.response;
    const restaurants = [...db.restaurants].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return json({ restaurants: restaurants.map(restaurantToApiWithCreds) });
  }

  if (path === 'restaurants' && method === 'POST') {
    const guard = requireSession(request, { roles: ['central'] });
    if (!guard.ok) return guard.response;
    const body = await request.json();
    if (!body.name || !body.ownerName || !body.contact || !body.email) return err('Missing required fields');

    const s = slug(body.name) + '_' + rand(4);
    const ts = nowIso();
    const restaurantId = makeId('rest');
    const row = {
      id: restaurantId,
      name: clampStr(body.name, 120),
      owner_name: clampStr(body.ownerName, 120),
      email: clampStr(body.email, 200),
      contact: clampStr(body.contact, 40),
      address: clampStr(body.address, 240),
      domain: clampStr(body.domain, 120),
      logo_url: clampStr(body.logoUrl, 500),
      subscription: clampStr(body.subscription || 'Pro', 40),
      manager_user_id: 'manager_' + s,
      manager_password: randPwd(),
      chef_user_id: 'chef_' + s,
      chef_password: randPwd(),
      created_at: ts,
      updated_at: ts,
    };
    db.restaurants.push(row);

    // Create 4 default server accounts for the restaurant
    const servers = ['Server 1', 'Server 2', 'Server 3', 'Server 4'].map((name, i) => ({
      id: makeId('srv'),
      restaurant_id: restaurantId,
      name,
      user_id: `server${i + 1}_${s}`,
      password: randPwd(),
      assigned_table_ids: [],
      created_at: ts,
    }));
    if (!db.servers) db.servers = [];
    db.servers.push(...servers);

    const restaurant = restaurantToApiWithCreds(row);
    const onboardingData = {
      ...onboardingPayload(restaurant),
      serverCreds: servers.map((sv) => ({ name: sv.name, userId: sv.user_id, password: sv.password })),
    };
    sendRestaurantOnboardingEmail(onboardingData).catch((e) => console.error('SMTP Background Error:', e?.message || e));
    return json({ restaurant, servers, mailStatus: 'sent_to_background' });
  }

  const restMatch = path.match(/^restaurants\/([^\/]+)$/);
  if (restMatch) {
    const id = restMatch[1];
    const idx = db.restaurants.findIndex((r) => r.id === id);
    if (idx === -1) return err('Not found', 404);
    const session = readSession(request);

    if (method === 'GET') {
      // Public read: never expose credentials. Central or owner gets the
      // cred-bearing view.
      const isPrivilegedViewer = session && (session.type === 'central' || (session.restaurantId === id && session.type === 'manager'));
      const mapper = isPrivilegedViewer ? restaurantToApiWithCreds : restaurantToApi;
      return json({ restaurant: mapper(db.restaurants[idx]) });
    }

    if (method === 'PUT') {
      const guard = requireSession(request, { roles: ['central', 'manager'], restaurantId: id });
      if (!guard.ok) return guard.response;
      const body = await request.json();
      const row = db.restaurants[idx];
      if (body.name !== undefined) row.name = clampStr(body.name, 120);
      if (body.ownerName !== undefined) row.owner_name = clampStr(body.ownerName, 120);
      if (body.email !== undefined) row.email = clampStr(body.email, 200);
      if (body.contact !== undefined) row.contact = clampStr(body.contact, 40);
      if (body.address !== undefined) row.address = clampStr(body.address, 240);
      if (body.domain !== undefined) row.domain = clampStr(body.domain, 120);
      if (body.logoUrl !== undefined) row.logo_url = clampStr(body.logoUrl, 500);
      // Only central can change subscription plan.
      if (body.subscription !== undefined && guard.session.type === 'central') {
        row.subscription = clampStr(body.subscription, 40);
      }
      row.updated_at = nowIso();
      const isCentral = guard.session.type === 'central';
      const mapper = isCentral ? restaurantToApiWithCreds : restaurantToApi;
      return json({ restaurant: mapper(row) });
    }

    if (method === 'DELETE') {
      const guard = requireSession(request, { roles: ['central'] });
      if (!guard.ok) return guard.response;
      db.restaurants.splice(idx, 1);
      db.menu = db.menu.filter((m) => m.restaurant_id !== id);
      db.rest_tables = db.rest_tables.filter((t) => t.restaurant_id !== id);
      db.orders = db.orders.filter((o) => o.restaurant_id !== id);
      db.chat_sessions = db.chat_sessions.filter((s) => s.restaurant_id !== id);
      return json({ ok: true });
    }
  }

  const resendMatch = path.match(/^restaurants\/([^\/]+)\/resend-credentials$/);
  if (resendMatch && method === 'POST') {
    const id = resendMatch[1];
    const guard = requireSession(request, { roles: ['central'] });
    if (!guard.ok) return guard.response;
    const idx = db.restaurants.findIndex((r) => r.id === id);
    if (idx === -1) return err('Restaurant not found', 404);

    const restaurant = restaurantToApiWithCreds(db.restaurants[idx]);
    const servers = (db.servers || [])
      .filter((s) => s.restaurant_id === id)
      .map((sv) => ({ name: sv.name, userId: sv.user_id, password: sv.password }));

    const onboardingData = {
      ...onboardingPayload(restaurant),
      serverCreds: servers,
    };
    sendRestaurantOnboardingEmail(onboardingData).catch((e) => console.error('SMTP Background Error:', e?.message || e));
    return json({ success: true, mailStatus: 'sent_to_background' });
  }

  // ============ MENU ============
  if (path === 'menu' && method === 'GET') {
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get('restaurantId');
    const availableOnly = url.searchParams.get('availableOnly');
    let items = db.menu.filter((m) => m.restaurant_id === restaurantId);
    if (availableOnly) items = items.filter((m) => m.available);
    items = [...items].sort((a, b) => (
      String(a.category).localeCompare(String(b.category)) || String(a.name).localeCompare(String(b.name))
    ));
    return json({ menu: items.map(menuToApi) });
  }

  if (path === 'menu' && method === 'POST') {
    const body = await request.json();
    const targetRestaurantId = body.restaurantId;
    if (!targetRestaurantId) return err('restaurantId is required');
    const guard = requireSession(request, { roles: ['central', 'manager'], restaurantId: targetRestaurantId });
    if (!guard.ok) return guard.response;
    const row = {
      id: makeId('menu'),
      restaurant_id: targetRestaurantId,
      name: clampStr(body.name, 120),
      name_es: clampStr(body.nameEs, 120),
      description: clampStr(body.description, 500),
      price: parseFloat(body.price) || 0,
      category: clampStr(body.category || 'Mains', 40),
      image: normalizeImage(body.image) || getRandomFoodImage(),
      video_url: clampStr(String(body.videoUrl || '').trim(), 500),
      available: body.available !== false,
      mood_tags: normalizeTagList(body.moodTags),
      taste_tags: normalizeTagList(body.tasteTags),
      dietary_tags: normalizeTagList(body.dietaryTags),
      created_at: nowIso(),
    };
    db.menu.push(row);
    return json({ item: menuToApi(row) });
  }

  const menuMatch = path.match(/^menu\/([^\/]+)$/);
  if (menuMatch) {
    const id = menuMatch[1];
    const idx = db.menu.findIndex((m) => m.id === id);
    if (idx === -1) return err('Not found', 404);
    const itemRestaurantId = db.menu[idx].restaurant_id;
    const guard = requireSession(request, { roles: ['central', 'manager'], restaurantId: itemRestaurantId });
    if (!guard.ok) return guard.response;

    if (method === 'PUT') {
      const body = await request.json();
      const row = db.menu[idx];
      if (body.name !== undefined) row.name = clampStr(body.name, 120);
      if (body.description !== undefined) row.description = clampStr(body.description, 500);
      if (body.price !== undefined) row.price = parseFloat(body.price);
      if (body.category !== undefined) row.category = clampStr(body.category, 40);
      if (body.image !== undefined) row.image = normalizeImage(body.image) || getRandomFoodImage();
      if (body.videoUrl !== undefined) row.video_url = clampStr(String(body.videoUrl || '').trim(), 500);
      if (body.available !== undefined) row.available = body.available;
      if (body.nameEs !== undefined) row.name_es = clampStr(body.nameEs, 120);
      if (body.moodTags !== undefined) row.mood_tags = normalizeTagList(body.moodTags);
      if (body.tasteTags !== undefined) row.taste_tags = normalizeTagList(body.tasteTags);
      if (body.dietaryTags !== undefined) row.dietary_tags = normalizeTagList(body.dietaryTags);
      return json({ ok: true });
    }

    if (method === 'DELETE') {
      db.menu.splice(idx, 1);
      return json({ ok: true });
    }
  }

  // ============ TABLES ============
  if (path === 'tables' && method === 'GET') {
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get('restaurantId');
    const tables = db.rest_tables
      .filter((t) => t.restaurant_id === restaurantId)
      .sort((a, b) => String(a.number).localeCompare(String(b.number), undefined, { numeric: true }));
    return json({ tables: tables.map(tableToApi) });
  }

  if (path === 'tables' && method === 'POST') {
    const body = await request.json();
    const targetRestaurantId = body.restaurantId;
    if (!targetRestaurantId) return err('restaurantId is required');
    const guard = requireSession(request, { roles: ['central', 'manager'], restaurantId: targetRestaurantId });
    if (!guard.ok) return guard.response;
    const row = {
      id: makeId('table'),
      restaurant_id: targetRestaurantId,
      number: clampStr(String(body.number), 16),
      seats: Math.max(1, Math.min(64, parseInt(body.seats, 10) || 2)),
      status: 'available',
      created_at: nowIso(),
    };
    db.rest_tables.push(row);
    return json({ table: tableToApi(row) });
  }

  const tblMatch = path.match(/^tables\/([^\/]+)$/);
  if (tblMatch) {
    const id = tblMatch[1];
    const idx = db.rest_tables.findIndex((t) => t.id === id);
    if (idx === -1) return err('Not found', 404);
    if (method === 'GET') {
      // Public: customers landing via QR need table info to render their page.
      return json({ table: tableToApi(db.rest_tables[idx]) });
    }
    const tableRestaurantId = db.rest_tables[idx].restaurant_id;
    const guard = requireSession(request, { roles: ['central', 'manager'], restaurantId: tableRestaurantId });
    if (!guard.ok) return guard.response;

    if (method === 'PUT') {
      const body = await request.json();
      const row = db.rest_tables[idx];
      if (body.number !== undefined) row.number = clampStr(String(body.number), 16);
      if (body.seats !== undefined) row.seats = Math.max(1, Math.min(64, parseInt(body.seats, 10) || 2));
      if (body.status !== undefined) row.status = clampStr(body.status, 24);
      return json({ ok: true });
    }

    if (method === 'DELETE') {
      db.rest_tables.splice(idx, 1);
      return json({ ok: true });
    }
  }

  // ============ ORDERS ============
  if (path === 'orders' && method === 'GET') {
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get('restaurantId');
    if (!restaurantId) return err('restaurantId is required');
    const guard = requireSession(request, { roles: ['central', 'manager', 'chef', 'server'], restaurantId });
    if (!guard.ok) return guard.response;
    const orders = db.orders
      .filter((o) => o.restaurant_id === restaurantId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 200);
    return json({ orders: orders.map(orderToApi) });
  }

  if (path === 'orders' && method === 'POST') {
    // Public: customers at a table create orders without logging in.
    const body = await request.json();
    const tbl = db.rest_tables.find((t) => t.id === body.tableId);
    if (!tbl) return err('Invalid table');
    if (body.restaurantId && tbl.restaurant_id !== body.restaurantId) return err('Invalid table');

    const restaurantMenu = db.menu.filter((m) => m.restaurant_id === tbl.restaurant_id);
    const { items, total } = rebuildOrderItems(body.items, restaurantMenu);
    if (!items.length) return err('No valid items in order');

    const ts = nowIso();
    const row = {
      id: makeId('ord'),
      restaurant_id: tbl.restaurant_id,
      table_id: body.tableId,
      table_number: tbl.number,
      items,
      total,
      tip_amount: 0,
      tip_percent: null,
      split_count: 1,
      total_with_tip: total,
      status: 'pending',
      allergy: clampStr(body.allergy, 240),
      spicy_level: clampStr(body.spicyLevel, 40),
      preference: clampStr(body.preference, 240),
      avoid: clampStr(body.avoid, 240),
      notes: clampStr(body.chefNotes || body.notes, 240),
      paid_at: null,
      payment_status: 'unpaid',
      payment_reference: '',
      payment_provider: '',
      payment_method: '',
      payment_vpa: '',
      payment_qr: '',
      payment_created_at: null,
      created_at: ts,
      updated_at: ts,
    };
    db.orders.push(row);
    tbl.status = 'occupied';
    return json({ order: orderToApi(row) });
  }

  const orderMatch = path.match(/^orders\/([^\/]+)$/);
  if (orderMatch) {
    const id = orderMatch[1];
    const idx = db.orders.findIndex((o) => o.id === id);
    if (idx === -1) return err('Not found', 404);
    const row = db.orders[idx];

    if (method === 'GET') {
      // Public read of own order is needed by the customer page.
      return json({ order: orderToApi(row) });
    }

    if (method === 'PUT') {
      const guard = requireSession(request, { roles: ['central', 'manager', 'chef', 'server'], restaurantId: row.restaurant_id });
      if (!guard.ok) return guard.response;
      const body = await request.json();
      if (body.status) {
        if (!ALLOWED_ORDER_STATUSES.has(body.status)) return err('Invalid status');
        // Direct 'paid' transitions must go through /payment/* endpoints so a
        // payment reference is recorded.
        if (body.status === 'paid') return err("Use /payment/* endpoints to mark an order paid", 400);
        row.status = body.status;
      }
      row.updated_at = nowIso();
      return json({ ok: true });
    }
  }

  const addonsMatch = path.match(/^orders\/([^\/]+)\/addons$/);
  if (addonsMatch && method === 'POST') {
    const id = addonsMatch[1];
    const row = db.orders.find((o) => o.id === id);
    if (!row) return err('Not found', 404);
    if (row.payment_status === 'paid' || row.status === 'paid') return err('Order is closed', 409);

    const restaurantMenu = db.menu.filter((m) => m.restaurant_id === row.restaurant_id);
    const incoming = await request.json();
    const { items: addItems } = rebuildOrderItems(incoming.items, restaurantMenu);
    const items = [...(row.items || [])];
    for (const it of addItems) {
      const ex = items.find((x) => x.id === it.id);
      if (ex) ex.qty = Math.min(99, ex.qty + it.qty);
      else items.push({ ...it, isAdditional: true });
    }
    row.items = items;
    row.total = Math.round(items.reduce((sum, i) => sum + i.price * i.qty, 0) * 100) / 100;
    row.status = row.status === 'served' ? 'preparing' : row.status;
    row.updated_at = nowIso();
    return json({ order: orderToApi(row) });
  }

  // ============ PAYMENT (DEMO) ============
  if (path === 'payment/demo' && method === 'POST') {
    const { orderId } = await request.json();
    const row = db.orders.find((o) => o.id === orderId);
    if (!row) return err('Order not found', 404);
    if (!row.payment_reference) row.payment_reference = makeUpiReference();
    row.payment_provider = row.payment_provider || 'demo';
    row.payment_method = row.payment_method || 'card';
    row.payment_status = 'paid';
    row.status = 'paid';
    row.paid_at = nowIso();
    row.updated_at = nowIso();
    const table = db.rest_tables.find((t) => t.id === row.table_id);
    if (table) table.status = 'available';
    return json({ order: orderToApi(row) });
  }

  // ============ PAYMENT (UPI DEMO) ============
  if (path === 'payment/upi/init' && method === 'POST') {
    const { orderId } = await request.json();
    const row = db.orders.find((o) => o.id === orderId);
    if (!row) return err('Order not found', 404);
    ensureDemoUpiPayment(row);
    return json({ order: orderToApi(row), payment: buildUpiPayment(row) });
  }

  if (path === 'payment/upi/status' && method === 'GET') {
    const url = new URL(request.url);
    const orderId = url.searchParams.get('orderId');
    const row = db.orders.find((o) => o.id === orderId);
    if (!row) return err('Order not found', 404);
    ensureDemoUpiPayment(row);
    const settled = maybeAutoSettleDemoUpi(row);
    if (settled) {
      const table = db.rest_tables.find((t) => t.id === row.table_id);
      if (table) table.status = 'available';
    }
    return json({ order: orderToApi(row), payment: buildUpiPayment(row) });
  }

  // ============ FEEDBACK ============
  if (path === 'feedback' && method === 'POST') {
    const body = await request.json();
    const rating = parseInt(body.rating, 10);
    const nps = parseInt(body.nps, 10);
    db.feedback.push({
      id: makeId('fb'),
      restaurant_id: body.restaurantId,
      table_id: body.tableId,
      order_id: body.orderId,
      rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : null,
      nps: Number.isFinite(nps) && nps >= 0 && nps <= 10 ? nps : null,
      comment: clampStr(body.comment, 1000),
      created_at: nowIso(),
    });
    return json({ ok: true });
  }

  // ============ SUPPORT MESSAGES ============
  if (!db.support_messages) db.support_messages = [];
  if (path === 'support' && method === 'GET') {
    const guard = requireSession(request, { roles: ['central', 'manager'] });
    if (!guard.ok) return guard.response;
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get('restaurantId');
    const scopedId = guard.session.type === 'central' ? restaurantId : guard.session.restaurantId;
    const msgs = scopedId ? db.support_messages.filter((m) => m.restaurant_id === scopedId) : db.support_messages;
    return json({ messages: msgs.sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) });
  }
  if (path === 'support' && method === 'POST') {
    const body = await request.json();
    let scopedId = null;
    if (body.sender === 'customer') {
      const table = db.rest_tables.find((t) => t.id === body.tableId);
      if (!table) return err('Invalid table');
      if (body.restaurantId && table.restaurant_id !== body.restaurantId) return err('Invalid table');
      scopedId = table.restaurant_id;
    } else {
      const guard = requireSession(request, { roles: ['central', 'manager'] });
      if (!guard.ok) return guard.response;
      scopedId = guard.session.type === 'central' ? body.restaurantId : guard.session.restaurantId;
    }
    if (!scopedId) return err('restaurantId is required');
    const msg = {
      id: makeId('msg'),
      restaurant_id: scopedId,
      table_id: body.tableId || null,
      order_id: body.orderId || null,
      sender: clampStr(body.sender || 'restaurant', 40),
      message: clampStr(body.message, 2000),
      priority: clampStr(body.priority || 'normal', 20),
      source: clampStr(body.source || 'dashboard', 30),
      read: false,
      created_at: nowIso(),
    };
    db.support_messages.push(msg);
    return json({ message: msg });
  }

  // ============ ANALYTICS (manager) ============
  if (path === 'analytics' && method === 'GET') {
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get('restaurantId');
    if (!restaurantId) return err('restaurantId is required');
    const guard = requireSession(request, { roles: ['central', 'manager'], restaurantId });
    if (!guard.ok) return guard.response;
    const orders = db.orders.filter((o) => o.restaurant_id === restaurantId && o.status !== 'cancelled');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todays = orders.filter((o) => new Date(o.created_at) >= today);
    const todayRevenue = todays.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const todayOrders = todays.length;
    const avgTicket = todayOrders ? todayRevenue / todayOrders : 0;

    const itemMap = {};
    orders.forEach((o) => (o.items || []).forEach((i) => {
      const key = i.name;
      if (!itemMap[key]) itemMap[key] = { name: key, count: 0, revenue: 0 };
      itemMap[key].count += i.qty;
      itemMap[key].revenue += i.qty * parseFloat(i.price);
    }));
    const topItems = Object.values(itemMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    const byHourMap = {};
    for (let h = 0; h < 24; h++) byHourMap[h] = { hour: `${String(h).padStart(2, '0')}h`, orders: 0 };
    todays.forEach((o) => {
      const h = new Date(o.created_at).getHours();
      byHourMap[h].orders += 1;
    });
    const byHour = Object.values(byHourMap);

    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const revenue = orders
        .filter((o) => new Date(o.created_at) >= d && new Date(o.created_at) < next)
        .reduce((sum, o) => sum + parseFloat(o.total), 0);
      last7.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), revenue: Math.round(revenue * 100) / 100 });
    }

    return json({ todayRevenue, todayOrders, avgTicket, topItems, byHour, last7 });
  }

  // ============ CENTRAL STATS ============
  if (path === 'central/stats' && method === 'GET') {
    const guard = requireSession(request, { roles: ['central'] });
    if (!guard.ok) return guard.response;
    const restaurants = db.restaurants;
    const orders = db.orders.filter((o) => o.status !== 'cancelled');
    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total), 0);
    const planPrice = { Starter: 49, Pro: 99, Premium: 199, Enterprise: 499 };
    const mrr = restaurants.reduce((sum, r) => sum + (planPrice[r.subscription] || 0), 0);

    const byPlanMap = {};
    restaurants.forEach((r) => {
      byPlanMap[r.subscription] = (byPlanMap[r.subscription] || 0) + 1;
    });
    const byPlan = Object.entries(byPlanMap).map(([name, value]) => ({ name, value }));

    const trend = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const revenue = orders
        .filter((o) => new Date(o.created_at) >= d && new Date(o.created_at) < next)
        .reduce((sum, o) => sum + parseFloat(o.total), 0);
      trend.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), revenue: Math.round(revenue * 100) / 100 });
    }

    return json({ totalRestaurants: restaurants.length, totalRevenue, totalOrders: orders.length, mrr, byPlan, trend });
  }

  // ============ AI WAITER CHAT (Gemini → NLU fallback) ============
  if (path === 'chat' && method === 'POST') {
    const body = await request.json();
    const {
      sessionId, restaurantId, tableId, language = 'en',
      message = '', menu = [], cart = [], allergy = '', preference = '',
      avoid = '', chefNotes = '', stage = 'browsing',
      clientActionId,
    } = body;
    const restaurant = db.restaurants.find((r) => r.id === restaurantId);

    const idx = db.chat_sessions.findIndex((s) => s.session_id === sessionId);
    const prev = idx >= 0 ? db.chat_sessions[idx] : { history: [], processed_actions: [] };

    if (clientActionId && (prev.processed_actions || []).includes(clientActionId)) {
      return json({ reply: "I already handled that request.", actions: {} });
    }

    const { reply, actions } = await aiWaiterReply({
      message: clampStr(message, 2000),
      menu, cart,
      allergy: clampStr(allergy, 240),
      preference: clampStr(preference, 240),
      avoid: clampStr(avoid, 240),
      notes: clampStr(chefNotes, 240),
      stage,
      restaurantName: restaurant?.name,
      history: prev.history || [],
      language,
    });

    const newHistory = [
      ...(prev.history || []),
      { role: 'user', content: message },
      { role: 'assistant', content: reply },
    ].slice(-30);
    
    const newProcessed = [...(prev.processed_actions || []), clientActionId].filter(Boolean).slice(-20);

    const row = { session_id: sessionId, restaurant_id: restaurantId, table_id: tableId, history: newHistory, processed_actions: newProcessed, updated_at: nowIso() };
    if (idx >= 0) db.chat_sessions[idx] = row;
    else db.chat_sessions.push(row);

    return json({ reply, actions });
  }

  // ============ HEALTH ============
  if (path === '' || path === 'health') {
    return json({ status: 'ok', service: 'netrik-shop', db: 'demo-mode', time: nowIso() });
  }

  return err(`Not found: /${path}`, 404);
}

async function handler(request, { params }) {
  const path = (params?.path || []).join('/');
  const method = request.method;

  // Stateless auth endpoints that don't need a DB.
  if (path === 'auth/logout' && method === 'POST') {
    return clearSession(json({ ok: true }));
  }
  if (path === 'auth/me' && method === 'GET') {
    const session = readSession(request);
    if (!session) return err('Unauthorized', 401);
    const { exp: _exp, ...user } = session;
    return json({ user });
  }

  let sb;
  let sbError = null;
  try { sb = getSupabase(); }
  catch (e) { sb = null; sbError = e; }

  if (!sb) {
    if (DEMO_MODE_ENABLED) {
      return handleDemoRequest(path, method, request);
    }
    return safeErr('supabase not configured', sbError, 500, 'Database not configured');
  }

  try {
    // ============ AUTH ============
    if (path === 'auth/login' && method === 'POST') {
      const { type, userId, password } = await request.json();
      if (!type || !userId || !password) return err('Missing fields');
      if (type === 'central') {
        const { data, error } = await sb.from('users').select('*').eq('type', 'central').eq('user_id', userId).eq('password', password).maybeSingle();
        if (error) return safeErr('login central', error);
        if (!data) return err('Invalid credentials', 401);
        const user = { id: data.id, type: 'central', userId: data.user_id };
        return attachSession(json({ user }), sessionForUser(user));
      }
      if (type === 'server') {
        let data = null;
        let lookupError = null;
        try {
          const r = await sb.from('servers').select('*').eq('user_id', userId).eq('password', password).maybeSingle();
          data = r.data;
          lookupError = r.error;
        } catch (e) {
          lookupError = { code: 'NO_TABLE', message: e?.message || 'servers table missing' };
        }
        if (data) {
          const { data: rest } = await sb.from('restaurants').select('id,name').eq('id', data.restaurant_id).maybeSingle();
          const user = {
            type: 'server', userId, serverId: data.id, serverName: data.name,
            restaurantId: data.restaurant_id, restaurantName: rest?.name,
            assignedTableIds: data.assigned_table_ids || [],
          };
          return attachSession(json({ user }), sessionForUser(user));
        }
        if (DEMO_MODE_ENABLED || (lookupError && (lookupError.code === '42P01' || lookupError.code === 'NO_TABLE'))) {
          return handleDemoRequest(path, method, request);
        }
        return err('Invalid credentials', 401);
      }
      const field = type === 'manager' ? 'manager_user_id' : type === 'chef' ? 'chef_user_id' : null;
      const passField = type === 'manager' ? 'manager_password' : type === 'chef' ? 'chef_password' : null;
      if (!field) return err('Invalid type');
      const { data, error } = await sb.from('restaurants').select('*').eq(field, userId).eq(passField, password).maybeSingle();
      if (error) return safeErr('login restaurant', error);
      if (!data) return err('Invalid credentials', 401);
      const user = { type, userId, restaurantId: data.id, restaurantName: data.name };
      return attachSession(json({ user }), sessionForUser(user));
    }

    // ============ SERVER (waiter) ENDPOINTS ============
    if ((path === 'server/me' || path === 'server/orders') && method === 'GET') {
      const session = readSession(request);
      if (!session || session.type !== 'server') return err('Unauthorized', 401);
      try {
        const sid = session.serverId;
        const { data: srv } = await sb.from('servers').select('*').eq('id', sid).maybeSingle();
        if (srv) {
          if (path === 'server/me') {
            const { data: rest } = await sb.from('restaurants').select('id,name').eq('id', srv.restaurant_id).maybeSingle();
            const { data: tables } = await sb.from('rest_tables').select('*').in('id', srv.assigned_table_ids || []);
            return json({
              server: { id: srv.id, name: srv.name, userId: srv.user_id, restaurantId: srv.restaurant_id, restaurantName: rest?.name, assignedTableIds: srv.assigned_table_ids || [] },
              tables: (tables || []).map((t) => ({ id: t.id, number: t.number, seats: t.seats, status: t.status, restaurantId: t.restaurant_id })),
            });
          }
          if (path === 'server/orders') {
            const { data: orders } = await sb.from('orders').select('*').eq('restaurant_id', srv.restaurant_id).in('table_id', srv.assigned_table_ids || []).order('created_at', { ascending: false });
            return json({ orders: (orders || []).map(orderToApi) });
          }
        }
      } catch (_) { /* fall through to demo */ }
      if (DEMO_MODE_ENABLED) return handleDemoRequest(path, method, request);
      return err('Server endpoints require a `servers` table', 404);
    }

    // ============ RESTAURANTS ============
    if (path === 'restaurants' && method === 'GET') {
      const guard = requireSession(request, { roles: ['central'] });
      if (!guard.ok) return guard.response;
      const { data, error } = await sb.from('restaurants').select('*').order('created_at', { ascending: false });
      if (error) return safeErr('restaurants list', error);
      return json({ restaurants: (data || []).map(restaurantToApiWithCreds) });
    }
    if (path === 'restaurants' && method === 'POST') {
      const guard = requireSession(request, { roles: ['central'] });
      if (!guard.ok) return guard.response;
      const body = await request.json();
      if (!body.name || !body.ownerName || !body.contact || !body.email) return err('Missing required fields');
      const s = slug(body.name) + '_' + rand(4);
      const row = {
        name: clampStr(body.name, 120),
        owner_name: clampStr(body.ownerName, 120),
        email: clampStr(body.email, 200),
        contact: clampStr(body.contact, 40),
        address: clampStr(body.address, 240),
        domain: clampStr(body.domain, 120),
        logo_url: clampStr(body.logoUrl, 500),
        subscription: clampStr(body.subscription || 'Pro', 40),
        manager_user_id: 'manager_' + s,
        manager_password: randPwd(),
        chef_user_id: 'chef_' + s,
        chef_password: randPwd(),
      };
      const { data, error } = await sb.from('restaurants').insert(row).select('*').single();
      if (error) return safeErr('restaurants insert', error);

      // Create 4 default server accounts for the restaurant
      const servers = ['Server 1', 'Server 2', 'Server 3', 'Server 4'].map((name, i) => ({
        restaurant_id: data.id, name, user_id: `server${i + 1}_${s}`, password: randPwd(), assigned_table_ids: [],
      }));
      let serverData = null;
      try {
        const r = await sb.from('servers').insert(servers).select('*');
        if (!r.error) serverData = r.data;
      } catch (e) {
        console.error('Server account insert failed (table may not exist):', e?.message || e);
      }

      const restaurant = restaurantToApiWithCreds(data);
      const onboardingData = {
        ...onboardingPayload(restaurant),
        serverCreds: servers.map((sv) => ({ name: sv.name, userId: sv.user_id, password: sv.password })),
      };
      sendRestaurantOnboardingEmail(onboardingData).catch((e) => console.error('SMTP Background Error:', e?.message || e));
      return json({ restaurant, servers: serverData || servers, mailStatus: 'sent_to_background' });
    }
    const restMatch = path.match(/^restaurants\/([^\/]+)$/);
    if (restMatch) {
      const id = restMatch[1];
      const session = readSession(request);
      if (method === 'GET') {
        const { data, error } = await sb.from('restaurants').select('*').eq('id', id).maybeSingle();
        if (error) return safeErr('restaurant get', error);
        if (!data) return err('Not found', 404);
        const isPrivilegedViewer = session && (session.type === 'central' || (session.restaurantId === id && (session.type === 'manager' || session.type === 'chef')));
        const mapper = isPrivilegedViewer ? restaurantToApiWithCreds : restaurantToApi;
        return json({ restaurant: mapper(data) });
      }
      if (method === 'PUT') {
        const guard = requireSession(request, { roles: ['central', 'manager'], restaurantId: id });
        if (!guard.ok) return guard.response;
        const body = await request.json();
        const upd = { updated_at: new Date().toISOString() };
        if (body.name !== undefined) upd.name = clampStr(body.name, 120);
        if (body.ownerName !== undefined) upd.owner_name = clampStr(body.ownerName, 120);
        if (body.email !== undefined) upd.email = clampStr(body.email, 200);
        if (body.contact !== undefined) upd.contact = clampStr(body.contact, 40);
        if (body.address !== undefined) upd.address = clampStr(body.address, 240);
        if (body.domain !== undefined) upd.domain = clampStr(body.domain, 120);
        if (body.logoUrl !== undefined) upd.logo_url = clampStr(body.logoUrl, 500);
        if (body.subscription !== undefined && guard.session.type === 'central') {
          upd.subscription = clampStr(body.subscription, 40);
        }
        const { data, error } = await sb.from('restaurants').update(upd).eq('id', id).select('*').single();
        if (error) return safeErr('restaurant update', error);
        const mapper = guard.session.type === 'central' ? restaurantToApiWithCreds : restaurantToApi;
        return json({ restaurant: mapper(data) });
      }
      if (method === 'DELETE') {
        const guard = requireSession(request, { roles: ['central'] });
        if (!guard.ok) return guard.response;
        const { error } = await sb.from('restaurants').delete().eq('id', id);
        if (error) return safeErr('restaurant delete', error);
        return json({ ok: true });
      }
    }

    const resendMatch = path.match(/^restaurants\/([^\/]+)\/resend-credentials$/);
    if (resendMatch && method === 'POST') {
      const id = resendMatch[1];
      const guard = requireSession(request, { roles: ['central'] });
      if (!guard.ok) return guard.response;
      
      const { data, error } = await sb.from('restaurants').select('*').eq('id', id).maybeSingle();
      if (error || !data) return err('Restaurant not found', 404);
      
      const { data: serverData } = await sb.from('servers').select('*').eq('restaurant_id', id);
      const servers = (serverData || []).map(sv => ({
         name: sv.name, userId: sv.user_id, password: sv.password 
      }));

      const restaurant = restaurantToApiWithCreds(data);
      const onboardingData = {
        ...onboardingPayload(restaurant),
        serverCreds: servers,
      };
      
      sendRestaurantOnboardingEmail(onboardingData).catch((e) => console.error('SMTP Background Error:', e?.message || e));
      return json({ success: true, mailStatus: 'sent_to_background' });
    }

    // Per-restaurant aggregate endpoints used by the central admin detail page
    const restServersMatch = path.match(/^restaurants\/([^\/]+)\/servers$/);
    if (restServersMatch && method === 'GET') {
      const id = restServersMatch[1];
      const guard = requireSession(request, { roles: ['central', 'manager'], restaurantId: id });
      if (!guard.ok) return guard.response;
      const { data, error } = await sb.from('servers').select('*').eq('restaurant_id', id).order('name', { ascending: true });
      if (error) return json({ servers: [], warning: 'unavailable' });
      const exposePasswords = guard.session.type === 'central';
      const servers = (data || []).map((s) => ({
        id: s.id,
        name: s.name,
        userId: s.user_id,
        ...(exposePasswords ? { password: s.password } : {}),
        assignedTableIds: s.assigned_table_ids || [],
        createdAt: s.created_at,
      }));
      return json({ servers });
    }
    const restFeedbackMatch = path.match(/^restaurants\/([^\/]+)\/feedback$/);
    if (restFeedbackMatch && method === 'GET') {
      const id = restFeedbackMatch[1];
      const guard = requireSession(request, { roles: ['central', 'manager'], restaurantId: id });
      if (!guard.ok) return guard.response;
      const { data, error } = await sb.from('feedback').select('*').eq('restaurant_id', id).order('created_at', { ascending: false }).limit(100);
      if (error) return json({ feedback: [], warning: 'unavailable' });
      const feedback = (data || []).map((f) => ({
        id: f.id,
        restaurantId: f.restaurant_id,
        tableId: f.table_id,
        orderId: f.order_id,
        rating: f.rating,
        nps: f.nps,
        comment: f.comment || '',
        createdAt: f.created_at,
      }));
      return json({ feedback });
    }
    const restSummaryMatch = path.match(/^restaurants\/([^\/]+)\/summary$/);
    if (restSummaryMatch && method === 'GET') {
      const id = restSummaryMatch[1];
      const guard = requireSession(request, { roles: ['central', 'manager'], restaurantId: id });
      if (!guard.ok) return guard.response;
      const [restRes, ordersRes, tablesRes, menuRes, serversRes, feedbackRes] = await Promise.all([
        sb.from('restaurants').select('*').eq('id', id).maybeSingle(),
        sb.from('orders').select('*').eq('restaurant_id', id),
        sb.from('rest_tables').select('*').eq('restaurant_id', id),
        sb.from('menu').select('id,available').eq('restaurant_id', id),
        sb.from('servers').select('id').eq('restaurant_id', id),
        sb.from('feedback').select('rating').eq('restaurant_id', id),
      ]);
      if (restRes.error) return safeErr('summary restaurant', restRes.error);
      if (!restRes.data) return err('Not found', 404);
      const allOrders = ordersRes.data || [];
      const tables = tablesRes.data || [];
      const menu = menuRes.data || [];
      const servers = serversRes.data || [];
      const feedback = feedbackRes.data || [];
      const live = allOrders.filter((o) => o.status !== 'cancelled');
      const paid = live.filter((o) => o.status === 'paid' || o.payment_status === 'paid');
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todays = live.filter((o) => new Date(o.created_at) >= today);
      const lifetimeRevenue = paid.reduce((s, o) => s + parseFloat(o.total || 0), 0);
      const todayRevenue = todays.reduce((s, o) => s + parseFloat(o.total || 0), 0);
      const activeOrders = live.filter((o) => ['pending', 'preparing', 'ready', 'served'].includes(o.status)).length;
      const occupiedTables = tables.filter((t) => t.status === 'occupied').length;
      const avgRating = feedback.length ? feedback.reduce((s, f) => s + (parseInt(f.rating) || 0), 0) / feedback.length : 0;
      const lastActivity = live.length ? live.map((o) => new Date(o.created_at).getTime()).reduce((a, b) => Math.max(a, b), 0) : null;
      const mapper = guard.session.type === 'central' ? restaurantToApiWithCreds : restaurantToApi;
      return json({
        restaurant: mapper(restRes.data),
        summary: {
          lifetimeRevenue,
          todayRevenue,
          totalOrders: live.length,
          paidOrders: paid.length,
          todayOrders: todays.length,
          activeOrders,
          tableCount: tables.length,
          occupiedTables,
          menuCount: menu.length,
          menuAvailable: menu.filter((m) => m.available).length,
          serverCount: servers.length,
          feedbackCount: feedback.length,
          avgRating: Math.round(avgRating * 10) / 10,
          lastActivity: lastActivity ? new Date(lastActivity).toISOString() : null,
        },
      });
    }

    // ============ MENU ============
    if (path === 'menu' && method === 'GET') {
      const url = new URL(request.url);
      const restaurantId = url.searchParams.get('restaurantId');
      const availableOnly = url.searchParams.get('availableOnly');
      let q = sb.from('menu').select('*').eq('restaurant_id', restaurantId).order('category', { ascending: true }).order('name', { ascending: true });
      if (availableOnly) q = q.eq('available', true);
      const { data, error } = await q;
      if (error) return safeErr('menu list', error);
      return json({ menu: (data || []).map(menuToApi) });
    }
    if (path === 'menu' && method === 'POST') {
      const body = await request.json();
      if (!body.restaurantId) return err('restaurantId is required');
      const guard = requireSession(request, { roles: ['central', 'manager'], restaurantId: body.restaurantId });
      if (!guard.ok) return guard.response;
      const row = {
        restaurant_id: body.restaurantId,
        name: clampStr(body.name, 120),
        name_es: clampStr(body.nameEs, 120),
        description: clampStr(body.description, 500),
        price: parseFloat(body.price) || 0,
        category: clampStr(body.category || 'Mains', 40),
        image: normalizeImage(body.image) || getRandomFoodImage(),
        video_url: clampStr(String(body.videoUrl || '').trim(), 500),
        available: body.available !== false,
        mood_tags: normalizeTagList(body.moodTags),
        taste_tags: normalizeTagList(body.tasteTags),
        dietary_tags: normalizeTagList(body.dietaryTags),
      };
      const { data, error } = await sb.from('menu').insert(row).select('*').single();
      if (error) return safeErr('menu insert', error);
      return json({ item: menuToApi(data) });
    }
    const menuMatch = path.match(/^menu\/([^\/]+)$/);
    if (menuMatch) {
      const id = menuMatch[1];
      const { data: existing, error: lookupError } = await sb.from('menu').select('restaurant_id').eq('id', id).maybeSingle();
      if (lookupError) return safeErr('menu lookup', lookupError);
      if (!existing) return err('Not found', 404);
      const guard = requireSession(request, { roles: ['central', 'manager'], restaurantId: existing.restaurant_id });
      if (!guard.ok) return guard.response;
      if (method === 'PUT') {
        const body = await request.json();
        const upd = {};
        if (body.name !== undefined) upd.name = clampStr(body.name, 120);
        if (body.description !== undefined) upd.description = clampStr(body.description, 500);
        if (body.price !== undefined) upd.price = parseFloat(body.price);
        if (body.category !== undefined) upd.category = clampStr(body.category, 40);
        if (body.image !== undefined) upd.image = normalizeImage(body.image) || getRandomFoodImage();
        if (body.videoUrl !== undefined) upd.video_url = clampStr(String(body.videoUrl || '').trim(), 500);
        if (body.available !== undefined) upd.available = body.available;
        if (body.nameEs !== undefined) upd.name_es = clampStr(body.nameEs, 120);
        if (body.moodTags !== undefined) upd.mood_tags = normalizeTagList(body.moodTags);
        if (body.tasteTags !== undefined) upd.taste_tags = normalizeTagList(body.tasteTags);
        if (body.dietaryTags !== undefined) upd.dietary_tags = normalizeTagList(body.dietaryTags);
        const { error } = await sb.from('menu').update(upd).eq('id', id);
        if (error) return safeErr('menu update', error);
        return json({ ok: true });
      }
      if (method === 'DELETE') {
        const { error } = await sb.from('menu').delete().eq('id', id);
        if (error) return safeErr('menu delete', error);
        return json({ ok: true });
      }
    }

    // ============ TABLES ============
    if (path === 'tables' && method === 'GET') {
      const url = new URL(request.url);
      const restaurantId = url.searchParams.get('restaurantId');
      const { data, error } = await sb.from('rest_tables').select('*').eq('restaurant_id', restaurantId).order('number', { ascending: true });
      if (error) return safeErr('tables list', error);
      return json({ tables: (data || []).map(tableToApi) });
    }
    if (path === 'tables' && method === 'POST') {
      const body = await request.json();
      if (!body.restaurantId) return err('restaurantId is required');
      const guard = requireSession(request, { roles: ['central', 'manager'], restaurantId: body.restaurantId });
      if (!guard.ok) return guard.response;
      const row = {
        restaurant_id: body.restaurantId,
        number: clampStr(String(body.number), 16),
        seats: Math.max(1, Math.min(64, parseInt(body.seats, 10) || 2)),
        status: 'available',
      };
      const { data, error } = await sb.from('rest_tables').insert(row).select('*').single();
      if (error) return safeErr('tables insert', error);
      return json({ table: tableToApi(data) });
    }
    const tblMatch = path.match(/^tables\/([^\/]+)$/);
    if (tblMatch) {
      const id = tblMatch[1];
      if (method === 'GET') {
        const { data, error } = await sb.from('rest_tables').select('*').eq('id', id).maybeSingle();
        if (error) return safeErr('table get', error);
        if (!data) return err('Not found', 404);
        return json({ table: tableToApi(data) });
      }
      const { data: existing, error: lookupError } = await sb.from('rest_tables').select('restaurant_id').eq('id', id).maybeSingle();
      if (lookupError) return safeErr('table lookup', lookupError);
      if (!existing) return err('Not found', 404);
      const guard = requireSession(request, { roles: ['central', 'manager'], restaurantId: existing.restaurant_id });
      if (!guard.ok) return guard.response;
      if (method === 'PUT') {
        const body = await request.json();
        const upd = {};
        if (body.number !== undefined) upd.number = clampStr(String(body.number), 16);
        if (body.seats !== undefined) upd.seats = Math.max(1, Math.min(64, parseInt(body.seats, 10) || 2));
        if (body.status !== undefined) upd.status = clampStr(body.status, 24);
        const { error } = await sb.from('rest_tables').update(upd).eq('id', id);
        if (error) return safeErr('table update', error);
        return json({ ok: true });
      }
      if (method === 'DELETE') {
        const { error } = await sb.from('rest_tables').delete().eq('id', id);
        if (error) return safeErr('table delete', error);
        return json({ ok: true });
      }
    }

    // ============ ORDERS ============
    if (path === 'orders' && method === 'GET') {
      const url = new URL(request.url);
      const restaurantId = url.searchParams.get('restaurantId');
      if (!restaurantId) return err('restaurantId is required');
      const guard = requireSession(request, { roles: ['central', 'manager', 'chef', 'server'], restaurantId });
      if (!guard.ok) return guard.response;
      const { data, error } = await sb.from('orders').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }).limit(200);
      if (error) return safeErr('orders list', error);
      return json({ orders: (data || []).map(orderToApi) });
    }
    if (path === 'orders' && method === 'POST') {
      // Public: a customer at a QR-scanned table places an order. We never
      // trust the client-supplied prices — we recompute the total from the
      // restaurant's current menu.
      const body = await request.json();
      const { data: tbl, error: te } = await sb.from('rest_tables').select('*').eq('id', body.tableId).maybeSingle();
      if (te) return safeErr('orders table lookup', te);
      if (!tbl) return err('Invalid table');
      if (body.restaurantId && tbl.restaurant_id !== body.restaurantId) return err('Invalid table');
      const { data: menuRows, error: me } = await sb.from('menu').select('id,name,name_es,price,available').eq('restaurant_id', tbl.restaurant_id);
      if (me) return safeErr('orders menu lookup', me);
      const { items, total } = rebuildOrderItems(body.items, menuRows || []);
      if (!items.length) return err('No valid items in order');
      const row = {
        restaurant_id: tbl.restaurant_id,
        table_id: body.tableId,
        table_number: tbl.number,
        items,
        total,
        tip_amount: 0,
        tip_percent: null,
        split_count: 1,
        total_with_tip: total,
        status: 'pending',
        allergy: clampStr(body.allergy, 240),
        spicy_level: clampStr(body.spicyLevel, 40),
        preference: clampStr(body.preference, 240),
        avoid: clampStr(body.avoid, 240),
        notes: clampStr(body.chefNotes || body.notes, 240),
        payment_status: 'unpaid',
        payment_reference: '',
        payment_provider: '',
        payment_method: '',
        payment_vpa: '',
        payment_qr: '',
        payment_created_at: null,
      };
      const { data, error } = await sb.from('orders').insert(row).select('*').single();
      if (error) return safeErr('orders insert', error);
      await sb.from('rest_tables').update({ status: 'occupied' }).eq('id', body.tableId);
      return json({ order: orderToApi(data) });
    }
    const orderMatch = path.match(/^orders\/([^\/]+)$/);
    if (orderMatch) {
      const id = orderMatch[1];
      if (method === 'GET') {
        const { data, error } = await sb.from('orders').select('*').eq('id', id).maybeSingle();
        if (error) return safeErr('order get', error);
        if (!data) return err('Not found', 404);
        return json({ order: orderToApi(data) });
      }
      if (method === 'PUT') {
        const { data: existing, error: lookupError } = await sb.from('orders').select('restaurant_id').eq('id', id).maybeSingle();
        if (lookupError) return safeErr('order lookup', lookupError);
        if (!existing) return err('Not found', 404);
        const guard = requireSession(request, { roles: ['central', 'manager', 'chef', 'server'], restaurantId: existing.restaurant_id });
        if (!guard.ok) return guard.response;
        const body = await request.json();
        const upd = { updated_at: new Date().toISOString() };
        if (body.status) {
          if (!ALLOWED_ORDER_STATUSES.has(body.status)) return err('Invalid status');
          if (body.status === 'paid') return err("Use /payment/* endpoints to mark an order paid", 400);
          upd.status = body.status;
        }
        if (body.allergy !== undefined) upd.allergy = clampStr(body.allergy, 240);
        if (body.spicyLevel !== undefined) upd.spicy_level = clampStr(body.spicyLevel, 40);
        if (body.preference !== undefined) upd.preference = clampStr(body.preference, 240);
        if (body.avoid !== undefined) upd.avoid = clampStr(body.avoid, 240);
        if (body.chefNotes !== undefined || body.notes !== undefined) {
          upd.notes = clampStr(body.chefNotes || body.notes, 240);
        }
        const { error } = await sb.from('orders').update(upd).eq('id', id);
        if (error) return safeErr('order update', error);
        return json({ ok: true });
      }
    }
    const addonsMatch = path.match(/^orders\/([^\/]+)\/addons$/);
    if (addonsMatch && method === 'POST') {
      const id = addonsMatch[1];
      const body = await request.json();
      const { data: o, error: ge } = await sb.from('orders').select('*').eq('id', id).maybeSingle();
      if (ge) return safeErr('addons get', ge);
      if (!o) return err('Not found', 404);
      if (o.payment_status === 'paid' || o.status === 'paid') return err('Order is closed', 409);
      const { data: menuRows } = await sb.from('menu').select('id,name,name_es,price,available').eq('restaurant_id', o.restaurant_id);
      const { items: addItems } = rebuildOrderItems(body.items, menuRows || []);
      const items = [...(o.items || [])];
      for (const it of addItems) {
        const ex = items.find((x) => x.id === it.id);
        if (ex) ex.qty = Math.min(99, ex.qty + it.qty);
        else items.push({ ...it, isAdditional: true });
      }
      const total = Math.round(items.reduce((s, i) => s + parseFloat(i.price) * i.qty, 0) * 100) / 100;
      const newStatus = o.status === 'served' ? 'preparing' : o.status;
      const { data, error } = await sb.from('orders').update({ items, total, status: newStatus, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
      if (error) return safeErr('addons update', error);
      return json({ order: orderToApi(data) });
    }

    // ============ PAYMENT (DEMO) ============
    if (path === 'payment/demo' && method === 'POST') {
      const { orderId } = await request.json();
      const { data: o, error: ge } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (ge) return safeErr('payment/demo get', ge);
      if (!o) return err('Order not found', 404);
      const paymentReference = o.payment_reference || makeUpiReference();
      const { data, error } = await sb.from('orders').update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_status: 'paid',
        payment_reference: paymentReference,
        payment_provider: o.payment_provider || 'demo',
        payment_method: o.payment_method || 'card',
      }).eq('id', orderId).select('*').single();
      if (error) return safeErr('payment/demo update', error);
      await sb.from('rest_tables').update({ status: 'available' }).eq('id', o.table_id);
      return json({ order: orderToApi(data) });
    }

    // ============ PAYMENT (UPI DEMO) ============
    if (path === 'payment/upi/init' && method === 'POST') {
      const { orderId } = await request.json();
      const { data: o, error: ge } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (ge) return safeErr('upi/init get', ge);
      if (!o) return err('Order not found', 404);

      const payableTotal = o.total_with_tip ?? o.total;

      const paymentReference = o.payment_reference || makeUpiReference();
      const vpa = o.payment_vpa || DEMO_UPI_VPA;
      const paymentCreatedAt = o.payment_created_at || new Date().toISOString();
      const paymentQr = o.payment_qr || buildUpiUri({
        vpa,
        name: DEMO_UPI_PAYEE,
        amount: toAmount(payableTotal),
        reference: paymentReference,
      });
      const { data, error } = await sb.from('orders').update({
        payment_status: o.payment_status && o.payment_status !== 'unpaid' ? o.payment_status : 'pending',
        payment_reference: paymentReference,
        payment_provider: o.payment_provider || 'demo-upi',
        payment_method: o.payment_method || 'upi',
        payment_vpa: vpa,
        payment_qr: paymentQr,
        payment_created_at: paymentCreatedAt,
      }).eq('id', orderId).select('*').single();
      if (error) return safeErr('upi/init update', error);
      return json({ order: orderToApi(data), payment: buildUpiPayment(data) });
    }

    if (path === 'payment/upi/status' && method === 'GET') {
      const url = new URL(request.url);
      const orderId = url.searchParams.get('orderId');
      const { data: o, error: ge } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (ge) return safeErr('upi/status get', ge);
      if (!o) return err('Order not found', 404);

      const row = { ...o };
      if (!row.payment_reference) row.payment_reference = makeUpiReference();
      if (!row.payment_vpa) row.payment_vpa = DEMO_UPI_VPA;
      if (!row.payment_provider) row.payment_provider = 'demo-upi';
      if (!row.payment_method) row.payment_method = 'upi';
      if (!row.payment_created_at) row.payment_created_at = new Date().toISOString();
      if (!row.payment_qr) {
        row.payment_qr = buildUpiUri({
          vpa: row.payment_vpa,
          name: DEMO_UPI_PAYEE,
          amount: toAmount(row.total_with_tip ?? row.total),
          reference: row.payment_reference,
        });
      }
      if (!row.payment_status || row.payment_status === 'unpaid') row.payment_status = 'pending';

      const settled = maybeAutoSettleDemoUpi(row);
      const { data, error } = await sb.from('orders').update({
        payment_status: row.payment_status,
        payment_reference: row.payment_reference,
        payment_provider: row.payment_provider,
        payment_method: row.payment_method,
        payment_vpa: row.payment_vpa,
        payment_qr: row.payment_qr,
        payment_created_at: row.payment_created_at,
        status: row.status,
        paid_at: row.paid_at,
        updated_at: row.updated_at || new Date().toISOString(),
      }).eq('id', orderId).select('*').single();
      if (error) return safeErr('upi/status update', error);
      if (settled) {
        await sb.from('rest_tables').update({ status: 'available' }).eq('id', o.table_id);
      }
      return json({ order: orderToApi(data), payment: buildUpiPayment(data) });
    }

    // ============ PAYMENT (STRIPE) ============
    if (path === 'payment/stripe/init' && method === 'POST') {
      const { orderId, tipAmount, tipPercent, splitCount } = await request.json();
      const { data: o, error: ge } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (ge) return safeErr('stripe/init get', ge);
      if (!o) return err('Order not found', 404);

      const { data: restaurant } = await sb.from('restaurants').select('*').eq('id', o.restaurant_id).maybeSingle();

      const baseTotal = parseFloat(o.total) || 0;
      const rawTip = tipAmount ?? o.tip_amount ?? 0;
      const rawSplit = splitCount ?? o.split_count ?? 1;
      const rawTipPercent = tipPercent ?? o.tip_percent;
      const safeTip = Math.max(0, parseFloat(rawTip) || 0);
      const safeSplit = Math.max(1, Math.min(12, parseInt(rawSplit, 10) || 1));
      const parsedTipPercent = parseFloat(rawTipPercent);
      const safeTipPercent = Number.isFinite(parsedTipPercent)
        ? Math.max(0, Math.min(100, parsedTipPercent))
        : null;
      const finalAmount = Math.round((baseTotal + safeTip) * 100) / 100;
      
      const result = await createCheckoutSession({
        orderId: o.id,
        amount: finalAmount,
        restaurantName: restaurant?.name || 'Restaurant',
        tableId: o.table_id,
        customerEmail: o.customer_email || undefined,
        baseUrl: resolvePublicAppUrl(request),
        metadata: {
          tipAmount: String(safeTip),
          tipPercent: safeTipPercent != null ? String(safeTipPercent) : '',
          splitCount: String(safeSplit),
        },
      });

      if (!result.success) {
        return safeErr('stripe checkout creation', result.error);
      }

      const paymentCreatedAt = new Date().toISOString();
      const { data, error } = await sb.from('orders').update({
        tip_amount: safeTip,
        tip_percent: safeTipPercent,
        split_count: safeSplit,
        total_with_tip: finalAmount,
        payment_status: 'pending',
        payment_reference: result.sessionId,
        payment_provider: 'stripe',
        payment_method: 'card',
        payment_created_at: paymentCreatedAt,
      }).eq('id', orderId).select('*').single();

      if (error) return safeErr('stripe/init update', error);

      return json({
        order: orderToApi(data),
        payment: {
          status: 'pending',
          reference: result.sessionId,
          provider: 'stripe',
          method: 'card',
          createdAt: paymentCreatedAt,
          checkoutUrl: result.checkoutUrl,
        },
        checkoutUrl: result.checkoutUrl,
      });
    }

    if (path === 'payment/stripe/status' && method === 'GET') {
      const url = new URL(request.url);
      const orderId = url.searchParams.get('orderId');
      const sessionId = url.searchParams.get('sessionId');

      const { data: o, error: ge } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (ge) return safeErr('stripe/status get', ge);
      if (!o) return err('Order not found', 404);

      if (!sessionId && !o.payment_reference) {
        return json({
          order: orderToApi(o),
          payment: {
            status: 'unpaid',
            reference: o.payment_reference,
            provider: 'stripe',
            method: 'card',
          },
        });
      }

      const session = await getSessionStatus(sessionId || o.payment_reference);
      
      let paymentStatus = o.payment_status || 'unpaid';
      let orderStatus = o.status;
      let paidAt = o.paid_at;

      if (session.success && session.status === 'paid') {
        paymentStatus = 'paid';
        orderStatus = 'paid';
        paidAt = new Date().toISOString();

        const { error: updateError } = await sb.from('orders').update({
          payment_status: 'paid',
          status: 'paid',
          paid_at: paidAt,
          updated_at: new Date().toISOString(),
        }).eq('id', orderId);

        if (updateError) console.error('stripe/status update error:', updateError);
        else {
          await sb.from('rest_tables').update({ status: 'available' }).eq('id', o.table_id);
        }
      }

      return json({
        order: { ...orderToApi(o), status: orderStatus, paid_at: paidAt },
        payment: {
          status: paymentStatus,
          reference: sessionId || o.payment_reference,
          provider: 'stripe',
          method: 'card',
        },
      });
    }

    // ============ PAYMENT (STRIPE WEBHOOK) ============
    if (path === 'payment/stripe/webhook' && method === 'POST') {
      const signature = request.headers.get('stripe-signature');
      if (!signature) return err('Missing stripe-signature header', 400);

      const body = await request.text();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.warn('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured');
        return json({ received: true }); // Still acknowledge to avoid retries
      }

      const verification = verifyWebhookSignature(body, signature, webhookSecret);
      if (!verification.success) {
        console.error('[Stripe Webhook] Signature verification failed:', verification.error);
        return err('Webhook signature verification failed', 401);
      }

      const event = verification.event;
      const result = await handleWebhookEvent(event, sb);

      if (result.handled) {
        console.log('[Stripe Webhook] Event processed:', event.type, result);
        return json({ received: true, processed: true });
      }

      console.log('[Stripe Webhook] Event acknowledged but not processed:', event.type);
      return json({ received: true, processed: false });
    }

    // ============ FEEDBACK ============
    if (path === 'feedback' && method === 'POST') {
      const body = await request.json();
      const rating = parseInt(body.rating, 10);
      const nps = parseInt(body.nps, 10);
      const row = {
        restaurant_id: body.restaurantId,
        table_id: body.tableId,
        order_id: body.orderId,
        rating: Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : null,
        nps: Number.isFinite(nps) && nps >= 0 && nps <= 10 ? nps : null,
        comment: clampStr(body.comment, 1000),
      };
      const { error } = await sb.from('feedback').insert(row);
      if (error) return safeErr('feedback insert', error);
      return json({ ok: true });
    }

    // ============ SUPPORT MESSAGES ============
    if (path === 'support' && method === 'GET') {
      const guard = requireSession(request, { roles: ['central', 'manager'] });
      if (!guard.ok) return guard.response;
      const url = new URL(request.url);
      const queryRestaurantId = url.searchParams.get('restaurantId');
      const scopedId = guard.session.type === 'central' ? queryRestaurantId : guard.session.restaurantId;
      let query = sb.from('support_messages').select('*').order('created_at', { ascending: true });
      if (scopedId) query = query.eq('restaurant_id', scopedId);
      const { data, error } = await query;
      if (error) return safeErr('support list', error);
      return json({ messages: data || [] });
    }
    if (path === 'support' && method === 'POST') {
      const body = await request.json();
      let scopedId = null;
      if (body.sender === 'customer') {
        const { data: tbl, error: tErr } = await sb.from('rest_tables').select('restaurant_id').eq('id', body.tableId).maybeSingle();
        if (tErr || !tbl) return err('Invalid table');
        if (body.restaurantId && tbl.restaurant_id !== body.restaurantId) return err('Invalid table');
        scopedId = tbl.restaurant_id;
      } else {
        const guard = requireSession(request, { roles: ['central', 'manager'] });
        if (!guard.ok) return guard.response;
        scopedId = guard.session.type === 'central' ? body.restaurantId : guard.session.restaurantId;
      }
      if (!scopedId) return err('restaurantId is required');
      const row = {
        restaurant_id: scopedId,
        table_id: body.tableId || null,
        order_id: body.orderId || null,
        sender: clampStr(body.sender || 'restaurant', 40),
        message: clampStr(body.message, 2000),
        priority: clampStr(body.priority || 'normal', 20),
        source: clampStr(body.source || 'dashboard', 30),
      };
      let data = null;
      let error = null;
      ({ data, error } = await sb.from('support_messages').insert(row).select('*').single());
      if (error && /column .* does not exist|schema cache/i.test(String(error.message || ''))) {
        const fallback = await sb.from('support_messages').insert({
          restaurant_id: scopedId,
          sender: row.sender,
          message: row.message,
        }).select('*').single();
        if (fallback.error) return safeErr('support insert', fallback.error);
        return json({ message: fallback.data, warning: 'support metadata not stored' });
      }
      if (error) return safeErr('support insert', error);
      return json({ message: data });
    }

    // ============ ANALYTICS (manager) ============
    if (path === 'analytics' && method === 'GET') {
      const url = new URL(request.url);
      const restaurantId = url.searchParams.get('restaurantId');
      if (!restaurantId) return err('restaurantId is required');
      const guard = requireSession(request, { roles: ['central', 'manager'], restaurantId });
      if (!guard.ok) return guard.response;
      const { data: all, error } = await sb.from('orders').select('*').eq('restaurant_id', restaurantId).neq('status', 'cancelled');
      if (error) return safeErr('analytics list', error);
      const orders = (all || []);
      const today = new Date(); today.setHours(0,0,0,0);
      const todays = orders.filter((o) => new Date(o.created_at) >= today);
      const todayRevenue = todays.reduce((s,o)=>s+parseFloat(o.total),0);
      const todayOrders = todays.length;
      const avgTicket = todayOrders ? todayRevenue / todayOrders : 0;
      const itemMap = {};
      orders.forEach((o) => (o.items || []).forEach((i) => {
        const k = i.name;
        itemMap[k] = itemMap[k] || { name: k, count: 0, revenue: 0 };
        itemMap[k].count += i.qty;
        itemMap[k].revenue += i.qty * parseFloat(i.price);
      }));
      const topItems = Object.values(itemMap).sort((a,b)=>b.revenue-a.revenue).slice(0,10);
      const byHourMap = {};
      for (let h = 0; h < 24; h++) byHourMap[h] = { hour: `${String(h).padStart(2,'0')}h`, orders: 0 };
      todays.forEach((o) => { const h = new Date(o.created_at).getHours(); byHourMap[h].orders += 1; });
      const byHour = Object.values(byHourMap);
      const last7 = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
        const next = new Date(d); next.setDate(next.getDate()+1);
        const rev = orders.filter((o) => new Date(o.created_at) >= d && new Date(o.created_at) < next).reduce((s,o)=>s+parseFloat(o.total),0);
        last7.push({ date: d.toLocaleDateString('en-US',{month:'short',day:'numeric'}), revenue: Math.round(rev*100)/100 });
      }
      return json({ todayRevenue, todayOrders, avgTicket, topItems, byHour, last7 });
    }

    // ============ CENTRAL STATS ============
    if (path === 'central/stats' && method === 'GET') {
      const guard = requireSession(request, { roles: ['central'] });
      if (!guard.ok) return guard.response;
      const { data: restaurants } = await sb.from('restaurants').select('*');
      const { data: orders } = await sb.from('orders').select('*').neq('status', 'cancelled');
      const totalRevenue = (orders || []).reduce((s,o)=>s+parseFloat(o.total),0);
      const planPrice = { Starter: 49, Pro: 99, Premium: 199, Enterprise: 499 };
      const mrr = (restaurants || []).reduce((s,r)=>s+(planPrice[r.subscription]||0),0);
      const byPlanMap = {};
      (restaurants || []).forEach((r) => { byPlanMap[r.subscription] = (byPlanMap[r.subscription]||0)+1; });
      const byPlan = Object.entries(byPlanMap).map(([name,value])=>({ name, value }));
      const trend = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
        const next = new Date(d); next.setDate(next.getDate()+1);
        const rev = (orders || []).filter((o) => new Date(o.created_at) >= d && new Date(o.created_at) < next).reduce((s,o)=>s+parseFloat(o.total),0);
        trend.push({ date: d.toLocaleDateString('en-US',{month:'short',day:'numeric'}), revenue: Math.round(rev*100)/100 });
      }
      return json({ totalRestaurants: (restaurants || []).length, totalRevenue, totalOrders: (orders || []).length, mrr, byPlan, trend });
    }

    // ============ AI WAITER CHAT (Gemini → NLU fallback) ============
    if (path === 'chat' && method === 'POST') {
      const body = await request.json();
      const {
        sessionId, restaurantId, tableId, language = 'en',
        message = '', menu = [], cart = [], allergy = '', preference = '',
        avoid = '', chefNotes = '', stage = 'browsing',
        clientActionId,
      } = body;
      const { data: restaurant } = await sb.from('restaurants').select('name').eq('id', restaurantId).maybeSingle();
      
      // In a real Supabase setup you would add processed_actions to the table.
      // Since we don't want to break the schema if it's not updated, we'll try to use it if present
      // or fallback gracefully.
      const { data: session } = await sb.from('chat_sessions').select('*').eq('session_id', sessionId).maybeSingle();
      const history = (session?.history || []);
      const processed = (session?.processed_actions || []);

      if (clientActionId && processed.includes(clientActionId)) {
        return json({ reply: "I already handled that request.", actions: {} });
      }

      const { reply, actions } = await aiWaiterReply({
        message: clampStr(message, 2000),
        menu, cart,
        allergy: clampStr(allergy, 240),
        preference: clampStr(preference, 240),
        avoid: clampStr(avoid, 240),
        notes: clampStr(chefNotes, 240),
        stage,
        restaurantName: restaurant?.name,
        history,
        language,
      });

      const newHistory = [...history, { role: 'user', content: message }, { role: 'assistant', content: reply }].slice(-30);
      const newProcessed = [...processed, clientActionId].filter(Boolean).slice(-20);
      
      try {
        await sb.from('chat_sessions').upsert({ session_id: sessionId, restaurant_id: restaurantId, table_id: tableId, history: newHistory, processed_actions: newProcessed, updated_at: new Date().toISOString() }, { onConflict: 'session_id' });
      } catch (err) {
        // Fallback if processed_actions column doesn't exist
        await sb.from('chat_sessions').upsert({ session_id: sessionId, restaurant_id: restaurantId, table_id: tableId, history: newHistory, updated_at: new Date().toISOString() }, { onConflict: 'session_id' });
      }
      
      return json({ reply, actions });
    }

    // ============ HEALTH ============
    if (path === '' || path === 'health') {
      const { error } = await sb.from('users').select('user_id').limit(1);
      return json({ status: 'ok', service: 'netrik-shop', db: error ? 'error' : 'supabase-ok', time: new Date().toISOString() });
    }

    return err(`Not found: /${path}`, 404);
  } catch (e) {
    return safeErr('uncaught', e);
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
export const OPTIONS = () => new NextResponse(null, { status: 204 });
