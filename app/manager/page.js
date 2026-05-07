'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  LogOut,
  BarChart3,
  ClipboardList,
  UtensilsCrossed,
  Table2,
  ChefHat,
  Plus,
  Trash2,
  Pencil,
  Printer,
  DollarSign,
  TrendingUp,
  Download,
  Clock,
  CheckCircle2,
  MessageCircle,
  MessageSquare,
  Upload,
  Shuffle,
  Send,
  AlertTriangle,
  Flame,
  FileText,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { NetrikLogo } from '@/components/netrik-logo';
import LoadingLogo from '@/components/loading-logo';

const CATEGORIES = ['Starters', 'Mains', 'Desserts', 'Drinks', 'Specials'];
const FOOD_IMG = 'https://images.pexels.com/photos/35420084/pexels-photo-35420084.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';
const MOOD_PRESETS = ['light', 'hearty', 'comfort', 'indulgent', 'energizing', 'romantic', 'celebratory', 'cozy', 'refreshing', 'adventurous'];
const TASTE_PRESETS = ['tangy', 'sweet', 'savory', 'spicy', 'rich', 'smoky', 'fresh', 'umami', 'sour', 'bitter', 'crispy', 'creamy', 'buttery', 'zesty'];
const DIETARY_PRESETS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'halal', 'kosher', 'keto', 'low-carb', 'high-protein', 'jain'];
const BRAND_LOGO_PATH = '/brand/original/netrikshop%20update%20logo.png';

function TagPicker({ label, hint, value, onChange, presets, accent = 'emerald' }) {
  const tags = Array.isArray(value) ? value : [];
  const [draft, setDraft] = useState('');
  const accentMap = {
    emerald: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    rose: 'bg-rose-50 text-rose-800 border-rose-200',
    neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  };
  const cls = accentMap[accent] || accentMap.emerald;
  const norm = (s) => String(s || '').trim().toLowerCase().slice(0, 24);
  const add = (raw) => {
    const t = norm(raw);
    if (!t || tags.includes(t) || tags.length >= 8) return;
    onChange([...tags, t]);
  };
  const remove = (t) => onChange(tags.filter((x) => x !== t));
  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
      setDraft('');
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      remove(tags[tags.length - 1]);
    }
  };
  return (
    <div>
      <Label className="text-xs font-semibold">{label}</Label>
      {hint && <div className="text-[11px] text-neutral-500 mt-0.5 mb-1.5">{hint}</div>}
      <div className="rounded-xl border border-neutral-200 bg-white p-2 min-h-[42px] flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span key={t} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
            {t}
            <button type="button" onClick={() => remove(t)} className="opacity-60 hover:opacity-100">×</button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => { if (draft.trim()) { add(draft); setDraft(''); } }}
          placeholder={tags.length === 0 ? 'Type & Enter…' : ''}
          className="flex-1 min-w-[80px] bg-transparent text-sm focus:outline-none placeholder:text-neutral-400"
        />
      </div>
      {presets && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.filter((p) => !tags.includes(p)).slice(0, 12).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => add(p)}
              className="rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-[10px] text-neutral-600 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 transition"
            >
              + {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
const RANDOM_MENU_IMAGES = [
  'https://images.unsplash.com/photo-1544025162-811114bd020f?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1000&q=80',
];

export default function ManagerDashboard() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [tab, setTab] = useState('analytics');
  const [clock, setClock] = useState(() => new Date());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [kitchenLanguage, setKitchenLanguage] = useState('both');

  const [menu, setMenu] = useState([]);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState({ todayRevenue: 0, todayOrders: 0, avgTicket: 0, topItems: [], byHour: [], last7: [] });

  const [menuOpen, setMenuOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', category: 'Mains', image: FOOD_IMG, videoUrl: '', available: true });
  const [tableOpen, setTableOpen] = useState(false);
  const [tableForm, setTableForm] = useState({ number: '', seats: 2 });
  const [tableQr, setTableQr] = useState(null);

  const [supportOpen, setSupportOpen] = useState(false);
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportText, setSupportText] = useState('');

  const getRandomImage = () => RANDOM_MENU_IMAGES[Math.floor(Math.random() * RANDOM_MENU_IMAGES.length)];

  const applyMenuImageFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setItemForm((prev) => ({ ...prev, image: String(reader.result || '') }));
      toast.success('Image attached');
    };
    reader.onerror = () => toast.error('Failed to read image');
    reader.readAsDataURL(file);
  };

  const onMenuImageUpload = (e) => applyMenuImageFile(e.target.files?.[0]);

  const onMenuImagePaste = async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    applyMenuImageFile(imageItem.getAsFile());
  };

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('netrik_user') || 'null');
    if (!u || u.type !== 'manager') { router.push('/login'); return; }
    setMe(u);
    loadAll(u);
    const clockId = setInterval(() => setClock(new Date()), 1000);
    const pollId = u?.demoMode ? setInterval(() => loadAll(u, true), 5000) : null;
    let channel;
    if (u) {
      import('@/lib/supabase').then(({ getSupabase }) => {
        const sb = getSupabase();
        if (sb) {
          channel = sb.channel('manager-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${u.restaurantId}` }, () => loadAll(u, true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rest_tables', filter: `restaurant_id=eq.${u.restaurantId}` }, () => loadAll(u, true))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `restaurant_id=eq.${u.restaurantId}` }, (payload) => {
              setSupportMessages((prev) => [...prev, payload.new].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_messages', filter: `restaurant_id=eq.${u.restaurantId}` }, () => loadAll(u, true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu', filter: `restaurant_id=eq.${u.restaurantId}` }, () => loadAll(u, true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants', filter: `id=eq.${u.restaurantId}` }, () => loadAll(u, true))
            .subscribe();
        }
      });
    }

    return () => {
      clearInterval(clockId);
      if (pollId) clearInterval(pollId);
      if (channel) channel.unsubscribe();
    };
  }, [router]);

  const loadAll = async (u, silent = false) => {
    if (!u) return;
    const [r, m, t, o, a, sm] = await Promise.all([
      fetch(`/api/restaurants/${u.restaurantId}`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`/api/menu?restaurantId=${u.restaurantId}`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`/api/tables?restaurantId=${u.restaurantId}`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`/api/orders?restaurantId=${u.restaurantId}`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`/api/analytics?restaurantId=${u.restaurantId}`, { cache: 'no-store' }).then((r) => r.json()),
      fetch(`/api/support?restaurantId=${u.restaurantId}`, { cache: 'no-store' }).then((r) => r.json()),
    ]);
    setRestaurant(r.restaurant);
    setMenu(m.menu || []);
    setTables(t.tables || []);
    setOrders(o.orders || []);
    setAnalytics(a || {});
    setSupportMessages(sm.messages || []);
  };

  const saveItem = async () => {
    if (!itemForm.name || !itemForm.price) return toast.error('Name & price required');
    const body = { ...itemForm, price: parseFloat(itemForm.price), restaurantId: me.restaurantId };
    const url = editingItem ? `/api/menu/${editingItem.id}` : '/api/menu';
    const method = editingItem ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) return toast.error('Failed');
    toast.success(editingItem ? 'Item updated' : 'Item added');
    setMenuOpen(false);
    setEditingItem(null);
    setItemForm({ name: '', description: '', price: '', category: 'Mains', image: FOOD_IMG, videoUrl: '', available: true, moodTags: [], tasteTags: [], dietaryTags: [] });
    loadAll(me);
  };

  const toggleAvail = async (item) => {
    await fetch(`/api/menu/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...item, available: !item.available }) });
    loadAll(me);
  };

  const removeItem = async (item) => {
    if (!confirm(`Delete ${item.name}?`)) return;
    await fetch(`/api/menu/${item.id}`, { method: 'DELETE' });
    loadAll(me);
  };

  const addTable = async () => {
    if (!tableForm.number) return toast.error('Enter table number');
    const res = await fetch('/api/tables', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...tableForm, restaurantId: me.restaurantId }) });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Failed');
    toast.success('Table added');
    setTableOpen(false);
    setTableForm({ number: '', seats: 2 });
    loadAll(me);
  };

  const removeTable = async (t) => {
    if (!confirm(`Delete table ${t.number}?`)) return;
    await fetch(`/api/tables/${t.id}`, { method: 'DELETE' });
    loadAll(me);
  };

  const setTableStatus = async (t, status) => {
    await fetch(`/api/tables/${t.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    loadAll(me);
  };

  const setOrderStatus = async (o, status) => {
    await fetch(`/api/orders/${o.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    loadAll(me);
  };

  const sendSupportMsg = async () => {
    if (!supportText) return;
    const res = await fetch('/api/support', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: me.restaurantId, sender: 'restaurant', message: supportText }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(data.error || 'Failed to send');
    setSupportText('');
    loadAll(me);
  };

  const toRange = (value, endOfDay = false) => {
    if (!value) return null;
    const d = new Date(value);
    if (endOfDay) d.setHours(23, 59, 59, 999);
    else d.setHours(0, 0, 0, 0);
    return d;
  };

  const orderInRange = (order, start, end) => {
    const ts = new Date(order.createdAt);
    const s = toRange(start, false);
    const e = toRange(end, true);
    if (s && ts < s) return false;
    if (e && ts > e) return false;
    return true;
  };

  const filteredOrders = useMemo(() => orders.filter((o) => orderInRange(o, startDate, endDate)), [orders, startDate, endDate]);

  const downloadCSV = (dataRows = orders, filenamePrefix = 'orders') => {
    const brandLogoUrl = new URL(BRAND_LOGO_PATH, window.location.origin).toString();
    const csvRows = [['Netrik Logo', 'Date', 'Order #', 'Table', 'Items', 'Total', 'Status']];
    dataRows.forEach((o) => {
      csvRows.push([brandLogoUrl, new Date(o.createdAt).toLocaleString(), o.id.slice(0, 8), o.tableNumber, o.items.map((i) => `${i.qty}x ${i.name}`).join('; '), o.total.toFixed(2), o.status]);
    });
    const csv = csvRows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printOrdersA4 = (rows = orders, title = 'Orders Report') => {
    const w = window.open('', '_blank');
    if (!w) return;
    const brandLogoUrl = new URL(BRAND_LOGO_PATH, window.location.origin).toString();
    const itemsToText = (items = []) => items.map((i) => `${i.qty}x ${i.name}`).join(', ');
    const bodyRows = rows.map((o) => `
      <tr>
        <td>${new Date(o.createdAt).toLocaleString()}</td>
        <td>${o.id.slice(0, 8)}</td>
        <td>${o.tableNumber}</td>
        <td>${itemsToText(o.items)}</td>
        <td>$${o.total.toFixed(2)}</td>
        <td>${o.status}</td>
      </tr>`).join('');

    w.document.write(`<html><head><title>${title}</title><style>
      @page{size:A4;margin:14mm}
      body{font-family:Inter,Segoe UI,Arial,sans-serif;color:#0a0a0a}
      .brand{display:flex;align-items:center;gap:12px;margin:0 0 10px}
      .brand img{height:40px;width:auto;display:block}
      h1{font-size:18px;margin:0;font-weight:700}
      p{color:#525252;font-size:12px;margin:6px 0 14px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border-bottom:1px solid #e5e7eb;padding:8px;vertical-align:top;text-align:left}
      th{background:#fafafa;text-transform:uppercase;font-size:10px;letter-spacing:.06em;color:#525252}
    </style></head><body>
      <div class="brand">
        <img src="${brandLogoUrl}" alt="Netrik Shop" />
        <div>
          <h1>${restaurant?.name || 'Restaurant'} · ${title}</h1>
          <div style="color:#6b7280;font-size:11px;letter-spacing:.2em;text-transform:uppercase">Powered by Netrik</div>
        </div>
      </div>
      <p>Printed: ${new Date().toLocaleString()} · Rows: ${rows.length}</p>
      <table>
        <thead><tr><th>Date</th><th>Order</th><th>Table</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
        <tbody>${bodyRows || '<tr><td colspan="6">No rows found</td></tr>'}</tbody>
      </table>
      <script>window.onload=()=>window.print()</script>
    </body></html>`);
    w.document.close();
  };

  const downloadReceipt = (order) => {
    if (!order) return;
    const brandLogoUrl = new URL(BRAND_LOGO_PATH, window.location.origin).toString();
    const details = [
      order.paymentReference ? `Reference: ${order.paymentReference}` : '',
      order.paymentProvider ? `Provider: ${order.paymentProvider}` : '',
      order.paymentMethod ? `Method: ${order.paymentMethod}` : '',
      order.paymentVpa ? `VPA: ${order.paymentVpa}` : '',
    ].filter(Boolean);
    const itemsHtml = (order.items || []).map((i) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px dashed #e5e7eb;">${i.qty}x</td>
        <td style="padding:8px 0;border-bottom:1px dashed #e5e7eb;">${i.name}</td>
        <td style="padding:8px 0;border-bottom:1px dashed #e5e7eb;text-align:right;">$${(i.price * i.qty).toFixed(2)}</td>
      </tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Receipt ${order.id.slice(0, 8)}</title>
      <style>
        body{font-family:Inter,Segoe UI,Arial,sans-serif;padding:28px;color:#0a0a0a}
        .brand{display:flex;align-items:center;gap:12px;margin-bottom:16px}
        .brand img{height:36px;width:auto}
        h1{font-size:18px;margin:0}
        .meta{color:#6b7280;font-size:12px;margin-top:4px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}
        th{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;text-align:left;padding-bottom:6px}
        td{vertical-align:top}
        .total{font-size:16px;font-weight:700;margin-top:12px;text-align:right}
      </style>
    </head><body>
      <div class="brand">
        <img src="${brandLogoUrl}" alt="Netrik Shop" />
        <div>
          <h1>${restaurant?.name || 'Restaurant'} Receipt</h1>
          <div class="meta">Order ${order.id.slice(0, 8).toUpperCase()} · Table ${order.tableNumber}</div>
        </div>
      </div>
      <div class="meta">Status: ${order.status} · Payment: ${order.paymentStatus || 'unpaid'}</div>
      <div class="meta">Created: ${new Date(order.createdAt).toLocaleString()}</div>
      ${details.length ? details.map((d) => `<div class="meta">${d}</div>`).join('') : ''}
      <table>
        <thead><tr><th>Qty</th><th>Item</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>${itemsHtml || '<tr><td colspan="3">No items</td></tr>'}</tbody>
      </table>
      <div class="total">Total: $${order.total.toFixed(2)}</div>
      <div class="meta" style="margin-top:8px;">Powered by Netrik Shop</div>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${order.id.slice(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setTodayRange = () => {
    const today = new Date().toISOString().slice(0, 10);
    setStartDate(today);
    setEndDate(today);
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const tableUrl = (t) => `${baseUrl}/order/${t.id}`;

  const printQR = (t) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const brandLogoUrl = new URL(BRAND_LOGO_PATH, window.location.origin).toString();
    w.document.write(`<html><head><title>Table ${t.number} QR</title><style>body{font-family:Inter,system-ui;text-align:center;padding:48px;color:#0a0a0a}h1{font-size:30px;margin:0;font-weight:700;letter-spacing:-.02em}</style></head><body>
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px;margin-bottom:12px;">
        <img src="${brandLogoUrl}" alt="Netrik Shop" style="height:42px;width:auto;" />
        <div style="color:#525252;font-size:12px;letter-spacing:.2em;text-transform:uppercase">Powered by Netrik</div>
      </div>
      <h1>${restaurant?.name || ''}</h1>
      <h2 style="margin:24px 0 6px;font-weight:600">Table ${t.number}</h2>
      <p style="color:#666">Scan to order</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(tableUrl(t))}" style="margin:16px auto"/>
      <p style="color:#777;font-size:12px;">${tableUrl(t)}</p>
      <script>window.onload=()=>window.print()</script>
    </body></html>`);
  };

  if (!me || !restaurant) {
    return (
      <div className="min-h-screen grid place-items-center bg-white text-neutral-500 text-sm">
        <div className="flex flex-col items-center gap-3">
          <LoadingLogo className="h-12 w-12" alt="Loading dashboard" />
          <div>Loading dashboard…</div>
        </div>
      </div>
    );
  }

  const pendingOrders = orders.filter((o) => ['pending', 'preparing'].includes(o.status));
  const liveOrders = orders.filter((o) => o.status !== 'paid' && o.status !== 'cancelled');
  const unreadSupport = supportMessages.filter((m) => m.sender === 'central' && !m.read).length;

  const TABS = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'orders', label: 'Orders', icon: ClipboardList },
    { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
    { id: 'tables', label: 'Tables', icon: Table2 },
    { id: 'kitchen', label: 'Kitchen', icon: ChefHat },
  ];

  return (
    <div className="min-h-screen bg-neutral-50/40 text-neutral-900">
      <header className="border-b border-neutral-200/80 sticky top-0 bg-white/85 backdrop-blur-xl z-30">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-[5.5rem] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {restaurant.logoUrl ? (
              <img src={restaurant.logoUrl} alt={restaurant.name} className="h-11 w-11 rounded-xl border border-neutral-200 object-cover" />
            ) : (
              <NetrikLogo className="h-12 w-auto" />
            )}
            <div className="min-w-0">
              <div className="font-bold tracking-tight truncate">{restaurant.name}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-700/80 font-semibold">
                Manager · {me.userId}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden lg:flex h-9 items-center rounded-full border border-neutral-200 bg-white px-3 text-xs text-neutral-700 font-medium">
              <Clock className="h-3.5 w-3.5 mr-1.5 text-neutral-400" />
              {clock.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })}
            </div>

            <Button
              size="sm"
              variant="outline"
              className="rounded-full h-9 border-neutral-200 hover:bg-neutral-50 relative hidden md:inline-flex"
              onClick={() => setSupportOpen(true)}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Support
              {unreadSupport > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white border-2 border-white">
                  {unreadSupport}
                </span>
              )}
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="md:hidden rounded-full h-9 w-9 p-0 border-neutral-200 hover:bg-neutral-50 relative"
              onClick={() => setSupportOpen(true)}
            >
              <MessageSquare className="h-4 w-4" />
              {unreadSupport > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white border-2 border-white">
                  {unreadSupport}
                </span>
              )}
            </Button>

            <Button asChild size="sm" variant="outline" className="hidden xl:inline-flex rounded-full h-9 border-neutral-200 hover:bg-neutral-50">
              <a href="https://wa.me/16562145190?text=Hi%20Netrik%20Support%2C%20I%20need%20help%20with%20my%20restaurant%20dashboard" target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4 mr-2" />WhatsApp
              </a>
            </Button>

            <div className="hidden sm:flex h-9 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs text-emerald-800 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 mr-2 netrik-pulse" /> Live
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
              onClick={() => { localStorage.removeItem('netrik_user'); router.push('/login'); }}
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-6 md:py-8">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          {/* Custom mobile-friendly tab bar */}
          <div className="overflow-x-auto -mx-5 md:-mx-0 px-5 md:px-0 hide-scrollbar">
            <TabsList className="bg-neutral-100/80 border border-neutral-200/80 rounded-full inline-flex h-11 p-1 w-auto md:w-full md:max-w-2xl md:mx-auto md:grid md:grid-cols-5">
              {TABS.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="h-9 rounded-full px-4 text-sm font-semibold text-neutral-600 data-[state=active]:bg-emerald-700 data-[state=active]:text-white data-[state=active]:shadow whitespace-nowrap"
                >
                  <t.icon className="h-4 w-4 mr-1.5" />
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Analytics */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="rounded-2xl bg-white border border-neutral-200/80 p-4 md:p-5">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="text-xs font-semibold text-neutral-700">Start date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1.5 w-[170px] bg-white border-neutral-200" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-neutral-700">End date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1.5 w-[170px] bg-white border-neutral-200" />
                </div>
                <Button size="sm" variant="outline" className="rounded-full border-neutral-200 hover:bg-neutral-50" onClick={setTodayRange}>Today</Button>
                <Button size="sm" variant="outline" className="rounded-full border-neutral-200 hover:bg-neutral-50" onClick={() => { setStartDate(''); setEndDate(''); }}>Clear</Button>
                <Button size="sm" variant="outline" className="rounded-full border-neutral-200 hover:bg-neutral-50" onClick={() => downloadCSV(filteredOrders, 'orders-range')}><Download className="h-4 w-4 mr-1.5" />CSV</Button>
                <Button size="sm" variant="outline" className="rounded-full border-neutral-200 hover:bg-neutral-50" onClick={() => printOrdersA4(filteredOrders, 'Orders Report (A4)')}><Printer className="h-4 w-4 mr-1.5" />Print A4</Button>
                <div className="text-xs text-neutral-500 ml-auto">Rows in range: <span className="font-semibold text-neutral-800">{filteredOrders.length}</span></div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { i: DollarSign, t: "Today's revenue", v: `$${analytics.todayRevenue?.toFixed(2) || '0.00'}` },
                { i: ClipboardList, t: "Today's orders", v: analytics.todayOrders || 0 },
                { i: TrendingUp, t: 'Avg ticket', v: `$${analytics.avgTicket?.toFixed(2) || '0.00'}` },
                { i: Table2, t: 'Active tables', v: tables.filter((t) => t.status === 'occupied').length + '/' + tables.length },
              ].map((c) => (
                <div key={c.t} className="rounded-2xl bg-white border border-neutral-200/80 p-5">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 grid place-items-center mb-3">
                    <c.i className="h-4.5 w-4.5" />
                  </div>
                  <div className="text-2xl md:text-3xl font-extrabold tabular-nums tracking-tight">{c.v}</div>
                  <div className="text-[11px] uppercase tracking-widest text-neutral-500 font-medium mt-1">{c.t}</div>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl bg-white border border-neutral-200/80 p-5 md:p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <div className="font-display font-bold text-lg tracking-tight">Revenue · last 7 days</div>
                    <div className="text-xs text-neutral-500 mt-0.5">Daily totals across all orders</div>
                  </div>
                  <Button variant="outline" className="rounded-full h-9 border-neutral-200 hover:bg-neutral-50" size="sm" onClick={() => downloadCSV(filteredOrders, 'orders-range')}>
                    <Download className="h-4 w-4 mr-1.5" />CSV
                  </Button>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={analytics.last7 || []}>
                    <CartesianGrid stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      itemStyle={{ color: '#0a0a0a', fontSize: 12 }}
                      labelStyle={{ color: '#525252', fontSize: 11 }}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#047857" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-2xl bg-white border border-neutral-200/80 p-5 md:p-6">
                <div className="font-display font-bold text-lg tracking-tight mb-1">Top items</div>
                <div className="text-xs text-neutral-500 mb-4">Best sellers by revenue</div>
                <div className="space-y-3">
                  {(analytics.topItems || []).slice(0, 5).map((i, idx) => (
                    <div key={i.name} className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-xs font-bold tabular-nums">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{i.name}</div>
                        <div className="text-xs text-neutral-500">{i.count} orders</div>
                      </div>
                      <div className="text-sm font-bold text-emerald-800 tabular-nums">${i.revenue.toFixed(2)}</div>
                    </div>
                  ))}
                  {(!analytics.topItems || analytics.topItems.length === 0) && (
                    <div className="text-sm text-neutral-400 text-center py-4">No data yet</div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white border border-neutral-200/80 p-5 md:p-6">
              <div className="font-display font-bold text-lg tracking-tight mb-1">Orders by hour</div>
              <div className="text-xs text-neutral-500 mb-4">Today's distribution</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics.byHour || []}>
                  <CartesianGrid stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="hour" stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a3a3a3" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12 }} />
                  <Bar dataKey="orders" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          {/* Orders */}
          <TabsContent value="orders" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-neutral-600">
                <span className="font-semibold text-neutral-900">{liveOrders.length}</span> live orders
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="rounded-full border-neutral-200 hover:bg-neutral-50" onClick={() => downloadCSV(filteredOrders, 'orders-range')}>
                  <Download className="h-4 w-4 mr-1.5" />CSV
                </Button>
                <Button variant="outline" size="sm" className="rounded-full border-neutral-200 hover:bg-neutral-50" onClick={() => printOrdersA4(filteredOrders, 'Orders Report (A4)')}>
                  <Printer className="h-4 w-4 mr-1.5" />Print A4
                </Button>
              </div>
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              {orders.length === 0 && (
                <div className="lg:col-span-2 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center text-neutral-500">
                  No orders yet — customers will scan a table QR to place orders.
                </div>
              )}
              {orders.map((o) => (
                <div key={o.id} className="rounded-2xl bg-white border border-neutral-200/80 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-400">
                        Order #{o.id.slice(0, 8)}
                      </div>
                      <div className="font-display text-xl font-bold tracking-tight mt-0.5">Table {o.tableNumber}</div>
                    </div>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <div className="mt-3 space-y-1 text-sm">
                    {o.items.map((i, idx) => (
                      <div key={idx} className="flex justify-between gap-3">
                        <span className="truncate">
                          <span className="font-semibold tabular-nums">{i.qty}×</span> {i.name}
                          {i.notes ? <span className="text-neutral-500"> ({i.notes})</span> : ''}
                        </span>
                        <span className="text-neutral-600 tabular-nums shrink-0">${(i.price * i.qty).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  {(o.allergy || o.spicyLevel) && (
                    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                      {o.allergy && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5">
                          <AlertTriangle className="h-3 w-3" />Allergy: {o.allergy}
                        </span>
                      )}
                      {o.spicyLevel && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 px-2 py-0.5">
                          <Flame className="h-3 w-3" />Spice: {o.spicyLevel}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-2 text-xs text-neutral-500">
                    Payment:{' '}
                    <span className={o.paymentStatus === 'paid' ? 'text-emerald-700 font-semibold' : o.paymentStatus === 'failed' ? 'text-rose-700 font-semibold' : 'text-amber-700 font-semibold'}>
                      {o.paymentStatus || 'unpaid'}
                    </span>
                    {o.paymentReference ? <span className="text-neutral-400"> · Ref {o.paymentReference}</span> : ''}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
                    <div className="font-bold text-lg text-emerald-800 tabular-nums">${o.total.toFixed(2)}</div>
                    <div className="flex gap-2">
                      {o.status === 'pending' && (
                        <Button size="sm" onClick={() => setOrderStatus(o, 'preparing')} className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white">
                          Accept
                        </Button>
                      )}
                      {o.status === 'preparing' && (
                        <Button size="sm" onClick={() => setOrderStatus(o, 'ready')} className="rounded-full bg-neutral-900 hover:bg-neutral-800 text-white">
                          Ready
                        </Button>
                      )}
                      {o.status === 'ready' && (
                        <Button size="sm" onClick={() => setOrderStatus(o, 'served')} className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white">
                          Served
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-neutral-400">
                    <span>{new Date(o.createdAt).toLocaleTimeString()}</span>
                    <button onClick={() => downloadReceipt(o)} className="text-emerald-700 hover:text-emerald-800 font-semibold">
                      Download bill
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Menu */}
          <TabsContent value="menu" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-neutral-600">
                <span className="font-semibold text-neutral-900">{menu.length}</span> items ·{' '}
                <span className="font-semibold text-emerald-700">{menu.filter((m) => m.available).length}</span> available
              </div>
              <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingItem(null);
                      setItemForm({ name: '', description: '', price: '', category: 'Mains', image: FOOD_IMG, videoUrl: '', available: true });
                    }}
                    className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />Add item
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
                  <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
                    <DialogTitle className="font-display tracking-tight">
                      {editingItem ? 'Edit item' : 'New menu item'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 px-6 py-2 overflow-y-auto flex-1 min-h-0">
                    <div>
                      <Label className="text-xs font-semibold">Name *</Label>
                      <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} className="mt-1.5 bg-white border-neutral-200" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Description</Label>
                      <Textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} className="mt-1.5 bg-white border-neutral-200" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold">Price ($) *</Label>
                        <Input type="number" step="0.01" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} className="mt-1.5 bg-white border-neutral-200" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Category</Label>
                        <Select value={itemForm.category} onValueChange={(v) => setItemForm({ ...itemForm, category: v })}>
                          <SelectTrigger className="mt-1.5 bg-white border-neutral-200"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-white">{CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Image URL</Label>
                      <Input
                        value={itemForm.image}
                        onChange={(e) => setItemForm({ ...itemForm, image: e.target.value })}
                        onPaste={onMenuImagePaste}
                        placeholder="Paste URL or press Ctrl+V after copying image"
                        className="mt-1.5 bg-white border-neutral-200"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <label className="inline-flex h-9 cursor-pointer items-center rounded-full border border-neutral-200 bg-white px-3.5 text-xs text-neutral-700 hover:bg-neutral-50 font-semibold">
                          <Upload className="h-3.5 w-3.5 mr-1.5" />Upload from PC
                          <input type="file" accept="image/*" className="hidden" onChange={onMenuImageUpload} />
                        </label>
                        <Button type="button" size="sm" variant="outline" className="rounded-full h-9 border-neutral-200 hover:bg-neutral-50" onClick={() => setItemForm((prev) => ({ ...prev, image: getRandomImage() }))}>
                          <Shuffle className="h-3.5 w-3.5 mr-1.5" />Random
                        </Button>
                      </div>
                    </div>
                    {itemForm.image && (
                      <div className="rounded-xl border border-neutral-200 p-2 bg-neutral-50/40">
                        <img src={itemForm.image} alt="Preview" className="h-32 w-full rounded-lg object-cover" />
                      </div>
                    )}
                    <div>
                      <Label className="text-xs font-semibold">Video URL (optional)</Label>
                      <Input value={itemForm.videoUrl} onChange={(e) => setItemForm({ ...itemForm, videoUrl: e.target.value })} placeholder="https://...mp4" className="mt-1.5 bg-white border-neutral-200" />
                    </div>
                    {itemForm.videoUrl && (
                      <div className="rounded-xl border border-neutral-200 p-2 bg-neutral-50/40">
                        <video src={itemForm.videoUrl} controls muted className="h-32 w-full rounded-lg object-cover" />
                      </div>
                    )}
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-4">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold">AI Waiter tags</div>
                        <div className="text-[11px] text-neutral-500 mt-0.5">Help the AI suggest this dish when guests describe their craving.</div>
                      </div>
                      <TagPicker label="Mood" hint="When would a guest want this? e.g. light, comfort, celebratory" value={itemForm.moodTags || []} onChange={(v) => setItemForm({ ...itemForm, moodTags: v })} presets={MOOD_PRESETS} accent="emerald" />
                      <TagPicker label="Taste" hint="What does it taste like? e.g. tangy, smoky, creamy" value={itemForm.tasteTags || []} onChange={(v) => setItemForm({ ...itemForm, tasteTags: v })} presets={TASTE_PRESETS} accent="rose" />
                      <TagPicker label="Dietary" hint="Any dietary fits? e.g. vegan, gluten-free" value={itemForm.dietaryTags || []} onChange={(v) => setItemForm({ ...itemForm, dietaryTags: v })} presets={DIETARY_PRESETS} accent="neutral" />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
                      <div>
                        <div className="text-sm font-semibold">Available</div>
                        <div className="text-xs text-neutral-500">Show on customer menu</div>
                      </div>
                      <Switch checked={itemForm.available} onCheckedChange={(v) => setItemForm({ ...itemForm, available: v })} />
                    </div>
                  </div>
                  <DialogFooter className="px-6 py-4 border-t border-neutral-200 shrink-0 bg-white">
                    <Button onClick={saveItem} className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-5">
                      {editingItem ? 'Save changes' : 'Add to menu'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {menu.length === 0 && (
                <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center text-neutral-500">
                  No items yet — add your first dish.
                </div>
              )}
              {menu.map((item) => (
                <div key={item.id} className="rounded-2xl bg-white border border-neutral-200/80 overflow-hidden hover:shadow-md hover:shadow-neutral-900/5 transition-shadow">
                  <div className="h-40 overflow-hidden bg-neutral-100">
                    <img src={item.image || FOOD_IMG} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{item.name}</div>
                        <div className="text-xs text-neutral-500">{item.category}</div>
                      </div>
                      <div className="font-bold text-emerald-800 tabular-nums">${item.price.toFixed(2)}</div>
                    </div>
                    {item.description && <div className="text-xs text-neutral-600 mt-2 line-clamp-2">{item.description}</div>}
                    {item.videoUrl && <div className="text-[11px] text-emerald-700 mt-2 font-medium">▶ Video attached</div>}
                    <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={item.available} onCheckedChange={() => toggleAvail(item)} />
                        <span className="text-xs text-neutral-600">{item.available ? 'Available' : 'Out'}</span>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-neutral-500 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => {
                            setEditingItem(item);
                            setItemForm({
                              name: item.name,
                              description: item.description || '',
                              price: String(item.price),
                              category: item.category,
                              image: item.image || FOOD_IMG,
                              videoUrl: item.videoUrl || '',
                              available: item.available,
                              moodTags: item.moodTags || [],
                              tasteTags: item.tasteTags || [],
                              dietaryTags: item.dietaryTags || [],
                            });
                            setMenuOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50" onClick={() => removeItem(item)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Tables */}
          <TabsContent value="tables" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-neutral-600">
                <span className="font-semibold text-neutral-900">{tables.length}</span> tables
              </div>
              <Dialog open={tableOpen} onOpenChange={setTableOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white">
                    <Plus className="h-4 w-4 mr-1.5" />Add table
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white">
                  <DialogHeader>
                    <DialogTitle className="font-display tracking-tight">New table</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-semibold">Table number *</Label>
                      <Input value={tableForm.number} onChange={(e) => setTableForm({ ...tableForm, number: e.target.value })} placeholder="e.g. 5" className="mt-1.5 bg-white border-neutral-200" />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Seats</Label>
                      <Input type="number" value={tableForm.seats} onChange={(e) => setTableForm({ ...tableForm, seats: parseInt(e.target.value) || 2 })} className="mt-1.5 bg-white border-neutral-200" />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={addTable} className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-5">
                      Add &amp; generate QR
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {tables.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center text-neutral-500">
                  No tables yet — add tables to generate QR codes.
                </div>
              )}
              {tables.map((t) => (
                <div key={t.id} className="rounded-2xl bg-white border border-neutral-200/80 p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-medium">Table</div>
                      <div className="font-display text-3xl font-extrabold tracking-tight">{t.number}</div>
                      <div className="text-xs text-neutral-500">{t.seats} seats</div>
                    </div>
                    <TableStatusBadge status={t.status} />
                  </div>
                  <button
                    onClick={() => setTableQr(t)}
                    className="mt-4 w-full rounded-xl bg-white border border-neutral-200 p-3 hover:border-emerald-300 transition"
                  >
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(tableUrl(t))}`}
                      alt="qr"
                      className="w-full"
                    />
                  </button>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" className="rounded-full border-neutral-200 hover:bg-neutral-50" onClick={() => printQR(t)}>
                      <Printer className="h-3.5 w-3.5 mr-1" />Print
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-full text-rose-600 hover:text-rose-700 hover:bg-rose-50" onClick={() => removeTable(t)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                    </Button>
                  </div>
                  <Select value={t.status} onValueChange={(v) => setTableStatus(t, v)}>
                    <SelectTrigger className="mt-2 bg-white border-neutral-200 text-xs h-9 rounded-full"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="occupied">Occupied</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <Dialog open={!!tableQr} onOpenChange={(v) => !v && setTableQr(null)}>
              <DialogContent className="bg-white max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-display tracking-tight">
                    Table {tableQr?.number} · QR
                  </DialogTitle>
                </DialogHeader>
                {tableQr && (
                  <div className="text-center">
                    <div className="bg-white p-5 rounded-2xl inline-block border border-neutral-200">
                      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(tableUrl(tableQr))}`} />
                    </div>
                    <div className="text-xs text-neutral-500 mt-3 break-all">{tableUrl(tableQr)}</div>
                    <Button className="mt-5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-5" onClick={() => printQR(tableQr)}>
                      <Printer className="h-4 w-4 mr-2" />Print
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Kitchen */}
          <TabsContent value="kitchen" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-neutral-600">
                <span className="font-semibold text-neutral-900">{pendingOrders.length}</span> active tickets · bilingual EN/ES
              </div>
              <div className="inline-flex rounded-full border border-neutral-200 bg-white p-1">
                {[
                  ['en', 'English'],
                  ['es', 'Spanish'],
                  ['both', 'Both'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setKitchenLanguage(value)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      kitchenLanguage === value ? 'bg-emerald-700 text-white' : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingOrders.length === 0 && (
                <div className="col-span-full rounded-2xl border border-dashed border-neutral-300 bg-white p-12 text-center text-neutral-500">
                  No tickets in the kitchen.
                </div>
              )}
              {pendingOrders.map((o) => (
                <div key={o.id} className={`rounded-2xl bg-white border p-5 ${o.status === 'pending' ? 'border-amber-300 ring-1 ring-amber-200/60' : 'border-neutral-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-400">
                        Ticket #{o.id.slice(0, 6).toUpperCase()}
                      </div>
                      <div className="font-display text-2xl font-extrabold tracking-tight mt-0.5">
                        {kitchenLanguage === 'es' ? `Mesa ${o.tableNumber}` : kitchenLanguage === 'both' ? `Table ${o.tableNumber}` : `Table ${o.tableNumber}`}
                      </div>
                      {kitchenLanguage === 'both' && <div className="text-xs text-emerald-700/80">Mesa {o.tableNumber}</div>}
                    </div>
                    <OrderStatusBadge status={o.status} />
                  </div>
                  <div className="mt-3 space-y-2">
                    {o.items.map((i, idx) => (
                      <div key={idx} className="rounded-xl bg-neutral-50 border border-neutral-100 p-2.5">
                        <div className="font-semibold">
                          <span className="text-emerald-700">{i.qty}×</span>{' '}
                          {kitchenLanguage === 'es' ? (i.nameEs || i.name) : i.name}
                        </div>
                        {kitchenLanguage === 'both' && i.nameEs && (
                          <div className="text-xs text-neutral-500 ml-5">{i.qty}× {i.nameEs}</div>
                        )}
                        {i.notes && (
                          <div className="text-xs text-neutral-600 mt-1 ml-5 inline-flex items-center gap-1">
                            <FileText className="h-3 w-3" />Note: {i.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {(o.allergy || o.spicyLevel) && (
                    <div className="mt-3 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs space-y-1">
                      {o.allergy && (
                        <div className="text-rose-800 flex items-start gap-1.5">
                          <AlertTriangle className="h-3 w-3 mt-0.5" />
                          <span><span className="font-semibold">Allergy:</span> {o.allergy}</span>
                        </div>
                      )}
                      {o.spicyLevel && (
                        <div className="text-amber-800 flex items-start gap-1.5">
                          <Flame className="h-3 w-3 mt-0.5" />
                          <span><span className="font-semibold">Spice:</span> {o.spicyLevel}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-4 flex justify-between items-center border-t border-neutral-100 pt-3">
                    <div className="text-xs text-neutral-400 inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {o.status === 'pending' && (
                      <Button size="sm" onClick={() => setOrderStatus(o, 'preparing')} className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white">
                        Start
                      </Button>
                    )}
                    {o.status === 'preparing' && (
                      <Button size="sm" onClick={() => setOrderStatus(o, 'ready')} className="rounded-full bg-neutral-900 hover:bg-neutral-800 text-white">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Ready
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Support Contact Dialog */}
      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="bg-white max-w-lg h-[500px] flex flex-col p-0">
          <DialogHeader className="p-5 border-b border-neutral-200 shrink-0">
            <DialogTitle className="font-display tracking-tight">Contact Netrik Support</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-neutral-50/40">
            <div className="text-center text-xs text-neutral-500">
              This chat connects you directly with Central Admin.
            </div>
            {supportMessages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.sender === 'central' ? 'items-start' : 'items-end'}`}>
                {m.sender === 'central' && (
                  <div className="text-xs text-emerald-700 mb-1 ml-1 font-semibold">Netrik Shop HQ</div>
                )}
                <div
                  className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                    m.sender === 'restaurant'
                      ? 'bg-emerald-700 text-white rounded-br-sm'
                      : 'bg-white border border-neutral-200 text-neutral-800 rounded-bl-sm'
                  }`}
                >
                  {m.message}
                </div>
                <div className="text-[10px] text-neutral-400 mt-1">{new Date(m.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-neutral-200 shrink-0 bg-white">
            <div className="flex gap-2">
              <Input
                value={supportText}
                onChange={(e) => setSupportText(e.target.value)}
                placeholder="Type your message..."
                className="bg-white border-neutral-200 focus-visible:ring-emerald-700 focus-visible:border-emerald-700"
                onKeyDown={(e) => e.key === 'Enter' && sendSupportMsg()}
              />
              <Button onClick={sendSupportMsg} className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-5">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrderStatusBadge({ status }) {
  const styles = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    preparing: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    ready: 'bg-neutral-900 text-white border-neutral-900',
    served: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    paid: 'bg-emerald-700 text-white border-emerald-700',
    cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
  };
  return (
    <Badge className={`rounded-full text-[10px] uppercase tracking-wider font-semibold ${styles[status] || 'bg-neutral-100 text-neutral-700 border-neutral-200'}`}>
      {status}
    </Badge>
  );
}

function TableStatusBadge({ status }) {
  const styles = {
    available: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    occupied: 'bg-rose-100 text-rose-800 border-rose-200',
    reserved: 'bg-amber-100 text-amber-800 border-amber-200',
  };
  return (
    <Badge className={`rounded-full text-[10px] uppercase tracking-wider font-semibold ${styles[status] || 'bg-neutral-100 text-neutral-700 border-neutral-200'}`}>
      {status}
    </Badge>
  );
}
