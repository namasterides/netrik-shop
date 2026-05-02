'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, ChefHat, Clock, CheckCircle2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { NetrikLogo } from '@/components/netrik-logo';

export default function ChefDashboard() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [orders, setOrders] = useState([]);
  const [language, setLanguage] = useState('both');
  const [lastOrderCount, setLastOrderCount] = useState(0);

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
    setLastOrderCount(activeOrders.length);
  };

  // Auto-print KOT when new orders arrive
  useEffect(() => {
    if (orders.length > lastOrderCount && lastOrderCount > 0) {
      // New order(s) detected - auto print
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [orders.length, lastOrderCount]);

  const advance = async (o) => {
    const next = o.status === 'pending' ? 'preparing' : o.status === 'preparing' ? 'ready' : 'served';
    await fetch(`/api/orders/${o.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) });
    load(me);
  };

  const printTicket = (o) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const lines = o.items.map((i, idx) => {
      const isAdditional = i.isAdditional || false;
      const additionalMark = isAdditional ? '<span style="color:#ff6b00;font-weight:bold;font-size:12px">[ADDITIONAL]</span>' : '';
      return `<tr><td>${i.qty}×</td><td><b>${i.name}</b> ${additionalMark}<br/><span style='color:#888;font-size:11px'>${i.nameEs||''}</span>${i.notes?`<div style='font-size:11px'>Note: ${i.notes}</div>`:''}</td></tr>`;
    }).join('');
    w.document.write(`<html><head><title>Ticket #${o.id.slice(0,6)}</title><style>body{font-family:monospace;width:300px;padding:10px}h2{margin:0}table{width:100%;border-collapse:collapse}td{padding:4px 0;border-bottom:1px dashed #ccc;vertical-align:top}</style></head><body>
      <h2>${restaurant?.name||''}</h2>
      <div>by Netrik Shop</div>
      <hr/>
      <div><b>Ticket #${o.id.slice(0,6).toUpperCase()}</b></div>
      <div>Table ${o.tableNumber} · Mesa ${o.tableNumber}</div>
      <div>${new Date(o.createdAt).toLocaleString()}</div>
      <hr/>
      <table>${lines}</table>
      ${o.allergy?`<p style='color:#d00'><b>⚠ Allergy:</b> ${o.allergy}</p>`:''}
      ${o.spicyLevel?`<p style='color:#ff6600'><b>🌶 Spice:</b> ${o.spicyLevel}</p>`:''}
      ${o.notes?`<p style='color:#0066cc'><b>✍ Notes:</b> ${o.notes}</p>`:''}
      <script>window.onload=()=>window.print()</script>
    </body></html>`);
  };

  if (!me || !restaurant) return <div className="min-h-screen grid place-items-center bg-[#0b0b0d] text-white">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white">
      <header className="border-b border-white/10 sticky top-0 bg-black/60 backdrop-blur z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {restaurant.logoUrl ? (
              <img src={restaurant.logoUrl} alt={restaurant.name} className="h-9 w-9 rounded-xl object-cover border border-white/10"/>
            ) : (
              <NetrikLogo className="h-9 w-9"/>
            )}
            <div>
              <div className="font-bold">{restaurant.name} · {language === 'es' ? 'Cocina' : language === 'both' ? 'Kitchen / Cocina' : 'Kitchen'}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80">by Netrik Shop · Chef</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
              {[
                ['en', 'EN'],
                ['es', 'ES'],
                ['both', 'Both'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLanguage(value)}
                  className={`rounded-md px-2.5 py-1 text-xs transition ${language === value ? 'bg-amber-400 text-black' : 'text-white/70 hover:bg-white/10'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button variant="ghost" className="text-white/70" onClick={() => { localStorage.removeItem('netrik_user'); router.push('/login'); }}><LogOut className="h-4 w-4 mr-2"/>Logout</Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-6 py-8">
        <div className="text-sm text-white/60 mb-4">{orders.length} active tickets · {language === 'es' ? 'Spanish' : language === 'both' ? 'Bilingual' : 'English'}</div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.length === 0 && <Card className="col-span-full bg-white/5 border-white/10"><CardContent className="p-12 text-center text-white/40 text-lg">All caught up — no pending tickets.</CardContent></Card>}
          {orders.map(o => (
            <Card key={o.id} className={`bg-white/5 border-white/10 ${o.status === 'pending' ? 'ring-2 ring-amber-400/40' : ''}`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-white/50">Ticket #{o.id.slice(0,6).toUpperCase()}</div>
                    <div className="text-3xl font-black">{language === 'es' ? `Mesa ${o.tableNumber}` : `Table ${o.tableNumber}`}</div>
                    {language === 'both' && <div className="text-xs text-amber-300/80">Mesa {o.tableNumber}</div>}
                  </div>
                  <Badge className={o.status === 'pending' ? 'bg-amber-400/20 text-amber-300 border-amber-400/30' : o.status === 'preparing' ? 'bg-blue-400/20 text-blue-300 border-blue-400/30' : 'bg-green-400/20 text-green-300 border-green-400/30'}>{o.status}</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {o.items.map((i,idx) => (
                    <div key={idx} className="rounded-lg bg-black/40 border border-white/5 p-3">
                      <div className="text-lg font-bold">{i.qty}× {language === 'es' ? (i.nameEs || i.name) : i.name}</div>
                      {language === 'both' && i.nameEs && <div className="text-sm text-amber-300/80">{i.qty}× {i.nameEs}</div>}
                      {i.notes && <div className="text-xs text-white/60 mt-1">{language === 'es' ? 'Nota' : language === 'both' ? 'Note / Nota' : 'Note'}: {i.notes}</div>}
                    </div>
                  ))}
                </div>
                {(o.allergy || o.spicyLevel || o.notes) && (
                  <div className="mt-3 rounded-lg bg-rose-400/10 border border-rose-400/30 p-3 text-sm space-y-1">
                    {o.allergy && <div><span className="font-semibold text-rose-300">{language === 'es' ? 'Alergia' : language === 'both' ? 'Allergy / Alergia' : 'Allergy'}:</span> {o.allergy}</div>}
                    {o.spicyLevel && <div><span className="font-semibold text-rose-300">{language === 'es' ? 'Picante' : language === 'both' ? 'Spice / Picante' : 'Spice'}:</span> {o.spicyLevel}</div>}
                    {o.notes && <div><span className="font-semibold text-amber-300">{language === 'es' ? 'Notas' : language === 'both' ? 'Notes / Notas' : 'Notes'}:</span> {o.notes}</div>}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-xs text-white/40 inline-flex items-center"><Clock className="h-3 w-3 mr-1"/>{new Date(o.createdAt).toLocaleTimeString()}</div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="border-white/20 bg-white/5 hover:bg-white/10 text-white" onClick={()=>printTicket(o)}><Printer className="h-3.5 w-3.5 mr-1"/>Print</Button>
                    {o.status !== 'ready' && <Button size="sm" onClick={()=>advance(o)} className="bg-amber-400 text-black hover:bg-amber-300">{o.status === 'pending' ? (language === 'es' ? 'Iniciar' : language === 'both' ? 'Start / Iniciar' : 'Start') : (language === 'es' ? 'Listo' : language === 'both' ? 'Ready / Listo' : 'Ready')}<CheckCircle2 className="h-3.5 w-3.5 ml-1"/></Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
