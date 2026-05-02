'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { LogOut, BarChart3, ClipboardList, UtensilsCrossed, Table2, ChefHat, Plus, Trash2, Pencil, Printer, QrCode, DollarSign, TrendingUp, Download, Clock, CheckCircle2, Mail, MessageCircle, MessageSquare, Upload, Shuffle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { NetrikLogo } from '@/components/netrik-logo';

const CATEGORIES = ['Starters', 'Mains', 'Desserts', 'Drinks', 'Specials'];
const FOOD_IMG = 'https://images.pexels.com/photos/35420084/pexels-photo-35420084.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';
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

  // dialogs
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: '', category: 'Mains', image: FOOD_IMG, videoUrl: '', available: true });
  const [tableOpen, setTableOpen] = useState(false);
  const [tableForm, setTableForm] = useState({ number: '', seats: 2 });
  const [tableQr, setTableQr] = useState(null);
  
  // Support
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

  const onMenuImageUpload = (e) => {
    const file = e.target.files?.[0];
    applyMenuImageFile(file);
  };

  const onMenuImagePaste = async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    applyMenuImageFile(file);
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${u.restaurantId}` }, () => {
              loadAll(u, true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rest_tables', filter: `restaurant_id=eq.${u.restaurantId}` }, () => {
              loadAll(u, true);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `restaurant_id=eq.${u.restaurantId}` }, (payload) => {
              setSupportMessages(prev => [...prev, payload.new].sort((a,b) => new Date(a.created_at) - new Date(b.created_at)));
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_messages', filter: `restaurant_id=eq.${u.restaurantId}` }, () => {
              loadAll(u, true); // if message updated/read status changed
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'menu', filter: `restaurant_id=eq.${u.restaurantId}` }, () => {
              loadAll(u, true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants', filter: `id=eq.${u.restaurantId}` }, () => {
              loadAll(u, true);
            })
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
      fetch(`/api/restaurants/${u.restaurantId}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/menu?restaurantId=${u.restaurantId}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/tables?restaurantId=${u.restaurantId}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/orders?restaurantId=${u.restaurantId}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/analytics?restaurantId=${u.restaurantId}`, { cache: 'no-store' }).then(r => r.json()),
      fetch(`/api/support?restaurantId=${u.restaurantId}`, { cache: 'no-store' }).then(r => r.json()),
    ]);
    setRestaurant(r.restaurant); setMenu(m.menu || []); setTables(t.tables || []); setOrders(o.orders || []); setAnalytics(a || {});
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
    setMenuOpen(false); setEditingItem(null); setItemForm({ name: '', description: '', price: '', category: 'Mains', image: FOOD_IMG, videoUrl: '', available: true });
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
    setTableOpen(false); setTableForm({ number: '', seats: 2 });
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
      body: JSON.stringify({ restaurantId: me.restaurantId, sender: 'restaurant', message: supportText })
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
    const csvRows = [['Date','Order #','Table','Items','Total','Status']];
    dataRows.forEach(o => {
      csvRows.push([new Date(o.createdAt).toLocaleString(), o.id.slice(0,8), o.tableNumber, o.items.map(i=>`${i.qty}x ${i.name}`).join('; '), o.total.toFixed(2), o.status]);
    });
    const csv = csvRows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
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
    const itemsToText = (items = []) => items.map((i) => `${i.qty}x ${i.name}`).join(', ');
    const bodyRows = rows.map((o) => `
      <tr>
        <td>${new Date(o.createdAt).toLocaleString()}</td>
        <td>${o.id.slice(0, 8)}</td>
        <td>${o.tableNumber}</td>
        <td>${itemsToText(o.items)}</td>
        <td>$${o.total.toFixed(2)}</td>
        <td>${o.status}</td>
      </tr>
    `).join('');

    w.document.write(`<html><head><title>${title}</title><style>
      @page{size:A4;margin:14mm}
      body{font-family:Segoe UI,Arial,sans-serif;color:#111}
      h1{font-size:18px;margin:0}
      p{color:#444;font-size:12px;margin:6px 0 14px}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ddd;padding:6px;vertical-align:top;text-align:left}
      th{background:#f6f6f6;text-transform:uppercase;font-size:10px;letter-spacing:.04em}
    </style></head><body>
      <h1>${restaurant?.name || 'Restaurant'} - ${title}</h1>
      <p>Printed: ${new Date().toLocaleString()} | Rows: ${rows.length}</p>
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
    const lines = [
      `${restaurant?.name || 'Restaurant'} Receipt`,
      `Order: ${order.id}`,
      `Table: ${order.tableNumber}`,
      `Status: ${order.status}`,
      `Payment: ${order.paymentStatus || 'unpaid'}`,
      order.paymentReference ? `Reference: ${order.paymentReference}` : '',
      order.paymentProvider ? `Provider: ${order.paymentProvider}` : '',
      order.paymentMethod ? `Method: ${order.paymentMethod}` : '',
      order.paymentVpa ? `VPA: ${order.paymentVpa}` : '',
      `Total: $${order.total.toFixed(2)}`,
      `Created: ${new Date(order.createdAt).toLocaleString()}`,
      '',
      'Items:',
      ...(order.items || []).map((i) => `- ${i.qty}x ${i.name} (${(i.price * i.qty).toFixed(2)})`),
    ].filter(Boolean);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${order.id.slice(0, 8)}.txt`;
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

  const tampaDateTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(clock);

  const printQR = (t) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Table ${t.number} QR</title><style>body{font-family:system-ui;text-align:center;padding:40px;}h1{font-size:32px;margin:0}</style></head><body>
      <h1>${restaurant?.name || ''}</h1>
      <p style="color:#888">by Netrik Shop</p>
      <h2 style="margin:24px 0 6px">Table ${t.number}</h2>
      <p style="color:#444">Scan to order</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(tableUrl(t))}" style="margin:16px auto"/>
      <p style="color:#888;font-size:12px;">${tableUrl(t)}</p>
      <script>window.onload=()=>window.print()</script>
    </body></html>`);
  };

  if (!me || !restaurant) return <div className="min-h-screen grid place-items-center bg-[#0b0b0d] text-white">Loading…</div>;

  const pendingOrders = orders.filter(o => ['pending','preparing'].includes(o.status));
  const liveOrders = orders.filter(o => o.status !== 'paid' && o.status !== 'cancelled');

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white">
      <header className="border-b border-white/10 sticky top-0 bg-black/60 backdrop-blur z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {restaurant.logoUrl ? (
              <img src={restaurant.logoUrl} alt={restaurant.name} className="h-10 w-10 rounded-lg border border-white/10 object-cover"/>
            ) : (
              <NetrikLogo className="h-10 w-10"/>
            )}
            <div>
              <div className="font-bold">{restaurant.name}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80">by Netrik Shop · Manager</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 items-center rounded-md border border-white/20 bg-white/5 px-3 text-sm text-white/80 font-medium whitespace-nowrap"><Clock className="h-4 w-4 mr-2"/>{clock.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })}</div>
            <Button size="sm" variant="outline" className="h-9 border-white/20 bg-white/5 hover:bg-white/10 hover:text-white text-white/80 relative" onClick={() => setSupportOpen(true)}>
              <MessageSquare className="h-4 w-4 mr-2"/>Contact support
              {supportMessages.filter(m => m.sender === 'central' && !m.read).length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold"></span>
              )}
            </Button>
            <Button asChild size="sm" variant="outline" className="h-9 border-white/20 bg-white/5 hover:bg-white/10 hover:text-white text-white/80">
              <a href="https://wa.me/16562145190?text=Hi%20Netrik%20Support%2C%20I%20need%20help%20with%20my%20restaurant%20dashboard" target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-2"/>WhatsApp</a>
            </Button>
            <div className="flex h-9 items-center rounded-md border border-green-400/30 bg-green-400/10 px-3 text-sm text-green-300 font-medium whitespace-nowrap"><span className="h-1.5 w-1.5 rounded-full bg-green-400 mr-2 animate-pulse"/> Live</div>
            <Button size="sm" variant="ghost" className="h-9 hover:bg-white/10 hover:text-white text-white/70" onClick={() => { localStorage.removeItem('netrik_user'); router.push('/login'); }}><LogOut className="h-4 w-4 mr-2"/>Logout</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs value={tab} onValueChange={setTab} className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10 grid grid-cols-5 max-w-3xl mx-auto">
            <TabsTrigger value="analytics" className="data-[state=active]:bg-amber-400 data-[state=active]:text-black"><BarChart3 className="h-4 w-4 mr-1.5"/>Analytics</TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-amber-400 data-[state=active]:text-black"><ClipboardList className="h-4 w-4 mr-1.5"/>Orders</TabsTrigger>
            <TabsTrigger value="menu" className="data-[state=active]:bg-amber-400 data-[state=active]:text-black"><UtensilsCrossed className="h-4 w-4 mr-1.5"/>Menu</TabsTrigger>
            <TabsTrigger value="tables" className="data-[state=active]:bg-amber-400 data-[state=active]:text-black"><Table2 className="h-4 w-4 mr-1.5"/>Tables</TabsTrigger>
            <TabsTrigger value="kitchen" className="data-[state=active]:bg-amber-400 data-[state=active]:text-black"><ChefHat className="h-4 w-4 mr-1.5"/>Kitchen</TabsTrigger>
          </TabsList>

          {/* Analytics */}
          <TabsContent value="analytics" className="space-y-6">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-4 md:p-5">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <Label className="text-xs text-white/60">Start date</Label>
                    <Input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="mt-1 w-[170px] bg-white/5 border-white/10"/>
                  </div>
                  <div>
                    <Label className="text-xs text-white/60">End date</Label>
                    <Input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="mt-1 w-[170px] bg-white/5 border-white/10"/>
                  </div>
                  <Button size="sm" variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white" onClick={setTodayRange}>Today</Button>
                  <Button size="sm" variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white" onClick={()=>{setStartDate(''); setEndDate('');}}>Clear</Button>
                  <Button size="sm" variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white" onClick={()=>downloadCSV(filteredOrders, 'orders-range')}><Download className="h-4 w-4 mr-2"/>CSV</Button>
                  <Button size="sm" variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white" onClick={()=>printOrdersA4(filteredOrders, 'Orders Report (A4)')}><Printer className="h-4 w-4 mr-2"/>Print A4</Button>
                  <div className="text-xs text-white/50 ml-auto">Rows in range: {filteredOrders.length}</div>
                </div>
              </CardContent>
            </Card>
            <div className="grid md:grid-cols-4 gap-5">
              {[
                { i: <DollarSign/>, t: "Today's revenue", v: `$${analytics.todayRevenue?.toFixed(2) || '0.00'}` },
                { i: <ClipboardList/>, t: "Today's orders", v: analytics.todayOrders || 0 },
                { i: <TrendingUp/>, t: 'Avg ticket', v: `$${analytics.avgTicket?.toFixed(2) || '0.00'}` },
                { i: <Table2/>, t: 'Active tables', v: tables.filter(t => t.status === 'occupied').length + '/' + tables.length },
              ].map((c) => (
                <Card key={c.t} className="bg-white/5 border-white/10">
                  <CardContent className="p-6">
                    <div className="h-10 w-10 rounded-xl bg-amber-400/20 text-amber-300 grid place-items-center mb-3">{c.i}</div>
                    <div className="text-3xl font-black">{c.v}</div>
                    <div className="text-xs uppercase tracking-wider text-white/50 mt-1">{c.t}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid lg:grid-cols-3 gap-5">
              <Card className="bg-white/5 border-white/10 lg:col-span-2">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-semibold">Revenue · last 7 days</div>
                    <Button variant="outline" className="h-9 border-white/20 bg-white/5 hover:bg-white/10 hover:text-white text-white/80" size="sm" onClick={() => downloadCSV(filteredOrders, 'orders-range')}><Download className="h-4 w-4 mr-2"/>CSV</Button>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={analytics.last7 || []}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)"/>
                      <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={11}/>
                      <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11}/>
                      <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} itemStyle={{ color: '#fff' }} labelStyle={{ color: '#fff' }}/>
                      <Line type="monotone" dataKey="revenue" stroke="#fbbf24" strokeWidth={2} dot={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-6">
                  <div className="font-semibold mb-4">Top items</div>
                  <div className="space-y-3">
                    {(analytics.topItems || []).slice(0,5).map((i,idx) => (
                      <div key={i.name} className="flex items-center gap-3">
                        <div className="text-xs font-mono text-amber-300 w-5">#{idx+1}</div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{i.name}</div>
                          <div className="text-xs text-white/40">{i.count} orders</div>
                        </div>
                        <div className="text-sm font-semibold text-amber-300">${i.revenue.toFixed(2)}</div>
                      </div>
                    ))}
                    {(!analytics.topItems || analytics.topItems.length === 0) && <div className="text-sm text-white/40">No data yet</div>}
                  </div>
                </CardContent>
              </Card>
            </div>
            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="font-semibold mb-4">Orders by hour (today)</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={analytics.byHour || []}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)"/>
                    <XAxis dataKey="hour" stroke="rgba(255,255,255,0.4)" fontSize={11}/>
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={11}/>
                    <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}/>
                    <Bar dataKey="orders" fill="#fb7185" radius={[4,4,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders */}
          <TabsContent value="orders" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/60">{liveOrders.length} live orders</div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white" size="sm" onClick={() => downloadCSV(filteredOrders, 'orders-range')}><Download className="h-4 w-4 mr-2"/>Download CSV</Button>
                <Button variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white" size="sm" onClick={() => printOrdersA4(filteredOrders, 'Orders Report (A4)')}><Printer className="h-4 w-4 mr-2"/>Print A4</Button>
              </div>
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              {orders.length === 0 && (<Card className="bg-white/5 border-white/10"><CardContent className="p-10 text-center text-white/40">No orders yet — customers will scan a table QR to place orders.</CardContent></Card>)}
              {orders.map((o) => (
                <Card key={o.id} className="bg-white/5 border-white/10">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white/50">Order <span className="font-mono">#{o.id.slice(0,8)}</span></div>
                        <div className="font-semibold text-lg">Table {o.tableNumber}</div>
                      </div>
                      <Badge className={`${o.status === 'paid' ? 'bg-green-400/20 text-green-300 border-green-400/30' : o.status === 'ready' ? 'bg-blue-400/20 text-blue-300 border-blue-400/30' : 'bg-amber-400/20 text-amber-300 border-amber-400/30'}`}>{o.status}</Badge>
                    </div>
                    <div className="mt-3 space-y-1 text-sm">
                      {o.items.map((i,idx) => (
                        <div key={idx} className="flex justify-between"><span>{i.qty}× {i.name}{i.notes ? ` (${i.notes})` : ''}</span><span className="text-white/60">${(i.price*i.qty).toFixed(2)}</span></div>
                      ))}
                    </div>
                    {(o.allergy || o.spicyLevel) && (
                      <div className="mt-2 text-xs text-amber-300/80">{o.allergy ? `Allergy: ${o.allergy}` : ''} {o.spicyLevel ? ` · Spice: ${o.spicyLevel}` : ''}</div>
                    )}
                    <div className="mt-2 text-xs text-white/60">
                      Payment: <span className={`${o.paymentStatus === 'paid' ? 'text-green-300' : o.paymentStatus === 'failed' ? 'text-rose-300' : 'text-amber-300'}`}>{o.paymentStatus || 'unpaid'}</span>
                      {o.paymentReference ? ` · Ref ${o.paymentReference}` : ''}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                      <div className="font-bold text-lg text-amber-300">${o.total.toFixed(2)}</div>
                      <div className="flex gap-1">
                        {o.status === 'pending' && <Button size="sm" onClick={() => setOrderStatus(o, 'preparing')} className="bg-amber-400 text-black hover:bg-amber-300">Accept</Button>}
                        {o.status === 'preparing' && <Button size="sm" onClick={() => setOrderStatus(o, 'ready')} className="bg-blue-500 hover:bg-blue-400">Ready</Button>}
                        {o.status === 'ready' && <Button size="sm" onClick={() => setOrderStatus(o, 'served')} className="bg-green-500 hover:bg-green-400">Served</Button>}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-white/40">
                      <span>{new Date(o.createdAt).toLocaleTimeString()}</span>
                      <button onClick={() => downloadReceipt(o)} className="text-amber-300 hover:text-amber-200">Download bill</button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Menu */}
          <TabsContent value="menu" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/60">{menu.length} items · {menu.filter(m=>m.available).length} available</div>
              <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
                <DialogTrigger asChild><Button onClick={()=>{setEditingItem(null); setItemForm({ name:'', description:'', price:'', category:'Mains', image:FOOD_IMG, videoUrl:'', available:true })}} className="bg-amber-400 text-black hover:bg-amber-300"><Plus className="h-4 w-4 mr-1"/>Add item</Button></DialogTrigger>
                <DialogContent className="bg-[#111] border-white/10 text-white max-w-lg">
                  <DialogHeader><DialogTitle>{editingItem ? 'Edit item' : 'New menu item'}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Name *</Label><Input value={itemForm.name} onChange={e=>setItemForm({...itemForm,name:e.target.value})} className="bg-white/5 border-white/10"/></div>
                    <div><Label>Description</Label><Textarea value={itemForm.description} onChange={e=>setItemForm({...itemForm,description:e.target.value})} className="bg-white/5 border-white/10"/></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Price ($) *</Label><Input type="number" step="0.01" value={itemForm.price} onChange={e=>setItemForm({...itemForm,price:e.target.value})} className="bg-white/5 border-white/10"/></div>
                      <div><Label>Category</Label>
                        <Select value={itemForm.category} onValueChange={v=>setItemForm({...itemForm,category:v})}>
                          <SelectTrigger className="bg-white/5 border-white/10"><SelectValue/></SelectTrigger>
                          <SelectContent className="bg-[#111] text-white border-white/10">{CATEGORIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Image URL</Label>
                      <Input
                        value={itemForm.image}
                        onChange={e=>setItemForm({...itemForm,image:e.target.value})}
                        onPaste={onMenuImagePaste}
                        placeholder="Paste URL or press Ctrl+V after copying image"
                        className="bg-white/5 border-white/10"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-white/20 bg-white/5 px-3 text-xs text-white/80 hover:bg-white/10">
                          <Upload className="h-3.5 w-3.5 mr-1.5"/>Upload from PC
                          <input type="file" accept="image/*" className="hidden" onChange={onMenuImageUpload}/>
                        </label>
                        <Button type="button" size="sm" variant="outline" className="h-9 border-white/20 bg-white/5 hover:bg-white/10 text-white" onClick={() => setItemForm((prev) => ({ ...prev, image: getRandomImage() }))}><Shuffle className="h-3.5 w-3.5 mr-1.5"/>Random photo</Button>
                      </div>
                    </div>
                    {itemForm.image && (
                      <div className="rounded-md border border-white/10 p-2 bg-black/30">
                        <img src={itemForm.image} alt="Preview" className="h-28 w-full rounded-md object-cover"/>
                      </div>
                    )}
                    <div>
                      <Label>Video URL (optional)</Label>
                      <Input value={itemForm.videoUrl} onChange={e=>setItemForm({...itemForm,videoUrl:e.target.value})} placeholder="https://...mp4" className="bg-white/5 border-white/10"/>
                    </div>
                    {itemForm.videoUrl && (
                      <div className="rounded-md border border-white/10 p-2 bg-black/30">
                        <video src={itemForm.videoUrl} controls muted className="h-32 w-full rounded-md object-cover"/>
                      </div>
                    )}
                    <div className="flex items-center justify-between rounded-lg border border-white/10 p-3"><div><div className="text-sm font-medium">Available</div><div className="text-xs text-white/50">Show on customer menu</div></div><Switch checked={itemForm.available} onCheckedChange={v=>setItemForm({...itemForm,available:v})}/></div>
                  </div>
                  <DialogFooter><Button onClick={saveItem} className="bg-amber-400 text-black hover:bg-amber-300">{editingItem ? 'Save' : 'Add'}</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {menu.length === 0 && <Card className="md:col-span-2 lg:col-span-3 bg-white/5 border-white/10"><CardContent className="p-10 text-center text-white/40">No items yet — add your first dish.</CardContent></Card>}
              {menu.map(item => (
                <Card key={item.id} className="bg-white/5 border-white/10 overflow-hidden">
                  <div className="h-36 overflow-hidden"><img src={item.image || FOOD_IMG} alt={item.name} className="w-full h-full object-cover"/></div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-xs text-white/50">{item.category}</div>
                      </div>
                      <div className="font-bold text-amber-300">${item.price.toFixed(2)}</div>
                    </div>
                    {item.description && <div className="text-xs text-white/60 mt-2 line-clamp-2">{item.description}</div>}
                    {item.videoUrl && <div className="text-[11px] text-emerald-300/80 mt-2">Video attached</div>}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2"><Switch checked={item.available} onCheckedChange={()=>toggleAvail(item)}/><span className="text-xs text-white/60">{item.available ? 'Available' : 'Out'}</span></div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={()=>{setEditingItem(item); setItemForm({ name:item.name, description:item.description||'', price:String(item.price), category:item.category, image:item.image||FOOD_IMG, videoUrl:item.videoUrl||'', available:item.available }); setMenuOpen(true);}}><Pencil className="h-4 w-4"/></Button>
                        <Button size="sm" variant="ghost" className="text-rose-400" onClick={()=>removeItem(item)}><Trash2 className="h-4 w-4"/></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Tables */}
          <TabsContent value="tables" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/60">{tables.length} tables</div>
              <Dialog open={tableOpen} onOpenChange={setTableOpen}>
                <DialogTrigger asChild><Button className="bg-amber-400 text-black hover:bg-amber-300"><Plus className="h-4 w-4 mr-1"/>Add table</Button></DialogTrigger>
                <DialogContent className="bg-[#111] border-white/10 text-white">
                  <DialogHeader><DialogTitle>New table</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Table number *</Label><Input value={tableForm.number} onChange={e=>setTableForm({...tableForm,number:e.target.value})} placeholder="e.g. 5" className="bg-white/5 border-white/10"/></div>
                    <div><Label>Seats</Label><Input type="number" value={tableForm.seats} onChange={e=>setTableForm({...tableForm,seats:parseInt(e.target.value)||2})} className="bg-white/5 border-white/10"/></div>
                  </div>
                  <DialogFooter><Button onClick={addTable} className="bg-amber-400 text-black hover:bg-amber-300">Add & generate QR</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {tables.length === 0 && <Card className="col-span-full bg-white/5 border-white/10"><CardContent className="p-10 text-center text-white/40">No tables yet — add tables to generate QR codes.</CardContent></Card>}
              {tables.map(t => (
                <Card key={t.id} className="bg-white/5 border-white/10">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase text-white/50">Table</div>
                        <div className="text-3xl font-black">{t.number}</div>
                        <div className="text-xs text-white/50">{t.seats} seats</div>
                      </div>
                      <Badge className={t.status === 'available' ? 'bg-green-400/20 text-green-300 border-green-400/30' : t.status === 'occupied' ? 'bg-rose-400/20 text-rose-300 border-rose-400/30' : 'bg-amber-400/20 text-amber-300 border-amber-400/30'}>{t.status}</Badge>
                    </div>
                    <button onClick={()=>setTableQr(t)} className="mt-3 w-full rounded-lg bg-white p-2"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(tableUrl(t))}`} alt="qr" className="w-full"/></button>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white" onClick={()=>printQR(t)}><Printer className="h-3.5 w-3.5 mr-1"/>Print</Button>
                      <Button size="sm" variant="ghost" className="text-rose-400" onClick={()=>removeTable(t)}><Trash2 className="h-3.5 w-3.5 mr-1"/>Delete</Button>
                    </div>
                    <Select value={t.status} onValueChange={v=>setTableStatus(t,v)}>
                      <SelectTrigger className="mt-2 bg-white/5 border-white/10 text-xs h-8"><SelectValue/></SelectTrigger>
                      <SelectContent className="bg-[#111] text-white border-white/10">
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="occupied">Occupied</SelectItem>
                        <SelectItem value="reserved">Reserved</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Dialog open={!!tableQr} onOpenChange={v=>!v && setTableQr(null)}>
              <DialogContent className="bg-[#111] border-white/10 text-white max-w-md">
                <DialogHeader><DialogTitle>Table {tableQr?.number} · QR</DialogTitle></DialogHeader>
                {tableQr && (
                  <div className="text-center">
                    <div className="bg-white p-4 rounded-xl inline-block"><img src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(tableUrl(tableQr))}`}/></div>
                    <div className="text-xs text-white/50 mt-3 break-all">{tableUrl(tableQr)}</div>
                    <Button className="mt-4 bg-amber-400 text-black hover:bg-amber-300" onClick={()=>printQR(tableQr)}><Printer className="h-4 w-4 mr-2"/>Print</Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Kitchen */}
          <TabsContent value="kitchen" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-white/60">{pendingOrders.length} active tickets · bilingual EN/ES</div>
              <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
                {[
                  ['en', 'English'],
                  ['es', 'Spanish'],
                  ['both', 'Both'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setKitchenLanguage(value)}
                    className={`rounded-md px-3 py-1.5 text-xs transition ${kitchenLanguage === value ? 'bg-amber-400 text-black' : 'text-white/70 hover:bg-white/10'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingOrders.length === 0 && <Card className="col-span-full bg-white/5 border-white/10"><CardContent className="p-10 text-center text-white/40">No tickets in the kitchen.</CardContent></Card>}
              {pendingOrders.map(o => (
                <Card key={o.id} className="bg-white/5 border-white/10">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-white/50">Ticket #{o.id.slice(0,6).toUpperCase()}</div>
                        <div className="text-2xl font-black">
                          {kitchenLanguage === 'es' ? `Mesa ${o.tableNumber}` : kitchenLanguage === 'both' ? `Table ${o.tableNumber} · Mesa ${o.tableNumber}` : `Table ${o.tableNumber}`}
                        </div>
                      </div>
                      <Badge className={o.status === 'pending' ? 'bg-amber-400/20 text-amber-300 border-amber-400/30' : 'bg-blue-400/20 text-blue-300 border-blue-400/30'}>{o.status}</Badge>
                    </div>
                    <div className="mt-3 space-y-2">
                      {o.items.map((i,idx) => (
                        <div key={idx} className="rounded-lg bg-black/40 border border-white/5 p-2">
                          <div className="font-semibold">{i.qty}× {kitchenLanguage === 'es' ? (i.nameEs || i.name) : i.name}</div>
                          {kitchenLanguage === 'both' && i.nameEs && <div className="text-xs text-amber-300/80">{i.qty}× {i.nameEs}</div>}
                          {i.notes && <div className="text-xs text-white/50 mt-1">{kitchenLanguage === 'es' ? 'Nota' : kitchenLanguage === 'both' ? 'Note / Nota' : 'Note'}: {i.notes}</div>}
                        </div>
                      ))}
                    </div>
                    {(o.allergy || o.spicyLevel) && (
                      <div className="mt-3 rounded-lg bg-rose-400/10 border border-rose-400/30 p-2 text-xs">
                        {o.allergy && <div><span className="font-semibold text-rose-300">{kitchenLanguage === 'es' ? 'Alergia' : kitchenLanguage === 'both' ? 'Allergy / Alergia' : 'Allergy'}:</span> {o.allergy}</div>}
                        {o.spicyLevel && <div><span className="font-semibold text-rose-300">{kitchenLanguage === 'es' ? 'Picante' : kitchenLanguage === 'both' ? 'Spice / Picante' : 'Spice'}:</span> {o.spicyLevel}</div>}
                      </div>
                    )}
                    <div className="mt-3 flex justify-between">
                      <div className="text-xs text-white/40 inline-flex items-center"><Clock className="h-3 w-3 mr-1"/>{new Date(o.createdAt).toLocaleTimeString()}</div>
                      {o.status === 'pending' && <Button size="sm" onClick={()=>setOrderStatus(o,'preparing')} className="bg-amber-400 text-black hover:bg-amber-300">{kitchenLanguage === 'es' ? 'Iniciar' : kitchenLanguage === 'both' ? 'Start / Iniciar' : 'Start'}</Button>}
                      {o.status === 'preparing' && <Button size="sm" onClick={()=>setOrderStatus(o,'ready')} className="bg-green-500 hover:bg-green-400"><CheckCircle2 className="h-3.5 w-3.5 mr-1"/>{kitchenLanguage === 'es' ? 'Listo' : kitchenLanguage === 'both' ? 'Ready / Listo' : 'Ready'}</Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Support Contact Dialog */}
      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="bg-[#111] border-white/10 text-white max-w-lg h-[500px] flex flex-col p-0">
          <DialogHeader className="p-4 border-b border-white/10 shrink-0"><DialogTitle>Contact Netrik Support</DialogTitle></DialogHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="text-center text-xs text-white/40">This chat connects you directly with Central Admin.</div>
            {supportMessages.map(m => (
              <div key={m.id} className={`flex flex-col ${m.sender === 'central' ? 'items-start' : 'items-end'}`}>
                {m.sender === 'central' && <div className="text-xs text-amber-300/80 mb-1 ml-1">Netrik Shop HQ</div>}
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.sender === 'restaurant' ? 'bg-[#635BFF] text-white rounded-br-sm' : 'bg-white/10 text-white rounded-bl-sm'}`}>
                  {m.message}
                </div>
                <div className="text-[10px] text-white/30 mt-1">{new Date(m.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-white/10 shrink-0 bg-black/50">
            <div className="flex gap-2">
              <Input value={supportText} onChange={e=>setSupportText(e.target.value)} placeholder="Type your message..." className="bg-white/5 border-white/10" onKeyDown={e => e.key === 'Enter' && sendSupportMsg()}/>
              <Button onClick={sendSupportMsg} className="bg-amber-400 text-black hover:bg-amber-300">Send</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
