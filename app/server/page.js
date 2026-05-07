'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, UserCheck, Clock, DollarSign, UtensilsCrossed, Users, AlertTriangle, Flame, Pencil } from 'lucide-react';
import { NetrikLogo } from '@/components/netrik-logo';
import LoadingLogo from '@/components/loading-logo';

export default function ServerDashboard() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [tables, setTables] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('netrik_user') || 'null');
    if (!u || u.type !== 'server') { router.push('/login'); return; }
    setMe(u);
    load(u);
    const interval = setInterval(() => load(u), 4000);
    return () => clearInterval(interval);
  }, [router]);

  const load = async (u) => {
    try {
      const [serverData, ordersData] = await Promise.all([
        fetch(`/api/server/me?serverId=${u.serverId}`, { cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/server/orders?serverId=${u.serverId}`, { cache: 'no-store' }).then(r => r.json()),
      ]);
      if (serverData.server) {
        setRestaurant({ id: serverData.server.restaurantId, name: serverData.server.restaurantName });
        setTables(serverData.tables || []);
      }
      setOrders(ordersData.orders || []);
    } catch (e) {
      console.error('Load error:', e);
    }
  };

  const getTableOrders = (tableId) => orders.filter(o => o.tableId === tableId && !['paid', 'cancelled'].includes(o.status));
  const getTableTotal = (tableId) => getTableOrders(tableId).reduce((sum, o) => sum + (o.total || 0), 0);
  const getTableStatus = (tableId) => {
    const tableOrders = getTableOrders(tableId);
    if (tableOrders.length === 0) return 'available';
    const hasPending = tableOrders.some(o => o.status === 'pending' || o.status === 'preparing');
    const hasReady = tableOrders.some(o => o.status === 'ready' || o.status === 'served');
    if (hasPending) return 'cooking';
    if (hasReady) return 'ready';
    return 'occupied';
  };

  if (!me || !restaurant) {
    return (
      <div className="min-h-screen grid place-items-center bg-white text-neutral-500 text-sm">
        <div className="flex flex-col items-center gap-3">
          <LoadingLogo className="h-12 w-12" alt="Loading server view" />
          <div>Loading server view…</div>
        </div>
      </div>
    );
  }

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const activeOrders = orders.filter((o) => ['pending', 'preparing'].includes(o.status)).length;

  return (
    <div className="min-h-screen bg-neutral-50/40 text-neutral-900">
      <header className="border-b border-neutral-200/80 sticky top-0 bg-white/85 backdrop-blur-xl z-30">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-emerald-700 grid place-items-center text-white shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="font-bold tracking-tight truncate">{restaurant.name}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-700/80 font-semibold">
                Server · {me.serverName || me.userId}
              </div>
            </div>
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
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-6 md:py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
          <StatCard icon={UtensilsCrossed} label="Assigned tables" value={tables.length} tone="light" />
          <StatCard icon={Clock} label="Active orders" value={activeOrders} tone="emerald" />
          <StatCard icon={DollarSign} label="Total revenue" value={`$${totalRevenue.toFixed(2)}`} tone="dark" />
        </div>

        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-4">
          <Users className="h-4 w-4" />
          <span className="font-medium">Your tables</span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tables.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-neutral-300 bg-white p-14 text-center">
              <div className="font-display text-xl font-bold tracking-tight">No tables assigned yet</div>
              <div className="text-sm text-neutral-500 mt-1">Ask your manager to assign tables to you.</div>
            </div>
          )}

          {tables.map((table) => {
            const tableOrders = getTableOrders(table.id);
            const total = getTableTotal(table.id);
            const status = getTableStatus(table.id);

            return (
              <article
                key={table.id}
                className={`rounded-2xl bg-white border transition ${
                  status === 'cooking'
                    ? 'border-amber-300 ring-1 ring-amber-200/60'
                    : status === 'ready'
                    ? 'border-emerald-300 ring-1 ring-emerald-200/60'
                    : 'border-neutral-200'
                }`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-medium">Table</div>
                      <div className="font-display text-3xl font-extrabold tracking-tight">{table.number}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">{table.seats} seats</div>
                    </div>
                    <TableStatusBadge status={status} />
                  </div>

                  {total > 0 && (
                    <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                      <div className="text-[10px] uppercase tracking-widest text-emerald-700/70 font-semibold mb-0.5">
                        Current bill
                      </div>
                      <div className="text-xl font-bold text-emerald-800 tabular-nums">${total.toFixed(2)}</div>
                    </div>
                  )}

                  {tableOrders.length > 0 && (
                    <div className="space-y-2.5">
                      <div className="text-[10px] uppercase tracking-widest text-neutral-400 font-semibold">
                        Orders
                      </div>
                      {tableOrders.map((order) => (
                        <div key={order.id} className="rounded-xl border border-neutral-200 bg-neutral-50/40 p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="text-[10px] font-mono text-neutral-400">
                              #{order.id.slice(0, 6).toUpperCase()}
                            </div>
                            <OrderMicroBadge status={order.status} />
                          </div>
                          <div className="text-xs text-neutral-700 space-y-0.5">
                            {(order.items || []).slice(0, 3).map((item, i) => (
                              <div key={i} className="flex justify-between">
                                <span className="truncate pr-2">
                                  <span className="font-semibold">{item.qty}×</span> {item.name}
                                </span>
                                <span className="text-neutral-500 tabular-nums shrink-0">
                                  ${(item.price * item.qty).toFixed(2)}
                                </span>
                              </div>
                            ))}
                            {order.items.length > 3 && (
                              <div className="text-neutral-400 text-[11px]">+{order.items.length - 3} more items</div>
                            )}
                          </div>
                          {(order.allergy || order.spicyLevel || order.notes) && (
                            <div className="mt-2 pt-2 border-t border-neutral-200/80 space-y-1 text-[11px]">
                              {order.allergy && (
                                <div className="text-rose-700 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> Allergy: {order.allergy}
                                </div>
                              )}
                              {order.spicyLevel && (
                                <div className="text-amber-700 flex items-center gap-1">
                                  <Flame className="h-3 w-3" /> Spice: {order.spicyLevel}
                                </div>
                              )}
                              {order.notes && (
                                <div className="text-neutral-700 flex items-center gap-1">
                                  <Pencil className="h-3 w-3" /> {order.notes}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="mt-2 text-[10px] text-neutral-400 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {tableOrders.length === 0 && (
                    <div className="text-center py-5 text-neutral-400 text-xs border-t border-dashed border-neutral-200 mt-2">
                      No active orders
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }) {
  const styles = {
    light: 'bg-white border-neutral-200 text-neutral-900',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    dark: 'bg-neutral-900 border-neutral-900 text-white',
  };
  const iconStyles = {
    light: 'bg-emerald-50 text-emerald-700',
    emerald: 'bg-white/70 text-emerald-700',
    dark: 'bg-white/10 text-white',
  };
  return (
    <div className={`rounded-2xl border p-4 md:p-5 ${styles[tone]}`}>
      <div className={`h-9 w-9 rounded-xl grid place-items-center ${iconStyles[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 text-xl md:text-2xl font-extrabold tracking-tight tabular-nums">{value}</div>
      <div className="text-[11px] uppercase tracking-widest opacity-70 font-medium mt-0.5">{label}</div>
    </div>
  );
}

function TableStatusBadge({ status }) {
  const styles = {
    available: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    cooking: 'bg-amber-100 text-amber-800 border-amber-200',
    ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    occupied: 'bg-neutral-900 text-white border-neutral-900',
  };
  return (
    <Badge className={`rounded-full text-[10px] uppercase tracking-wider font-semibold ${styles[status]}`}>
      {status}
    </Badge>
  );
}

function OrderMicroBadge({ status }) {
  const styles = {
    pending: 'bg-amber-100 text-amber-800',
    preparing: 'bg-emerald-100 text-emerald-800',
    ready: 'bg-neutral-900 text-white',
    served: 'bg-neutral-100 text-neutral-700',
  };
  return (
    <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${styles[status] || 'bg-neutral-100 text-neutral-600'}`}>
      {status}
    </span>
  );
}
