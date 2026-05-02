import { createClient } from '@supabase/supabase-js';

const url =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

let cached = global._supabase;
if (!cached) {
  cached = global._supabase = { client: null };
}

export function getSupabase() {
  if (!url || !key) {
    throw new Error('Supabase env is missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY).');
  }
  if (!cached.client) {
    cached.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'X-Client-Info': 'netrik-shop' } },
    });
  }
  return cached.client;
}

// ---------- Field mappers ----------
// DB uses snake_case; API uses camelCase + nested creds for restaurants.

export const restaurantToApi = (r) => r ? ({
  id: r.id,
  name: r.name,
  ownerName: r.owner_name,
  email: r.email || '',
  contact: r.contact,
  address: r.address || '',
  domain: r.domain || '',
  logoUrl: r.logo_url || '',
  subscription: r.subscription,
  managerCreds: { userId: r.manager_user_id, password: r.manager_password },
  chefCreds:    { userId: r.chef_user_id,    password: r.chef_password },
  createdAt: r.created_at,
  updatedAt: r.updated_at || null,
}) : null;

export const menuToApi = (m) => m ? ({
  id: m.id, restaurantId: m.restaurant_id, name: m.name, nameEs: m.name_es || '',
  description: m.description || '', price: parseFloat(m.price), category: m.category, image: m.image || '',
  videoUrl: m.video_url || '',
  available: m.available, createdAt: m.created_at,
}) : null;

export const tableToApi = (t) => t ? ({
  id: t.id, restaurantId: t.restaurant_id, number: t.number, seats: t.seats, status: t.status,
  createdAt: t.created_at,
}) : null;

export const orderToApi = (o) => o ? ({
  id: o.id, restaurantId: o.restaurant_id, tableId: o.table_id, tableNumber: o.table_number,
  items: (o.items || []).map(it => ({ ...it, price: parseFloat(it.price) })),
  total: parseFloat(o.total), status: o.status, allergy: o.allergy || '', spicyLevel: o.spicy_level || '',
  paidAt: o.paid_at,
  paymentStatus: o.payment_status || (o.status === 'paid' ? 'paid' : 'unpaid'),
  paymentReference: o.payment_reference || '',
  paymentProvider: o.payment_provider || '',
  paymentMethod: o.payment_method || '',
  paymentVpa: o.payment_vpa || '',
  paymentQr: o.payment_qr || '',
  paymentCreatedAt: o.payment_created_at || null,
  createdAt: o.created_at, updatedAt: o.updated_at || null,
}) : null;
