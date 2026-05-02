'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Send, Star, Receipt, Utensils, ChefHat, QrCode, Wallet, Download, X, PlayCircle, ExternalLink, ShoppingBag, Sparkles, Search, FileText, AlertTriangle, Flame, Pencil } from 'lucide-react';

const FALLBACK_MENU_IMAGE = 'https://images.pexels.com/photos/35420084/pexels-photo-35420084.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';

export default function CustomerOrder() {
  const { tableId } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [table, setTable] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]); // {id,name,nameEs,price,qty,notes}
  const [allergy, setAllergy] = useState('');
  const [spicy, setSpicy] = useState('');
  const [notes, setNotes] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId] = useState(() => 'sess_' + Math.random().toString(36).slice(2));
  const [order, setOrder] = useState(null);
  const [stage, setStage] = useState('browsing'); // browsing | ordered | served | paying | feedback | done
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const chatEndRef = useRef(null);
  const reminderRef = useRef(0);
  const [showMenu, setShowMenu] = useState(false);
  const [menuCategory, setMenuCategory] = useState('All');
  const [menuSearch, setMenuSearch] = useState('');
  const [payment, setPayment] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    if (!tableId) return;
    (async () => {
      try {
        const r = await fetch(`/api/tables/${tableId}`, { cache: 'no-store' }).then(r => r.json());
        if (!r.table) { toast.error('Table not found'); return; }
        setTable(r.table);
        const rest = await fetch(`/api/restaurants/${r.table.restaurantId}`, { cache: 'no-store' }).then(r => r.json());
        setRestaurant(rest.restaurant);
        const m = await fetch(`/api/menu?restaurantId=${r.table.restaurantId}&availableOnly=1`, { cache: 'no-store' }).then(r => r.json());
        setMenu(m.menu || []);
        
        setMessages([
          { role: 'assistant', text: `Hi there! 👋 Welcome to ${rest.restaurant?.name || 'our restaurant'}. I'm your digital waiter. What are you craving today? You can ask for recommendations, add items, place your order, and pay online directly in this chat.` }
        ]);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [tableId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Poll order status
  useEffect(() => {
    if (!order) return;
    const id = setInterval(async () => {
      const r = await fetch(`/api/orders/${order.id}`, { cache: 'no-store' }).then(r => r.json());
      if (r.order) {
        setOrder(r.order);
        if (r.order.paymentReference || r.order.paymentQr) {
          setPayment((prev) => ({
            reference: r.order.paymentReference || prev?.reference || '',
            vpa: r.order.paymentVpa || prev?.vpa || '',
            payee: restaurant?.name || prev?.payee || '',
            amount: r.order.total?.toFixed?.(2) || prev?.amount || '',
            status: r.order.paymentStatus || prev?.status || '',
            upiUri: r.order.paymentQr || prev?.upiUri || '',
            createdAt: r.order.paymentCreatedAt || prev?.createdAt || null,
          }));
        }
        if (r.order.status === 'ready' && stage === 'ordered') {
          setStage('served');
          setMessages(m => [...m, { role: 'assistant', text: `✨ Good news! Your food is ready. Please enjoy your meal.` }]);
        }
      }
    }, 4000);
    return () => clearInterval(id);
  }, [order, stage, restaurant]);

  useEffect(() => {
    if (!order || stage !== 'paying') return;
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/payment/upi/status?orderId=${order.id}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !active) return;
        if (data.order) setOrder(data.order);
        if (data.payment) setPayment(data.payment);
        if (data.payment?.status === 'paid' || data.order?.status === 'paid') {
          setPaymentOpen(false);
          setStage('feedback');
          const ref = data.payment?.reference || data.order?.paymentReference;
          const base = ref ? `✅ Payment confirmed! Reference ${ref}.` : '✅ Payment confirmed!';
          setMessages(m => [...m, { role: 'assistant', text: `${base} Please rate your experience.` }]);
        }
      } catch {
        // Keep polling silently
      }
    };

    poll();
    const id = setInterval(poll, 3000);
    return () => { active = false; clearInterval(id); };
  }, [order, stage]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set((menu || []).map((m) => m.category || 'Other')));
    return ['All', ...unique];
  }, [menu]);

  const filteredMenu = useMemo(() => {
    let list = menu || [];
    if (menuCategory !== 'All') list = list.filter((m) => (m.category || 'Other') === menuCategory);
    if (menuSearch.trim()) {
      const q = menuSearch.toLowerCase();
      list = list.filter((m) => (m.name || '').toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q));
    }
    return list;
  }, [menu, menuCategory, menuSearch]);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart]);

  const mergeItemsIntoCart = (baseCart, additions = []) => {
    const next = [...baseCart.map((x) => ({ ...x }))];
    additions.forEach((it) => {
      const foundMenu = menu.find((x) => x.id === it.id || String(x.name).toLowerCase() === String(it.name || '').toLowerCase());
      if (!foundMenu) return;
      const qty = Math.max(1, parseInt(it.quantity || '1', 10));
      const ex = next.find((x) => x.id === foundMenu.id);
      if (ex) ex.qty += qty;
      else next.push({ id: foundMenu.id, name: foundMenu.name, nameEs: foundMenu.nameEs || '', price: foundMenu.price, qty, notes: '' });
    });
    return next;
  };

  const addToCartItem = (item) => {
    if (!item) return;
    setCart((prev) => {
      const next = [...prev.map((x) => ({ ...x }))];
      const found = next.find((x) => x.id === item.id);
      if (found) found.qty += 1;
      else next.push({ id: item.id, name: item.name, nameEs: item.nameEs || '', price: item.price, qty: 1, notes: '' });
      return next;
    });
    toast.success(`${item.name} added to cart`);
  };

  const downloadReceipt = (currentOrder, currentPayment) => {
    if (!currentOrder) return;
    const lines = [
      `${restaurant?.name || 'Restaurant'} Receipt`,
      `Order: ${currentOrder.id}`,
      `Table: ${currentOrder.tableNumber}`,
      `Status: ${currentOrder.status}`,
      `Payment: ${currentOrder.paymentStatus || currentPayment?.status || 'unpaid'}`,
      currentOrder.paymentReference || currentPayment?.reference ? `Reference: ${currentOrder.paymentReference || currentPayment?.reference}` : '',
      currentOrder.paymentProvider ? `Provider: ${currentOrder.paymentProvider}` : '',
      currentOrder.paymentMethod ? `Method: ${currentOrder.paymentMethod}` : '',
      currentOrder.paymentVpa || currentPayment?.vpa ? `VPA: ${currentOrder.paymentVpa || currentPayment?.vpa}` : '',
      `Total: $${currentOrder.total.toFixed(2)}`,
      `Created: ${new Date(currentOrder.createdAt).toLocaleString()}`,
      '',
      'Items:',
      ...(currentOrder.items || []).map((i) => `- ${i.qty}x ${i.name} (${(i.price * i.qty).toFixed(2)})`),
    ].filter(Boolean);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${currentOrder.id.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const placeOrder = async (itemsOverride = null) => {
    const items = itemsOverride || cart;
    if (items.length === 0) return toast.error('Cart is empty');
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: restaurant.id, tableId: table.id, items, allergy, spicyLevel: spicy, notes }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Failed');
    setOrder(data.order);
    setPayment(null);
    setStage('ordered');
    setCart([]);
    setBurst(true);
    setTimeout(() => setBurst(false), 2800);
    setMessages(m => [...m, { role: 'assistant', text: `🎉 Order confirmed! Ticket #${data.order.id.slice(0,6).toUpperCase()} sent to the kitchen. They're cooking it now — I'll ping you the moment it's ready.` }]);
  };

  const addOnsAfterOrder = async (itemsOverride = null) => {
    const items = itemsOverride || cart;
    if (items.length === 0 || !order) return toast.error('Cart is empty');
    const res = await fetch(`/api/orders/${order.id}/addons`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Failed');
    setOrder(data.order);
    setCart([]);
    setMessages(m => [...m, { role: 'assistant', text: `Done! I've added those to your existing tab. Your new total is $${data.order.total.toFixed(2)}.` }]);
  };

  const startUpiPayment = async () => {
    if (!order) return;
    setStage('paying');
    setMessages(m => [...m, { role: 'assistant', text: `Opening UPI payment for $${order.total.toFixed(2)}. Please complete the payment using your UPI app.` }]);
    try {
      const res = await fetch('/api/payment/upi/init', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (!res.ok) return toast.error(data.error || 'Payment init failed');
      setOrder(data.order);
      setPayment(data.payment || null);
      setPaymentOpen(true);
    } catch (e) {
      toast.error('Unable to start UPI payment');
    }
  };

  const submitFeedback = async () => {
    await fetch('/api/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: restaurant.id, tableId: table.id, orderId: order.id, rating, comment: feedback }),
    });
    setStage('done');
    setMessages(m => [...m, { role: 'assistant', text: `Thank you for your feedback! 🙏 Have a wonderful day, and we hope to see you again soon.` }]);
    setTimeout(() => {
      try { window.close(); } catch {}
    }, 900);
  };

  const sendMessage = async (textOverride = null) => {
    const text = textOverride || input.trim();
    if (!text || sending) return;
    const lower = text.toLowerCase();
    const wantsMenu = /\bmenu\b|show\s+me\s+the\s+menu|what\s+do\s+you\s+have|dishes|food/.test(lower);
    if (wantsMenu) {
      setMenuCategory('All');
      setShowMenu(true);
    }
    setMessages(m => [...m, { role: 'user', text }]);
    if (!textOverride) setInput('');
    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, restaurantId: restaurant.id, tableId: table.id, language: 'en',
          message: text,
          menu: menu.map(m => ({ id: m.id, name: m.name, description: m.description, price: m.price, category: m.category })),
          cart,
          allergy, spicy, notes,
          stage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');

      const assistantText = String(data.reply || '').trim();
      if (assistantText) {
        setMessages(m => [...m, { role: 'assistant', text: assistantText }]);
      }

      let nextCart = cart;
      if (data.actions?.add_items?.length) {
        nextCart = mergeItemsIntoCart(cart, data.actions.add_items);
        setCart(nextCart);
      }

      if (data.actions?.set_allergy) setAllergy(data.actions.set_allergy);
      if (data.actions?.set_spicy) setSpicy(data.actions.set_spicy);
      if (data.actions?.set_notes) setNotes(data.actions.set_notes);
      if (data.actions?.show_menu) { setMenuCategory('All'); setShowMenu(true); }
      if (data.actions?.clear_last) {
        setCart((prev) => prev.slice(0, -1));
      }
      if (data.actions?.show_bill && order) {
        setShowBill(true);
      }

      // The AI might reply and place the order in the same turn
      if (data.actions?.place_order) {
        if (stage === 'browsing') await placeOrder(nextCart);
        else if (stage === 'ordered' || stage === 'served') await addOnsAfterOrder(nextCart);
      }

      if (data.actions?.pay_now && order && order.status !== 'paid') {
        setShowBill(true);
      }

      if (order && order.status !== 'paid' && (stage === 'served' || stage === 'paying')) {
        reminderRef.current += 1;
        if (reminderRef.current % 5 === 0) {
          setMessages(m => [...m, { role: 'assistant', text: '⏳ Friendly reminder: your payment is still pending. You can pay anytime in this chat.' }]);
        }
      }
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: 'Sorry, I lost connection for a moment. Could you say that again?' }]);
    } finally {
      setSending(false);
    }
  };

  if (!restaurant || !table) return <div className="min-h-screen bg-[#0b0b0d] text-white flex items-center justify-center font-sans">Connecting to your table...</div>;

  return (
    <div className="fixed inset-0 bg-black flex justify-center overflow-hidden overscroll-none">
      <div className="flex flex-col w-full h-full max-w-lg bg-[#0b0b0d] text-white font-sans shadow-2xl relative overflow-hidden">
      
      {/* Sleek App Header */}
      <div className="flex-none pt-safe bg-gradient-to-b from-black/80 to-transparent backdrop-blur-md z-20 pb-4">
        <div className="px-5 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {restaurant.logoUrl ? (
              <img src={restaurant.logoUrl} alt="Logo" className="w-10 h-10 rounded-full border border-white/20 object-cover shadow-lg" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-400 to-rose-500 grid place-items-center shadow-lg"><ChefHat className="text-black w-5 h-5"/></div>
            )}
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight shadow-black/50">{restaurant.name}</h1>
              <p className="text-[11px] text-white/60 font-medium uppercase tracking-widest">Table {table.number}</p>
            </div>
          </div>
          {order && (
            <div className="text-right flex flex-col items-end gap-1">
               <div className="text-xl font-black text-amber-400">${order.total.toFixed(2)}</div>
               <div className="text-[10px] text-white/50 uppercase tracking-widest">{order.status}</div>
               <div className="text-[10px] text-amber-300 uppercase tracking-widest">payment {order.paymentStatus || payment?.status || 'pending'}</div>
               {order.status !== 'paid' && stage !== 'paying' && stage !== 'feedback' && stage !== 'done' && (
                 <button onClick={() => setShowBill(true)} className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-semibold text-emerald-200 border border-emerald-400/30 hover:bg-emerald-500/30 transition">
                   <FileText className="h-3 w-3"/>View bill & pay
                 </button>
               )}
               {order.status !== 'paid' && stage === 'paying' && (
                 <button onClick={() => setPaymentOpen(true)} className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/80 border border-white/10">
                   <QrCode className="h-3 w-3"/>View payment
                 </button>
               )}
               {order.status === 'paid' && (
                 <button onClick={() => downloadReceipt(order, payment)} className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/80 border border-white/10">
                   <Download className="h-3 w-3"/>Download bill
                 </button>
               )}
            </div>
          )}
        </div>
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 pt-2 hide-scrollbar scroll-smooth">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-white/10 shrink-0 mr-2 mt-auto mb-1 flex items-center justify-center">
                <ChefHat className="w-3.5 h-3.5 text-white/60" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm ${m.role === 'user' ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-black rounded-br-sm font-medium' : 'bg-[#1c1c1e] text-white/90 rounded-bl-sm border border-white/5'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start animate-in fade-in">
             <div className="w-6 h-6 rounded-full bg-white/10 shrink-0 mr-2 mt-auto mb-1 flex items-center justify-center">
                <ChefHat className="w-3.5 h-3.5 text-white/60" />
              </div>
            <div className="bg-[#1c1c1e] text-white/50 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center border border-white/5">
              <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce delay-75"></span>
              <span className="w-1.5 h-1.5 bg-white/40 rounded-full animate-bounce delay-150"></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} className="h-2" />
      </div>

      {/* Quick Action Chips */}
      {stage === 'browsing' && !sending && cart.length === 0 && (
         <div className="px-4 pb-3 flex gap-2 overflow-x-auto hide-scrollbar whitespace-nowrap animate-in slide-in-from-bottom-4">
           <button onClick={() => sendMessage("What are your popular dishes?")} className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-sm font-medium hover:bg-white/20 transition-colors">✨ Recommendations</button>
           <button onClick={() => { setMenuCategory('All'); setShowMenu(true); sendMessage("Show me the menu"); }} className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-sm font-medium hover:bg-white/20 transition-colors"><Utensils className="w-3 h-3 inline mr-1.5"/> Menu</button>
         </div>
      )}

      {cart.length > 0 && stage !== 'paying' && stage !== 'feedback' && stage !== 'done' && (
        <div className="px-4 pb-3">
          <div className="rounded-2xl border border-white/10 bg-[#151518] px-4 py-3 shadow-lg shadow-black/30">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-white/40">Cart</div>
                <div className="text-sm font-semibold">{cartCount} items · ${cartTotal.toFixed(2)}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowMenu(true)} className="text-xs text-white/60 hover:text-white flex items-center gap-1"><ShoppingBag className="h-3.5 w-3.5"/>View</button>
                <Button size="sm" className="bg-amber-400 text-black hover:bg-amber-300" onClick={() => (stage === 'browsing' ? placeOrder() : addOnsAfterOrder())}>{stage === 'browsing' ? 'Place order' : 'Add to tab'}</Button>
              </div>
            </div>
            {(allergy || spicy || notes) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {allergy && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-400/15 border border-rose-300/30 text-rose-200 px-2 py-0.5 text-[10px]">
                    <AlertTriangle className="h-3 w-3"/>{allergy}
                  </span>
                )}
                {spicy && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 border border-amber-300/30 text-amber-200 px-2 py-0.5 text-[10px]">
                    <Flame className="h-3 w-3"/>{spicy}
                  </span>
                )}
                {notes && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 text-white/80 px-2 py-0.5 text-[10px]">
                    <Pencil className="h-3 w-3"/>{notes}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-none p-4 bg-[#0b0b0d] border-t border-white/10 pb-safe z-20">
        <div className="relative flex items-center">
          <Input 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && sendMessage()} 
            placeholder="Type your order or question..." 
            className="w-full bg-[#1c1c1e] border-white/10 text-[15px] h-12 rounded-full pl-5 pr-12 focus-visible:ring-amber-400 focus-visible:border-amber-400 transition-all placeholder:text-white/30" 
            disabled={sending || stage === 'paying' || stage === 'feedback' || stage === 'done'}
          />
          <button 
            onClick={() => sendMessage()} 
            disabled={sending || !input.trim() || stage === 'paying' || stage === 'feedback' || stage === 'done'} 
            className="absolute right-1.5 w-9 h-9 flex items-center justify-center rounded-full bg-amber-400 text-black disabled:opacity-50 disabled:bg-white/10 disabled:text-white/30 transition-colors"
          >
            <Send className="h-4 w-4 ml-0.5" />
          </button>
        </div>
      </div>

      {/* Visual Menu Overlay */}
      {showMenu && (
        <div className="absolute inset-0 z-40">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowMenu(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[78%] rounded-t-3xl bg-[#111114] border-t border-white/10 overflow-hidden flex flex-col">
            <div className="shrink-0 bg-[#111114]/95 backdrop-blur border-b border-white/10 px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.35em] text-amber-300/80">Menu</div>
                  <div className="text-base font-bold flex items-center gap-2"><Sparkles className="h-3.5 w-3.5"/>Browse & tap to add</div>
                </div>
                <button onClick={() => setShowMenu(false)} className="h-9 w-9 rounded-full bg-white/10 grid place-items-center hover:bg-white/20"><X className="h-4 w-4"/></button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40" />
                <input
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Search dishes..."
                  className="w-full bg-black/40 border border-white/10 rounded-full h-10 pl-9 pr-4 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-400 transition"
                />
              </div>
              <div className="mt-3 flex gap-1.5 overflow-x-auto hide-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setMenuCategory(cat)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] uppercase tracking-wider border ${menuCategory === cat ? 'bg-amber-400 text-black border-amber-300' : 'border-white/10 text-white/70 hover:bg-white/10'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <div className="grid grid-cols-2 gap-3">
                {filteredMenu.map((item) => (
                  <Card key={item.id} className="bg-black/40 border-white/10 overflow-hidden flex flex-col">
                    <div className="relative h-24 overflow-hidden shrink-0">
                      <img src={item.image || FALLBACK_MENU_IMAGE} alt={item.name} className="w-full h-full object-cover" />
                      {item.videoUrl && (
                        <div className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] text-white">
                          <PlayCircle className="h-2.5 w-2.5"/> Video
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3 flex-1 flex flex-col">
                      <div className="text-sm font-semibold leading-tight line-clamp-2">{item.name}</div>
                      {item.description && <div className="text-[11px] text-white/55 mt-1 line-clamp-2">{item.description}</div>}
                      <div className="flex items-center justify-between mt-auto pt-2">
                        <div className="text-base font-bold text-amber-300">${item.price.toFixed(2)}</div>
                        <button onClick={() => addToCartItem(item)} className="h-7 w-7 rounded-full bg-amber-400 text-black grid place-items-center hover:bg-amber-300 transition active:scale-95">
                          <span className="text-base font-bold leading-none">+</span>
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {filteredMenu.length === 0 && <div className="text-center text-white/40 py-10 text-sm">No dishes match — try a different search or category.</div>}
            </div>
            {cart.length > 0 && (
              <div className="shrink-0 border-t border-white/10 bg-[#111114] px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-white/40">Cart</div>
                  <div className="text-sm font-semibold">{cartCount} items · ${cartTotal.toFixed(2)}</div>
                </div>
                <Button size="sm" className="bg-amber-400 text-black hover:bg-amber-300" onClick={() => { setShowMenu(false); if (stage === 'browsing') placeOrder(); else addOnsAfterOrder(); }}>{stage === 'browsing' ? 'Place order' : 'Add to tab'}</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========== BILL MODAL (before payment) ========== */}
      {showBill && order && (
        <div className="absolute inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5 animate-in fade-in">
          <div className="absolute inset-0" onClick={() => setShowBill(false)} />
          <Card className="relative w-full max-w-md bg-white text-black rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl border-0 max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-br from-amber-400 to-amber-500 px-6 py-5 text-black flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-[0.35em] font-bold opacity-70">Itemised Bill</div>
                <div className="text-2xl font-black tracking-tight mt-0.5">{restaurant.name}</div>
                <div className="text-xs opacity-70 mt-0.5">Table {table.number} · Ticket #{order.id.slice(0,6).toUpperCase()}</div>
              </div>
              <button onClick={() => setShowBill(false)} className="h-8 w-8 rounded-full bg-black/15 hover:bg-black/25 grid place-items-center"><X className="h-4 w-4"/></button>
            </div>
            <CardContent className="p-0 flex-1 overflow-y-auto">
              <div className="px-6 py-4 divide-y divide-gray-100">
                {(order.items || []).map((it, idx) => (
                  <div key={idx} className="py-3 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{it.name}</div>
                      <div className="text-xs text-gray-500">${Number(it.price || 0).toFixed(2)} × {it.qty}</div>
                    </div>
                    <div className="text-sm font-bold tabular-nums">${(Number(it.price || 0) * (it.qty || 1)).toFixed(2)}</div>
                  </div>
                ))}
              </div>
              {(allergy || spicy || notes) && (
                <div className="mx-6 mb-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-900 space-y-0.5">
                  {allergy && <div>⚠ <span className="font-semibold">Allergy:</span> {allergy}</div>}
                  {spicy && <div>🌶 <span className="font-semibold">Spice:</span> {spicy}</div>}
                  {notes && <div>✍ <span className="font-semibold">Notes:</span> {notes}</div>}
                </div>
              )}
              <div className="px-6 pb-4 space-y-1 text-sm">
                {(() => {
                  const subtotal = (order.items || []).reduce((s, i) => s + Number(i.price || 0) * (i.qty || 1), 0);
                  const total = Number(order.total || subtotal);
                  const tax = Math.max(0, total - subtotal);
                  return (
                    <>
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span><span className="tabular-nums">${subtotal.toFixed(2)}</span>
                      </div>
                      {tax > 0.001 && (
                        <div className="flex justify-between text-gray-600">
                          <span>Taxes & service</span><span className="tabular-nums">${tax.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-black pt-2 border-t border-gray-100 mt-2">
                        <span>Total</span><span className="tabular-nums">${total.toFixed(2)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </CardContent>
            <div className="shrink-0 border-t border-gray-100 px-6 py-4 bg-white flex gap-2">
              <Button variant="outline" className="border-gray-200 text-gray-700" onClick={() => downloadReceipt(order, payment)}>
                <Download className="h-4 w-4 mr-1.5"/>Download
              </Button>
              <Button
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-bold h-11 rounded-xl shadow-lg shadow-emerald-500/30"
                disabled={order.status === 'paid'}
                onClick={async () => { setShowBill(false); await startUpiPayment(); }}
              >
                <Wallet className="h-4 w-4 mr-2"/>{order.status === 'paid' ? 'Already paid' : `Pay $${order.total.toFixed(2)} via UPI`}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ========== CONFETTI / SUCCESS BURST ========== */}
      {burst && (
        <div className="absolute inset-0 z-[60] pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-black/40 animate-in fade-in duration-200" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="text-7xl mb-3 animate-bounce">🎉</div>
            <div className="text-2xl font-black text-white drop-shadow-lg">Order placed!</div>
            <div className="text-sm text-amber-200 mt-1">The chef has your ticket.</div>
          </div>
          {Array.from({ length: 28 }).map((_, i) => {
            const emojis = ['🎉','✨','🍽️','🥂','⭐','🍴','💫','🔥'];
            const e = emojis[i % emojis.length];
            const left = Math.random() * 100;
            const delay = Math.random() * 0.4;
            const duration = 1.4 + Math.random() * 0.8;
            const drift = (Math.random() - 0.5) * 80;
            return (
              <span
                key={i}
                className="confetti-particle absolute text-2xl"
                style={{
                  left: `${left}%`,
                  top: '-40px',
                  animationDelay: `${delay}s`,
                  animationDuration: `${duration}s`,
                  '--drift': `${drift}px`,
                }}
              >
                {e}
              </span>
            );
          })}
        </div>
      )}

      {/* UPI Demo Payment Modal */}
      {paymentOpen && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-5 animate-in fade-in">
          <div className="absolute inset-0" onClick={() => setPaymentOpen(false)} />
          <Card className="relative w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl border-0">
            <div className="bg-emerald-500 p-6 text-white text-center">
              <QrCode className="w-12 h-12 mx-auto mb-3 opacity-90" />
              <h2 className="text-xl font-bold">UPI Payment</h2>
              <p className="text-white/90 text-sm mt-1">{restaurant.name}</p>
            </div>
            <CardContent className="p-6 space-y-4 text-black">
              <div className="flex items-end justify-between border-b border-gray-100 pb-3">
                <div>
                  <div className="text-gray-500 text-xs uppercase tracking-widest">Total</div>
                  <div className="text-3xl font-black">${order?.total.toFixed(2)}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase">Status</div>
                  <div className={`text-xs font-semibold ${payment?.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>{payment?.status || order?.paymentStatus || 'pending'}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                Reference: <span className="font-mono text-gray-800">{payment?.reference || order?.paymentReference || 'Generating...'}</span>
              </div>
              <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3 text-center">
                {payment?.upiUri || order?.paymentQr ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payment?.upiUri || order?.paymentQr || '')}`}
                    alt="UPI QR"
                    className="mx-auto"
                  />
                ) : (
                  <div className="text-xs text-gray-400">Preparing QR...</div>
                )}
              </div>
              <div className="text-xs text-gray-500 flex items-center justify-between">
                <span>VPA: <span className="font-mono text-gray-800">{payment?.vpa || order?.paymentVpa || 'netrik@upi'}</span></span>
                <span>Payee: {payment?.payee || 'Netrik Shop'}</span>
              </div>
              <div className="flex gap-2">
                <Button asChild className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white">
                  <a href={payment?.upiUri || order?.paymentQr || '#'}>
                    <ExternalLink className="h-4 w-4 mr-2" />Open UPI App
                  </a>
                </Button>
                <Button variant="outline" className="border-gray-200" onClick={() => downloadReceipt(order, payment)}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              <div className="text-center text-[11px] text-gray-400">This is a demo UPI flow. Your payment will auto-confirm in a few seconds.</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Feedback Modal Overlay */}
      {stage === 'feedback' && (
        <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-500">
          <Card className="bg-[#1c1c1e] border border-white/10 text-white w-full max-w-sm rounded-3xl shadow-2xl">
            <CardContent className="p-8 text-center">
              <Receipt className="h-12 w-12 mx-auto text-amber-400 mb-4"/>
              <div className="text-2xl font-black mb-2">How was it?</div>
              <div className="text-sm text-white/60 leading-relaxed mb-6">Your feedback directly helps {restaurant.name} improve their service.</div>
              <div className="flex justify-center gap-2 mb-6">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={()=>setRating(n)} className={`transition-transform hover:scale-110 ${n <= rating ? 'text-amber-400' : 'text-white/20'}`}>
                    <Star className="h-10 w-10" fill={n <= rating ? 'currentColor' : 'none'}/>
                  </button>
                ))}
              </div>
              <Input placeholder="Leave a nice comment (optional)..." value={feedback} onChange={e=>setFeedback(e.target.value)} className="bg-black/50 border-white/10 rounded-xl h-12 mb-4 placeholder:text-white/30 text-[15px]"/>
              <Button onClick={submitFeedback} className="w-full bg-amber-400 text-black hover:bg-amber-300 h-12 rounded-xl text-lg font-bold shadow-lg shadow-amber-400/20">Submit Feedback</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {stage === 'done' && (
        <div className="absolute inset-0 z-30 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6">
          <Card className="bg-[#1c1c1e] border border-white/10 text-white w-full max-w-sm rounded-3xl shadow-2xl">
            <CardContent className="p-8 text-center">
              <Receipt className="h-10 w-10 mx-auto text-emerald-400 mb-3"/>
              <div className="text-xl font-black">You are all set</div>
              <div className="text-sm text-white/60 mt-2">You can close this tab now.</div>
              <Button onClick={() => { try { window.close(); } catch {} }} className="mt-5 w-full bg-emerald-400 text-black hover:bg-emerald-300 h-11 rounded-xl">Close</Button>
            </CardContent>
          </Card>
        </div>
      )}

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .pt-safe { padding-top: env(safe-area-inset-top); }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .confetti-particle {
          animation-name: confettiFall;
          animation-timing-function: cubic-bezier(0.32, 0.72, 0.36, 1);
          animation-fill-mode: forwards;
        }
        @keyframes confettiFall {
          0% { transform: translate(0,0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--drift, 0), 110vh) rotate(540deg); opacity: 0; }
        }
      `}</style>
      </div>
    </div>
  );
}

