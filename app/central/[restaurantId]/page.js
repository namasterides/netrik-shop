'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Building2,
  DollarSign,
  Activity,
  Star,
  Users,
  UtensilsCrossed,
  ClipboardList,
  Copy,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Upload,
  Mail,
  Phone,
  MapPin,
  Globe,
  CalendarDays,
  Clock,
  ShieldCheck,
  ChefHat,
  UserCog,
  ConciergeBell,
  CircleDot,
  RefreshCcw,
  Send,
  MessageSquare,
  QrCode,
  ExternalLink,
  Search,
} from 'lucide-react';
import { NetrikLogo } from '@/components/netrik-logo';
import LoadingLogo from '@/components/loading-logo';

const SUBSCRIPTIONS = ['Starter', 'Pro', 'Premium', 'Enterprise'];
const PLAN_PRICE = { Starter: 49, Pro: 99, Premium: 199, Enterprise: 499 };

const PLAN_STYLE = {
  Starter: 'bg-slate-100 text-slate-700 border-slate-200',
  Pro: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Premium: 'bg-violet-50 text-violet-800 border-violet-200',
  Enterprise: 'bg-amber-50 text-amber-800 border-amber-200',
};

const ORDER_STATUS_STYLE = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  preparing: 'bg-blue-50 text-blue-800 border-blue-200',
  ready: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  served: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

const TABLE_STATUS_STYLE = {
  available: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  occupied: 'bg-rose-50 text-rose-700 border-rose-200',
  reserved: 'bg-amber-50 text-amber-800 border-amber-200',
};

function CopyField({ value, masked = false, label }) {
  const [reveal, setReveal] = useState(!masked);
  if (!value) return <span className="text-neutral-400 text-sm">—</span>;
  const display = reveal ? value : '•'.repeat(Math.max(8, Math.min(value.length, 14)));
  return (
    <div className="flex items-center gap-2 group">
      {label && <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold w-20 shrink-0">{label}</span>}
      <code className="font-mono text-[13px] text-neutral-900 bg-neutral-100 px-2.5 py-1 rounded-md border border-neutral-200 flex-1 truncate">
        {display}
      </code>
      {masked && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setReveal((r) => !r)}
          className="h-7 w-7 p-0 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100"
          title={reveal ? 'Hide' : 'Reveal'}
        >
          {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          navigator.clipboard.writeText(value);
          toast.success('Copied');
        }}
        className="h-7 w-7 p-0 text-neutral-500 hover:text-emerald-700 hover:bg-emerald-50"
        title="Copy"
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function CredentialCard({ icon: Icon, role, accent, userId, password, footer }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 hover:border-emerald-300 hover:shadow-sm transition">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl grid place-items-center ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-neutral-900 text-sm">{role}</div>
            <div className="text-[11px] text-neutral-500 uppercase tracking-wider font-medium">Login credentials</div>
          </div>
        </div>
      </div>
      <div className="space-y-2.5">
        <CopyField value={userId} label="User ID" />
        <CopyField value={password} masked label="Password" />
      </div>
      {footer && <div className="mt-3 pt-3 border-t border-neutral-100 text-xs text-neutral-500">{footer}</div>}
    </div>
  );
}

function StatPill({ icon: Icon, label, value, sub, tone = 'emerald' }) {
  const toneMap = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    violet: 'bg-violet-50 text-violet-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <div className="rounded-2xl bg-white border border-neutral-200/80 p-5">
      <div className="flex items-center justify-between">
        <div className={`h-10 w-10 rounded-xl grid place-items-center ${toneMap[tone]}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <div className="mt-3 text-2xl font-extrabold tabular-nums tracking-tight text-neutral-900">{value}</div>
      <div className="text-[11px] uppercase tracking-widest text-neutral-500 font-medium mt-1">{label}</div>
      {sub && <div className="text-xs text-neutral-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function relativeTime(iso) {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function RestaurantDetail() {
  const router = useRouter();
  const params = useParams();
  const restaurantId = params?.restaurantId;

  const [me, setMe] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [summary, setSummary] = useState(null);
  const [servers, setServers] = useState([]);
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [supportThread, setSupportThread] = useState([]);
  const [supportText, setSupportText] = useState('');
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [form, setForm] = useState(null);
  const [orderSearch, setOrderSearch] = useState('');

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('netrik_user') || 'null');
    if (!u || u.type !== 'central') {
      router.push('/login');
      return;
    }
    setMe(u);
  }, [router]);

  useEffect(() => {
    if (!me || !restaurantId) return;
    refresh();
    let channel;
    import('@/lib/supabase').then(({ getSupabase }) => {
      const sb = getSupabase();
      if (sb) {
        channel = sb.channel(`rest-${restaurantId}-realtime`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` }, () => refresh(true))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'rest_tables', filter: `restaurant_id=eq.${restaurantId}` }, () => refresh(true))
          .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages', filter: `restaurant_id=eq.${restaurantId}` }, () => loadSupport())
          .subscribe();
      }
    });
    return () => { if (channel) channel.unsubscribe(); };
  }, [me, restaurantId]);

  const refresh = async (silent = false) => {
    try {
      const [sumRes, srvRes, tblRes, menuRes, ordRes, fbRes] = await Promise.all([
        fetch(`/api/restaurants/${restaurantId}/summary`, { cache: 'no-store' }),
        fetch(`/api/restaurants/${restaurantId}/servers`, { cache: 'no-store' }),
        fetch(`/api/tables?restaurantId=${restaurantId}`, { cache: 'no-store' }),
        fetch(`/api/menu?restaurantId=${restaurantId}`, { cache: 'no-store' }),
        fetch(`/api/orders?restaurantId=${restaurantId}`, { cache: 'no-store' }),
        fetch(`/api/restaurants/${restaurantId}/feedback`, { cache: 'no-store' }),
      ]);
      if (sumRes.status === 404) {
        toast.error('Restaurant not found');
        router.push('/central');
        return;
      }
      const sum = await sumRes.json();
      const srv = await srvRes.json();
      const tbl = await tblRes.json();
      const mn = await menuRes.json();
      const ord = await ordRes.json();
      const fb = await fbRes.json();
      setRestaurant(sum.restaurant);
      setSummary(sum.summary);
      setServers(srv.servers || []);
      setTables(tbl.tables || []);
      setMenu(mn.menu || []);
      setOrders(ord.orders || []);
      setFeedback(fb.feedback || []);
      if (!silent) loadSupport();
    } catch (e) {
      if (!silent) toast.error('Failed to load restaurant');
    } finally {
      setLoading(false);
    }
  };

  const loadSupport = async () => {
    try {
      const r = await fetch(`/api/support?restaurantId=${restaurantId}`, { cache: 'no-store' });
      const d = await r.json();
      setSupportThread(d.messages || []);
    } catch (_) { /* ignore */ }
  };

  const sendSupport = async () => {
    if (!supportText.trim()) return;
    const res = await fetch('/api/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, sender: 'central', message: supportText.trim() }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      return toast.error(d.error || 'Failed to send');
    }
    setSupportText('');
    toast.success('Message sent');
    loadSupport();
  };

  const openEdit = () => {
    if (!restaurant) return;
    setForm({
      name: restaurant.name,
      ownerName: restaurant.ownerName,
      email: restaurant.email || '',
      contact: restaurant.contact,
      address: restaurant.address || '',
      domain: restaurant.domain || '',
      logoUrl: restaurant.logoUrl || '',
      subscription: restaurant.subscription,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!form?.name || !form?.ownerName || !form?.contact || !form?.email) {
      return toast.error('Fill required fields');
    }
    const res = await fetch(`/api/restaurants/${restaurantId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    if (!res.ok) return toast.error(d.error || 'Failed');
    toast.success('Saved');
    setEditOpen(false);
    refresh();
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Image only');
    if (file.size > 1024 * 1024) return toast.error('Max 1MB');
    const reader = new FileReader();
    reader.onload = () => setForm((p) => ({ ...p, logoUrl: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const remove = async () => {
    const res = await fetch(`/api/restaurants/${restaurantId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deletePassword }),
    });
    const d = await res.json();
    if (!res.ok) return toast.error(d.error || 'Failed');
    toast.success('Restaurant deleted');
    router.push('/central');
  };

  const tableNumberById = useMemo(() => {
    const m = {};
    tables.forEach((t) => { m[t.id] = t.number; });
    return m;
  }, [tables]);

  const menuByCategory = useMemo(() => {
    const m = {};
    menu.forEach((it) => {
      const k = it.category || 'Other';
      if (!m[k]) m[k] = [];
      m[k].push(it);
    });
    return m;
  }, [menu]);

  const filteredOrders = useMemo(() => {
    if (!orderSearch.trim()) return orders;
    const q = orderSearch.toLowerCase();
    return orders.filter((o) =>
      String(o.tableNumber).toLowerCase().includes(q)
      || o.status.toLowerCase().includes(q)
      || (o.items || []).some((i) => i.name?.toLowerCase().includes(q))
    );
  }, [orders, orderSearch]);

  if (!me) return null;

  if (loading || !restaurant || !summary) {
    return (
      <div className="min-h-screen bg-neutral-50/40 grid place-items-center">
        <div className="flex flex-col items-center gap-4">
          <LoadingLogo className="h-16 w-16" alt="Loading restaurant" />
          <div className="text-sm text-neutral-500">Loading restaurant…</div>
        </div>
      </div>
    );
  }

  const planTone = PLAN_STYLE[restaurant.subscription] || PLAN_STYLE.Pro;
  const mrr = PLAN_PRICE[restaurant.subscription] || 0;

  return (
    <div className="min-h-screen bg-neutral-50/40 text-neutral-900">
      {/* Top bar */}
      <header className="border-b border-neutral-200/80 sticky top-0 bg-white/85 backdrop-blur-xl z-30">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/central" className="flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 font-medium">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to admin</span>
            </Link>
            <span className="h-5 w-px bg-neutral-200" />
            <NetrikLogo variant="primary" className="h-9 w-auto max-w-[160px]" />
            <div className="font-bold tracking-tight text-sm hidden md:block">Tenant detail</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-9 border-neutral-200 hover:bg-neutral-50"
              onClick={() => refresh()}
            >
              <RefreshCcw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full h-9 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Delete</span>
            </Button>
            <Button
              size="sm"
              className="rounded-full h-9 bg-emerald-700 hover:bg-emerald-800 text-white"
              onClick={openEdit}
            >
              <Pencil className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Edit</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-6 md:py-10 space-y-8">
        {/* Identity card */}
        <div className="rounded-3xl bg-white border border-neutral-200/80 p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="shrink-0">
              {restaurant.logoUrl ? (
                <img
                  src={restaurant.logoUrl}
                  alt={restaurant.name}
                  className="h-24 w-24 md:h-28 md:w-28 rounded-2xl border border-neutral-200 object-cover bg-white"
                />
              ) : (
                <div className="h-24 w-24 md:h-28 md:w-28 rounded-2xl border border-neutral-200 bg-emerald-50 grid place-items-center">
                  <Building2 className="h-10 w-10 text-emerald-700" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-neutral-900 truncate">
                  {restaurant.name}
                </h1>
                <Badge className={`rounded-full font-semibold border ${planTone}`}>
                  {restaurant.subscription}
                </Badge>
                <Badge className="rounded-full font-semibold bg-emerald-50 text-emerald-800 border-emerald-200">
                  <CircleDot className="h-3 w-3 mr-1" /> Active tenant
                </Badge>
              </div>
              <div className="text-sm text-neutral-500 mb-4">
                Tenant ID <code className="font-mono text-[12px] text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded">{restaurant.id}</code>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-2.5 gap-x-6 text-sm">
                <div className="flex items-start gap-2 text-neutral-700">
                  <UserCog className="h-4 w-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Owner</div>
                    <div className="font-medium">{restaurant.ownerName || '—'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-neutral-700">
                  <Phone className="h-4 w-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Contact</div>
                    <div className="font-medium">{restaurant.contact || '—'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-neutral-700">
                  <Mail className="h-4 w-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Email</div>
                    <div className="font-medium truncate">{restaurant.email || '—'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-neutral-700">
                  <Globe className="h-4 w-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Domain</div>
                    <div className="font-medium font-mono text-[13px]">{restaurant.domain || '—'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-neutral-700 sm:col-span-2">
                  <MapPin className="h-4 w-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Address</div>
                    <div className="font-medium">{restaurant.address || '—'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-neutral-700">
                  <CalendarDays className="h-4 w-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Joined</div>
                    <div className="font-medium">{new Date(restaurant.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-neutral-700">
                  <Clock className="h-4 w-4 text-neutral-400 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">Last activity</div>
                    <div className="font-medium">{relativeTime(summary.lastActivity)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatPill icon={DollarSign} label="Lifetime revenue" value={`$${(summary.lifetimeRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub={`$${(summary.todayRevenue || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} today`} tone="emerald" />
          <StatPill icon={Activity} label="Orders" value={(summary.totalOrders || 0).toLocaleString()} sub={`${summary.activeOrders || 0} active · ${summary.todayOrders || 0} today`} tone="blue" />
          <StatPill icon={UtensilsCrossed} label="Tables" value={`${summary.occupiedTables || 0}/${summary.tableCount || 0}`} sub="occupied / total" tone="amber" />
          <StatPill icon={Star} label="Avg rating" value={summary.avgRating ? summary.avgRating.toFixed(1) : '—'} sub={`${summary.feedbackCount || 0} review${summary.feedbackCount === 1 ? '' : 's'}`} tone="violet" />
        </div>

        {/* Plan & MRR strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 text-white p-5">
            <div className="text-[11px] uppercase tracking-widest text-emerald-200 font-semibold">Subscription</div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight">{restaurant.subscription}</div>
            <div className="text-emerald-100 text-sm mt-1">${mrr}/mo MRR contribution</div>
          </div>
          <div className="rounded-2xl bg-white border border-neutral-200/80 p-5">
            <div className="text-[11px] uppercase tracking-widest text-neutral-500 font-semibold">Menu</div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight">{summary.menuAvailable}/{summary.menuCount}</div>
            <div className="text-neutral-500 text-sm mt-1">items available</div>
          </div>
          <div className="rounded-2xl bg-white border border-neutral-200/80 p-5">
            <div className="text-[11px] uppercase tracking-widest text-neutral-500 font-semibold">Staff accounts</div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight">{summary.serverCount + 2}</div>
            <div className="text-neutral-500 text-sm mt-1">1 manager · 1 chef · {summary.serverCount} servers</div>
          </div>
        </div>

        {/* Tabbed sections */}
        <Tabs defaultValue="credentials" className="w-full">
          <TabsList className="bg-white border border-neutral-200 h-auto p-1 rounded-xl flex flex-wrap gap-1 w-full justify-start">
            <TabsTrigger value="credentials" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white rounded-lg px-4 py-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 mr-2" /> Credentials
            </TabsTrigger>
            <TabsTrigger value="tables" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white rounded-lg px-4 py-2 text-sm font-semibold">
              <UtensilsCrossed className="h-4 w-4 mr-2" /> Tables
            </TabsTrigger>
            <TabsTrigger value="menu" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white rounded-lg px-4 py-2 text-sm font-semibold">
              <ClipboardList className="h-4 w-4 mr-2" /> Menu
            </TabsTrigger>
            <TabsTrigger value="orders" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white rounded-lg px-4 py-2 text-sm font-semibold">
              <Activity className="h-4 w-4 mr-2" /> Orders
            </TabsTrigger>
            <TabsTrigger value="feedback" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white rounded-lg px-4 py-2 text-sm font-semibold">
              <Star className="h-4 w-4 mr-2" /> Feedback
            </TabsTrigger>
            <TabsTrigger value="support" className="data-[state=active]:bg-emerald-700 data-[state=active]:text-white rounded-lg px-4 py-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4 mr-2" /> Support
            </TabsTrigger>
          </TabsList>

          {/* CREDENTIALS */}
          <TabsContent value="credentials" className="mt-5 space-y-5">
            <div>
              <div className="font-display font-bold text-lg mb-3 tracking-tight">Management accounts</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CredentialCard
                  icon={UserCog}
                  role="Manager"
                  accent="bg-emerald-100 text-emerald-700"
                  userId={restaurant.managerCreds?.userId}
                  password={restaurant.managerCreds?.password}
                  footer="Full restaurant management — menu, tables, staff, analytics."
                />
                <CredentialCard
                  icon={ChefHat}
                  role="Chef / Kitchen"
                  accent="bg-amber-100 text-amber-700"
                  userId={restaurant.chefCreds?.userId}
                  password={restaurant.chefCreds?.password}
                  footer="Kitchen display — accept and progress orders."
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="font-display font-bold text-lg tracking-tight">Server (waiter) accounts</div>
                <div className="text-xs text-neutral-500">{servers.length} account{servers.length === 1 ? '' : 's'}</div>
              </div>
              {servers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-8 text-center text-neutral-400 text-sm">
                  No server accounts found for this tenant.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {servers.map((s) => {
                    const assigned = (s.assignedTableIds || [])
                      .map((id) => tableNumberById[id])
                      .filter(Boolean);
                    return (
                      <CredentialCard
                        key={s.id}
                        icon={ConciergeBell}
                        role={s.name}
                        accent="bg-blue-100 text-blue-700"
                        userId={s.userId}
                        password={s.password}
                        footer={
                          assigned.length
                            ? `Assigned tables: ${assigned.join(', ')}`
                            : 'No tables assigned yet.'
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-9 w-9 rounded-xl bg-neutral-100 grid place-items-center text-neutral-700">
                  <QrCode className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="font-semibold text-sm">Tenant QR</div>
                  <div className="text-xs text-neutral-500">Encodes tenant id, name and domain</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <img
                  alt="qr"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(JSON.stringify({ tenant: restaurant.id, name: restaurant.name, domain: restaurant.domain }))}`}
                  className="h-32 w-32 rounded-lg border border-neutral-200"
                />
                <div className="text-xs text-neutral-500 leading-relaxed">
                  Scan to load tenant context into onboarding tools. Onboarding email sent to{' '}
                  <span className="font-medium text-neutral-700">{restaurant.email || 'no address on file'}</span>.
                </div>
              </div>
            </div>
          </TabsContent>

          {/* TABLES */}
          <TabsContent value="tables" className="mt-5">
            <div className="rounded-2xl bg-white border border-neutral-200/80 p-5 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-display font-bold text-lg tracking-tight">Tables</div>
                  <div className="text-xs text-neutral-500">{tables.length} table{tables.length === 1 ? '' : 's'} · {summary.occupiedTables} currently occupied</div>
                </div>
              </div>
              {tables.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 text-sm">No tables created yet.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {tables.map((t) => (
                    <div key={t.id} className="rounded-xl border border-neutral-200 bg-white p-4 hover:border-emerald-300 transition">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-[10px] uppercase tracking-widest text-neutral-400 font-semibold">Table</div>
                        <Badge className={`rounded-full text-[10px] font-semibold border ${TABLE_STATUS_STYLE[t.status] || 'bg-neutral-100 text-neutral-700 border-neutral-200'}`}>
                          {t.status}
                        </Badge>
                      </div>
                      <div className="font-display text-2xl font-bold tracking-tight">{t.number}</div>
                      <div className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
                        <Users className="h-3 w-3" /> {t.seats} seats
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* MENU */}
          <TabsContent value="menu" className="mt-5">
            <div className="rounded-2xl bg-white border border-neutral-200/80 p-5 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-display font-bold text-lg tracking-tight">Menu</div>
                  <div className="text-xs text-neutral-500">{menu.length} item{menu.length === 1 ? '' : 's'} · {summary.menuAvailable} currently available</div>
                </div>
              </div>
              {menu.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 text-sm">No menu items created yet.</div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(menuByCategory).map(([cat, items]) => (
                    <div key={cat}>
                      <div className="text-[11px] uppercase tracking-widest font-semibold text-emerald-700 mb-2">
                        {cat} <span className="text-neutral-400 font-medium normal-case tracking-normal">· {items.length} item{items.length === 1 ? '' : 's'}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {items.map((it) => (
                          <div key={it.id} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 bg-white">
                            {it.image ? (
                              <img src={it.image} alt={it.name} className="h-12 w-12 rounded-lg object-cover border border-neutral-200" />
                            ) : (
                              <div className="h-12 w-12 rounded-lg bg-neutral-100 grid place-items-center text-neutral-300">
                                <UtensilsCrossed className="h-5 w-5" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="font-semibold text-sm text-neutral-900 truncate">{it.name}</div>
                                {!it.available && (
                                  <Badge className="rounded-full text-[10px] bg-rose-50 text-rose-700 border-rose-200">unavailable</Badge>
                                )}
                              </div>
                              <div className="text-xs text-neutral-500 truncate">{it.description || '—'}</div>
                            </div>
                            <div className="font-semibold text-sm tabular-nums text-neutral-900">${parseFloat(it.price).toFixed(2)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ORDERS */}
          <TabsContent value="orders" className="mt-5">
            <div className="rounded-2xl bg-white border border-neutral-200/80 p-5 md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="font-display font-bold text-lg tracking-tight">Recent orders</div>
                  <div className="text-xs text-neutral-500">Latest {orders.length} order{orders.length === 1 ? '' : 's'} · live</div>
                </div>
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <Input
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    placeholder="Search by table, item, status…"
                    className="pl-9 h-9 w-72 max-w-full bg-white border-neutral-200"
                  />
                </div>
              </div>
              {filteredOrders.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 text-sm">
                  {orders.length === 0 ? 'No orders yet for this tenant.' : 'No orders match your search.'}
                </div>
              ) : (
                <div className="overflow-x-auto -mx-5 md:-mx-6 px-5 md:px-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-neutral-500 text-[10px] uppercase tracking-widest font-semibold border-b border-neutral-100">
                        <th className="text-left py-3 px-2 font-semibold">When</th>
                        <th className="text-left py-3 px-2 font-semibold">Table</th>
                        <th className="text-left py-3 px-2 font-semibold">Items</th>
                        <th className="text-left py-3 px-2 font-semibold">Status</th>
                        <th className="text-left py-3 px-2 font-semibold">Payment</th>
                        <th className="text-right py-3 px-2 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {filteredOrders.slice(0, 100).map((o) => (
                        <tr key={o.id} className="hover:bg-neutral-50/60">
                          <td className="py-3 px-2 text-neutral-500 text-xs whitespace-nowrap">{relativeTime(o.createdAt)}</td>
                          <td className="py-3 px-2 font-mono text-xs">#{o.tableNumber}</td>
                          <td className="py-3 px-2 text-neutral-700 text-xs max-w-md truncate">
                            {(o.items || []).map((i) => `${i.qty}× ${i.name}`).join(', ') || '—'}
                          </td>
                          <td className="py-3 px-2">
                            <Badge className={`rounded-full text-[10px] font-semibold border ${ORDER_STATUS_STYLE[o.status] || 'bg-neutral-100 text-neutral-700 border-neutral-200'}`}>
                              {o.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-xs text-neutral-500">
                            {o.paymentStatus === 'paid' ? (
                              <span className="text-emerald-700 font-semibold">paid · {o.paymentMethod || '—'}</span>
                            ) : (
                              <span className="text-neutral-400">{o.paymentStatus || 'unpaid'}</span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-right tabular-nums font-semibold">${(o.total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* FEEDBACK */}
          <TabsContent value="feedback" className="mt-5">
            <div className="rounded-2xl bg-white border border-neutral-200/80 p-5 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-display font-bold text-lg tracking-tight">Customer feedback</div>
                  <div className="text-xs text-neutral-500">{feedback.length} review{feedback.length === 1 ? '' : 's'} · avg {summary.avgRating || '—'}</div>
                </div>
              </div>
              {feedback.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 text-sm">No customer feedback yet.</div>
              ) : (
                <div className="space-y-3">
                  {feedback.map((f) => (
                    <div key={f.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Star
                              key={n}
                              className={`h-4 w-4 ${n <= (f.rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`}
                            />
                          ))}
                          <span className="ml-2 text-xs text-neutral-500">{f.rating || '—'}/5</span>
                        </div>
                        <span className="text-xs text-neutral-400">{relativeTime(f.createdAt)}</span>
                      </div>
                      <div className="text-sm text-neutral-700">{f.comment || <span className="italic text-neutral-400">No comment</span>}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* SUPPORT */}
          <TabsContent value="support" className="mt-5">
            <div className="rounded-2xl bg-white border border-neutral-200/80 p-5 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-display font-bold text-lg tracking-tight">Support thread</div>
                  <div className="text-xs text-neutral-500">Direct messages with {restaurant.name}</div>
                </div>
              </div>
              <div className="border border-neutral-200 rounded-xl bg-neutral-50/40 h-[420px] overflow-y-auto p-4 space-y-3">
                {supportThread.length === 0 ? (
                  <div className="text-center text-neutral-400 text-sm mt-12">No messages yet.</div>
                ) : (
                  supportThread.map((m) => (
                    <div key={m.id} className={`flex flex-col ${m.sender === 'central' ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                          m.sender === 'central'
                            ? 'bg-emerald-700 text-white rounded-br-sm'
                            : 'bg-white border border-neutral-200 text-neutral-800 rounded-bl-sm'
                        }`}
                      >
                        {m.message}
                      </div>
                      <span className="text-[10px] text-neutral-400 mt-1">{new Date(m.created_at).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <Input
                  value={supportText}
                  onChange={(e) => setSupportText(e.target.value)}
                  placeholder={`Reply to ${restaurant.name}…`}
                  onKeyDown={(e) => e.key === 'Enter' && sendSupport()}
                  className="bg-white border-neutral-200 focus-visible:ring-emerald-700 focus-visible:border-emerald-700"
                />
                <Button onClick={sendSupport} className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-full px-5">
                  <Send className="h-4 w-4 mr-1.5" /> Send
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-white max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display tracking-tight">Edit restaurant</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold">Restaurant name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Owner *</Label>
                  <Input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Email *</Label>
                  <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1.5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Contact *</Label>
                  <Input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Domain</Label>
                  <Input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold">Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-1.5" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs font-semibold">Logo URL</Label>
                  <Input value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Upload</Label>
                  {form.logoUrl && form.logoUrl.startsWith('data:') ? (
                    <div className="mt-1.5 flex items-center gap-2">
                      <img src={form.logoUrl} alt="preview" className="h-10 w-10 object-cover rounded border border-neutral-200" />
                      <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, logoUrl: '' })} className="text-rose-600 hover:bg-rose-50 h-10 px-2">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <label className="mt-1.5 flex h-10 items-center justify-center rounded-md border border-neutral-200 bg-white text-sm cursor-pointer hover:bg-neutral-50 text-neutral-600">
                      <Upload className="h-4 w-4 mr-1" /> Upload
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold">Subscription</Label>
                <Select value={form.subscription} onValueChange={(v) => setForm({ ...form, subscription: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    {SUBSCRIPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} className="rounded-full">Cancel</Button>
            <Button onClick={saveEdit} className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-full px-5">Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-white max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display tracking-tight">Delete tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-neutral-600 leading-relaxed">
              This permanently removes <span className="font-semibold text-neutral-900">{restaurant.name}</span> — all menus, tables, orders, feedback, staff accounts and chat history. This cannot be undone.
            </p>
            <div>
              <Label className="text-xs font-semibold">Delete password</Label>
              <Input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="mt-1.5"
                placeholder="Type password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="rounded-full">Cancel</Button>
            <Button onClick={remove} className="bg-rose-600 hover:bg-rose-700 text-white rounded-full px-5">Delete tenant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
