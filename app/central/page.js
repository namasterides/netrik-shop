'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Plus,
  LogOut,
  Building2,
  Users,
  DollarSign,
  Activity,
  QrCode,
  Pencil,
  Trash2,
  Copy,
  ShieldCheck,
  Download,
  Printer,
  Upload,
  MessageSquare,
  Send,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { NetrikLogo } from '@/components/netrik-logo';

const SUBSCRIPTIONS = ['Starter', 'Pro', 'Premium', 'Enterprise'];
const COLORS = ['#047857', '#10b981', '#34d399', '#a7f3d0'];
const BRAND_LOGO_PATH = '/brand/original/netrikshop%20update%20logo.png';

export default function CentralAdmin() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [list, setList] = useState([]);
  const [stats, setStats] = useState({ totalRestaurants: 0, totalRevenue: 0, totalOrders: 0, mrr: 0, byPlan: [], trend: [] });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showCredsFor, setShowCredsFor] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [supportMessages, setSupportMessages] = useState([]);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [form, setForm] = useState({
    name: '',
    ownerName: '',
    email: '',
    contact: '',
    address: '',
    domain: '',
    logoUrl: '',
    subscription: 'Pro',
  });

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('netrik_user') || 'null');
    if (!u || u.type !== 'central') { router.push('/login'); return; }
    setMe(u);
    refresh();

    let channel;
    import('@/lib/supabase').then(({ getSupabase }) => {
      const sb = getSupabase();
      if (sb) {
        channel = sb.channel('central-realtime')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => refresh(true))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, () => refresh(true))
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages' }, (payload) => {
            setSupportMessages(prev => [...prev, payload.new].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_messages' }, () => refresh(true))
          .subscribe();
      }
    });

    return () => { if (channel) channel.unsubscribe(); };
  }, [router]);

  const refresh = async (silent = false) => {
    try {
      const [r, s, m] = await Promise.all([
        fetch('/api/restaurants', { cache: 'no-store' }),
        fetch('/api/central/stats', { cache: 'no-store' }),
        fetch('/api/support', { cache: 'no-store' }),
      ]);
      const d = await r.json();
      setList(d.restaurants || []);
      setStats(await s.json());
      const msgData = await m.json();
      setSupportMessages(msgData.messages || []);
    } catch (e) {
      if (!silent) toast.error('Failed to refresh central data');
    }
  };

  const save = async () => {
    if (!form.name || !form.ownerName || !form.contact || !form.email) return toast.error('Fill required fields');
    const method = editing ? 'PUT' : 'POST';
    const url = editing ? `/api/restaurants/${editing.id}` : '/api/restaurants';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Failed');
    if (editing) {
      toast.success('Restaurant updated');
    } else if (data.mailStatus === 'sent_to_background') {
      toast.success('Restaurant created and credentials email sent');
    } else {
      toast.warning('Restaurant created, but email was not sent. Check SMTP settings.');
    }
    if (!editing && data.restaurant) setShowCredsFor(data.restaurant);
    setOpen(false);
    setEditing(null);
    setForm({ name: '', ownerName: '', email: '', contact: '', address: '', domain: '', logoUrl: '', subscription: 'Pro' });
    refresh();
  };

  const startEdit = (r) => {
    setEditing(r);
    setForm({
      name: r.name,
      ownerName: r.ownerName,
      email: r.email || '',
      contact: r.contact,
      address: r.address || '',
      domain: r.domain || '',
      logoUrl: r.logoUrl || '',
      subscription: r.subscription,
    });
    setOpen(true);
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/restaurants/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deletePassword }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Failed to delete restaurant');
    toast.success('Restaurant deleted');
    setDeleteTarget(null);
    setDeletePassword('');
    refresh();
  };

  const sendSupportReply = async () => {
    if (!replyText || !replyOpen) return;
    const res = await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: replyOpen.restaurant_id || replyOpen.id, sender: 'central', message: replyText }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(data.error || 'Failed to send reply');
    toast.success('Reply sent');
    setReplyText('');
    refresh();
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 1024 * 1024) {
      toast.error('Logo file size must be less than 1MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((previous) => ({ ...previous, logoUrl: String(reader.result || '') }));
      toast.success('Logo loaded');
    };
    reader.onerror = () => toast.error('Could not read file');
    reader.readAsDataURL(file);
  };

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success('Copied'); };

  const downloadRestaurantsCsv = () => {
    const brandLogoUrl = new URL(BRAND_LOGO_PATH, window.location.origin).toString();
    const rows = [['Netrik Logo', 'Restaurant', 'Owner', 'Email', 'Contact', 'Subscription', 'Domain', 'Created']];
    list.forEach((r) => {
      rows.push([brandLogoUrl, r.name, r.ownerName, r.email || '', r.contact, r.subscription, r.domain || '', new Date(r.createdAt).toLocaleDateString()]);
    });
    const csv = rows.map((row) => row.map((col) => `"${String(col).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `restaurants-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printRestaurants = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const brandLogoUrl = new URL(BRAND_LOGO_PATH, window.location.origin).toString();
    const rows = list.map((r) => `
      <tr>
        <td>${r.name}</td>
        <td>${r.ownerName}</td>
        <td>${r.email || '-'}</td>
        <td>${r.contact}</td>
        <td>${r.subscription}</td>
        <td>${r.domain || '-'}</td>
        <td>${new Date(r.createdAt).toLocaleDateString()}</td>
      </tr>`).join('');
    w.document.write(`<html><head><title>Restaurants Report</title><style>
      body{font-family:Inter,Segoe UI,Arial,sans-serif;padding:32px;color:#0a0a0a}
      .brand{display:flex;align-items:center;gap:14px;margin-bottom:10px}
      .brand img{height:42px;width:auto;display:block}
      h1{margin:0 0 8px 0;font-weight:700}
      p{margin:0 0 18px 0;color:#666;font-size:12px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border-bottom:1px solid #e5e7eb;padding:10px 8px;text-align:left;vertical-align:top}
      th{background:#fafafa;text-transform:uppercase;font-size:10px;letter-spacing:.06em;color:#525252}
    </style></head><body>
      <div class="brand">
        <img src="${brandLogoUrl}" alt="Netrik Shop" />
        <div>
          <h1>Netrik Shop · Restaurants</h1>
          <div style="color:#6b7280;font-size:11px;letter-spacing:.2em;text-transform:uppercase">Central report</div>
        </div>
      </div>
      <p>Printed on ${new Date().toLocaleString()}</p>
      <table>
        <thead><tr><th>Restaurant</th><th>Owner</th><th>Email</th><th>Contact</th><th>Plan</th><th>Domain</th><th>Created</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7">No restaurants found</td></tr>'}</tbody>
      </table>
      <script>window.onload=()=>window.print()</script>
    </body></html>`);
    w.document.close();
  };

  if (!me) return null;

  const unread = supportMessages.filter((m) => m.sender === 'restaurant' && !m.read).length;

  const KPI = [
    { i: Building2, t: 'Restaurants', v: stats.totalRestaurants, sub: 'active tenants' },
    { i: DollarSign, t: 'Total Revenue', v: `$${(stats.totalRevenue || 0).toLocaleString()}`, sub: 'across all tenants' },
    { i: Activity, t: 'Orders Served', v: (stats.totalOrders || 0).toLocaleString(), sub: 'all-time' },
    { i: Users, t: 'MRR', v: `$${(stats.mrr || 0).toLocaleString()}`, sub: 'monthly recurring' },
  ];

  return (
    <div className="min-h-screen bg-neutral-50/40 text-neutral-900">
      <header className="border-b border-neutral-200/80 sticky top-0 bg-white/85 backdrop-blur-xl z-30">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <NetrikLogo variant="primary" className="h-[3.01rem] w-auto max-w-[480px]" />
            <div className="min-w-0">
              <div className="font-bold tracking-tight">Central Admin</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={inboxOpen} onOpenChange={setInboxOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-full h-9 border-neutral-200 hover:bg-neutral-50 relative">
                  <MessageSquare className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Inbox</span>
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white border-2 border-white">
                      {unread}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl h-[600px] flex flex-col p-0 bg-white">
                <DialogHeader className="p-5 border-b border-neutral-200 shrink-0">
                  <DialogTitle className="font-display tracking-tight">Support Inbox</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-neutral-50/40">
                  {supportMessages.length === 0 && (
                    <div className="text-center text-neutral-400 mt-10 text-sm">No support messages yet.</div>
                  )}
                  {supportMessages.map((m) => {
                    const r = list.find((x) => x.id === m.restaurant_id);
                    return (
                      <div key={m.id} className={`flex flex-col ${m.sender === 'central' ? 'items-end' : 'items-start'}`}>
                        {m.sender === 'restaurant' && (
                          <div className="text-xs text-neutral-500 mb-1 ml-1 font-medium">
                            {r?.name || 'Unknown Restaurant'}
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                            m.sender === 'central'
                              ? 'bg-emerald-700 text-white rounded-br-sm'
                              : 'bg-white border border-neutral-200 text-neutral-800 rounded-bl-sm'
                          }`}
                        >
                          {m.message}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-neutral-400">{new Date(m.created_at).toLocaleString()}</span>
                          {m.sender === 'restaurant' && (
                            <button
                              onClick={() => setReplyOpen(r)}
                              className="text-[10px] text-emerald-700 hover:underline font-semibold"
                            >
                              Reply
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {replyOpen && (
                  <div className="p-4 border-t border-neutral-200 shrink-0 bg-white">
                    <div className="text-xs text-emerald-800 mb-2 flex justify-between items-center font-semibold">
                      <span>Replying to {replyOpen.name}</span>
                      <button onClick={() => setReplyOpen(null)} className="text-neutral-500 hover:text-neutral-800">
                        Cancel
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Type a reply..."
                        className="bg-white border-neutral-200 focus-visible:ring-emerald-700 focus-visible:border-emerald-700"
                        onKeyDown={(e) => e.key === 'Enter' && sendSupportReply()}
                      />
                      <Button onClick={sendSupportReply} className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-full px-5">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Badge className="hidden sm:inline-flex h-9 px-3 rounded-full bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> {me.userId}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
              onClick={() => { localStorage.removeItem('netrik_user'); router.push('/login'); }}
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-6 md:py-10 space-y-8">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight">Overview</h1>
          <p className="text-sm text-neutral-500 mt-1">All restaurants, all revenue, all in one place.</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {KPI.map((c) => (
            <div key={c.t} className="rounded-2xl bg-white border border-neutral-200/80 p-5">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 grid place-items-center">
                  <c.i className="h-4.5 w-4.5" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-700">live</span>
              </div>
              <div className="mt-4 text-2xl md:text-3xl font-extrabold tabular-nums tracking-tight">{c.v}</div>
              <div className="text-[11px] uppercase tracking-widest text-neutral-500 font-medium mt-1">{c.t}</div>
              <div className="text-xs text-neutral-400 mt-0.5">{c.sub}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-2xl bg-white border border-neutral-200/80 p-5 md:p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="font-display font-bold text-lg tracking-tight">Revenue trend</div>
                <div className="text-xs text-neutral-500 mt-0.5">Last 14 days · all restaurants</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.trend || []}>
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
            <div className="font-display font-bold text-lg tracking-tight mb-1">Subscription mix</div>
            <div className="text-xs text-neutral-500 mb-3">By active plan</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={stats.byPlan || []} dataKey="value" nameKey="name" innerRadius={50} outerRadius={88} paddingAngle={3}>
                  {(stats.byPlan || []).map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12 }}
                  itemStyle={{ color: '#0a0a0a', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 text-xs mt-2">
              {(stats.byPlan || []).map((p, i) => (
                <div key={p.name} className="flex items-center gap-1.5 text-neutral-600">
                  <span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  {p.name} ({p.value})
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Restaurants list */}
        <div className="rounded-2xl bg-white border border-neutral-200/80 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <div className="font-display font-bold text-lg tracking-tight">Restaurants</div>
              <div className="text-xs text-neutral-500">{list.length} tenant{list.length === 1 ? '' : 's'}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="rounded-full h-9 border-neutral-200 hover:bg-neutral-50"
                onClick={downloadRestaurantsCsv}
              >
                <Download className="h-4 w-4 mr-1.5" />CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full h-9 border-neutral-200 hover:bg-neutral-50"
                onClick={printRestaurants}
              >
                <Printer className="h-4 w-4 mr-1.5" />Print
              </Button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditing(null);
                      setForm({ name: '', ownerName: '', email: '', contact: '', address: '', domain: '', logoUrl: '', subscription: 'Pro' });
                    }}
                    className="rounded-full h-9 bg-emerald-700 hover:bg-emerald-800 text-white px-4"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />Add restaurant
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white max-w-xl">
                  <DialogHeader>
                    <DialogTitle className="font-display tracking-tight">
                      {editing ? 'Edit restaurant' : 'New restaurant'}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-semibold">Restaurant name *</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5 bg-white border-neutral-200" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold">Owner name *</Label>
                        <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} className="mt-1.5 bg-white border-neutral-200" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Restaurant email *</Label>
                        <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="owner@restaurant.com" className="mt-1.5 bg-white border-neutral-200" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold">Contact *</Label>
                        <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="mt-1.5 bg-white border-neutral-200" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Domain</Label>
                        <Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="oasis-cafe.com" className="mt-1.5 bg-white border-neutral-200" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Address</Label>
                      <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1.5 bg-white border-neutral-200" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <Label className="text-xs font-semibold">Logo URL</Label>
                        <Input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." className="mt-1.5 bg-white border-neutral-200" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">Upload logo</Label>
                        {form.logoUrl && form.logoUrl.startsWith('data:') ? (
                          <div className="mt-1.5 flex items-center gap-2">
                            <img src={form.logoUrl} alt="Logo preview" className="h-10 w-10 object-cover rounded border border-neutral-200" />
                            <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, logoUrl: '' })} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-10 px-2">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <label className="mt-1.5 flex h-10 items-center justify-center rounded-md border border-neutral-200 bg-white text-sm cursor-pointer hover:bg-neutral-50 text-neutral-600">
                            <Upload className="h-4 w-4 mr-1" />Upload
                            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                          </label>
                        )}
                      </div>
                    </div>
                    {form.logoUrl && (
                      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 inline-flex items-center gap-3">
                        <img src={form.logoUrl} alt="logo preview" className="h-12 w-12 rounded-lg object-cover border border-neutral-200" />
                        <div className="text-xs text-neutral-500">Logo preview</div>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs font-semibold">Subscription plan</Label>
                      <Select value={form.subscription} onValueChange={(v) => setForm({ ...form, subscription: v })}>
                        <SelectTrigger className="mt-1.5 bg-white border-neutral-200"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white">{SUBSCRIPTIONS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    {!editing && (
                      <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                        On creation, credentials and subscription details will be emailed to this restaurant address.
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={save} className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-full px-5">
                      {editing ? 'Save changes' : 'Create & generate credentials'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="overflow-x-auto -mx-5 md:-mx-6 px-5 md:px-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-neutral-500 text-[10px] uppercase tracking-widest font-semibold">
                  <th className="text-left py-3 px-2 font-semibold">Restaurant</th>
                  <th className="text-left py-3 px-2 font-semibold">Owner</th>
                  <th className="text-left py-3 px-2 font-semibold">Email</th>
                  <th className="text-left py-3 px-2 font-semibold">Plan</th>
                  <th className="text-left py-3 px-2 font-semibold">Domain</th>
                  <th className="text-left py-3 px-2 font-semibold">Created</th>
                  <th className="text-right py-3 px-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {list.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-neutral-400">No restaurants yet — add your first to get started.</td></tr>
                )}
                {list.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-50/60">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2.5">
                        {r.logoUrl ? (
                          <img src={r.logoUrl} alt={r.name} className="h-9 w-9 rounded-lg border border-neutral-200 object-cover" />
                        ) : (
                          <NetrikLogo className="h-[6.75rem] w-[6.75rem]" />
                        )}
                        <div>
                          <div className="font-semibold text-neutral-900">{r.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="text-neutral-800">{r.ownerName}</div>
                      <div className="text-xs text-neutral-400">{r.contact}</div>
                    </td>
                    <td className="py-3 px-2 text-neutral-600 text-xs">{r.email || '—'}</td>
                    <td className="py-3 px-2">
                      <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 rounded-full font-semibold">
                        {r.subscription}
                      </Badge>
                    </td>
                    <td className="py-3 px-2 font-mono text-xs text-neutral-500">{r.domain || '—'}</td>
                    <td className="py-3 px-2 text-xs text-neutral-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-neutral-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => setShowCredsFor(r)}>
                        <QrCode className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-neutral-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => startEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50" onClick={() => setDeleteTarget(r)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Credentials & QR Modal */}
        <Dialog open={!!showCredsFor} onOpenChange={(v) => !v && setShowCredsFor(null)}>
          <DialogContent className="bg-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-display tracking-tight">
                Credentials — {showCredsFor?.name}
              </DialogTitle>
            </DialogHeader>
            {showCredsFor && (
              <div className="space-y-4">
                <div className="rounded-xl border border-neutral-200 p-4 bg-neutral-50/40">
                  <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold mb-2">
                    Manager Login
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm">{showCredsFor.managerCreds?.userId}</span>
                    <Button size="sm" variant="ghost" onClick={() => copy(showCredsFor.managerCreds?.userId)} className="h-7 w-7 p-0">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm">{showCredsFor.managerCreds?.password}</span>
                    <Button size="sm" variant="ghost" onClick={() => copy(showCredsFor.managerCreds?.password)} className="h-7 w-7 p-0">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-200 p-4 bg-neutral-50/40">
                  <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold mb-2">
                    Chef Login
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm">{showCredsFor.chefCreds?.userId}</span>
                    <Button size="sm" variant="ghost" onClick={() => copy(showCredsFor.chefCreds?.userId)} className="h-7 w-7 p-0">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm">{showCredsFor.chefCreds?.password}</span>
                    <Button size="sm" variant="ghost" onClick={() => copy(showCredsFor.chefCreds?.password)} className="h-7 w-7 p-0">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="rounded-xl border border-neutral-200 p-4 bg-neutral-50/40 text-center">
                  <div className="text-[10px] uppercase tracking-widest text-emerald-700 font-bold mb-2">
                    Tenant QR
                  </div>
                  <img
                    alt="qr"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(JSON.stringify({ tenant: showCredsFor.id, name: showCredsFor.name, domain: showCredsFor.domain }))}`}
                    className="mx-auto rounded-lg"
                  />
                  <div className="text-xs text-neutral-500 mt-2">
                    Onboarding email target: {showCredsFor.email || 'not provided'}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
          <DialogContent className="bg-white max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display tracking-tight">Delete restaurant</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-neutral-600 leading-relaxed">
                This action will permanently remove <span className="font-semibold text-neutral-900">{deleteTarget?.name}</span>, including menus, tables, orders and chat history.
              </p>
              <div>
                <Label className="text-xs font-semibold">Enter delete password</Label>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="mt-1.5 bg-white border-neutral-200"
                  placeholder="Type password"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="rounded-full border-neutral-200" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button className="bg-rose-600 hover:bg-rose-700 text-white rounded-full" onClick={remove}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
