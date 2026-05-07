'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, Clock, CheckCircle2, Printer, ChefHat, Flame, AlertTriangle, FileText } from 'lucide-react';
import { NetrikLogo } from '@/components/netrik-logo';
import LoadingLogo from '@/components/loading-logo';

const BRAND_LOGO_PATH = '/brand/original/netrikshop%20update%20logo.png';

export default function ChefDashboard() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [language, setLanguage] = useState('both');
  const printedOrdersRef = useRef(new Set());
  const hasSeededRef = useRef(false);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('netrik_user') || 'null');
    if (!u || u.type !== 'chef') { router.push('/login'); return; }
    setMe(u);
    load(u);
    let channel;
    if (u) {
      import('@/lib/supabase').then(({ getSupabase }) => {
        const sb = getSupabase();
        if (sb) {
          channel = sb.channel('chef-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${u.restaurantId}` }, () => {
              load(u);
            })
            .subscribe();
        }
      });
    }

    return () => {
      if (channel) channel.unsubscribe();
    };
  }, [router]);

  const load = async (u) => {
    const [r, o] = await Promise.all([
      fetch(`/api/restaurants/${u.restaurantId}`, { cache: 'no-store' }).then(r=>r.json()),
      fetch(`/api/orders?restaurantId=${u.restaurantId}`, { cache: 'no-store' }).then(r=>r.json()),
    ]);
    setRestaurant(r.restaurant);
    const activeOrders = (o.orders || []).filter(x => ['pending','preparing','ready'].includes(x.status));
    setOrders(activeOrders);
    if (!hasSeededRef.current) {
      printedOrdersRef.current = new Set(activeOrders.map((o) => o.id));
      hasSeededRef.current = true;
    }
  };

  // Auto-print KOT when new orders arrive
  useEffect(() => {
    if (!orders.length || !restaurant) return;
    const printed = printedOrdersRef.current;
    const newOrders = orders.filter((o) => !printed.has(o.id));
    if (!newOrders.length) return;
    newOrders
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .forEach((o, idx) => {
        printed.add(o.id);
        setTimeout(() => { printTicket(o); }, idx * 500);
      });
  }, [orders, restaurant]);

  const advance = async (o) => {
    const next = o.status === 'pending' ? 'preparing' : o.status === 'preparing' ? 'ready' : 'served';
    await fetch(`/api/orders/${o.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
    load(me);
  };

  const printTicket = (o) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const brandLogoUrl = new URL(BRAND_LOGO_PATH, window.location.origin).toString();
    const lines = o.items.map((i) => {
      const isAdditional = i.isAdditional || false;
      const additionalMark = isAdditional ? '<span style="color:#047857;font-weight:bold;font-size:11px">[ADDITIONAL]</span>' : '';
      return `<tr><td style="padding:6px 0;border-bottom:1px dashed #ddd"><b>${i.qty}×</b></td><td style="padding:6px 0;border-bottom:1px dashed #ddd"><b>${i.name}</b> ${additionalMark}<br/><span style='color:#666;font-size:11px'>${i.nameEs||''}</span>${i.notes?`<div style='font-size:11px;color:#444'>Note: ${i.notes}</div>`:''}</td></tr>`;
    }).join('');
    w.document.write(`<html><head><title>Ticket #${o.id.slice(0,6)}</title><style>body{font-family:'Inter',monospace;width:300px;padding:16px;color:#111}h2{margin:6px 0 0;font-size:18px}table{width:100%;border-collapse:collapse}td{vertical-align:top}.muted{color:#666;font-size:11px}img{height:28px;width:auto;display:block}</style></head><body>
      <img src="${brandLogoUrl}" alt="Netrik Shop" />
      <h2>${restaurant?.name||''}</h2>
      <div class="muted">Kitchen ticket</div>
      <hr style="border:none;border-top:1px solid #ddd;margin:12px 0"/>
      <div><b>Ticket #${o.id.slice(0,6).toUpperCase()}</b></div>
      <div>Table ${o.tableNumber} · Mesa ${o.tableNumber}</div>
      <div class="muted">${new Date(o.createdAt).toLocaleString()}</div>
      <hr style="border:none;border-top:1px solid #ddd;margin:12px 0"/>
      <table>${lines}</table>
      ${o.allergy?`<p style='color:#b91c1c;margin-top:12px'><b>⚠ Allergy:</b> ${o.allergy}</p>`:''}
      ${o.spicyLevel?`<p style='color:#c2410c;margin-top:8px'><b>🌶 Spice:</b> ${o.spicyLevel}</p>`:''}
      ${o.notes?`<p style='color:#047857;margin-top:8px'><b>✍ Notes:</b> ${o.notes}</p>`:''}
      <script>window.onload=()=>window.print()</script>
    </body></html>`);
  };

  if (!me || !restaurant) {
    return (
      <div className="min-h-screen grid place-items-center bg-white text-neutral-500 text-sm">
        <div className="flex flex-col items-center gap-3">
          <LoadingLogo className="h-12 w-12" alt="Loading kitchen" />
          <div>Loading kitchen…</div>
        </div>
      </div>
    );
  }

  const pending = orders.filter((o) => o.status === 'pending').length;
  const preparing = orders.filter((o) => o.status === 'preparing').length;
  const ready = orders.filter((o) => o.status === 'ready').length;

  return (
    <div className="min-h-screen bg-neutral-50/40 text-neutral-900">
      <header className="border-b border-neutral-200/80 sticky top-0 bg-white/85 backdrop-blur-xl z-30">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-[5.5rem] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {restaurant.logoUrl ? (
              <img src={restaurant.logoUrl} alt={restaurant.name} className="h-11 w-11 rounded-xl object-cover border border-neutral-200" />
            ) : (
              <NetrikLogo className="h-12 w-auto" />
            )}
            <div className="min-w-0">
              <div className="font-bold tracking-tight truncate">{restaurant.name}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-700/80 font-semibold">Kitchen · KOT</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:inline-flex rounded-full border border-neutral-200 bg-white p-1">
              {[
                ['en', 'EN'],
                ['es', 'ES'],
                ['both', 'EN/ES'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLanguage(value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    language === value ? 'bg-emerald-700 text-white shadow-sm' : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-full"
              onClick={() => { localStorage.removeItem('netrik_user'); router.push('/login'); }}
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-6 md:py-8">
        {/* Status counters */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
          <StatusTile label="Pending" value={pending} tone="amber" icon={Clock} />
          <StatusTile label="Preparing" value={preparing} tone="emerald" icon={ChefHat} />
          <StatusTile label="Ready" value={ready} tone="dark" icon={CheckCircle2} />
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-neutral-500">
            {orders.length} active ticket{orders.length === 1 ? '' : 's'}
            <span className="hidden sm:inline"> · {language === 'es' ? 'Spanish' : language === 'both' ? 'Bilingual EN/ES' : 'English'}</span>
          </div>
          <div className="sm:hidden inline-flex rounded-full border border-neutral-200 bg-white p-1">
            {[
              ['en', 'EN'],
              ['es', 'ES'],
              ['both', 'EN/ES'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setLanguage(value)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  language === value ? 'bg-emerald-700 text-white' : 'text-neutral-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-neutral-300 bg-white p-14 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 grid place-items-center text-emerald-700 mb-4">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="font-display text-xl font-bold tracking-tight">All caught up</div>
              <div className="text-sm text-neutral-500 mt-1">No pending tickets in the kitchen.</div>
            </div>
          )}
          {orders.map((o) => (
            <article
              key={o.id}
              className={`rounded-2xl bg-white border transition-all ${
                o.status === 'pending'
                  ? 'border-amber-300 ring-2 ring-amber-200/60 shadow-sm'
                  : o.status === 'ready'
                  ? 'border-emerald-300'
                  : 'border-neutral-200'
              }`}
            >
              <header className="px-5 pt-5 flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-neutral-400">
                    Ticket #{o.id.slice(0, 6).toUpperCase()}
                  </div>
                  <div className="font-display text-3xl font-extrabold tracking-tight mt-1">
                    {language === 'es' ? `Mesa ${o.tableNumber}` : `Table ${o.tableNumber}`}
                  </div>
                  {language === 'both' && (
                    <div className="text-xs text-emerald-700/80 font-medium">Mesa {o.tableNumber}</div>
                  )}
                </div>
                <StatusBadge status={o.status} />
              </header>

              <div className="px-5 mt-4 space-y-2">
                {o.items.map((i, idx) => (
                  <div key={idx} className="rounded-xl bg-neutral-50 border border-neutral-100 p-3">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-emerald-700 tabular-nums">{i.qty}×</span>
                      <span className="text-base font-semibold leading-snug">
                        {language === 'es' ? (i.nameEs || i.name) : i.name}
                      </span>
                    </div>
                    {language === 'both' && i.nameEs && (
                      <div className="text-xs text-neutral-500 mt-0.5 ml-6">{i.qty}× {i.nameEs}</div>
                    )}
                    {i.notes && (
                      <div className="text-xs text-neutral-600 mt-1.5 ml-6 inline-flex items-center gap-1">
                        <FileText className="h-3 w-3 text-neutral-400" />
                        {language === 'es' ? 'Nota' : language === 'both' ? 'Note / Nota' : 'Note'}: {i.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {(o.allergy || o.spicyLevel || o.notes) && (
                <div className="mx-5 mt-3 rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm space-y-1.5">
                  {o.allergy && (
                    <div className="flex items-start gap-1.5 text-rose-800">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span><span className="font-semibold">{language === 'es' ? 'Alergia' : language === 'both' ? 'Allergy / Alergia' : 'Allergy'}:</span> {o.allergy}</span>
                    </div>
                  )}
                  {o.spicyLevel && (
                    <div className="flex items-start gap-1.5 text-amber-800">
                      <Flame className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span><span className="font-semibold">{language === 'es' ? 'Picante' : language === 'both' ? 'Spice / Picante' : 'Spice'}:</span> {o.spicyLevel}</span>
                    </div>
                  )}
                  {o.notes && (
                    <div className="flex items-start gap-1.5 text-neutral-700">
                      <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span><span className="font-semibold">{language === 'es' ? 'Notas' : language === 'both' ? 'Notes / Notas' : 'Notes'}:</span> {o.notes}</span>
                    </div>
                  )}
                </div>
              )}

              <footer className="px-5 py-4 mt-4 border-t border-neutral-100 flex items-center justify-between">
                <div className="text-xs text-neutral-500 inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full h-9 border-neutral-200 hover:bg-neutral-50"
                    onClick={() => printTicket(o)}
                  >
                    <Printer className="h-3.5 w-3.5 mr-1" />
                    Print
                  </Button>
                  {o.status !== 'ready' && (
                    <Button
                      size="sm"
                      onClick={() => advance(o)}
                      className="rounded-full h-9 bg-emerald-700 hover:bg-emerald-800 text-white"
                    >
                      {o.status === 'pending'
                        ? language === 'es' ? 'Iniciar' : language === 'both' ? 'Start' : 'Start'
                        : language === 'es' ? 'Listo' : language === 'both' ? 'Ready' : 'Ready'}
                      <CheckCircle2 className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              </footer>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

function StatusTile({ label, value, tone, icon: Icon }) {
  const styles = {
    amber: 'bg-amber-50 border-amber-100 text-amber-900',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    dark: 'bg-neutral-900 border-neutral-900 text-white',
  };
  const iconStyles = {
    amber: 'bg-white/70 text-amber-700',
    emerald: 'bg-white/70 text-emerald-700',
    dark: 'bg-white/10 text-white',
  };
  return (
    <div className={`rounded-2xl border p-4 md:p-5 ${styles[tone]}`}>
      <div className={`h-9 w-9 rounded-xl grid place-items-center ${iconStyles[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 text-2xl md:text-3xl font-extrabold tabular-nums tracking-tight">{value}</div>
      <div className="text-[11px] uppercase tracking-widest opacity-70 font-medium mt-0.5">{label}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    preparing: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    ready: 'bg-neutral-900 text-white border-neutral-900',
  };
  return (
    <Badge className={`rounded-full text-[10px] uppercase tracking-wider font-semibold ${styles[status] || 'bg-neutral-100 text-neutral-700 border-neutral-200'}`}>
      {status}
    </Badge>
  );
}
