'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, UserCheck, Clock, DollarSign, UtensilsCrossed, Users } from 'lucide-react';
import { toast } from 'sonner';
import { NetrikLogo } from '@/components/netrik-logo';

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

  const getTableOrders = (tableId) => {
    return orders.filter(o => o.tableId === tableId && !['paid', 'cancelled'].includes(o.status));
  };

  const getTableTotal = (tableId) => {
    return getTableOrders(tableId).reduce((sum, o) => sum + (o.total || 0), 0);
  };

  const getTableStatus = (tableId) => {
    const tableOrders = getTableOrders(tableId);
    if (tableOrders.length === 0) return 'available';
    const hasPending = tableOrders.some(o => o.status === 'pending' || o.status === 'preparing');
    const hasReady = tableOrders.some(o => o.status === 'ready' || o.status === 'served');
    if (hasPending) return 'cooking';
    if (hasReady) return 'ready';
    return 'occupied';
  };

  if (!me || !restaurant) return <div className="min-h-screen grid place-items-center bg-[#0b0b0d] text-white">Loading…</div>;

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white">
      <header className="border-b border-white/10 sticky top-0 bg-black/60 backdrop-blur z-30">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-400 to-rose-500 grid place-items-center">
              <UserCheck className="text-black w-5 h-5"/>
            </div>
            <div>
              <div className="font-bold">{restaurant.name} · Server Dashboard</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300/80">by Netrik Shop · {me.serverName || me.userId}</div>
            </div>
          </div>
          <Button variant="ghost" className="text-white/70" onClick={() => { localStorage.removeItem('netrik_user'); router.push('/login'); }}><LogOut className="h-4 w-4 mr-2"/>Logout</Button>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-400/20 grid place-items-center">
                <UtensilsCrossed className="h-6 w-6 text-amber-300"/>
              </div>
              <div>
                <div className="text-2xl font-black">{tables.length}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Assigned Tables</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-400/20 grid place-items-center">
                <Clock className="h-6 w-6 text-blue-300"/>
              </div>
              <div>
                <div className="text-2xl font-black">{orders.filter(o => ['pending', 'preparing'].includes(o.status)).length}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Active Orders</div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-400/20 grid place-items-center">
                <DollarSign className="h-6 w-6 text-emerald-300"/>
              </div>
              <div>
                <div className="text-2xl font-black">${orders.reduce((sum, o) => sum + (o.total || 0), 0).toFixed(2)}</div>
                <div className="text-xs text-white/50 uppercase tracking-wider">Total Revenue</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-sm text-white/60 mb-4 flex items-center gap-2">
          <Users className="h-4 w-4"/>
          Your Tables
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tables.length === 0 && (
            <Card className="col-span-full bg-white/5 border-white/10">
              <CardContent className="p-12 text-center text-white/40 text-lg">
                No tables assigned yet.
              </CardContent>
            </Card>
          )}

          {tables.map(table => {
            const tableOrders = getTableOrders(table.id);
            const total = getTableTotal(table.id);
            const status = getTableStatus(table.id);
            
            const statusColors = {
              available: 'bg-gray-400/20 text-gray-300 border-gray-400/30',
              cooking: 'bg-amber-400/20 text-amber-300 border-amber-400/30',
              ready: 'bg-green-400/20 text-green-300 border-green-400/30',
              occupied: 'bg-blue-400/20 text-blue-300 border-blue-400/30',
            };

            return (
              <Card key={table.id} className={`bg-white/5 border-white/10 transition-all hover:bg-white/10 ${status === 'cooking' ? 'ring-2 ring-amber-400/40' : status === 'ready' ? 'ring-2 ring-green-400/40' : ''}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-xs text-white/50">Table</div>
                      <div className="text-3xl font-black">{table.number}</div>
                      <div className="text-xs text-white/40">{table.seats} seats</div>
                    </div>
                    <Badge className={statusColors[status]}>{status}</Badge>
                  </div>

                  {total > 0 && (
                    <div className="mb-3 p-3 rounded-lg bg-black/40 border border-white/5">
                      <div className="text-xs text-white/40 uppercase tracking-wider mb-1">Current Bill</div>
                      <div className="text-2xl font-black text-emerald-300">${total.toFixed(2)}</div>
                    </div>
                  )}

                  {tableOrders.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-white/50 uppercase tracking-wider">Orders</div>
                      {tableOrders.map((order, idx) => (
                        <div key={order.id} className="rounded-lg bg-black/40 border border-white/5 p-2.5">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="text-xs text-white/40">#{order.id.slice(0, 6).toUpperCase()}</div>
                            <Badge className={`text-[9px] px-1.5 py-0.5 ${
                              order.status === 'pending' ? 'bg-amber-400/20 text-amber-300' :
                              order.status === 'preparing' ? 'bg-blue-400/20 text-blue-300' :
                              order.status === 'ready' ? 'bg-green-400/20 text-green-300' :
                              'bg-gray-400/20 text-gray-300'
                            }`}>{order.status}</Badge>
                          </div>
                          <div className="text-xs text-white/70 space-y-0.5">
                            {(order.items || []).slice(0, 3).map((item, i) => (
                              <div key={i} className="flex justify-between">
                                <span>{item.qty}× {item.name}</span>
                                <span className="text-white/40">${(item.price * item.qty).toFixed(2)}</span>
                              </div>
                            ))}
                            {order.items.length > 3 && (
                              <div className="text-white/30 text-[10px]">+{order.items.length - 3} more items</div>
                            )}
                          </div>
                          {(order.allergy || order.spicyLevel || order.notes) && (
                            <div className="mt-2 pt-2 border-t border-white/5 space-y-1 text-[10px]">
                              {order.allergy && <div className="text-rose-300">⚠ Allergy: {order.allergy}</div>}
                              {order.spicyLevel && <div className="text-amber-300">🌶 Spice: {order.spicyLevel}</div>}
                              {order.notes && <div className="text-blue-300">✍ Notes: {order.notes}</div>}
                            </div>
                          )}
                          <div className="mt-2 text-[10px] text-white/30 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5"/>
                            {new Date(order.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {tableOrders.length === 0 && (
                    <div className="text-center py-4 text-white/30 text-xs">
                      No active orders
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
