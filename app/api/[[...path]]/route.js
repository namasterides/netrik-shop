import { NextResponse } from 'next/server';
import { getSupabase, restaurantToApi, menuToApi, tableToApi, orderToApi } from '@/lib/supabase';
import { llmChat } from '@/lib/llm';
import { nluRespond } from '@/lib/nlu';
import { sendRestaurantOnboardingEmail } from '@/lib/mailer';

const json = (data, status = 200) => NextResponse.json(data, { status });
const err = (message, status = 400) => NextResponse.json({ error: message }, { status });

const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 18) || 'rest';
const rand = (n = 4) => Math.random().toString(36).slice(2, 2 + n);
const randPwd = () => Math.floor(100000 + Math.random() * 900000).toString();
const DELETE_RESTAURANT_PASSWORD = 'harry';
const SUPPORT_EMAIL = 'namasterides26@gmail.com';
const SUPPORT_PHONE = '+1(656)214-5190';

function stripJson(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) {
    try { return { actions: JSON.parse(m[1]), reply: text.replace(m[0], '').trim() }; } catch {}
  }
  return { actions: null, reply: text };
}

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
const makeId = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeImage = (image) => String(image || '').trim();

const DEMO_UPI_PAYEE = 'Netrik Shop';
const DEMO_UPI_VPA = 'netrik@upi';
const DEMO_UPI_AUTO_SETTLE_MS = 9000;

const toAmount = (value) => Number.parseFloat(value || 0).toFixed(2);
const makeUpiReference = () => `UPI${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
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
  amount: toAmount(row.total),
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
      amount: toAmount(row.total),
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

async function assertDeletePassword(request) {
  const body = await readJsonSafe(request);
  if ((body.deletePassword || '').trim() !== DELETE_RESTAURANT_PASSWORD) {
    return { ok: false, body };
  }
  return { ok: true, body };
}

function onboardingPayload(restaurant) {
  if (!restaurant) return null;
  return {
    restaurantName: restaurant.name,
    ownerName: restaurant.ownerName,
    toEmail: restaurant.email,
    subscription: restaurant.subscription,
    domain: restaurant.domain,
    address: restaurant.address,
    contact: restaurant.contact,
    managerCreds: restaurant.managerCreds,
    chefCreds: restaurant.chefCreds,
    supportEmail: SUPPORT_EMAIL,
    supportPhone: SUPPORT_PHONE,
  };
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

function buildDemoChatReply({ message = '', language = 'en', restaurantName = 'our restaurant', menu = [] }) {
  const lower = message.toLowerCase();
  const name = restaurantName || 'our restaurant';
  const popularItems = menu.slice(0, 3).map((m) => m.name).filter(Boolean);
  const popular = popularItems.length ? popularItems.join(', ') : 'today\'s chef specials';
  const menuPreview = menu.slice(0, 6).map((m) => `${m.name} ($${Number(m.price || 0).toFixed(2)})`).join(', ');

  if (/menu|show.*dish|what.*have|available/.test(lower)) {
    if (language === 'es') {
      return menuPreview
        ? `Claro. En este momento tenemos: ${menuPreview}. También puedo mostrar el menu visual con fotos y videos. Dime cuál quieres y lo agrego por ti.`
        : 'Ahora mismo no tengo el menu cargado. Intentalo de nuevo en unos segundos y te ayudo a pedir.';
    }
    return menuPreview
      ? `Sure. Right now we have: ${menuPreview}. I can also show the visual menu with photos and videos. Tell me what you want and I will add it for you.`
      : 'I do not have the menu loaded yet. Please try again in a few seconds and I will help you order.';
  }

  if (/recommend|suggest|special|popular|best/.test(lower)) {
    return language === 'es'
      ? `Te recomiendo ${popular}. Si quieres, te ayudo a elegir segun tu apetito o nivel de picante.`
      : `I recommend ${popular}. If you want, I can tailor choices by appetite and spice level.`;
  }

  if (/hello|hi|hey|hola/.test(lower)) {
    return language === 'es'
      ? `Hola, bienvenido a ${name}. Dime que te apetece y te ayudo a pedir en segundos.`
      : `Hi, welcome to ${name}. Tell me what you are craving and I will help you order quickly.`;
  }

  if (/place.*order|checkout|confirm.*order|submit.*order/.test(lower)) {
    return language === 'es'
      ? 'Perfecto, estoy confirmando tu pedido ahora mismo. Enseguida te comparto el ticket de cocina.'
      : 'Perfect, I am confirming your order now. I will share your kitchen ticket right away.';
  }

  if (/pay|payment|bill|check/.test(lower)) {
    return language === 'es'
      ? 'Excelente, te ayudo con el pago en linea ahora mismo.'
      : 'Great, I will help you complete the online payment now.';
  }

  return language === 'es'
    ? 'Perfecto. Puedo ayudarte a agregar platos, bebidas o postres. Dime qué quieres y yo me encargo del pedido.'
    : 'Great choice. I can add mains, drinks, or desserts for you. Tell me what you want and I will handle the order.';
}

function extractDemoChatActions(message = '', menu = []) {
  const lower = message.toLowerCase();
  const actions = {};
  const addItems = [];

  for (const item of menu) {
    const name = String(item.name || '').trim();
    if (!name) continue;
    const nameLower = name.toLowerCase();
    if (!lower.includes(nameLower)) continue;

    const qtyRegex = new RegExp(`(\\d+)\\s*(x|\\*)?\\s*${escapeRegExp(nameLower)}`);
    const qtyMatch = lower.match(qtyRegex);
    const quantity = Math.max(1, parseInt(qtyMatch?.[1] || '1', 10));
    addItems.push({ id: item.id, name: item.name, quantity });
  }

  if (addItems.length) actions.add_items = addItems;

  if (/extra[- ]?hot/.test(lower)) actions.set_spicy = 'extra-hot';
  else if (/\bhot\b|picante/.test(lower)) actions.set_spicy = 'hot';
  else if (/\bmedium\b|medio/.test(lower)) actions.set_spicy = 'medium';
  else if (/\bmild\b|suave|no spicy/.test(lower)) actions.set_spicy = 'mild';

  if (/allergy|allergic|alerg/.test(lower)) {
    actions.set_allergy = message.slice(0, 120).trim();
  }

  if (/(place|submit|send|confirm).*(order|pedido)|checkout/.test(lower)) {
    actions.place_order = true;
  }

  if (/(pay|payment|charge|pagar|cobrar|card)/.test(lower)) {
    actions.pay_now = true;
  }

  return Object.keys(actions).length ? actions : null;
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
      return json({ user: { id: data.id, type: 'central', userId: data.user_id, demoMode: true } });
    }

    if (type === 'server') {
      const srv = (db.servers || []).find((s) => s.user_id === userId && s.password === password);
      if (!srv) return err('Invalid credentials', 401);
      const rest = db.restaurants.find((r) => r.id === srv.restaurant_id);
      return json({
        user: {
          type: 'server', userId, serverId: srv.id, serverName: srv.name,
          restaurantId: srv.restaurant_id, restaurantName: rest?.name,
          assignedTableIds: srv.assigned_table_ids || [],
          demoMode: true,
        },
      });
    }

    const rest = db.restaurants.find((r) => (
      (type === 'manager' && r.manager_user_id === userId && r.manager_password === password) ||
      (type === 'chef' && r.chef_user_id === userId && r.chef_password === password)
    ));
    if (!rest) return err('Invalid credentials', 401);
    return json({ user: { type, userId, restaurantId: rest.id, restaurantName: rest.name, demoMode: true } });
  }

  // ============ SERVER (waiter) ENDPOINTS ============
  if (path === 'server/me' && method === 'GET') {
    const url = new URL(request.url);
    const sid = url.searchParams.get('serverId');
    const srv = (db.servers || []).find((s) => s.id === sid);
    if (!srv) return err('Not found', 404);
    const tables = (db.rest_tables || []).filter((t) => (srv.assigned_table_ids || []).includes(t.id));
    const rest = db.restaurants.find((r) => r.id === srv.restaurant_id);
    return json({
      server: { id: srv.id, name: srv.name, userId: srv.user_id, restaurantId: srv.restaurant_id, restaurantName: rest?.name, assignedTableIds: srv.assigned_table_ids || [] },
      tables: tables.map((t) => ({ id: t.id, number: t.number, seats: t.seats, status: t.status, restaurantId: t.restaurant_id })),
    });
  }

  if (path === 'server/orders' && method === 'GET') {
    const url = new URL(request.url);
    const sid = url.searchParams.get('serverId');
    const srv = (db.servers || []).find((s) => s.id === sid);
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
    const restaurants = [...db.restaurants].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return json({ restaurants: restaurants.map(restaurantToApi) });
  }

  if (path === 'restaurants' && method === 'POST') {
    const body = await request.json();
    if (!body.name || !body.ownerName || !body.contact || !body.email) return err('Missing required fields');

    const s = slug(body.name) + '_' + rand(4);
    const ts = nowIso();
    const restaurantId = makeId('rest');
    const row = {
      id: restaurantId,
      name: body.name,
      owner_name: body.ownerName,
      email: body.email,
      contact: body.contact,
      address: body.address || '',
      domain: body.domain || '',
      logo_url: body.logoUrl || '',
      subscription: body.subscription || 'Pro',
      manager_user_id: 'manager_' + s,
      manager_password: randPwd(),
      chef_user_id: 'chef_' + s,
      chef_password: randPwd(),
      created_at: ts,
      updated_at: ts,
    };
    db.restaurants.push(row);

    // Create 2 default server accounts for the restaurant
    const server1 = {
      id: makeId('srv'),
      restaurant_id: restaurantId,
      name: 'Server 1',
      user_id: 'server1_' + s,
      password: randPwd(),
      assigned_table_ids: [],
      created_at: ts,
    };
    const server2 = {
      id: makeId('srv'),
      restaurant_id: restaurantId,
      name: 'Server 2',
      user_id: 'server2_' + s,
      password: randPwd(),
      assigned_table_ids: [],
      created_at: ts,
    };
    if (!db.servers) db.servers = [];
    db.servers.push(server1, server2);

    const restaurant = restaurantToApi(row);
    const onboardingData = {
      ...onboardingPayload(restaurant),
      serverCreds: [
        { name: server1.name, userId: server1.user_id, password: server1.password },
        { name: server2.name, userId: server2.user_id, password: server2.password },
      ],
    };
    sendRestaurantOnboardingEmail(onboardingData).catch(e => console.error('SMTP Background Error:', e));
    return json({ restaurant, servers: [server1, server2], mailStatus: 'sent_to_background' });
  }

  const restMatch = path.match(/^restaurants\/([^\/]+)$/);
  if (restMatch) {
    const id = restMatch[1];
    const idx = db.restaurants.findIndex((r) => r.id === id);
    if (idx === -1) return err('Not found', 404);

    if (method === 'GET') {
      return json({ restaurant: restaurantToApi(db.restaurants[idx]) });
    }

    if (method === 'PUT') {
      const body = await request.json();
      const row = db.restaurants[idx];
      if (body.name !== undefined) row.name = body.name;
      if (body.ownerName !== undefined) row.owner_name = body.ownerName;
      if (body.email !== undefined) row.email = body.email;
      if (body.contact !== undefined) row.contact = body.contact;
      if (body.address !== undefined) row.address = body.address;
      if (body.domain !== undefined) row.domain = body.domain;
      if (body.logoUrl !== undefined) row.logo_url = body.logoUrl;
      if (body.subscription !== undefined) row.subscription = body.subscription;
      row.updated_at = nowIso();
      return json({ restaurant: restaurantToApi(row) });
    }

    if (method === 'DELETE') {
      const auth = await assertDeletePassword(request);
      if (!auth.ok) return err('Delete password is incorrect', 403);
      db.restaurants.splice(idx, 1);
      db.menu = db.menu.filter((m) => m.restaurant_id !== id);
      db.rest_tables = db.rest_tables.filter((t) => t.restaurant_id !== id);
      db.orders = db.orders.filter((o) => o.restaurant_id !== id);
      db.chat_sessions = db.chat_sessions.filter((s) => s.restaurant_id !== id);
      return json({ ok: true });
    }
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
    const row = {
      id: makeId('menu'),
      restaurant_id: body.restaurantId,
      name: body.name,
      name_es: body.nameEs || '',
      description: body.description || '',
      price: parseFloat(body.price) || 0,
      category: body.category || 'Mains',
      image: normalizeImage(body.image) || getRandomFoodImage(),
      video_url: String(body.videoUrl || '').trim(),
      available: body.available !== false,
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

    if (method === 'PUT') {
      const body = await request.json();
      const row = db.menu[idx];
      if (body.name !== undefined) row.name = body.name;
      if (body.description !== undefined) row.description = body.description;
      if (body.price !== undefined) row.price = parseFloat(body.price);
      if (body.category !== undefined) row.category = body.category;
      if (body.image !== undefined) row.image = normalizeImage(body.image) || getRandomFoodImage();
      if (body.videoUrl !== undefined) row.video_url = String(body.videoUrl || '').trim();
      if (body.available !== undefined) row.available = body.available;
      if (body.nameEs !== undefined) row.name_es = body.nameEs;
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
    const row = {
      id: makeId('table'),
      restaurant_id: body.restaurantId,
      number: String(body.number),
      seats: parseInt(body.seats, 10) || 2,
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
      return json({ table: tableToApi(db.rest_tables[idx]) });
    }

    if (method === 'PUT') {
      const body = await request.json();
      const row = db.rest_tables[idx];
      if (body.number !== undefined) row.number = String(body.number);
      if (body.seats !== undefined) row.seats = parseInt(body.seats, 10);
      if (body.status !== undefined) row.status = body.status;
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
    const orders = db.orders
      .filter((o) => o.restaurant_id === restaurantId)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 200);
    return json({ orders: orders.map(orderToApi) });
  }

  if (path === 'orders' && method === 'POST') {
    const body = await request.json();
    const tbl = db.rest_tables.find((t) => t.id === body.tableId);
    if (!tbl) return err('Invalid table');

    const items = (body.items || []).map((i) => ({
      id: i.id,
      name: i.name,
      nameEs: i.nameEs || '',
      price: parseFloat(i.price),
      qty: parseInt(i.qty, 10) || 1,
      notes: i.notes || '',
    }));
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
    const ts = nowIso();
    const row = {
      id: makeId('ord'),
      restaurant_id: body.restaurantId,
      table_id: body.tableId,
      table_number: tbl.number,
      items,
      total,
      status: 'pending',
      allergy: body.allergy || '',
      spicy_level: body.spicyLevel || '',
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

    if (method === 'GET') {
      return json({ order: orderToApi(db.orders[idx]) });
    }

    if (method === 'PUT') {
      const body = await request.json();
      const row = db.orders[idx];
      if (body.status) row.status = body.status;
      row.updated_at = nowIso();
      if (body.status === 'paid') {
        row.payment_status = 'paid';
        row.payment_reference = row.payment_reference || makeUpiReference();
        row.payment_provider = row.payment_provider || 'manual';
        row.payment_method = row.payment_method || 'cash';
        row.paid_at = row.paid_at || nowIso();
        const table = db.rest_tables.find((t) => t.id === row.table_id);
        if (table) table.status = 'available';
      }
      return json({ ok: true });
    }
  }

  const addonsMatch = path.match(/^orders\/([^\/]+)\/addons$/);
  if (addonsMatch && method === 'POST') {
    const id = addonsMatch[1];
    const row = db.orders.find((o) => o.id === id);
    if (!row) return err('Not found', 404);

    const items = [...(row.items || [])];
    const incoming = await request.json();
    for (const it of (incoming.items || [])) {
      const ex = items.find((x) => x.id === it.id);
      if (ex) ex.qty += parseInt(it.qty, 10) || 1;
      else {
        items.push({
          id: it.id,
          name: it.name,
          nameEs: it.nameEs || '',
          price: parseFloat(it.price),
          qty: parseInt(it.qty, 10) || 1,
          notes: it.notes || '',
          isAdditional: true,
        });
      }
    }
    row.items = items;
    row.total = items.reduce((sum, i) => sum + parseFloat(i.price) * i.qty, 0);
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
    db.feedback.push({
      id: makeId('fb'),
      restaurant_id: body.restaurantId,
      table_id: body.tableId,
      order_id: body.orderId,
      rating: parseInt(body.rating, 10) || null,
      comment: body.comment || '',
      created_at: nowIso(),
    });
    return json({ ok: true });
  }

  // ============ SUPPORT MESSAGES ============
  if (!db.support_messages) db.support_messages = [];
  if (path === 'support' && method === 'GET') {
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get('restaurantId');
    const msgs = restaurantId ? db.support_messages.filter(m => m.restaurant_id === restaurantId) : db.support_messages;
    return json({ messages: msgs.sort((a,b)=> new Date(a.created_at) - new Date(b.created_at)) });
  }
  if (path === 'support' && method === 'POST') {
    const body = await request.json();
    const msg = {
      id: makeId('msg'),
      restaurant_id: body.restaurantId,
      sender: body.sender || 'restaurant',
      message: body.message,
      read: false,
      created_at: nowIso()
    };
    db.support_messages.push(msg);
    return json({ message: msg });
  }

  // ============ ANALYTICS (manager) ============
  if (path === 'analytics' && method === 'GET') {
    const url = new URL(request.url);
    const restaurantId = url.searchParams.get('restaurantId');
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

  // ============ AI WAITER CHAT (LOCAL NLU — NO EXTERNAL API) ============
  if (path === 'chat' && method === 'POST') {
    const body = await request.json();
    const { sessionId, restaurantId, tableId, language = 'en', message = '', menu = [], cart = [], allergy = '', spicy = '', notes = '', stage = 'browsing' } = body;
    const restaurant = db.restaurants.find((r) => r.id === restaurantId);

    const idx = db.chat_sessions.findIndex((s) => s.session_id === sessionId);
    const prev = idx >= 0 ? db.chat_sessions[idx] : { history: [] };

    const { reply, actions } = nluRespond({
      message, menu, cart, allergy, spicy, notes, stage,
      restaurantName: restaurant?.name, history: prev.history || [], language,
    });

    const newHistory = [...(prev.history || []), { role: 'user', content: message }, { role: 'assistant', content: reply }].slice(-30);
    const row = { session_id: sessionId, restaurant_id: restaurantId, table_id: tableId, history: newHistory, updated_at: nowIso() };
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
  let sb;
  let sbError = null;
  try { sb = getSupabase(); }
  catch (e) { sb = null; sbError = e; }

  if (!sb) {
    if (DEMO_MODE_ENABLED) {
      return handleDemoRequest(path, method, request);
    }
    return err(`Database not configured: ${sbError?.message || 'unknown error'}`, 500);
  }

  try {
    // ============ AUTH ============
    if (path === 'auth/login' && method === 'POST') {
      const { type, userId, password } = await request.json();
      if (!type || !userId || !password) return err('Missing fields');
      if (type === 'central') {
        const { data, error } = await sb.from('users').select('*').eq('type', 'central').eq('user_id', userId).eq('password', password).maybeSingle();
        if (error) return err(error.message, 500);
        if (!data) return err('Invalid credentials', 401);
        return json({ user: { id: data.id, type: 'central', userId: data.user_id } });
      }
      if (type === 'server') {
        // Try Supabase first, fall back to demo
        const { data, error } = await sb.from('servers').select('*').eq('user_id', userId).eq('password', password).maybeSingle().catch(() => ({ data: null, error: { code: 'NO_TABLE' } }));
        if (data) {
          const { data: rest } = await sb.from('restaurants').select('id,name').eq('id', data.restaurant_id).maybeSingle();
          return json({
            user: {
              type: 'server', userId, serverId: data.id, serverName: data.name,
              restaurantId: data.restaurant_id, restaurantName: rest?.name,
              assignedTableIds: data.assigned_table_ids || [],
            },
          });
        }
        if (DEMO_MODE_ENABLED || (error && (error.code === '42P01' || error.code === 'NO_TABLE'))) {
          return handleDemoRequest(path, method, request);
        }
        return err('Invalid credentials', 401);
      }
      const field = type === 'manager' ? 'manager_user_id' : type === 'chef' ? 'chef_user_id' : null;
      const passField = type === 'manager' ? 'manager_password' : type === 'chef' ? 'chef_password' : null;
      if (!field) return err('Invalid type');
      const { data, error } = await sb.from('restaurants').select('*').eq(field, userId).eq(passField, password).maybeSingle();
      if (error) return err(error.message, 500);
      if (!data) return err('Invalid credentials', 401);
      return json({ user: { type, userId, restaurantId: data.id, restaurantName: data.name } });
    }

    // ============ SERVER (waiter) ENDPOINTS — fall back to demo for cleaner experience ============
    if ((path === 'server/me' || path === 'server/orders') && method === 'GET') {
      try {
        const url = new URL(request.url);
        const sid = url.searchParams.get('serverId');
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
      return err('Server endpoints require demo mode or a `servers` table', 404);
    }

    // ============ RESTAURANTS ============
    if (path === 'restaurants' && method === 'GET') {
      const { data, error } = await sb.from('restaurants').select('*').order('created_at', { ascending: false });
      if (error) return err(error.message, 500);
      return json({ restaurants: (data || []).map(restaurantToApi) });
    }
    if (path === 'restaurants' && method === 'POST') {
      const body = await request.json();
      if (!body.name || !body.ownerName || !body.contact || !body.email) return err('Missing required fields');
      const s = slug(body.name) + '_' + rand(4);
      const row = {
        name: body.name,
        owner_name: body.ownerName,
        email: body.email,
        contact: body.contact,
        address: body.address || '',
        domain: body.domain || '',
        logo_url: body.logoUrl || '',
        subscription: body.subscription || 'Pro',
        manager_user_id: 'manager_' + s,
        manager_password: randPwd(),
        chef_user_id: 'chef_' + s,
        chef_password: randPwd(),
      };
      const { data, error } = await sb.from('restaurants').insert(row).select('*').single();
      if (error) return err(error.message, 500);
      
      // Create 2 default server accounts for the restaurant
      const servers = [
        { restaurant_id: data.id, name: 'Server 1', user_id: 'server1_' + s, password: randPwd(), assigned_table_ids: [] },
        { restaurant_id: data.id, name: 'Server 2', user_id: 'server2_' + s, password: randPwd(), assigned_table_ids: [] },
      ];
      const { data: serverData } = await sb.from('servers').insert(servers).select('*').catch(() => ({ data: null }));
      
      const restaurant = restaurantToApi(data);
      const onboardingData = {
        ...onboardingPayload(restaurant),
        serverCreds: servers.map(s => ({ name: s.name, userId: s.user_id, password: s.password })),
      };
      sendRestaurantOnboardingEmail(onboardingData).catch(e => console.error('SMTP Background Error:', e));
      return json({ restaurant, servers: serverData || servers, mailStatus: 'sent_to_background' });
    }
    const restMatch = path.match(/^restaurants\/([^\/]+)$/);
    if (restMatch) {
      const id = restMatch[1];
      if (method === 'GET') {
        const { data, error } = await sb.from('restaurants').select('*').eq('id', id).maybeSingle();
        if (error) return err(error.message, 500);
        if (!data) return err('Not found', 404);
        return json({ restaurant: restaurantToApi(data) });
      }
      if (method === 'PUT') {
        const body = await request.json();
        const upd = { updated_at: new Date().toISOString() };
        if (body.name !== undefined) upd.name = body.name;
        if (body.ownerName !== undefined) upd.owner_name = body.ownerName;
        if (body.email !== undefined) upd.email = body.email;
        if (body.contact !== undefined) upd.contact = body.contact;
        if (body.address !== undefined) upd.address = body.address;
        if (body.domain !== undefined) upd.domain = body.domain;
        if (body.logoUrl !== undefined) upd.logo_url = body.logoUrl;
        if (body.subscription !== undefined) upd.subscription = body.subscription;
        const { data, error } = await sb.from('restaurants').update(upd).eq('id', id).select('*').single();
        if (error) return err(error.message, 500);
        return json({ restaurant: restaurantToApi(data) });
      }
      if (method === 'DELETE') {
        const auth = await assertDeletePassword(request);
        if (!auth.ok) return err('Delete password is incorrect', 403);
        // FK cascade defined in schema handles menu/tables/orders
        const { error } = await sb.from('restaurants').delete().eq('id', id);
        if (error) return err(error.message, 500);
        return json({ ok: true });
      }
    }

    // ============ MENU ============
    if (path === 'menu' && method === 'GET') {
      const url = new URL(request.url);
      const restaurantId = url.searchParams.get('restaurantId');
      const availableOnly = url.searchParams.get('availableOnly');
      let q = sb.from('menu').select('*').eq('restaurant_id', restaurantId).order('category', { ascending: true }).order('name', { ascending: true });
      if (availableOnly) q = q.eq('available', true);
      const { data, error } = await q;
      if (error) return err(error.message, 500);
      return json({ menu: (data || []).map(menuToApi) });
    }
    if (path === 'menu' && method === 'POST') {
      const body = await request.json();
      const row = {
        restaurant_id: body.restaurantId,
        name: body.name,
        name_es: body.nameEs || '',
        description: body.description || '',
        price: parseFloat(body.price) || 0,
        category: body.category || 'Mains',
        image: normalizeImage(body.image) || getRandomFoodImage(),
        video_url: String(body.videoUrl || '').trim(),
        available: body.available !== false,
      };
      const { data, error } = await sb.from('menu').insert(row).select('*').single();
      if (error) return err(error.message, 500);
      return json({ item: menuToApi(data) });
    }
    const menuMatch = path.match(/^menu\/([^\/]+)$/);
    if (menuMatch) {
      const id = menuMatch[1];
      if (method === 'PUT') {
        const body = await request.json();
        const upd = {};
        if (body.name !== undefined) upd.name = body.name;
        if (body.description !== undefined) upd.description = body.description;
        if (body.price !== undefined) upd.price = parseFloat(body.price);
        if (body.category !== undefined) upd.category = body.category;
        if (body.image !== undefined) upd.image = normalizeImage(body.image) || getRandomFoodImage();
        if (body.videoUrl !== undefined) upd.video_url = String(body.videoUrl || '').trim();
        if (body.available !== undefined) upd.available = body.available;
        if (body.nameEs !== undefined) upd.name_es = body.nameEs;
        const { error } = await sb.from('menu').update(upd).eq('id', id);
        if (error) return err(error.message, 500);
        return json({ ok: true });
      }
      if (method === 'DELETE') {
        const { error } = await sb.from('menu').delete().eq('id', id);
        if (error) return err(error.message, 500);
        return json({ ok: true });
      }
    }

    // ============ TABLES ============
    if (path === 'tables' && method === 'GET') {
      const url = new URL(request.url);
      const restaurantId = url.searchParams.get('restaurantId');
      const { data, error } = await sb.from('rest_tables').select('*').eq('restaurant_id', restaurantId).order('number', { ascending: true });
      if (error) return err(error.message, 500);
      return json({ tables: (data || []).map(tableToApi) });
    }
    if (path === 'tables' && method === 'POST') {
      const body = await request.json();
      const row = {
        restaurant_id: body.restaurantId,
        number: String(body.number),
        seats: parseInt(body.seats) || 2,
        status: 'available',
      };
      const { data, error } = await sb.from('rest_tables').insert(row).select('*').single();
      if (error) return err(error.message, 500);
      return json({ table: tableToApi(data) });
    }
    const tblMatch = path.match(/^tables\/([^\/]+)$/);
    if (tblMatch) {
      const id = tblMatch[1];
      if (method === 'GET') {
        const { data, error } = await sb.from('rest_tables').select('*').eq('id', id).maybeSingle();
        if (error) return err(error.message, 500);
        if (!data) return err('Not found', 404);
        return json({ table: tableToApi(data) });
      }
      if (method === 'PUT') {
        const body = await request.json();
        const upd = {};
        if (body.number !== undefined) upd.number = String(body.number);
        if (body.seats !== undefined) upd.seats = parseInt(body.seats);
        if (body.status !== undefined) upd.status = body.status;
        const { error } = await sb.from('rest_tables').update(upd).eq('id', id);
        if (error) return err(error.message, 500);
        return json({ ok: true });
      }
      if (method === 'DELETE') {
        const { error } = await sb.from('rest_tables').delete().eq('id', id);
        if (error) return err(error.message, 500);
        return json({ ok: true });
      }
    }

    // ============ ORDERS ============
    if (path === 'orders' && method === 'GET') {
      const url = new URL(request.url);
      const restaurantId = url.searchParams.get('restaurantId');
      const { data, error } = await sb.from('orders').select('*').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }).limit(200);
      if (error) return err(error.message, 500);
      return json({ orders: (data || []).map(orderToApi) });
    }
    if (path === 'orders' && method === 'POST') {
      const body = await request.json();
      const { data: tbl, error: te } = await sb.from('rest_tables').select('*').eq('id', body.tableId).maybeSingle();
      if (te) return err(te.message, 500);
      if (!tbl) return err('Invalid table');
      const items = (body.items || []).map(i => ({ id: i.id, name: i.name, nameEs: i.nameEs || '', price: parseFloat(i.price), qty: parseInt(i.qty) || 1, notes: i.notes || '' }));
      const total = items.reduce((s, i) => s + i.price * i.qty, 0);
      const row = {
        restaurant_id: body.restaurantId,
        table_id: body.tableId,
        table_number: tbl.number,
        items,
        total,
        status: 'pending',
        allergy: body.allergy || '',
        spicy_level: body.spicyLevel || '',
        payment_status: 'unpaid',
        payment_reference: '',
        payment_provider: '',
        payment_method: '',
        payment_vpa: '',
        payment_qr: '',
        payment_created_at: null,
      };
      const { data, error } = await sb.from('orders').insert(row).select('*').single();
      if (error) return err(error.message, 500);
      await sb.from('rest_tables').update({ status: 'occupied' }).eq('id', body.tableId);
      return json({ order: orderToApi(data) });
    }
    const orderMatch = path.match(/^orders\/([^\/]+)$/);
    if (orderMatch) {
      const id = orderMatch[1];
      if (method === 'GET') {
        const { data, error } = await sb.from('orders').select('*').eq('id', id).maybeSingle();
        if (error) return err(error.message, 500);
        if (!data) return err('Not found', 404);
        return json({ order: orderToApi(data) });
      }
      if (method === 'PUT') {
        const body = await request.json();
        const upd = { updated_at: new Date().toISOString() };
        if (body.status) upd.status = body.status;
        if (body.status === 'paid') {
          upd.paid_at = new Date().toISOString();
          upd.payment_status = 'paid';
          const { data: existing } = await sb.from('orders').select('payment_reference,payment_provider,payment_method').eq('id', id).maybeSingle();
          upd.payment_reference = existing?.payment_reference || makeUpiReference();
          upd.payment_provider = existing?.payment_provider || 'manual';
          upd.payment_method = existing?.payment_method || 'cash';
        }
        const { error } = await sb.from('orders').update(upd).eq('id', id);
        if (error) return err(error.message, 500);
        if (body.status === 'paid') {
          const { data: o } = await sb.from('orders').select('table_id').eq('id', id).maybeSingle();
          if (o) await sb.from('rest_tables').update({ status: 'available' }).eq('id', o.table_id);
        }
        return json({ ok: true });
      }
    }
    const addonsMatch = path.match(/^orders\/([^\/]+)\/addons$/);
    if (addonsMatch && method === 'POST') {
      const id = addonsMatch[1];
      const body = await request.json();
      const { data: o, error: ge } = await sb.from('orders').select('*').eq('id', id).maybeSingle();
      if (ge) return err(ge.message, 500);
      if (!o) return err('Not found', 404);
      const items = [...(o.items || [])];
      for (const it of (body.items || [])) {
        const ex = items.find(x => x.id === it.id);
        if (ex) ex.qty += parseInt(it.qty) || 1;
        else items.push({ id: it.id, name: it.name, nameEs: it.nameEs || '', price: parseFloat(it.price), qty: parseInt(it.qty) || 1, notes: it.notes || '' });
      }
      const total = items.reduce((s, i) => s + parseFloat(i.price) * i.qty, 0);
      const newStatus = o.status === 'served' ? 'preparing' : o.status;
      const { data, error } = await sb.from('orders').update({ items, total, status: newStatus, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
      if (error) return err(error.message, 500);
      return json({ order: orderToApi(data) });
    }

    // ============ PAYMENT (DEMO) ============
    if (path === 'payment/demo' && method === 'POST') {
      const { orderId } = await request.json();
      const { data: o, error: ge } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (ge) return err(ge.message, 500);
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
      if (error) return err(error.message, 500);
      await sb.from('rest_tables').update({ status: 'available' }).eq('id', o.table_id);
      return json({ order: orderToApi(data) });
    }

    // ============ PAYMENT (UPI DEMO) ============
    if (path === 'payment/upi/init' && method === 'POST') {
      const { orderId } = await request.json();
      const { data: o, error: ge } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (ge) return err(ge.message, 500);
      if (!o) return err('Order not found', 404);

      const paymentReference = o.payment_reference || makeUpiReference();
      const vpa = o.payment_vpa || DEMO_UPI_VPA;
      const paymentCreatedAt = o.payment_created_at || new Date().toISOString();
      const paymentQr = o.payment_qr || buildUpiUri({
        vpa,
        name: DEMO_UPI_PAYEE,
        amount: toAmount(o.total),
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
      if (error) return err(error.message, 500);
      return json({ order: orderToApi(data), payment: buildUpiPayment(data) });
    }

    if (path === 'payment/upi/status' && method === 'GET') {
      const url = new URL(request.url);
      const orderId = url.searchParams.get('orderId');
      const { data: o, error: ge } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (ge) return err(ge.message, 500);
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
          amount: toAmount(row.total),
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
      if (error) return err(error.message, 500);
      if (settled) {
        await sb.from('rest_tables').update({ status: 'available' }).eq('id', o.table_id);
      }
      return json({ order: orderToApi(data), payment: buildUpiPayment(data) });
    }

    // ============ PAYMENT (UPI DEMO) ============
    if (path === 'payment/upi/init' && method === 'POST') {
      const { orderId } = await request.json();
      const { data: o, error } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (error) return err(error.message, 500);
      if (!o) return err('Order not found', 404);
      const updated = {
        payment_reference: o.payment_reference || makeUpiReference(),
        payment_provider: o.payment_provider || 'demo-upi',
        payment_method: o.payment_method || 'upi',
        payment_vpa: o.payment_vpa || DEMO_UPI_VPA,
        payment_created_at: o.payment_created_at || new Date().toISOString(),
        payment_status: o.payment_status && o.payment_status !== 'unpaid' ? o.payment_status : 'pending',
      };
      if (!o.payment_qr) {
        updated.payment_qr = buildUpiUri({
          vpa: updated.payment_vpa,
          name: DEMO_UPI_PAYEE,
          amount: toAmount(o.total),
          reference: updated.payment_reference,
        });
      }
      const { data, error: ue } = await sb.from('orders').update(updated).eq('id', orderId).select('*').single();
      if (ue) return err(ue.message, 500);
      return json({ order: orderToApi(data), payment: buildUpiPayment(data) });
    }

    if (path === 'payment/upi/status' && method === 'GET') {
      const url = new URL(request.url);
      const orderId = url.searchParams.get('orderId');
      const { data: o, error } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle();
      if (error) return err(error.message, 500);
      if (!o) return err('Order not found', 404);

      let updated = null;
      const createdAt = o.payment_created_at ? new Date(o.payment_created_at).getTime() : 0;
      if (o.payment_status === 'pending' && createdAt && Date.now() - createdAt >= DEMO_UPI_AUTO_SETTLE_MS) {
        updated = {
          payment_status: 'paid',
          status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      let finalRow = o;
      if (updated) {
        const { data, error: ue } = await sb.from('orders').update(updated).eq('id', orderId).select('*').single();
        if (ue) return err(ue.message, 500);
        finalRow = data;
        await sb.from('rest_tables').update({ status: 'available' }).eq('id', finalRow.table_id);
      }

      return json({ order: orderToApi(finalRow), payment: buildUpiPayment(finalRow) });
    }

    // ============ FEEDBACK ============
    if (path === 'feedback' && method === 'POST') {
      const body = await request.json();
      const row = {
        restaurant_id: body.restaurantId,
        table_id: body.tableId,
        order_id: body.orderId,
        rating: parseInt(body.rating) || null,
        comment: body.comment || '',
      };
      const { error } = await sb.from('feedback').insert(row);
      if (error) return err(error.message, 500);
      return json({ ok: true });
    }

    // ============ SUPPORT MESSAGES ============
    if (path === 'support' && method === 'GET') {
      const url = new URL(request.url);
      const restaurantId = url.searchParams.get('restaurantId');
      let query = sb.from('support_messages').select('*').order('created_at', { ascending: true });
      if (restaurantId) query = query.eq('restaurant_id', restaurantId);
      const { data, error } = await query;
      if (error) return err(error.message, 500);
      return json({ messages: data || [] });
    }
    if (path === 'support' && method === 'POST') {
      const body = await request.json();
      const row = {
        restaurant_id: body.restaurantId,
        sender: body.sender || 'restaurant',
        message: body.message,
      };
      const { data, error } = await sb.from('support_messages').insert(row).select('*').single();
      if (error) return err(error.message, 500);
      return json({ message: data });
    }

    // ============ ANALYTICS (manager) ============
    if (path === 'analytics' && method === 'GET') {
      const url = new URL(request.url);
      const restaurantId = url.searchParams.get('restaurantId');
      const { data: all, error } = await sb.from('orders').select('*').eq('restaurant_id', restaurantId).neq('status', 'cancelled');
      if (error) return err(error.message, 500);
      const orders = (all || []);
      const today = new Date(); today.setHours(0,0,0,0);
      const todays = orders.filter(o => new Date(o.created_at) >= today);
      const todayRevenue = todays.reduce((s,o)=>s+parseFloat(o.total),0);
      const todayOrders = todays.length;
      const avgTicket = todayOrders ? todayRevenue / todayOrders : 0;
      const itemMap = {};
      orders.forEach(o => (o.items || []).forEach(i => {
        const k = i.name;
        itemMap[k] = itemMap[k] || { name: k, count: 0, revenue: 0 };
        itemMap[k].count += i.qty;
        itemMap[k].revenue += i.qty * parseFloat(i.price);
      }));
      const topItems = Object.values(itemMap).sort((a,b)=>b.revenue-a.revenue).slice(0,10);
      const byHourMap = {};
      for (let h = 0; h < 24; h++) byHourMap[h] = { hour: `${String(h).padStart(2,'0')}h`, orders: 0 };
      todays.forEach(o => { const h = new Date(o.created_at).getHours(); byHourMap[h].orders += 1; });
      const byHour = Object.values(byHourMap);
      const last7 = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
        const next = new Date(d); next.setDate(next.getDate()+1);
        const rev = orders.filter(o => new Date(o.created_at) >= d && new Date(o.created_at) < next).reduce((s,o)=>s+parseFloat(o.total),0);
        last7.push({ date: d.toLocaleDateString('en-US',{month:'short',day:'numeric'}), revenue: Math.round(rev*100)/100 });
      }
      return json({ todayRevenue, todayOrders, avgTicket, topItems, byHour, last7 });
    }

    // ============ CENTRAL STATS ============
    if (path === 'central/stats' && method === 'GET') {
      const { data: restaurants } = await sb.from('restaurants').select('*');
      const { data: orders } = await sb.from('orders').select('*').neq('status', 'cancelled');
      const totalRevenue = (orders || []).reduce((s,o)=>s+parseFloat(o.total),0);
      const planPrice = { Starter: 49, Pro: 99, Premium: 199, Enterprise: 499 };
      const mrr = (restaurants || []).reduce((s,r)=>s+(planPrice[r.subscription]||0),0);
      const byPlanMap = {};
      (restaurants || []).forEach(r => { byPlanMap[r.subscription] = (byPlanMap[r.subscription]||0)+1; });
      const byPlan = Object.entries(byPlanMap).map(([name,value])=>({ name, value }));
      const trend = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
        const next = new Date(d); next.setDate(next.getDate()+1);
        const rev = (orders || []).filter(o => new Date(o.created_at) >= d && new Date(o.created_at) < next).reduce((s,o)=>s+parseFloat(o.total),0);
        trend.push({ date: d.toLocaleDateString('en-US',{month:'short',day:'numeric'}), revenue: Math.round(rev*100)/100 });
      }
      return json({ totalRestaurants: (restaurants || []).length, totalRevenue, totalOrders: (orders || []).length, mrr, byPlan, trend });
    }

    // ============ AI WAITER CHAT (LOCAL NLU — NO EXTERNAL API) ============
    if (path === 'chat' && method === 'POST') {
      const body = await request.json();
      const { sessionId, restaurantId, tableId, language = 'en', message = '', menu = [], cart = [], allergy = '', spicy = '', notes = '', stage = 'browsing' } = body;
      const { data: restaurant } = await sb.from('restaurants').select('name').eq('id', restaurantId).maybeSingle();
      const { data: session } = await sb.from('chat_sessions').select('*').eq('session_id', sessionId).maybeSingle();
      const history = (session?.history || []);

      const { reply, actions } = nluRespond({
        message, menu, cart, allergy, spicy, notes, stage,
        restaurantName: restaurant?.name, history, language,
      });

      const newHistory = [...history, { role: 'user', content: message }, { role: 'assistant', content: reply }].slice(-30);
      await sb.from('chat_sessions').upsert({ session_id: sessionId, restaurant_id: restaurantId, table_id: tableId, history: newHistory, updated_at: new Date().toISOString() }, { onConflict: 'session_id' });
      return json({ reply, actions });
    }

    // ============ HEALTH ============
    if (path === '' || path === 'health') {
      // Quick check: can we hit Supabase?
      const { error } = await sb.from('users').select('user_id').limit(1);
      return json({ status: 'ok', service: 'netrik-shop', db: error ? `error: ${error.message}` : 'supabase-ok', time: new Date().toISOString() });
    }

    return err(`Not found: /${path}`, 404);
  } catch (e) {
    console.error('API error', e);
    return err(e.message || 'Server error', 500);
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
