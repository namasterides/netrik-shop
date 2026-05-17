'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import LoadingLogo from '@/components/loading-logo';
import {
  Send,
  Star,
  Receipt,
  Utensils,
  ChefHat,
  Download,
  X,
  PlayCircle,
  ExternalLink,
  ShoppingBag,
  Sparkles,
  Search,
  FileText,
  AlertTriangle,
  Pencil,
} from 'lucide-react';

const FALLBACK_MENU_IMAGE = 'https://images.pexels.com/photos/35420084/pexels-photo-35420084.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';
const BRAND_LOGO_PATH = '/brand/original/netrikshop%20update%20logo.png';
const STORAGE_VERSION = 1;
const STORAGE_PREFIX = 'netrik_ai_waiter';
const buildStorageKey = (tableId) => (tableId ? `${STORAGE_PREFIX}:${tableId}` : null);

const renderTextWithAnimatedEmojis = (text) => {
  if (!text) return null;
  const parts = String(text).split(/(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu);
  return parts.map((part, i) => {
    if (/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)$/u.test(part)) {
      return <span key={i} className="emoji-pop inline-block text-[1.3em] mx-[1px]" style={{ animationDelay: `${(i % 5) * 0.1}s` }}>{part}</span>;
    }
    return <span key={i}>{part}</span>;
  });
};

export default function CustomerOrder() {
  const { tableId } = useParams();
  const storageKey = buildStorageKey(tableId);
  const [restaurant, setRestaurant] = useState(null);
  const [table, setTable] = useState(null);
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [allergy, setAllergy] = useState('');
  const [preference, setPreference] = useState('');
  const [avoid, setAvoid] = useState('');
  const [chefNotes, setChefNotes] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(() => 'sess_' + Math.random().toString(36).slice(2));
  const [order, setOrder] = useState(null);
  const [stage, setStage] = useState('browsing');
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const chatEndRef = useRef(null);
  const reminderRef = useRef(0);
  const cartPromptedRef = useRef(false);
  const storedHasMessagesRef = useRef(false);
  const persistReadyRef = useRef(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuCategory, setMenuCategory] = useState('All');
  const [menuSearch, setMenuSearch] = useState('');
  const [payment, setPayment] = useState(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [burst, setBurst] = useState(false);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [orderSheetMode, setOrderSheetMode] = useState('place');
  const [draftAllergy, setDraftAllergy] = useState('');
  const [draftPreference, setDraftPreference] = useState('');
  const [draftAvoid, setDraftAvoid] = useState('');
  const [draftChefNotes, setDraftChefNotes] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [pendingItems, setPendingItems] = useState(null);

  useEffect(() => {
    if (!tableId || !storageKey) return;
    const resetUiState = () => {
      setInput('');
      setSending(false);
      setShowMenu(false);
      setMenuCategory('All');
      setMenuSearch('');
      setPaymentOpen(false);
      setShowBill(false);
      setBurst(false);
      setOrderSheetOpen(false);
      setOrderSheetMode('place');
      setPendingItems(null);
      setDraftAllergy('');
      setDraftPreference('');
      setDraftAvoid('');
      setDraftChefNotes('');
    };
    let restored = null;
    try {
      const raw = localStorage.getItem(storageKey);
      restored = raw ? JSON.parse(raw) : null;
      if (restored && (restored.stage === 'done' || (restored.order && restored.order.status === 'paid'))) {
        localStorage.removeItem(storageKey);
        restored = null;
      }
    } catch {
      restored = null;
    }

    if (restored && typeof restored === 'object') {
      if (restored.sessionId) setSessionId(restored.sessionId);
      else setSessionId(`sess_${Math.random().toString(36).slice(2)}`);
      if (Array.isArray(restored.messages)) setMessages(restored.messages);
      if (Array.isArray(restored.cart)) setCart(restored.cart);
      if (typeof restored.allergy === 'string') setAllergy(restored.allergy);
      if (typeof restored.preference === 'string') setPreference(restored.preference);
      if (typeof restored.avoid === 'string') setAvoid(restored.avoid);
      if (typeof restored.chefNotes === 'string') setChefNotes(restored.chefNotes);
      if (restored.order) setOrder(restored.order);
      if (typeof restored.stage === 'string') setStage(restored.stage);
      if (typeof restored.rating === 'number') setRating(restored.rating);
      if (typeof restored.feedback === 'string') setFeedback(restored.feedback);
      if (restored.payment) setPayment(restored.payment);
      if (typeof restored.checkoutUrl === 'string') setCheckoutUrl(restored.checkoutUrl);
      if (restored.table) setTable(restored.table);
      if (restored.restaurant) setRestaurant(restored.restaurant);
      reminderRef.current = Number(restored.reminderCount || 0);
      cartPromptedRef.current = Boolean(restored.cartPrompted);
      storedHasMessagesRef.current = Array.isArray(restored.messages) && restored.messages.length > 0;
      resetUiState();
    } else {
      setSessionId(`sess_${Math.random().toString(36).slice(2)}`);
      setCart([]);
      setAllergy('');
      setPreference('');
      setAvoid('');
      setChefNotes('');
      setMessages([]);
      setOrder(null);
      setStage('browsing');
      setRating(5);
      setFeedback('');
      setPayment(null);
      setCheckoutUrl('');
      setTable(null);
      setRestaurant(null);
      reminderRef.current = 0;
      cartPromptedRef.current = false;
      storedHasMessagesRef.current = false;
      resetUiState();
    }

    persistReadyRef.current = true;
  }, [tableId, storageKey]);

  useEffect(() => {
    if (!tableId) return;
    (async () => {
      try {
        const r = await fetch(`/api/tables/${tableId}`, { cache: 'no-store' }).then((r) => r.json());
        if (!r.table) { toast.error('Table not found'); return; }
        setTable(r.table);
        const rest = await fetch(`/api/restaurants/${r.table.restaurantId}`, { cache: 'no-store' }).then((r) => r.json());
        setRestaurant(rest.restaurant);
        const m = await fetch(`/api/menu?restaurantId=${r.table.restaurantId}&availableOnly=1`, { cache: 'no-store' }).then((r) => r.json());
        setMenu(m.menu || []);

        if (!storedHasMessagesRef.current) {
          setMessages([
            {
              role: 'assistant',
              text: `Hi there 👋 Welcome to ${rest.restaurant?.name || 'our restaurant'}. I'm your digital waiter. What are you craving today? You can ask for recommendations, browse the menu, place your order and pay — all right here in this chat.`,
            },
          ]);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, [tableId]);

  useEffect(() => {
    if (!storageKey || !persistReadyRef.current || !sessionId) return;
    const payload = {
      v: STORAGE_VERSION,
      updatedAt: new Date().toISOString(),
      sessionId,
      table,
      restaurant,
      messages,
      cart,
      allergy,
      preference,
      avoid,
      chefNotes,
      order,
      stage,
      rating,
      feedback,
      payment,
      checkoutUrl,
      reminderCount: reminderRef.current,
      cartPrompted: cartPromptedRef.current,
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {}
  }, [
    storageKey,
    sessionId,
    table,
    restaurant,
    messages,
    cart,
    allergy,
    preference,
    avoid,
    chefNotes,
    order,
    stage,
    rating,
    feedback,
    payment,
    checkoutUrl,
  ]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (stage !== 'browsing') return;
    if (cart.length === 0) {
      cartPromptedRef.current = false;
      return;
    }
    if (!cartPromptedRef.current) {
      setMessages((m) => [...m, { role: 'assistant', text: 'Ready when you are — say “place order” or tap the button to send it to the kitchen.' }]);
      cartPromptedRef.current = true;
    }
  }, [cart, stage]);

  // Poll order status
  useEffect(() => {
    if (!order) return;
    const id = setInterval(async () => {
      const r = await fetch(`/api/orders/${order.id}`, { cache: 'no-store' }).then((r) => r.json());
      if (r.order) {
        setOrder(r.order);
        setPayment((prev) => ({
          reference: r.order.paymentReference || prev?.reference || '',
          provider: r.order.paymentProvider || prev?.provider || 'stripe',
          method: r.order.paymentMethod || prev?.method || 'card',
          amount: r.order.total?.toFixed?.(2) || prev?.amount || '',
          status: r.order.paymentStatus || prev?.status || 'unpaid',
          checkoutUrl: prev?.checkoutUrl || '',
          createdAt: r.order.paymentCreatedAt || prev?.createdAt || null,
        }));
        if (r.order.status === 'ready' && stage === 'ordered') {
          setStage('served');
          setMessages((m) => [...m, { role: 'assistant', text: '✨ Your food is ready. Enjoy your meal! Want anything else, or should I bring the bill?' }]);
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
        const res = await fetch(`/api/payment/stripe/status?orderId=${order.id}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !active) return;
        if (data.order) setOrder(data.order);
        if (data.payment) setPayment((prev) => ({ ...prev, ...data.payment }));
        if (data.payment?.status === 'paid' || data.order?.status === 'paid') {
          setPaymentOpen(false);
          setStage('feedback');
          const ref = data.payment?.reference || data.order?.paymentReference;
          const base = ref ? `✅ Payment confirmed. Reference ${ref}.` : '✅ Payment confirmed.';
          setMessages((m) => [...m, { role: 'assistant', text: `${base} Please rate your experience.` }]);
        }
      } catch {
        // keep polling
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
    toast.success(`${item.name} added`);
  };

  const downloadReceipt = (currentOrder, currentPayment) => {
    if (!currentOrder) return;
    const brandLogoUrl = new URL(BRAND_LOGO_PATH, window.location.origin).toString();
    const details = [
      currentOrder.paymentReference || currentPayment?.reference ? `Reference: ${currentOrder.paymentReference || currentPayment?.reference}` : '',
      currentOrder.paymentProvider ? `Provider: ${currentOrder.paymentProvider}` : '',
      currentOrder.paymentMethod ? `Method: ${currentOrder.paymentMethod}` : '',
    ].filter(Boolean);
    const itemsHtml = (currentOrder.items || []).map((i) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px dashed #e5e7eb;">${i.qty}x</td>
        <td style="padding:8px 0;border-bottom:1px dashed #e5e7eb;">${i.name}</td>
        <td style="padding:8px 0;border-bottom:1px dashed #e5e7eb;text-align:right;">$${(i.price * i.qty).toFixed(2)}</td>
      </tr>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Receipt ${currentOrder.id.slice(0, 8)}</title>
      <style>
        body{font-family:Inter,Segoe UI,Arial,sans-serif;padding:28px;color:#0a0a0a}
        .brand{display:flex;align-items:center;gap:12px;margin-bottom:16px}
        .brand img{height:36px;width:auto}
        h1{font-size:18px;margin:0}
        .meta{color:#6b7280;font-size:12px;margin-top:4px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}
        th{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;text-align:left;padding-bottom:6px}
        td{vertical-align:top}
        .total{font-size:16px;font-weight:700;margin-top:12px;text-align:right}
      </style>
    </head><body>
      <div class="brand">
        ${restaurant?.logoUrl ? `<img src="${restaurant.logoUrl}" alt="${restaurant?.name || 'Restaurant'}" style="height:44px;width:44px;object-fit:cover;display:block;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.05);" />` : ''}
        <div>
          <h1>${restaurant?.name || 'Restaurant'} Receipt</h1>
          <div class="meta">Order ${currentOrder.id.slice(0, 8).toUpperCase()} · Table ${currentOrder.tableNumber}</div>
          ${restaurant?.address ? `<div class="meta">${restaurant.address}</div>` : ''}
          ${restaurant?.contact ? `<div class="meta">${restaurant.contact}</div>` : ''}
        </div>
      </div>
      <div class="meta">Status: ${currentOrder.status} · Payment: ${currentOrder.paymentStatus || currentPayment?.status || 'unpaid'}</div>
      <div class="meta">Created: ${new Date(currentOrder.createdAt).toLocaleString()}</div>
      ${details.length ? details.map((d) => `<div class="meta">${d}</div>`).join('') : ''}
      <table>
        <thead><tr><th>Qty</th><th>Item</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>${itemsHtml || '<tr><td colspan="3">No items</td></tr>'}</tbody>
      </table>
      <div class="total">Total: $${currentOrder.total.toFixed(2)}</div>
      <div style="margin-top:36px;padding-top:20px;border-top:1px dashed #e5e7eb;text-align:center;font-size:10px;color:#9ca3af;letter-spacing:0.02em;">
        POWERED BY
        <div style="margin-top:8px;">
          <img src="${brandLogoUrl}" alt="Netrik Shop" style="height:22px;width:auto;margin:0 auto;opacity:0.85;" />
        </div>
      </div>
    </body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${currentOrder.id.slice(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    setMessages((m) => [...m, { role: 'assistant', text: 'Receipt downloaded. When you are ready, tap Pay to complete payment.' }]);
  };

  const openOrderSheet = (mode = 'place', itemsOverride = null) => {
    setOrderSheetMode(mode);
    setPendingItems(itemsOverride || cart);
    setDraftAllergy(allergy || '');
    setDraftPreference(preference || '');
    setDraftAvoid(avoid || '');
    setDraftChefNotes(chefNotes || '');
    setOrderSheetOpen(true);
  };

  const confirmOrderSheet = async () => {
    const instructions = {
      allergy: draftAllergy.trim(),
      preference: draftPreference.trim(),
      avoid: draftAvoid.trim(),
      chefNotes: draftChefNotes.trim(),
    };
    setAllergy(instructions.allergy);
    setPreference(instructions.preference);
    setAvoid(instructions.avoid);
    setChefNotes(instructions.chefNotes);
    setOrderSheetOpen(false);
    const items = pendingItems || cart;
    setPendingItems(null);
    if (orderSheetMode === 'place') await placeOrder(items, instructions);
    else await addOnsAfterOrder(items);
  };

  const placeOrder = async (itemsOverride = null, instructionsOverride = null) => {
    const items = itemsOverride || cart;
    const instructions = instructionsOverride || {
      allergy,
      preference,
      avoid,
      chefNotes,
    };
    if (items.length === 0) return toast.error('Cart is empty');
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: restaurant.id,
        tableId: table.id,
        items,
        allergy: instructions.allergy,
        preference: instructions.preference,
        avoid: instructions.avoid,
        chefNotes: instructions.chefNotes,
      }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Failed');
    setOrder(data.order);
    setPayment(null);
    setStage('ordered');
    setCart([]);
    setBurst(true);
    setTimeout(() => setBurst(false), 2800);
    setMessages((m) => [...m, { role: 'assistant', text: `🎉 Order confirmed. Ticket #${data.order.id.slice(0, 6).toUpperCase()} is live in the kitchen.` }]);
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
    setMessages((m) => [...m, { role: 'assistant', text: `Added to your tab. New total: $${data.order.total.toFixed(2)}. Want anything else?` }]);
  };

  const startStripePayment = async () => {
    if (!order) return;
    const previousStage = stage;
    setStage('paying');
    setMessages((m) => [...m, { role: 'assistant', text: `Opening secure card payment for $${order.total.toFixed(2)}.` }]);
    try {
      const res = await fetch('/api/payment/stripe/init', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStage(previousStage);
        return toast.error(data.error || 'Payment init failed');
      }
      if (data.order) setOrder(data.order);
      if (data.payment) setPayment(data.payment || null);
      if (data.checkoutUrl) setCheckoutUrl(data.checkoutUrl);
      setPaymentOpen(true);
      if (data.checkoutUrl) window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer');
      else {
        setStage(previousStage);
        toast.error('Checkout URL not returned. Please try again.');
      }
    } catch (e) {
      setStage(previousStage);
      toast.error('Unable to start card payment');
    }
  };

  const openCheckout = () => {
    if (checkoutUrl) {
      window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    startStripePayment();
  };

  const submitFeedback = async () => {
    await fetch('/api/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: restaurant.id, tableId: table.id, orderId: order.id, rating, comment: feedback }),
    });
    setStage('done');
    setMessages((m) => [...m, { role: 'assistant', text: 'Thank you for your feedback 🙏 Have a wonderful day.' }]);
    try { localStorage.removeItem(storageKey); } catch {}
    setTimeout(() => { try { window.close(); } catch {} }, 1500);
  };

  const sendMessage = async (textOverride = null) => {
    const text = textOverride || input.trim();
    if (!text || sending) return;
    const lower = text.toLowerCase();
    if (stage === 'served' && /^(no|nope|nothing|that's all|thats all|bill|check)/i.test(lower)) {
      setMessages((m) => [...m, { role: 'user', text }]);
      if (!textOverride) setInput('');
      setShowBill(true);
      setMessages((m) => [...m, { role: 'assistant', text: 'Got it. Here is your itemized bill.' }]);
      return;
    }
    const wantsMenu = /\bmenu\b|show\s+me\s+the\s+menu|what\s+do\s+you\s+have|dishes|food/.test(lower);
    if (wantsMenu) {
      setMenuCategory('All');
      setShowMenu(true);
    }
    setMessages((m) => [...m, { role: 'user', text }]);
    if (!textOverride) setInput('');
    setSending(true);
    
    // Generate an idempotency key for this chat request
    const actionId = Math.random().toString(36).slice(2);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, restaurantId: restaurant.id, tableId: table.id, language: 'en',
          message: text,
          menu: menu.map((m) => ({ id: m.id, name: m.name, description: m.description, price: m.price, category: m.category, moodTags: m.moodTags || [], tasteTags: m.tasteTags || [], dietaryTags: m.dietaryTags || [] })),
          cart, allergy, preference, avoid, chefNotes, stage,
          clientActionId: actionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat failed');

      const assistantText = String(data.reply || '').trim();
      const suggestedIds = Array.isArray(data.actions?.suggest_items) ? data.actions.suggest_items : [];
      const suggestedItems = suggestedIds.map((id) => menu.find((m) => m.id === id)).filter(Boolean);
      if (assistantText || suggestedItems.length) {
        setMessages((m) => [...m, { role: 'assistant', text: assistantText, items: suggestedItems }]);
      }

      let nextCart = cart;
      if (data.actions?.add_items?.length) {
        nextCart = mergeItemsIntoCart(cart, data.actions.add_items);
        setCart(nextCart);
      }

      if (data.actions?.set_allergy) setAllergy(data.actions.set_allergy);
      if (data.actions?.set_preference) setPreference(data.actions.set_preference);
      if (data.actions?.set_avoid) setAvoid(data.actions.set_avoid);
      if (data.actions?.set_notes) setChefNotes(data.actions.set_notes);
      if (data.actions?.set_spicy && !preference) setPreference(`Spice: ${data.actions.set_spicy}`);
      if (data.actions?.show_menu) { setMenuCategory('All'); setShowMenu(true); }
      if (data.actions?.clear_last) setCart((prev) => prev.slice(0, -1));
      if (data.actions?.show_bill && order) setShowBill(true);

      if (data.actions?.place_order) {
        if (stage === 'browsing') openOrderSheet('place', nextCart);
        else if (stage === 'ordered' || stage === 'served') await addOnsAfterOrder(nextCart);
      }

      if (data.actions?.pay_now && order && order.status !== 'paid') setShowBill(true);

      if (order && order.status !== 'paid' && (stage === 'served' || stage === 'paying')) {
        reminderRef.current += 1;
        if (reminderRef.current % 5 === 0) {
          setMessages((m) => [...m, { role: 'assistant', text: '⏳ Payment is still pending. You can pay anytime here.' }]);
        }
      }
    } catch (e) {
      if (textOverride) setInput(textOverride); // Restore input if it was an explicit button click
      else if (text) setInput(text); // Keep input for manual typing
      setMessages((m) => [...m, { role: 'assistant', text: 'Sorry, I lost connection for a moment.', isError: true, userText: text }]);
    } finally {
      setSending(false);
    }
  };

  if (!restaurant || !table) {
    return (
      <div className="min-h-screen bg-white text-neutral-500 flex items-center justify-center text-sm">
        <div className="flex flex-col items-center gap-3">
          <LoadingLogo className="h-20 w-20" alt="Connecting" />
          <div className="text-xs">Connecting…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-neutral-100/40 flex justify-center overflow-hidden overscroll-none">
      <div className="flex flex-col w-full h-full max-w-lg bg-white text-neutral-900 shadow-xl relative overflow-hidden border-x border-neutral-200/70">
        {/* Sleek App Header */}
        <div className="flex-none pt-safe bg-white/90 backdrop-blur-xl z-20 pb-4 border-b border-neutral-100">
          <div className="px-5 pt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {restaurant.logoUrl ? (
                <img
                  src={restaurant.logoUrl}
                  alt="Logo"
                  className="w-10 h-10 rounded-full border border-neutral-200 object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-700 grid place-items-center text-white">
                  <ChefHat className="w-4 h-4" />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-display font-bold text-base leading-tight tracking-tight truncate">
                  {restaurant.name}
                </h1>
                <p className="text-[10px] text-emerald-700/80 font-semibold uppercase tracking-[0.18em]">
                  Table {table.number}
                </p>
              </div>
            </div>
            {order && (
              <div className="text-right flex flex-col items-end gap-1 shrink-0">
                <div className="text-lg font-extrabold text-emerald-800 tabular-nums leading-none">
                  ${order.total.toFixed(2)}
                </div>
                <div className="text-[9px] text-neutral-500 uppercase tracking-[0.18em] font-medium">
                  {order.status} · pay {order.paymentStatus || payment?.status || 'pending'}
                </div>
                {order.status !== 'paid' && stage !== 'paying' && stage !== 'feedback' && stage !== 'done' && (
                  <button
                    onClick={() => setShowBill(true)}
                    className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-700 text-white px-2.5 py-1 text-[10px] font-semibold hover:bg-emerald-800 transition"
                  >
                    <FileText className="h-3 w-3" />Bill & pay
                  </button>
                )}
                {order.status !== 'paid' && stage === 'paying' && (
                  <button
                    onClick={() => setPaymentOpen(true)}
                    className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-neutral-900 text-white px-2.5 py-1 text-[10px] font-semibold"
                  >
                    <Receipt className="h-3 w-3" />Payment
                  </button>
                )}
                {order.status === 'paid' && (
                  <button
                    onClick={() => downloadReceipt(order, payment)}
                    className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-700 px-2.5 py-1 text-[10px] font-semibold"
                  >
                    <Download className="h-3 w-3" />Bill
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 pt-4 hide-scrollbar scroll-smooth">
          {messages.map((m, i) => {
            const showAvatar = m.role === 'assistant' && (i === 0 || messages[i - 1].role !== 'assistant' || messages[i - 1].isError);
            return (
            <div
              key={i}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className={`w-7 h-7 shrink-0 mr-2 mt-auto mb-1 flex items-center justify-center ${showAvatar ? 'rounded-full bg-emerald-50 border border-emerald-100' : ''}`}>
                    {showAvatar && <ChefHat className="w-3.5 h-3.5 text-emerald-700" />}
                  </div>
                )}
                {m.text && (
                  <div className="flex flex-col max-w-[80%]">
                    <div
                      className={`rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-emerald-700 text-white rounded-br-sm font-medium'
                          : m.isError 
                            ? 'bg-rose-50 text-rose-800 border border-rose-200' 
                            : 'bg-neutral-100 text-neutral-800 rounded-bl-sm border border-neutral-200/60'
                      }`}
                    >
                      {renderTextWithAnimatedEmojis(m.text)}
                    </div>
                    {m.isError && (
                      <button onClick={() => sendMessage(m.userText)} className="self-start mt-2 px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-semibold rounded-full flex items-center gap-1 transition">
                        <RotateCcw className="w-3 h-3"/> Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
              {m.role === 'assistant' && Array.isArray(m.items) && m.items.length > 0 && (
                <div className="ml-9 mt-2 w-[calc(100%-2.25rem)] grid grid-cols-2 gap-2">
                  {m.items.map((item) => {
                    const inCart = cart.find((c) => c.id === item.id);
                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl bg-white border border-neutral-200 overflow-hidden flex flex-col hover:border-emerald-300 hover:shadow-sm transition"
                      >
                        <div className="relative h-20 overflow-hidden bg-neutral-100">
                          <img src={item.image || FALLBACK_MENU_IMAGE} alt={item.name} className="w-full h-full object-cover" />
                          {(item.tasteTags?.length || item.moodTags?.length) ? (
                            <div className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-0.5 overflow-hidden">
                              {[...(item.tasteTags || []), ...(item.moodTags || [])].slice(0, 2).map((t) => (
                                <span key={t} className="rounded-full bg-white/90 backdrop-blur px-1.5 py-0.5 text-[8px] uppercase tracking-wider text-emerald-800 font-semibold">
                                  {t}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="p-2.5 flex-1 flex flex-col">
                          <div className="text-[13px] font-semibold leading-tight line-clamp-2">{item.name}</div>
                          {item.description && <div className="text-[10px] text-neutral-500 mt-0.5 line-clamp-2">{item.description}</div>}
                          <div className="mt-auto pt-1.5 flex items-center justify-between">
                            <div className="text-sm font-bold text-emerald-800 tabular-nums">${Number(item.price).toFixed(2)}</div>
                            <button
                              onClick={() => addToCartItem(item)}
                              className={`h-7 min-w-[44px] rounded-full text-[11px] font-bold transition active:scale-95 ${
                                inCart
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : 'bg-emerald-700 text-white hover:bg-emerald-800'
                              }`}
                            >
                              {inCart ? `× ${inCart.qty}` : '+ Add'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            );
          })}
          {sending && (
            <div className="flex justify-start animate-in fade-in">
              <div className="w-7 h-7 rounded-full bg-emerald-50 border border-emerald-100 shrink-0 mr-2 mt-auto mb-1 flex items-center justify-center">
                <ChefHat className="w-3.5 h-3.5 text-emerald-700" />
              </div>
              <div className="bg-neutral-100 text-neutral-500 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center border border-neutral-200/60">
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          )}
          <div ref={chatEndRef} className="h-2" />
        </div>

        {/* Quick Action Chips */}
        {/* Quick Action Chips */}
        {stage === 'browsing' && !sending && cart.length === 0 && (
          <div className="px-4 pb-3 flex gap-2 overflow-x-auto hide-scrollbar whitespace-nowrap animate-in slide-in-from-bottom-4">
            <button
              onClick={() => sendMessage('What are your popular dishes?')}
              className="px-5 py-3 rounded-full bg-emerald-50 border border-emerald-200 text-base font-bold text-emerald-800 hover:bg-emerald-100 transition shadow-sm"
            >
              <Sparkles className="w-4 h-4 inline mr-2" />Recommendations
            </button>
            <button
              onClick={() => { setMenuCategory('All'); setShowMenu(true); sendMessage('Show me the menu'); }}
              className="px-5 py-3 rounded-full bg-white border border-neutral-200 text-base font-bold text-neutral-700 hover:border-emerald-200 hover:text-emerald-800 transition shadow-sm"
            >
              <Utensils className="w-4 h-4 inline mr-2" />View Menu
            </button>
          </div>
        )}

        {stage === 'served' && !sending && order?.status !== 'paid' && (
          <div className="px-4 pb-3 flex gap-2 overflow-x-auto hide-scrollbar whitespace-nowrap animate-in slide-in-from-bottom-4">
            <button
              onClick={() => sendMessage('Can I get the bill?')}
              className="px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 transition flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />Get Bill
            </button>
            <button
              onClick={() => sendMessage('Can I add a dessert?')}
              className="px-4 py-2 rounded-full bg-white border border-neutral-200 text-sm font-semibold text-neutral-700 hover:border-emerald-200 hover:text-emerald-800 transition flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />Add Dessert
            </button>
          </div>
        )}

        {cart.length > 0 && stage !== 'paying' && stage !== 'feedback' && stage !== 'done' && (
          <div className="px-4 pb-3">
            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-neutral-400 font-semibold">Cart</div>
                  <div className="text-sm font-semibold tabular-nums">{cartCount} items · ${cartTotal.toFixed(2)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowMenu(true)} className="text-xs text-neutral-500 hover:text-emerald-700 flex items-center gap-1 font-medium">
                    <ShoppingBag className="h-3.5 w-3.5" />View
                  </button>
                  <Button
                    size="lg"
                    className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 shadow-md shadow-emerald-700/20"
                    onClick={() => (stage === 'browsing' ? openOrderSheet('place') : addOnsAfterOrder())}
                  >
                    {stage === 'browsing' ? 'Place order' : 'Add to tab'}
                  </Button>
                </div>
              </div>
              {(allergy || preference || avoid || chefNotes) && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {allergy && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5 text-[10px]">
                      <AlertTriangle className="h-3 w-3" />{allergy}
                    </span>
                  )}
                  {preference && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 text-[10px]">
                      <Sparkles className="h-3 w-3" />{preference}
                    </span>
                  )}
                  {avoid && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 px-2 py-0.5 text-[10px]">
                      <X className="h-3 w-3" />No {avoid}
                    </span>
                  )}
                  {chefNotes && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-700 px-2 py-0.5 text-[10px]">
                      <Pencil className="h-3 w-3" />{chefNotes}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="flex-none p-4 bg-white border-t border-neutral-200 pb-safe z-20">
          <div className="relative flex items-center">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your order or question…"
              className="w-full bg-neutral-100 border-neutral-200 text-[15px] h-12 rounded-full pl-5 pr-12 focus-visible:ring-emerald-700 focus-visible:border-emerald-700 placeholder:text-neutral-400"
              disabled={sending || stage === 'paying' || stage === 'feedback' || stage === 'done'}
            />
            <button
              onClick={() => sendMessage()}
              disabled={sending || !input.trim() || stage === 'paying' || stage === 'feedback' || stage === 'done'}
              className="absolute right-1.5 w-9 h-9 flex items-center justify-center rounded-full bg-emerald-700 text-white disabled:opacity-40 disabled:bg-neutral-300 transition-colors"
            >
              <Send className="h-4 w-4 ml-0.5" />
            </button>
          </div>
        </div>

        {/* Visual Menu Overlay */}
        {showMenu && (
          <div className="absolute inset-0 z-40">
            <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={() => setShowMenu(false)} />
            <div className="absolute bottom-0 left-0 right-0 max-h-[82%] rounded-t-3xl bg-white overflow-hidden flex flex-col shadow-2xl">
              <div className="shrink-0 bg-white border-b border-neutral-200 px-4 pt-4 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-emerald-700 font-bold">Menu</div>
                    <div className="font-display text-lg font-bold tracking-tight flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-emerald-700" />Browse & tap to add
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMenu(false)}
                    className="h-9 w-9 rounded-full bg-neutral-100 grid place-items-center hover:bg-neutral-200 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                  <input
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Search dishes…"
                    className="w-full bg-neutral-100 border border-neutral-200 rounded-full h-10 pl-9 pr-4 text-sm placeholder:text-neutral-400 focus:outline-none focus:border-emerald-700 transition"
                  />
                </div>
                <div className="mt-3 flex gap-1.5 overflow-x-auto hide-scrollbar">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setMenuCategory(cat)}
                      className={`shrink-0 px-3.5 py-1.5 rounded-full text-[11px] uppercase tracking-wider font-semibold border transition ${
                        menuCategory === cat
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-3 bg-neutral-50/40">
                <div className="grid grid-cols-2 gap-3">
                  {filteredMenu.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white border border-neutral-200 overflow-hidden flex flex-col">
                      <div className="relative h-24 overflow-hidden shrink-0 bg-neutral-100">
                        <img src={item.image || FALLBACK_MENU_IMAGE} alt={item.name} className="w-full h-full object-cover" />
                        {item.videoUrl && (
                          <div className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] text-emerald-800 font-semibold">
                            <PlayCircle className="h-2.5 w-2.5" /> Video
                          </div>
                        )}
                      </div>
                      <div className="p-3 flex-1 flex flex-col">
                        <div className="text-sm font-semibold leading-tight line-clamp-2">{item.name}</div>
                        {item.description && <div className="text-[11px] text-neutral-500 mt-1 line-clamp-2">{item.description}</div>}
                        <div className="flex items-center justify-between mt-auto pt-2">
                          <div className="text-base font-bold text-emerald-800 tabular-nums">${item.price.toFixed(2)}</div>
                          <button
                            onClick={() => addToCartItem(item)}
                            className="h-7 w-7 rounded-full bg-emerald-700 text-white grid place-items-center hover:bg-emerald-800 transition active:scale-95"
                          >
                            <span className="text-base font-bold leading-none">+</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {filteredMenu.length === 0 && (
                  <div className="text-center text-neutral-400 py-10 text-sm">No dishes match — try a different search or category.</div>
                )}
              </div>
              {cart.length > 0 && (
                <div className="shrink-0 border-t border-neutral-200 bg-white px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-neutral-400 font-semibold">Cart</div>
                    <div className="text-sm font-semibold tabular-nums">{cartCount} items · ${cartTotal.toFixed(2)}</div>
                  </div>
                  <Button
                    size="sm"
                    className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white"
                    onClick={() => { setShowMenu(false); if (stage === 'browsing') openOrderSheet('place'); else addOnsAfterOrder(); }}
                  >
                    {stage === 'browsing' ? 'Place order' : 'Add to tab'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== ORDER INSTRUCTIONS MODAL ========== */}
        {orderSheetOpen && (
          <div className="absolute inset-0 z-50 bg-neutral-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5 animate-in fade-in">
            <div className="absolute inset-0" onClick={() => setOrderSheetOpen(false)} />
            <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl">
              <div className="bg-emerald-700 text-white px-6 py-5">
                <div className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-80">Almost there</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="text-2xl">🎉</div>
                  <div className="font-display text-xl font-bold tracking-tight">Kitchen instructions</div>
                </div>
                <div className="text-xs text-emerald-100 mt-1">We will generate your ticket right after you confirm.</div>
              </div>
              <div className="p-6 space-y-4">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-[11px] text-emerald-900">
                  {pendingItems?.length || cart.length ? (
                    <span className="font-semibold">{(pendingItems || cart).length} items</span>
                  ) : (
                    <span className="text-emerald-700">Cart is empty</span>
                  )}
                  <span className="ml-2">${(pendingItems || cart).reduce((s, i) => s + i.price * i.qty, 0).toFixed(2)}</span>
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-700">Allergy</label>
                  <Input
                    value={draftAllergy}
                    onChange={(e) => setDraftAllergy(e.target.value)}
                    placeholder="e.g. peanuts, dairy"
                    className="mt-1.5 h-11 bg-white border-neutral-200 rounded-xl focus-visible:ring-emerald-700 focus-visible:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-700">I want</label>
                  <Input
                    value={draftPreference}
                    onChange={(e) => setDraftPreference(e.target.value)}
                    placeholder="e.g. extra cheese, well done"
                    className="mt-1.5 h-11 bg-white border-neutral-200 rounded-xl focus-visible:ring-emerald-700 focus-visible:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-700">I do not want</label>
                  <Input
                    value={draftAvoid}
                    onChange={(e) => setDraftAvoid(e.target.value)}
                    placeholder="e.g. no onions, no garlic"
                    className="mt-1.5 h-11 bg-white border-neutral-200 rounded-xl focus-visible:ring-emerald-700 focus-visible:border-emerald-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-neutral-700">Chef notes</label>
                  <textarea
                    value={draftChefNotes}
                    onChange={(e) => setDraftChefNotes(e.target.value)}
                    placeholder="Any extra instructions for the chef"
                    className="mt-1.5 w-full min-h-[90px] bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:border-emerald-700"
                  />
                </div>
              </div>
              <div className="shrink-0 border-t border-neutral-100 px-6 py-4 bg-white flex gap-2">
                <Button variant="outline" className="rounded-full border-neutral-200 hover:bg-neutral-50" onClick={() => setOrderSheetOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold h-11 shadow-md shadow-emerald-700/20"
                  onClick={confirmOrderSheet}
                  disabled={(pendingItems || cart).length === 0}
                >
                  {orderSheetMode === 'place' ? 'Place order' : 'Add to tab'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========== BILL MODAL (before payment) ========== */}
        {showBill && order && (
          <div className="absolute inset-0 z-50 bg-neutral-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5 animate-in fade-in">
            <div className="absolute inset-0" onClick={() => setShowBill(false)} />
            <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
              <div className="bg-emerald-900 text-white px-6 py-5 flex items-start justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-70">Itemised bill</div>
                  <img src={BRAND_LOGO_PATH} alt="Netrik Shop" className="h-6 w-auto mt-2 mb-1 opacity-90" />
                  <div className="font-display text-2xl font-bold tracking-tight mt-0.5">{restaurant.name}</div>
                  <div className="text-xs opacity-70 mt-0.5">Table {table.number} · Ticket #{order.id.slice(0, 6).toUpperCase()}</div>
                </div>
                <button onClick={() => setShowBill(false)} className="h-8 w-8 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-4 divide-y divide-neutral-100">
                  {(order.items || []).map((it, idx) => (
                    <div key={idx} className="py-3 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{it.name}</div>
                        <div className="text-xs text-neutral-500 tabular-nums">${Number(it.price || 0).toFixed(2)} × {it.qty}</div>
                      </div>
                      <div className="text-sm font-bold tabular-nums">${(Number(it.price || 0) * (it.qty || 1)).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
                {(allergy || preference || avoid || chefNotes) && (
                  <div className="mx-6 mb-4 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-[11px] text-emerald-900 space-y-0.5">
                    {allergy && <div>⚠ <span className="font-semibold">Allergy:</span> {allergy}</div>}
                    {preference && <div>✨ <span className="font-semibold">Wants:</span> {preference}</div>}
                    {avoid && <div>⛔ <span className="font-semibold">Avoid:</span> {avoid}</div>}
                    {chefNotes && <div>✍ <span className="font-semibold">Chef notes:</span> {chefNotes}</div>}
                  </div>
                )}
                <div className="px-6 pb-4 space-y-1 text-sm">
                  {(() => {
                    const subtotal = (order.items || []).reduce((s, i) => s + Number(i.price || 0) * (i.qty || 1), 0);
                    const total = Number(order.total || subtotal);
                    const tax = Math.max(0, total - subtotal);
                    return (
                      <>
                        <div className="flex justify-between text-neutral-600">
                          <span>Subtotal</span><span className="tabular-nums">${subtotal.toFixed(2)}</span>
                        </div>
                        {tax > 0.001 && (
                          <div className="flex justify-between text-neutral-600">
                            <span>Taxes & service</span><span className="tabular-nums">${tax.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-extrabold pt-2 border-t border-neutral-100 mt-2">
                          <span>Total</span><span className="tabular-nums">${total.toFixed(2)}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="shrink-0 border-t border-neutral-100 px-6 py-4 bg-white flex gap-2">
                <Button variant="outline" className="rounded-full border-neutral-200 hover:bg-neutral-50" onClick={() => downloadReceipt(order, payment)}>
                  <Download className="h-4 w-4 mr-1.5" />Download
                </Button>
                <Button
                  className="flex-1 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold h-11 shadow-md shadow-emerald-700/20"
                  disabled={order.status === 'paid'}
                  onClick={async () => { setShowBill(false); await startStripePayment(); }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {order.status === 'paid' ? 'Already paid' : `Pay $${order.total.toFixed(2)}`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========== CONFETTI ========== */}
        {burst && (
          <div className="absolute inset-0 z-[60] pointer-events-none overflow-hidden">
            <div className="absolute inset-0 bg-emerald-900/30 animate-in fade-in duration-200" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-7xl mb-3 animate-bounce">🎉</div>
              <div className="font-display text-2xl font-extrabold text-white tracking-tight drop-shadow">Order placed</div>
              <div className="text-sm text-emerald-100 mt-1">The chef has your ticket.</div>
              {order?.id && (
                <div className="text-xs text-emerald-100/80 mt-1">Ticket #{order.id.slice(0, 6).toUpperCase()}</div>
              )}
            </div>
            {Array.from({ length: 28 }).map((_, i) => {
              const emojis = ['🎉', '✨', '🍽️', '🥂', '⭐', '🍴', '💫', '🔥'];
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

        {/* Card Payment Modal (Stripe) */}
        {paymentOpen && (
          <div className="absolute inset-0 z-50 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-5 animate-in fade-in">
            <div className="absolute inset-0" onClick={() => setPaymentOpen(false)} />
            <div className="relative w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl">
              <div className="bg-emerald-700 p-6 text-white text-center">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-90" />
                <h2 className="font-display text-xl font-bold tracking-tight">Card Payment</h2>
                <p className="text-emerald-50/90 text-sm mt-1">{restaurant.name}</p>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-end justify-between border-b border-neutral-100 pb-3">
                  <div>
                    <div className="text-neutral-500 text-[10px] uppercase tracking-widest font-semibold">Total</div>
                    <div className="text-3xl font-extrabold tabular-nums">${order?.total.toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-neutral-500 uppercase font-semibold">Status</div>
                    <div className={`text-xs font-bold uppercase tracking-wider ${payment?.status === 'paid' ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {payment?.status || order?.paymentStatus || 'pending'}
                    </div>
                  </div>
                </div>
                <div className="text-xs text-neutral-500">
                  Reference: <span className="font-mono text-neutral-800">{payment?.reference || order?.paymentReference || 'Generating…'}</span>
                </div>
                <div className="rounded-2xl bg-neutral-50 border border-neutral-200 p-4 text-center text-sm text-neutral-600">
                  Secure card checkout powered by Stripe. You will return here after payment.
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white" onClick={openCheckout}>
                    <ExternalLink className="h-4 w-4 mr-2" />Open secure payment
                  </Button>
                  <Button variant="outline" className="rounded-full border-neutral-200 hover:bg-neutral-50" onClick={() => downloadReceipt(order, payment)}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-center text-[11px] text-neutral-400">Keep this screen open to see payment confirmation.</div>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Modal */}
        {stage === 'feedback' && (
          <div className="absolute inset-0 z-40 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center">
              <div className="h-12 w-12 mx-auto rounded-full bg-emerald-50 grid place-items-center text-emerald-700 mb-4">
                <Receipt className="h-5 w-5" />
              </div>
              <div className="font-display text-2xl font-extrabold tracking-tight mb-2">How was it?</div>
              <div className="text-sm text-neutral-500 leading-relaxed mb-6">
                Your feedback directly helps {restaurant.name} improve.
              </div>
              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    className={`transition-transform hover:scale-110 ${n <= rating ? 'text-emerald-600' : 'text-neutral-200'}`}
                  >
                    <Star className="h-9 w-9" fill={n <= rating ? 'currentColor' : 'none'} />
                  </button>
                ))}
              </div>
              <Input
                placeholder="Leave a comment (optional)…"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="bg-neutral-50 border-neutral-200 rounded-full h-12 mb-4 placeholder:text-neutral-400 text-[15px] focus-visible:ring-emerald-700 focus-visible:border-emerald-700"
              />
              <Button
                onClick={submitFeedback}
                className="w-full rounded-full bg-emerald-700 hover:bg-emerald-800 text-white h-12 text-base font-bold shadow-md shadow-emerald-700/20"
              >
                Submit feedback
              </Button>
            </div>
          </div>
        )}

        {stage === 'done' && (
          <div className="absolute inset-0 z-30 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 text-center">
              <div className="h-12 w-12 mx-auto rounded-full bg-emerald-50 grid place-items-center text-emerald-700 mb-4">
                <Receipt className="h-5 w-5" />
              </div>
              <div className="font-display text-xl font-extrabold tracking-tight">You are all set</div>
              <div className="text-sm text-neutral-500 mt-2">You can close this tab now.</div>
              <Button
                onClick={() => { try { window.close(); } catch {} }}
                className="mt-6 w-full rounded-full bg-emerald-700 hover:bg-emerald-800 text-white h-11"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
