'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Minus, Plus, ShoppingBag, UtensilsCrossed, AlertTriangle, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export default function PlaceOrderPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [cart, setCart] = useState([]);
  
  const [allergy, setAllergy] = useState('');
  const [chefNotes, setChefNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('netrik_user') || 'null');
    if (!u || u.type !== 'server') {
      router.push('/login');
      return;
    }
    setMe(u);
    load(u);
  }, [router]);

  const load = async (u) => {
    try {
      const serverData = await fetch(`/api/server/me?serverId=${u.serverId}`, { cache: 'no-store' }).then(r => r.json());
      if (serverData.server) {
        setRestaurant({ id: serverData.server.restaurantId, name: serverData.server.restaurantName });
        setTables(serverData.tables || []);
        
        const menuData = await fetch(`/api/menu?restaurantId=${serverData.server.restaurantId}&availableOnly=1`, { cache: 'no-store' }).then(r => r.json());
        setMenu(menuData.menu || []);
      }
    } catch (e) {
      console.error('Load error:', e);
      toast.error('Failed to load data');
    }
  };

  const categories = useMemo(() => {
    const unique = Array.from(new Set((menu || []).map((m) => m.category || 'Other')));
    return ['All', ...unique];
  }, [menu]);
  
  const [menuCategory, setMenuCategory] = useState('All');

  const filteredMenu = useMemo(() => {
    let list = menu || [];
    if (menuCategory !== 'All') list = list.filter((m) => (m.category || 'Other') === menuCategory);
    return list;
  }, [menu, menuCategory]);

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart]);

  const updateQuantity = (item, delta) => {
    setCart((prev) => {
      const existing = prev.find((x) => x.id === item.id);
      if (existing) {
        const nextQty = existing.qty + delta;
        if (nextQty <= 0) return prev.filter((x) => x.id !== item.id);
        return prev.map((x) => x.id === item.id ? { ...x, qty: nextQty } : x);
      }
      if (delta > 0) {
        return [...prev, { id: item.id, name: item.name, price: item.price, qty: 1 }];
      }
      return prev;
    });
  };

  const placeOrder = async () => {
    if (!selectedTable) return toast.error('Please select a table');
    if (cart.length === 0) return toast.error('Cart is empty');
    
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          tableId: selectedTable.id,
          items: cart,
          allergy,
          chefNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to place order');
      
      toast.success('Order placed successfully!');
      router.push('/server');
    } catch (e) {
      toast.error(e.message);
      setSubmitting(false);
    }
  };

  if (!me || !restaurant) {
    return <div className="min-h-screen grid place-items-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50/40 text-neutral-900 pb-20">
      <header className="border-b border-neutral-200/80 sticky top-0 bg-white/85 backdrop-blur-xl z-30">
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push('/server')} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="font-bold tracking-tight">New Order</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Menu Selection */}
          <div className="flex-1 space-y-6">
            <div className="space-y-3">
              <div className="font-semibold text-sm text-neutral-500 uppercase tracking-wider">Select Table</div>
              <div className="flex flex-wrap gap-2">
                {tables.map(t => (
                  <Button
                    key={t.id}
                    variant={selectedTable?.id === t.id ? 'default' : 'outline'}
                    onClick={() => setSelectedTable(t)}
                    className={selectedTable?.id === t.id ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  >
                    Table {t.number}
                  </Button>
                ))}
                {tables.length === 0 && <div className="text-sm text-neutral-500">No tables available.</div>}
              </div>
            </div>

            <div className="space-y-4">
              <div className="font-semibold text-sm text-neutral-500 uppercase tracking-wider">Menu</div>
              <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    variant={menuCategory === cat ? 'default' : 'secondary'}
                    size="sm"
                    className="rounded-full shrink-0"
                    onClick={() => setMenuCategory(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {filteredMenu.map((item) => {
                  const inCart = cart.find(c => c.id === item.id);
                  const qty = inCart ? inCart.qty : 0;
                  return (
                    <div key={item.id} className="bg-white border border-neutral-200 rounded-xl p-4 flex justify-between items-center">
                      <div>
                        <div className="font-bold text-neutral-800">{item.name}</div>
                        <div className="text-sm text-neutral-500">${item.price.toFixed(2)}</div>
                      </div>
                      
                      {qty > 0 ? (
                        <div className="flex items-center gap-3 bg-neutral-100 rounded-full px-1 py-1">
                          <button onClick={() => updateQuantity(item, -1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm text-neutral-600 hover:text-neutral-900">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-semibold tabular-nums min-w-[1ch] text-center">{qty}</span>
                          <button onClick={() => updateQuantity(item, 1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm text-neutral-600 hover:text-neutral-900">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => updateQuantity(item, 1)}>
                          Add
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="lg:w-96 shrink-0">
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 sticky top-24">
              <div className="flex items-center gap-2 mb-6">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <h2 className="font-bold text-lg">Order Summary</h2>
              </div>
              
              <div className="space-y-4 mb-6">
                {cart.length === 0 ? (
                  <div className="text-neutral-400 text-sm text-center py-6">Cart is empty</div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-900">{item.qty}x</span>
                        <span className="text-neutral-600">{item.name}</span>
                      </div>
                      <span className="tabular-nums font-medium">${(item.price * item.qty).toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <>
                  <div className="border-t border-neutral-100 pt-4 mb-6 space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-500 uppercase flex items-center gap-1.5"><AlertTriangle className="w-3 h-3"/> Allergies</label>
                      <Input placeholder="E.g. Peanuts, Shellfish..." value={allergy} onChange={e => setAllergy(e.target.value)} className="bg-neutral-50" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-neutral-500 uppercase flex items-center gap-1.5"><Pencil className="w-3 h-3"/> Chef Notes</label>
                      <Input placeholder="E.g. Extra spicy, sauce on side" value={chefNotes} onChange={e => setChefNotes(e.target.value)} className="bg-neutral-50" />
                    </div>
                  </div>

                  <div className="border-t border-neutral-100 pt-4 mb-6 flex justify-between items-center">
                    <span className="font-semibold text-neutral-600">Total</span>
                    <span className="font-bold text-xl tabular-nums">${cartTotal.toFixed(2)}</span>
                  </div>
                </>
              )}

              <Button
                className="w-full rounded-xl h-12 text-base shadow-sm bg-emerald-600 hover:bg-emerald-700"
                disabled={cart.length === 0 || !selectedTable || submitting}
                onClick={placeOrder}
              >
                {submitting ? 'Placing Order...' : `Place Order${selectedTable ? ` for T${selectedTable.number}` : ''}`}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
