'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, LogOut, Building2, Users, DollarSign, Activity, QrCode, Pencil, Trash2, Copy, ShieldCheck, Download, Printer, Upload, MessageSquare, CheckCircle2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { NetrikLogo } from '@/components/netrik-logo';

const SUBSCRIPTIONS = ['Starter', 'Pro', 'Premium', 'Enterprise'];
const COLORS = ['#fbbf24', '#fb7185', '#34d399', '#60a5fa'];
const DELETE_PASSWORD_HINT = 'harry';

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
            setSupportMessages(prev => [...prev, payload.new].sort((a,b) => new Date(a.created_at) - new Date(b.created_at)));
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
    if (!editing && data.restaurant) {
      setShowCredsFor(data.restaurant);
    }
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
      body: JSON.stringify({ restaurantId: replyOpen.restaurant_id || replyOpen.id, sender: 'central', message: replyText })
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
    const rows = [['Restaurant','Owner','Email','Contact','Subscription','Domain','Created']];
    list.forEach((r) => {
      rows.push([
        r.name,
        r.ownerName,
        r.email || '',
        r.contact,
        r.subscription,
        r.domain || '',
        new Date(r.createdAt).toLocaleDateString(),
      ]);
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
    const rows = list.map((r) => `
      <tr>
        <td>${r.name}</td>
        <td>${r.ownerName}</td>
        <td>${r.email || '-'}</td>
        <td>${r.contact}</td>
        <td>${r.subscription}</td>
        <td>${r.domain || '-'}</td>
        <td>${new Date(r.createdAt).toLocaleDateString()}</td>
      </tr>
    `).join('');

    w.document.write(`<html><head><title>Restaurants Report</title><style>
      body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#111}
      h1{margin:0 0 8px 0}
      p{margin:0 0 16px 0;color:#444}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left;vertical-align:top}
      th{background:#f6f6f6;text-transform:uppercase;font-size:11px;letter-spacing:.04em}
    </style></head><body>
      <h1>Netrik Shop - Restaurants</h1>
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

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white">
      <header className="border-b border-white/10 sticky top-0 bg-black/60 backdrop-blur z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NetrikLogo className="h-10 w-10"/>
            <div>
              <div className="font-bold">Central Admin</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80">Netrik Shop · HQ</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-9 border-white/20 bg-white/5 hover:bg-white/10 hover:text-white text-white/80 relative">
                  <MessageSquare className="h-4 w-4 mr-2"/> Inbox
                  {supportMessages.filter(m => m.sender === 'restaurant' && !m.read).length > 0 && (
                    <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white border-2 border-black">
                      {supportMessages.filter(m => m.sender === 'restaurant' && !m.read).length}
                    </span>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#111] border-white/10 text-white max-w-2xl h-[600px] flex flex-col p-0">
                <DialogHeader className="p-4 border-b border-white/10 shrink-0"><DialogTitle>Support Inbox</DialogTitle></DialogHeader>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {supportMessages.length === 0 && <div className="text-center text-white/40 mt-10">No support messages yet.</div>}
                  {supportMessages.map(m => {
                    const r = list.find(x => x.id === m.restaurant_id);
                    return (
                      <div key={m.id} className={`flex flex-col ${m.sender === 'central' ? 'items-end' : 'items-start'}`}>
                        {m.sender === 'restaurant' && <div className="text-xs text-white/40 mb-1 ml-1">{r?.name || 'Unknown Restaurant'}</div>}
                        <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${m.sender === 'central' ? 'bg-[#635BFF] text-white rounded-br-sm' : 'bg-white/10 text-white rounded-bl-sm'}`}>
                          {m.message}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-white/30">{new Date(m.created_at).toLocaleString()}</span>
                          {m.sender === 'restaurant' && (
                            <button onClick={() => setReplyOpen(r)} className="text-[10px] text-amber-400 hover:underline">Reply</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {replyOpen && (
                  <div className="p-4 border-t border-white/10 shrink-0 bg-black/50">
                    <div className="text-xs text-amber-300 mb-2 flex justify-between items-center">
                      <span>Replying to {replyOpen.name}</span>
                      <button onClick={() => setReplyOpen(null)} className="text-white/50 hover:text-white">Cancel</button>
                    </div>
                    <div className="flex gap-2">
                      <Input value={replyText} onChange={e=>setReplyText(e.target.value)} placeholder="Type a reply..." className="bg-white/5 border-white/10" onKeyDown={e => e.key === 'Enter' && sendSupportReply()}/>
                      <Button onClick={sendSupportReply} className="bg-amber-400 text-black hover:bg-amber-300">Send</Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <Badge className="bg-amber-400 text-black h-9 px-3 rounded-md"><ShieldCheck className="h-4 w-4 mr-2"/> {me.userId}</Badge>
            <Button variant="ghost" className="h-9 hover:bg-white/10 hover:text-white text-white/70" onClick={() => { localStorage.removeItem('netrik_user'); router.push('/login'); }}><LogOut className="h-4 w-4 mr-2"/>Logout</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* KPI cards */}
        <div className="grid md:grid-cols-4 gap-5">
          {[
            { i: <Building2/>, t: 'Restaurants', v: stats.totalRestaurants, sub: 'active tenants' },
            { i: <DollarSign/>, t: 'Total Revenue', v: `$${(stats.totalRevenue || 0).toLocaleString()}`, sub: 'across all tenants' },
            { i: <Activity/>, t: 'Orders Served', v: (stats.totalOrders || 0).toLocaleString(), sub: 'all-time' },
            { i: <Users/>, t: 'MRR', v: `$${(stats.mrr || 0).toLocaleString()}`, sub: 'monthly recurring' },
          ].map((c) => (
            <Card key={c.t} className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-amber-400/20 text-amber-300 grid place-items-center">{c.i}</div>
                  <Badge variant="outline" className="text-white/60 border-white/20">live</Badge>
                </div>
                <div className="mt-4 text-3xl font-black">{c.v}</div>
                <div className="text-xs uppercase tracking-wider text-white/50 mt-1">{c.t}</div>
                <div className="text-xs text-white/40 mt-0.5">{c.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-3 gap-5">
          <Card className="bg-white/5 border-white/10 lg:col-span-2">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-semibold">Revenue trend</div>
                  <div className="text-xs text-white/50">Last 14 days across all restaurants</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={stats.trend || []}>
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
              <div className="font-semibold mb-4">Subscription mix</div>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={stats.byPlan || []} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
                    {(stats.byPlan || []).map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]}/>))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} itemStyle={{ color: '#fff' }} labelStyle={{ color: '#fff' }}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 text-xs mt-2">
                {(stats.byPlan || []).map((p, i) => (
                  <div key={p.name} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }}/>{p.name} ({p.value})</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Restaurants list */}
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="font-semibold text-lg">Restaurants</div>
                <div className="text-xs text-white/50">{list.length} tenants</div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white" onClick={downloadRestaurantsCsv}><Download className="h-4 w-4 mr-2"/>CSV</Button>
                <Button size="sm" variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white" onClick={printRestaurants}><Printer className="h-4 w-4 mr-2"/>Print A4</Button>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditing(null);
                      setForm({ name: '', ownerName: '', email: '', contact: '', address: '', domain: '', logoUrl: '', subscription: 'Pro' });
                    }} className="bg-amber-400 text-black hover:bg-amber-300"><Plus className="h-4 w-4 mr-2"/>Add restaurant</Button>
                  </DialogTrigger>
                  <DialogContent className="bg-[#111] border-white/10 text-white max-w-xl">
                    <DialogHeader><DialogTitle>{editing ? 'Edit restaurant' : 'New restaurant'}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div><Label>Restaurant name *</Label><Input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="bg-white/5 border-white/10"/></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Owner name *</Label><Input value={form.ownerName} onChange={(e)=>setForm({...form,ownerName:e.target.value})} className="bg-white/5 border-white/10"/></div>
                        <div><Label>Restaurant email *</Label><Input value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} placeholder="owner@restaurant.com" className="bg-white/5 border-white/10"/></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>Contact *</Label><Input value={form.contact} onChange={(e)=>setForm({...form,contact:e.target.value})} className="bg-white/5 border-white/10"/></div>
                        <div><Label>Domain (editable later)</Label><Input value={form.domain} onChange={(e)=>setForm({...form,domain:e.target.value})} placeholder="oasis-cafe.com" className="bg-white/5 border-white/10"/></div>
                      </div>
                      <div><Label>Address</Label><Input value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})} className="bg-white/5 border-white/10"/></div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2"><Label>Logo URL</Label><Input value={form.logoUrl} onChange={(e)=>setForm({...form,logoUrl:e.target.value})} placeholder="https://..." className="bg-white/5 border-white/10"/></div>
                        <div>
                          <Label>Upload logo</Label>
                          {form.logoUrl && form.logoUrl.startsWith('data:') ? (
                            <div className="mt-1.5 flex items-center gap-2">
                              <img src={form.logoUrl} alt="Logo preview" className="h-10 w-10 object-cover rounded border border-white/10"/>
                              <Button variant="ghost" size="sm" onClick={() => setForm({...form, logoUrl:''})} className="text-rose-400 hover:text-rose-300 hover:bg-rose-400/10 h-10 px-2"><Trash2 className="h-4 w-4"/></Button>
                            </div>
                          ) : (
                            <label className="mt-1.5 flex h-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-sm cursor-pointer hover:bg-white/10 text-white/70">
                              <Upload className="h-4 w-4 mr-1"/>Upload
                              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload}/>
                            </label>
                          )}
                        </div>
                      </div>
                      {form.logoUrl && (
                        <div className="rounded-xl border border-white/10 bg-black/40 p-3 inline-flex items-center gap-3">
                          <img src={form.logoUrl} alt="logo preview" className="h-12 w-12 rounded-lg object-cover border border-white/15"/>
                          <div className="text-xs text-white/50">Logo preview</div>
                        </div>
                      )}
                      <div><Label>Subscription plan</Label>
                        <Select value={form.subscription} onValueChange={(v)=>setForm({...form,subscription:v})}>
                          <SelectTrigger className="bg-white/5 border-white/10"><SelectValue/></SelectTrigger>
                          <SelectContent className="bg-[#111] text-white border-white/10">{SUBSCRIPTIONS.map(s=>(<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                        </Select>
                      </div>
                      {!editing && <div className="text-xs text-amber-300/80">On creation, credentials and subscription details will be emailed to this restaurant address.</div>}
                    </div>
                    <DialogFooter><Button onClick={save} className="bg-amber-400 text-black hover:bg-amber-300">{editing ? 'Save changes' : 'Create & generate credentials'}</Button></DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-white/50 text-xs uppercase">
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-2">Restaurant</th>
                    <th className="text-left py-3 px-2">Owner</th>
                    <th className="text-left py-3 px-2">Email</th>
                    <th className="text-left py-3 px-2">Plan</th>
                    <th className="text-left py-3 px-2">Domain</th>
                    <th className="text-left py-3 px-2">Created</th>
                    <th className="text-right py-3 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 && (<tr><td colSpan={7} className="py-10 text-center text-white/40">No restaurants yet — add your first to get started.</td></tr>)}
                  {list.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          {r.logoUrl ? (
                            <img src={r.logoUrl} alt={r.name} className="h-9 w-9 rounded-md border border-white/10 object-cover"/>
                          ) : (
                            <NetrikLogo className="h-9 w-9"/>
                          )}
                          <div>
                            <div className="font-semibold">{r.name}</div>
                            <div className="text-xs text-white/40">by Netrik Shop</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div>{r.ownerName}</div>
                        <div className="text-xs text-white/40">{r.contact}</div>
                      </td>
                      <td className="py-3 px-2 text-white/70 text-xs">{r.email || '—'}</td>
                      <td className="py-3 px-2"><Badge className="bg-amber-400/20 text-amber-300 border-amber-400/30">{r.subscription}</Badge></td>
                      <td className="py-3 px-2 font-mono text-xs text-white/60">{r.domain || '—'}</td>
                      <td className="py-3 px-2 text-xs text-white/50">{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-2 text-right">
                        <Button size="sm" variant="ghost" className="text-white/70" onClick={() => setShowCredsFor(r)}><QrCode className="h-4 w-4"/></Button>
                        <Button size="sm" variant="ghost" className="text-white/70" onClick={() => startEdit(r)}><Pencil className="h-4 w-4"/></Button>
                        <Button size="sm" variant="ghost" className="text-rose-400" onClick={() => setDeleteTarget(r)}><Trash2 className="h-4 w-4"/></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Credentials & QR Modal */}
        <Dialog open={!!showCredsFor} onOpenChange={(v) => !v && setShowCredsFor(null)}>
          <DialogContent className="bg-[#111] border-white/10 text-white max-w-lg">
            <DialogHeader><DialogTitle>Credentials — {showCredsFor?.name}</DialogTitle></DialogHeader>
            {showCredsFor && (
              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 p-4 bg-black/30">
                  <div className="text-xs uppercase tracking-wider text-amber-300 mb-2">Manager Login</div>
                  <div className="flex items-center justify-between gap-2"><span className="font-mono text-sm">{showCredsFor.managerCreds?.userId}</span><Button size="sm" variant="ghost" onClick={()=>copy(showCredsFor.managerCreds?.userId)}><Copy className="h-3 w-3"/></Button></div>
                  <div className="flex items-center justify-between gap-2"><span className="font-mono text-sm">{showCredsFor.managerCreds?.password}</span><Button size="sm" variant="ghost" onClick={()=>copy(showCredsFor.managerCreds?.password)}><Copy className="h-3 w-3"/></Button></div>
                </div>
                <div className="rounded-xl border border-white/10 p-4 bg-black/30">
                  <div className="text-xs uppercase tracking-wider text-amber-300 mb-2">Chef Login</div>
                  <div className="flex items-center justify-between gap-2"><span className="font-mono text-sm">{showCredsFor.chefCreds?.userId}</span><Button size="sm" variant="ghost" onClick={()=>copy(showCredsFor.chefCreds?.userId)}><Copy className="h-3 w-3"/></Button></div>
                  <div className="flex items-center justify-between gap-2"><span className="font-mono text-sm">{showCredsFor.chefCreds?.password}</span><Button size="sm" variant="ghost" onClick={()=>copy(showCredsFor.chefCreds?.password)}><Copy className="h-3 w-3"/></Button></div>
                </div>
                <div className="rounded-xl border border-white/10 p-4 bg-black/30 text-center">
                  <div className="text-xs uppercase tracking-wider text-amber-300 mb-2">Tenant QR</div>
                  <img alt="qr" src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(JSON.stringify({ tenant: showCredsFor.id, name: showCredsFor.name, domain: showCredsFor.domain }))}`} className="mx-auto rounded-lg"/>
                  <div className="text-xs text-white/40 mt-2">Onboarding email target: {showCredsFor.email || 'not provided'}</div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
          <DialogContent className="bg-[#111] border-white/10 text-white max-w-md">
            <DialogHeader><DialogTitle>Delete restaurant</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-sm text-white/70">This action will permanently remove <span className="font-semibold">{deleteTarget?.name}</span>, including menus, tables, orders and chat history.</p>
              <div>
                <Label>Enter delete password</Label>
                <Input type="password" value={deletePassword} onChange={(e)=>setDeletePassword(e.target.value)} className="mt-1.5 bg-white/5 border-white/10" placeholder="Type password"/>
              </div>

            </div>
            <DialogFooter>
              <Button variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white" onClick={() => setDeleteTarget(null)}>Cancel</Button>
              <Button className="bg-rose-600 hover:bg-rose-500 text-white" onClick={remove}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

    </div>
  );
}
