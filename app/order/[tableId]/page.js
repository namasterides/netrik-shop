'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import LoadingLogo from '@/components/loading-logo';
import InlinePayment from '@/components/inline-payment';
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
  RotateCcw,
  Smile,
  Bell,
  Languages,
  Crown,
} from 'lucide-react';

const FALLBACK_MENU_IMAGE = 'https://images.pexels.com/photos/35420084/pexels-photo-35420084.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';
const BRAND_LOGO_PATH = '/brand/original/netrikshop%20update%20logo.png';
const STORAGE_VERSION = 1;
const STORAGE_PREFIX = 'netrik_ai_waiter';
const buildStorageKey = (tableId) => (tableId ? `${STORAGE_PREFIX}:${tableId}` : null);

const EMOJI_SECTIONS = [
  {
    label: 'Smileys',
    emojis: ['😀', '😁', '😊', '😋', '😍', '🥳', '🤩', '😎', '🤗', '😂'],
  },
  {
    label: 'Food',
    emojis: ['🍕', '🍔', '🍟', '🌮', '🍜', '🍣', '🥗', '🍰', '🍩', '🍹'],
  },
  {
    label: 'Reactions',
    emojis: ['❤️', '🔥', '✨', '🎉', '🙌', '👍', '👏', '🙏', '✅', '💯'],
  },
];
const EMOJI_RECENT_LIMIT = 12;
const LAST_ORDER_KEY = 'netrik_ai_waiter:last_order';

const CHEF_QUIZ = {
  moods: [
    { id: 'light', label: 'Light & fresh', emoji: '🥗' },
    { id: 'comfort', label: 'Comforting', emoji: '🍲' },
    { id: 'celebratory', label: 'Celebratory', emoji: '🥂' },
    { id: 'adventurous', label: 'Adventurous', emoji: '🔥' },
  ],
  tastes: [
    { id: 'spicy', label: 'Spicy', emoji: '🌶️' },
    { id: 'smoky', label: 'Smoky', emoji: '🥩' },
    { id: 'creamy', label: 'Creamy', emoji: '🧀' },
    { id: 'tangy', label: 'Tangy', emoji: '🍋' },
  ],
  diet: [
    { id: 'none', label: 'No preference', emoji: '😊' },
    { id: 'vegetarian', label: 'Vegetarian', emoji: '🥦' },
    { id: 'vegan', label: 'Vegan', emoji: '🌿' },
    { id: 'gluten-free', label: 'Gluten-free', emoji: '🌾' },
    { id: 'nut-free', label: 'Nut-free', emoji: '🥜' },
  ],
};

const DIETARY_PRESETS = [
  { id: 'vegan', label: 'Vegan' },
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'gluten-free', label: 'Gluten-free' },
  { id: 'nut-free', label: 'Nut-free' },
];

const ORDER_STEPS = [
  { id: 'pending', label: 'Received' },
  { id: 'preparing', label: 'Cooking' },
  { id: 'ready', label: 'Ready' },
  { id: 'served', label: 'Served' },
];

const TIP_PRESETS = [0, 5, 10, 15, 20];
const LOYALTY_KEY_PREFIX = 'netrik_loyalty';
const LOYALTY_TIERS = [
  { id: 'Bronze', min: 0, color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { id: 'Silver', min: 150, color: 'bg-slate-100 text-slate-700 border-slate-200' },
  { id: 'Gold', min: 350, color: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  { id: 'Platinum', min: 650, color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
];

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

const normTag = (value) => String(value || '').trim().toLowerCase();
const getTimeMood = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 11) return 'light';
  if (hour < 16) return 'comfort';
  if (hour < 20) return 'celebratory';
  return 'adventurous';
};

const scoreMenuItem = ({ item, moodPick, tastePick, dietPick, cartTags, timeMood }) => {
  const moodTags = (item.moodTags || []).map(normTag);
  const tasteTags = (item.tasteTags || []).map(normTag);
  const dietTags = (item.dietaryTags || []).map(normTag);
  let score = 0;

  if (dietPick && dietPick !== 'none') {
    if (!dietTags.includes(dietPick)) return -1;
    score += 2;
  }
  if (moodPick && moodTags.includes(moodPick)) score += 3;
  if (tastePick && tasteTags.includes(tastePick)) score += 2;
  if (timeMood && moodTags.includes(timeMood)) score += 1.5;
  if (cartTags.size) {
    for (const tag of cartTags) {
      if (tasteTags.includes(tag) || moodTags.includes(tag)) score += 0.75;
    }
  }
  if (item.description && item.description.length > 20) score += 0.25;
  if (item.promoted) score += 2.5;
  return score;
};

const pickSuggestedItems = ({ menu = [], cart = [], moodPick, tastePick, dietPick, limit = 3 }) => {
  const cartIds = new Set((cart || []).map((c) => c.id));
  const cartTags = new Set();
  (cart || []).forEach((c) => {
    const match = menu.find((m) => m.id === c.id);
    (match?.moodTags || []).forEach((t) => cartTags.add(normTag(t)));
    (match?.tasteTags || []).forEach((t) => cartTags.add(normTag(t)));
  });
  const timeMood = getTimeMood();

  const scored = (menu || [])
    .filter((item) => item.available !== false && !cartIds.has(item.id))
    .map((item) => ({
      item,
      score: scoreMenuItem({ item, moodPick, tastePick, dietPick, cartTags, timeMood }),
    }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];
  return scored.slice(0, limit).map((row) => row.item);
};

const detectLanguage = (text = '') => {
  const lower = String(text || '').toLowerCase();
  if (/\b(hola|gracias|por\s+favor|menu|cuenta|pedido|quiero|recomienda|recomendacion)\b/i.test(lower)) return 'es';
  return 'en';
};

const getLoyaltyTier = (points = 0) => {
  let current = LOYALTY_TIERS[0];
  for (const tier of LOYALTY_TIERS) {
    if (points >= tier.min) current = tier;
  }
  return current;
};

const getItemName = (item, lang = 'en') => {
  if (lang === 'es' && item?.nameEs) return item.nameEs;
  return item?.name || '';
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState([]);
  const [language, setLanguage] = useState('auto');
  const [tipMode, setTipMode] = useState('percent');
  const [tipPercent, setTipPercent] = useState(15);
  const [tipCustom, setTipCustom] = useState('');
  const [splitCount, setSplitCount] = useState(1);
  const [npsScore, setNpsScore] = useState(null);
  const [feedbackFollowup, setFeedbackFollowup] = useState('');
  const [loyalty, setLoyalty] = useState({ points: 0, tier: 'Bronze' });
  const [loyaltyBurst, setLoyaltyBurst] = useState(null);
  const [callStaffLoading, setCallStaffLoading] = useState(false);
  const [chefQuizOpen, setChefQuizOpen] = useState(false);
  const [chefQuizStep, setChefQuizStep] = useState(0);
  const [chefQuizAnswers, setChefQuizAnswers] = useState({ mood: '', taste: '', diet: 'none' });
  const [dietaryFilter, setDietaryFilter] = useState([]);
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(() => 'sess_' + Math.random().toString(36).slice(2));
  const [order, setOrder] = useState(null);
  const [stage, setStage] = useState('browsing');
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const emojiWrapRef = useRef(null);
  const statusRef = useRef(null);
  const suggestRef = useRef(0);
  const videoTimerRef = useRef(null);
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
  const [burst, setBurst] = useState(null);
  const [orderSheetOpen, setOrderSheetOpen] = useState(false);
  const [orderSheetMode, setOrderSheetMode] = useState('place');
  const [draftAllergy, setDraftAllergy] = useState('');
  const [draftPreference, setDraftPreference] = useState('');
  const [draftAvoid, setDraftAvoid] = useState('');
  const [draftChefNotes, setDraftChefNotes] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [pendingItems, setPendingItems] = useState(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set((menu || []).map((m) => m.category || 'Other')));
    return ['All', ...unique];
  }, [menu]);

  const filteredMenu = useMemo(() => {
    let list = menu || [];
    if (menuCategory !== 'All') list = list.filter((m) => (m.category || 'Other') === menuCategory);
    if (dietaryFilter.length > 0) {
      list = list.filter((m) => {
        const tags = (m.dietaryTags || []).map(normTag);
        return dietaryFilter.every((t) => tags.includes(t));
      });
    }
    if (menuSearch.trim()) {
      const q = menuSearch.toLowerCase();
      list = list.filter((m) => (m.name || '').toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => Number(!!b.promoted) - Number(!!a.promoted));
  }, [menu, menuCategory, menuSearch, dietaryFilter]);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.qty, 0), [cart]);
  const uiLang = language === 'es' ? 'es' : 'en';
  const baseTotal = Number(order?.total || 0);
  const tipAmount = useMemo(() => {
    const existing = Number(order?.tipAmount || 0);
    if (existing > 0) return existing;
    if (tipMode === 'custom') {
      const raw = Number.parseFloat(tipCustom || '');
      return Number.isFinite(raw) && raw >= 0 ? Math.round(raw * 100) / 100 : 0;
    }
    if (!tipPercent) return 0;
    return Math.round(baseTotal * (tipPercent / 100) * 100) / 100;
  }, [order?.tipAmount, tipMode, tipCustom, tipPercent, baseTotal]);
  const payTotal = useMemo(() => {
    const withTip = Number(order?.totalWithTip || 0);
    if (withTip > 0) return withTip;
    return Math.round((baseTotal + tipAmount) * 100) / 100;
  }, [order?.totalWithTip, baseTotal, tipAmount]);
  const perPersonTotal = useMemo(() => {
    const split = Math.max(1, splitCount || 1);
    return Math.round((payTotal / split) * 100) / 100;
  }, [payTotal, splitCount]);
  const needsFollowup = (rating && rating <= 2) || (npsScore !== null && npsScore <= 6);
  const burstTitle = burst === 'ready' ? 'Food is ready' : 'Order placed';
  const burstSubtitle = burst === 'ready' ? 'Your order is ready.' : 'The chef has your ticket.';
  const canReorder = useMemo(() => {
    if (!lastOrder || !restaurant) return false;
    if (lastOrder.restaurantId !== restaurant.id) return false;
    return Array.isArray(lastOrder.items) && lastOrder.items.length > 0;
  }, [lastOrder, restaurant]);
  const orderStepIndex = useMemo(() => {
    if (!order?.status) return 0;
    const idx = ORDER_STEPS.findIndex((s) => s.id === order.status);
    return idx >= 0 ? idx : 0;
  }, [order?.status]);

  useEffect(() => {
    if (!tableId || !storageKey) return;
    const resetUiState = () => {
      setInput('');
      setEmojiOpen(false);
      setChefQuizOpen(false);
      setChefQuizStep(0);
      setChefQuizAnswers({ mood: '', taste: '', diet: 'none' });
      setSending(false);
      closeMenu();
      setMenuCategory('All');
      setMenuSearch('');
      setDietaryFilter([]);
      setActiveVideoId(null);
      setPaymentOpen(false);
      setShowBill(false);
      setBurst(null);
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
    try {
      const raw = localStorage.getItem(LAST_ORDER_KEY);
      setLastOrder(raw ? JSON.parse(raw) : null);
    } catch {
      setLastOrder(null);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('netrik_language');
      if (stored) setLanguage(stored);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('netrik_language', language); } catch {}
  }, [language]);

  useEffect(() => {
    if (!restaurant?.id) return;
    try {
      const key = `${LOYALTY_KEY_PREFIX}:${restaurant.id}`;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.points === 'number') {
        const tier = getLoyaltyTier(parsed.points).id;
        setLoyalty({ points: parsed.points, tier });
      }
    } catch {}
  }, [restaurant?.id]);

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
              text: `Hi there 👋 Welcome to ${rest.restaurant?.name || 'our restaurant'}. I'm your digital waiter. What are you craving today? You can ask for recommendations, browse the menu, and place your order here, then finish payment in the checkout flow. You can also tap the emoji button to add reactions.`,
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
    if (!emojiOpen) return;
    const handleClick = (event) => {
      if (!emojiWrapRef.current?.contains(event.target)) setEmojiOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [emojiOpen]);

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

  useEffect(() => {
    if (!order?.status) return;
    if (!statusRef.current) {
      statusRef.current = order.status;
      return;
    }
    if (order.status !== statusRef.current) {
      if (order.status === 'preparing') {
        setMessages((m) => [...m, { role: 'assistant', text: '👨‍🍳 Your order is now being prepared.' }]);
      }
      if (order.status === 'ready') {
        setMessages((m) => [...m, { role: 'assistant', text: '✨ Your food is ready. Enjoy your meal! Want anything else, or should I bring the bill?' }]);
        setBurst('ready');
        setTimeout(() => setBurst(null), 2200);
      }
      if (order.status === 'served') {
        setMessages((m) => [...m, { role: 'assistant', text: 'Hope you love it. I am here if you need anything else.' }]);
      }
      statusRef.current = order.status;
    }
  }, [order?.status]);

  useEffect(() => {
    if (!order?.id) return;
    if (Number(order.tipAmount || 0) > 0) {
      setTipMode('custom');
      setTipCustom(Number(order.tipAmount).toFixed(2));
    } else if (Number(order.tipPercent || 0) > 0) {
      setTipMode('percent');
      setTipPercent(Number(order.tipPercent));
    }
    if (Number(order.splitCount || 0) > 0) setSplitCount(Number(order.splitCount));
  }, [order?.id]);

  useEffect(() => {
    if (!menu.length) return;
    if (!cart.length) {
      suggestRef.current = 0;
      return;
    }
    if (stage !== 'browsing') return;
    if (cart.length === suggestRef.current) return;
    suggestRef.current = cart.length;
    if (!(cart.length === 1 || cart.length % 3 === 0)) return;
    const picks = pickSuggestedItems({ menu, cart, limit: 3 });
    if (picks.length === 0) return;
    setMessages((m) => [...m, { role: 'assistant', text: 'You might like these as well:', items: picks }]);
  }, [cart, menu, stage]);

  useEffect(() => {
    if (!order?.id) return;
    if (order.paymentStatus === 'paid' || order.status === 'paid') {
      awardLoyalty(order.id, payTotal || order.total || 0);
    }
  }, [order?.id, order?.paymentStatus, order?.status, payTotal, order?.total]);

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
          clientSecret: prev?.clientSecret || '',
          checkoutUrl: prev?.checkoutUrl || '',
          createdAt: r.order.paymentCreatedAt || prev?.createdAt || null,
        }));
        if (r.order.status === 'ready' && stage === 'ordered') {
          setStage('served');
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
      toast.success(`${getItemName(item, uiLang)} added`);
  };

  const downloadReceipt = (currentOrder, currentPayment) => {
    if (!currentOrder) return;
    const brandLogoUrl = new URL(BRAND_LOGO_PATH, window.location.origin).toString();
    const baseTotal = Number(currentOrder.total || 0);
    const tip = Number(currentOrder.tipAmount || 0);
    const totalWithTip = Number(currentOrder.totalWithTip || (baseTotal + tip));
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
      ${tip > 0 ? `<div class="meta">Tip: $${tip.toFixed(2)}</div>` : ''}
      <div class="total">Total: $${totalWithTip.toFixed(2)}</div>
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
    try {
      const payload = {
        restaurantId: restaurant.id,
        orderId: data.order?.id,
        createdAt: new Date().toISOString(),
        items: (data.order?.items || []).map((i) => ({ id: i.id, qty: i.qty })),
      };
      localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(payload));
      setLastOrder(payload);
    } catch {}
    setBurst('order');
    setTimeout(() => setBurst(null), 2800);
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
    setMessages((m) => [...m, { role: 'assistant', text: `Opening secure card payment for $${payTotal.toFixed(2)}.` }]);
    try {
      const res = await fetch('/api/payment/stripe/init', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          tipAmount,
          tipPercent: tipMode === 'percent' ? tipPercent : null,
          splitCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStage(previousStage);
        return toast.error(data.error || 'Payment init failed');
      }
      if (data.order) setOrder(data.order);
      if (data.payment) setPayment(data.payment || null);

      const returnedClientSecret = data.clientSecret || data.payment?.clientSecret || '';
      const returnedCheckoutUrl = data.checkoutUrl || data.payment?.checkoutUrl || '';
      setCheckoutUrl(returnedCheckoutUrl);

      if (returnedClientSecret) {
        setPaymentOpen(true);
        return;
      }

      if (returnedCheckoutUrl) {
        window.open(returnedCheckoutUrl, '_blank', 'noopener,noreferrer');
        setPaymentOpen(false);
        return;
      }

      setPaymentOpen(false);
      if (!returnedClientSecret && !returnedCheckoutUrl) {
        setStage(previousStage);
        toast.error('Payment details not returned. Please try again.');
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
    const combinedComment = [feedback?.trim(), feedbackFollowup?.trim()].filter(Boolean).join(' | ');
    await fetch('/api/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: restaurant.id, tableId: table.id, orderId: order.id, rating, nps: npsScore, comment: combinedComment }),
    });
    setStage('done');
    setMessages((m) => [...m, { role: 'assistant', text: 'Thank you for your feedback 🙏 Have a wonderful day.' }]);
    try { localStorage.removeItem(storageKey); } catch {}
    setTimeout(() => { try { window.close(); } catch {} }, 1500);
  };

  const addEmoji = (emoji) => {
    setInput((prev) => `${prev}${emoji}`);
    setRecentEmojis((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)];
      return next.slice(0, EMOJI_RECENT_LIMIT);
    });
    inputRef.current?.focus();
  };

  const toggleDietary = (id) => {
    setDietaryFilter((prev) => (
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    ));
  };

  const closeMenu = () => {
    setShowMenu(false);
    setActiveVideoId(null);
    if (videoTimerRef.current) {
      clearTimeout(videoTimerRef.current);
      videoTimerRef.current = null;
    }
  };

  const startVideoPreview = (id) => {
    if (!id) return;
    setActiveVideoId(id);
    if (videoTimerRef.current) clearTimeout(videoTimerRef.current);
    videoTimerRef.current = setTimeout(() => setActiveVideoId(null), 6000);
  };

  const reorderLast = () => {
    if (!lastOrder || !Array.isArray(lastOrder.items) || !menu.length) {
      return toast.error('No previous order available');
    }
    const next = lastOrder.items
      .map((it) => {
        const match = menu.find((m) => m.id === it.id);
        if (!match) return null;
        return {
          id: match.id,
          name: match.name,
          nameEs: match.nameEs || '',
          price: match.price,
          qty: Math.max(1, parseInt(it.qty, 10) || 1),
          notes: '',
        };
      })
      .filter(Boolean);
    setTipMode('percent');
    setTipPercent(15);
    setTipCustom('');
    setSplitCount(1);
    setNpsScore(null);
    setFeedbackFollowup('');
    setCallStaffLoading(false);
    if (next.length === 0) return toast.error('No items available from the last order');
    setCart(next);
    toast.success('Last order added to cart');
  };

  const startChefSurprise = () => {
    if (!menu.length) return toast.error('Menu is still loading');
    setChefQuizAnswers({ mood: '', taste: '', diet: 'none' });
    setChefQuizStep(0);
    setChefQuizOpen(true);
  };

  const finishChefSurprise = (answers) => {
    setChefQuizOpen(false);
    setMessages((m) => [...m, { role: 'user', text: "Chef's surprise, please." }]);
    const picks = pickSuggestedItems({
      menu,
      cart,
      moodPick: answers.mood,
      tastePick: answers.taste,
      dietPick: answers.diet,
      limit: 3,
    });
    if (picks.length === 0) {
      setMessages((m) => [...m, { role: 'assistant', text: 'I could not find a perfect match, but the menu is open if you want to browse.' }]);
      setShowMenu(true);
      return;
    }
    setMessages((m) => [...m, { role: 'assistant', text: 'Here is a chef-picked surprise based on your taste:', items: picks }]);
  };

  const handleChefPick = (kind, value) => {
    const next = { ...chefQuizAnswers, [kind]: value };
    setChefQuizAnswers(next);
    if (kind === 'mood') setChefQuizStep(1);
    else if (kind === 'taste') setChefQuizStep(2);
    else finishChefSurprise(next);
  };

  const awardLoyalty = (orderId, amount) => {
    if (!restaurant?.id || !orderId) return;
    const pointsToAdd = Math.max(1, Math.round(Number(amount || 0)));
    const key = `${LOYALTY_KEY_PREFIX}:${restaurant.id}`;
    try {
      const raw = localStorage.getItem(key);
      const prev = raw ? JSON.parse(raw) : { points: 0, tier: 'Bronze', lastOrderId: null };
      if (prev.lastOrderId === orderId) return;
      const nextPoints = (prev.points || 0) + pointsToAdd;
      const nextTier = getLoyaltyTier(nextPoints).id;
      const next = { points: nextPoints, tier: nextTier, lastOrderId: orderId };
      localStorage.setItem(key, JSON.stringify(next));
      setLoyalty({ points: nextPoints, tier: nextTier });
      if (nextTier !== prev.tier) {
        setLoyaltyBurst(nextTier);
        setTimeout(() => setLoyaltyBurst(null), 2200);
        setMessages((m) => [...m, { role: 'assistant', text: `Loyalty unlocked: ${nextTier} tier.` }]);
      }
    } catch {}
  };

  const callStaff = async () => {
    if (!restaurant || !table) return;
    if (callStaffLoading) return;
    setCallStaffLoading(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          tableId: table.id,
          orderId: order?.id || null,
          sender: 'customer',
          priority: 'urgent',
          source: 'table',
          message: `Table ${table.number} needs assistance.`,
        }),
      });
      if (!res.ok) throw new Error('Request failed');
      setMessages((m) => [...m, { role: 'assistant', text: 'Staff has been notified. Someone will be right over.' }]);
    } catch {
      toast.error('Unable to alert staff');
    } finally {
      setCallStaffLoading(false);
    }
  };

  const sendMessage = async (textOverride = null) => {
    const text = textOverride || input.trim();
    if (!text || sending) return;
    if (emojiOpen) setEmojiOpen(false);
    const resolvedLanguage = language === 'auto' ? detectLanguage(text) : language;
    if (language === 'auto' && resolvedLanguage !== 'auto') setLanguage(resolvedLanguage);
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
          sessionId, restaurantId: restaurant.id, tableId: table.id, language: resolvedLanguage,
          message: text,
          menu: menu.map((m) => ({ id: m.id, name: m.name, description: m.description, price: m.price, category: m.category, moodTags: m.moodTags || [], tasteTags: m.tasteTags || [], dietaryTags: m.dietaryTags || [], promoted: !!m.promoted, promotionLabel: m.promotionLabel || '' })),
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
                <div className="mt-1 flex flex-wrap items-center gap-2">

                  <div className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getLoyaltyTier(loyalty.points).color}`}>
                    <Crown className="h-3 w-3" /> {loyalty.tier} · {loyalty.points} pts
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1 shrink-0">
                <div className="text-lg font-extrabold text-emerald-800 tabular-nums leading-none">
                  ${(order ? Number(order.total) || 0 : cartTotal).toFixed(2)}
                </div>
                {order && (
                  <div className="text-[9px] text-neutral-500 uppercase tracking-[0.18em] font-medium">
                    {order.status}
                  </div>
                )}
              </div>
          </div>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 pt-4 hide-scrollbar scroll-smooth">
          {order && stage !== 'done' && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm animate-in fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-neutral-400 font-semibold">Order tracker</div>
                  <div className="text-sm font-semibold text-neutral-800">Status: {order.status}</div>
                </div>
                {order?.id && (
                  <div className="text-[10px] text-neutral-400 font-semibold">#{order.id.slice(0, 6).toUpperCase()}</div>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                {ORDER_STEPS.map((step, idx) => (
                  <div key={step.id} className="flex items-center flex-1">
                    <div
                      className={`h-2.5 w-2.5 rounded-full ${
                        idx <= orderStepIndex ? 'bg-emerald-600' : 'bg-neutral-200'
                      } ${idx === orderStepIndex ? 'animate-pulse' : ''}`}
                    />
                    <div className="ml-2 text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                      {step.label}
                    </div>
                    {idx < ORDER_STEPS.length - 1 && (
                      <div
                        className={`mx-2 h-px flex-1 ${
                          idx < orderStepIndex ? 'bg-emerald-200' : 'bg-neutral-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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
                        className={`rounded-2xl bg-white border overflow-hidden flex flex-col transition hover:shadow-sm ${
                          item.promoted
                            ? 'border-amber-300 ring-1 ring-amber-200 hover:border-amber-400'
                            : 'border-neutral-200 hover:border-emerald-300'
                        }`}
                      >
                        <div className="relative h-20 overflow-hidden bg-neutral-100">
                          <img src={item.image || FALLBACK_MENU_IMAGE} alt={item.name} className="w-full h-full object-cover" />
                          {item.promoted && (
                            <div className="absolute top-1 left-1 inline-flex items-center gap-1 rounded-full bg-amber-500 text-white px-1.5 py-0.5 text-[8px] uppercase tracking-widest font-bold shadow">
                              <Sparkles className="h-2 w-2" />
                              {item.promotionLabel?.trim() || 'Promoted'}
                            </div>
                          )}
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
                          <div className="text-[13px] font-semibold leading-tight line-clamp-2">{getItemName(item, uiLang)}</div>
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
              onClick={startChefSurprise}
              className="px-5 py-3 rounded-full bg-white border border-neutral-200 text-base font-bold text-neutral-700 hover:border-emerald-200 hover:text-emerald-800 transition shadow-sm"
            >
              <ChefHat className="w-4 h-4 inline mr-2" />Chef's Surprise
            </button>
            <button
              onClick={() => { setMenuCategory('All'); setShowMenu(true); sendMessage('Show me the menu'); }}
              className="px-5 py-3 rounded-full bg-white border border-neutral-200 text-base font-bold text-neutral-700 hover:border-emerald-200 hover:text-emerald-800 transition shadow-sm"
            >
              <Utensils className="w-4 h-4 inline mr-2" />View Menu
            </button>
            {canReorder && (
              <button
                onClick={reorderLast}
                className="px-5 py-3 rounded-full bg-neutral-900 text-white text-base font-bold hover:bg-neutral-800 transition shadow-sm"
              >
                <ShoppingBag className="w-4 h-4 inline mr-2" />Reorder last
              </button>
            )}
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
            <button
              onClick={callStaff}
              disabled={callStaffLoading}
              className="px-4 py-2 rounded-full bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 transition flex items-center gap-1.5 disabled:opacity-70"
            >
              <Bell className="w-3.5 h-3.5" />{callStaffLoading ? 'Calling…' : 'Call Staff'}
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
          <div ref={emojiWrapRef} className="relative flex items-center">
            <button
              type="button"
              onClick={() => setEmojiOpen((v) => !v)}
              disabled={sending || stage === 'paying' || stage === 'feedback' || stage === 'done'}
              className="absolute left-1.5 h-9 w-9 flex items-center justify-center rounded-full bg-neutral-100 border border-neutral-200 text-neutral-600 hover:text-emerald-700 hover:border-emerald-200 hover:bg-white transition disabled:opacity-40"
              aria-label="Open emoji picker"
            >
              <Smile className="h-4 w-4" />
            </button>
            {emojiOpen && (
              <div className="absolute bottom-14 left-0 right-0 z-30">
                <div className="rounded-2xl border border-neutral-200 bg-white/95 backdrop-blur-xl shadow-lg p-3 max-h-64 overflow-y-auto">
                  {recentEmojis.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-semibold">Recent</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {recentEmojis.map((emoji, idx) => (
                          <button
                            key={`recent-${emoji}-${idx}`}
                            type="button"
                            onClick={() => addEmoji(emoji)}
                            className="emoji-chip h-9 w-9 rounded-xl border border-neutral-200 bg-neutral-50 text-lg grid place-items-center hover:bg-white hover:border-emerald-200 transition"
                            style={{ animationDelay: `${(idx % 6) * 0.08}s` }}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-3">
                    {EMOJI_SECTIONS.map((section, sectionIndex) => (
                      <div key={section.label} className={sectionIndex === 0 ? '' : 'pt-2 border-t border-neutral-100'}>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-semibold">{section.label}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {section.emojis.map((emoji, idx) => (
                            <button
                              key={`${section.label}-${emoji}`}
                              type="button"
                              onClick={() => addEmoji(emoji)}
                              className="emoji-chip h-9 w-9 rounded-xl border border-neutral-200 bg-neutral-50 text-lg grid place-items-center hover:bg-white hover:border-emerald-200 transition"
                              style={{ animationDelay: `${(idx % 8) * 0.06}s` }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Type your order or question…"
              className="w-full bg-neutral-100 border-neutral-200 text-[15px] h-12 rounded-full pl-12 pr-12 focus-visible:ring-emerald-700 focus-visible:border-emerald-700 placeholder:text-neutral-400"
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

        {chefQuizOpen && (
          <div className="absolute inset-0 z-40">
            <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={() => setChefQuizOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 max-h-[80%] rounded-t-3xl bg-white overflow-hidden shadow-2xl">
              <div className="border-b border-neutral-200 px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-emerald-700 font-bold">Chef's Surprise</div>
                  <div className="font-display text-lg font-bold tracking-tight">Tell me your vibe</div>
                  <div className="text-xs text-neutral-500">Step {chefQuizStep + 1} of 3</div>
                </div>
                <button
                  onClick={() => (chefQuizStep > 0 ? setChefQuizStep((s) => s - 1) : setChefQuizOpen(false))}
                  className="text-xs font-semibold text-neutral-500 hover:text-neutral-800"
                >
                  {chefQuizStep > 0 ? 'Back' : 'Close'}
                </button>
              </div>
              <div className="p-5 space-y-4">
                {chefQuizStep === 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {CHEF_QUIZ.moods.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleChefPick('mood', opt.id)}
                        className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-left hover:border-emerald-300 hover:shadow-sm transition"
                      >
                        <div className="text-2xl mb-2">{opt.emoji}</div>
                        <div className="text-sm font-semibold text-neutral-900">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                )}
                {chefQuizStep === 1 && (
                  <div className="grid grid-cols-2 gap-3">
                    {CHEF_QUIZ.tastes.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleChefPick('taste', opt.id)}
                        className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-left hover:border-emerald-300 hover:shadow-sm transition"
                      >
                        <div className="text-2xl mb-2">{opt.emoji}</div>
                        <div className="text-sm font-semibold text-neutral-900">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                )}
                {chefQuizStep === 2 && (
                  <div className="grid grid-cols-2 gap-3">
                    {CHEF_QUIZ.diet.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => handleChefPick('diet', opt.id)}
                        className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-left hover:border-emerald-300 hover:shadow-sm transition"
                      >
                        <div className="text-2xl mb-2">{opt.emoji}</div>
                        <div className="text-sm font-semibold text-neutral-900">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Visual Menu Overlay */}
        {showMenu && (
          <div className="absolute inset-0 z-40">
            <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm" onClick={closeMenu} />
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
                    onClick={closeMenu}
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
                  {DIETARY_PRESETS.map((preset) => {
                    const active = dietaryFilter.includes(preset.id);
                    return (
                      <button
                        key={preset.id}
                        onClick={() => toggleDietary(preset.id)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-semibold border transition ${
                          active
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                  {dietaryFilter.length > 0 && (
                    <button
                      onClick={() => setDietaryFilter([])}
                      className="shrink-0 px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-semibold border border-neutral-200 text-neutral-500 hover:bg-neutral-100"
                    >
                      Clear
                    </button>
                  )}
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
                    <div
                      key={item.id}
                      className={`rounded-2xl bg-white border overflow-hidden flex flex-col transition ${
                        item.promoted
                          ? 'border-amber-300 ring-1 ring-amber-200 shadow-sm shadow-amber-100/60'
                          : 'border-neutral-200'
                      }`}
                      onMouseEnter={() => item.videoUrl && startVideoPreview(item.id)}
                      onMouseLeave={() => item.videoUrl && setActiveVideoId(null)}
                    >
                      <div className="relative h-24 overflow-hidden shrink-0 bg-neutral-100">
                        {item.videoUrl && activeVideoId === item.id ? (
                          <video
                            src={item.videoUrl}
                            muted
                            playsInline
                            autoPlay
                            loop
                            preload="metadata"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <img src={item.image || FALLBACK_MENU_IMAGE} alt={item.name} className="w-full h-full object-cover" />
                        )}
                        {item.promoted && (
                          <div className="absolute top-1 left-1 inline-flex items-center gap-1 rounded-full bg-amber-500 text-white px-2 py-0.5 text-[9px] uppercase tracking-widest font-bold shadow">
                            <Sparkles className="h-2.5 w-2.5" />
                            {item.promotionLabel?.trim() || 'Promoted'}
                          </div>
                        )}
                        {item.videoUrl && (
                          <button
                            type="button"
                            onClick={() => (activeVideoId === item.id ? setActiveVideoId(null) : startVideoPreview(item.id))}
                            className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[9px] text-emerald-800 font-semibold hover:bg-white"
                          >
                            <PlayCircle className="h-2.5 w-2.5" /> {activeVideoId === item.id ? 'Playing' : 'Preview'}
                          </button>
                        )}
                      </div>
                      <div className="p-3 flex-1 flex flex-col">
                        <div className="text-sm font-semibold leading-tight line-clamp-2">{getItemName(item, uiLang)}</div>
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
                    onClick={() => { closeMenu(); if (stage === 'browsing') openOrderSheet('place'); else addOnsAfterOrder(); }}
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
                <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-1">
                  {(pendingItems || cart).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 border-b border-neutral-100 last:border-0 bg-white m-1 rounded-lg">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-xs font-semibold truncate text-neutral-800">{getItemName(item, uiLang)}</div>
                        <div className="text-[10px] text-emerald-700 font-bold">${item.price.toFixed(2)}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button 
                          onClick={() => {
                            const current = pendingItems || cart;
                            const next = current.map(x => x.id === item.id ? { ...x, qty: x.qty - 1 } : x).filter(x => x.qty > 0);
                            setPendingItems(next);
                            if (orderSheetMode === 'place') setCart(next);
                          }}
                          className="h-6 w-6 rounded-full bg-neutral-100 grid place-items-center hover:bg-neutral-200 text-neutral-600 font-bold"
                        >-</button>
                        <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                        <button 
                          onClick={() => {
                            const current = pendingItems || cart;
                            const next = current.map(x => x.id === item.id ? { ...x, qty: x.qty + 1 } : x);
                            setPendingItems(next);
                            if (orderSheetMode === 'place') setCart(next);
                          }}
                          className="h-6 w-6 rounded-full bg-emerald-100 grid place-items-center hover:bg-emerald-200 text-emerald-700 font-bold"
                        >+</button>
                      </div>
                    </div>
                  ))}
                  {(pendingItems || cart).length === 0 && (
                    <div className="p-3 text-center text-xs text-neutral-500">Cart is empty</div>
                  )}
                  <div className="flex justify-between items-center p-3 text-sm font-bold bg-white m-1 rounded-lg border border-emerald-100 text-emerald-900">
                    <span>Total</span>
                    <span>${(pendingItems || cart).reduce((s, i) => s + i.price * i.qty, 0).toFixed(2)}</span>
                  </div>
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
                <div className="px-6 pb-4 space-y-2 text-sm">
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
                <Button variant="outline" className="flex-1 rounded-full border-neutral-200 hover:bg-neutral-50" onClick={() => downloadReceipt(order, payment)}>
                  <Download className="h-4 w-4 mr-1.5" />Download bill
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
              <div className="font-display text-2xl font-extrabold text-white tracking-tight drop-shadow">{burstTitle}</div>
              <div className="text-sm text-emerald-100 mt-1">{burstSubtitle}</div>
              {burst === 'order' && order?.id && (
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
                    <div className="text-3xl font-extrabold tabular-nums">${payTotal.toFixed(2)}</div>
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
                {payment?.clientSecret ? (
                  <InlinePayment 
                    clientSecret={payment.clientSecret}
                    amount={payTotal}
                    onSuccess={(pi) => {
                      toast.success('Payment successful!');
                      setPayment({ ...payment, status: 'paid' });
                      setPaymentOpen(false);
                      setStage('feedback');
                      setMessages((m) => [...m, { role: 'assistant', text: 'Payment received! Thank you. How was your experience?' }]);
                    }}
                    onCancel={() => setPaymentOpen(false)}
                  />
                ) : (
                  <div className="text-center p-4">
                    {checkoutUrl ? (
                      <Button
                        className="rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-6"
                        onClick={openCheckout}
                      >
                        Open secure payment
                      </Button>
                    ) : (
                      'Loading secure payment...'
                    )}
                  </div>
                )}
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
              <div className="text-xs text-neutral-500 font-semibold uppercase tracking-widest mb-2">Likelihood to recommend</div>
              <div className="flex flex-wrap justify-center gap-1.5 mb-2">
                {Array.from({ length: 11 }).map((_, n) => (
                  <button
                    key={n}
                    onClick={() => setNpsScore(n)}
                    className={`h-8 w-8 rounded-full text-xs font-semibold border transition ${
                      npsScore === n
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'border-neutral-200 text-neutral-500 hover:bg-neutral-100'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-neutral-400 mb-4">
                <span>Not likely</span>
                <span>Very likely</span>
              </div>
              {needsFollowup && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700 mb-4">
                  We are sorry about that. Please tell us what went wrong so we can improve.
                </div>
              )}
              <Input
                placeholder={needsFollowup ? 'Quick summary (optional)…' : 'Leave a comment (optional)…'}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="bg-neutral-50 border-neutral-200 rounded-full h-12 mb-4 placeholder:text-neutral-400 text-[15px] focus-visible:ring-emerald-700 focus-visible:border-emerald-700"
              />
              {needsFollowup && (
                <textarea
                  value={feedbackFollowup}
                  onChange={(e) => setFeedbackFollowup(e.target.value)}
                  placeholder="Tell us what went wrong…"
                  className="w-full min-h-[96px] bg-white border border-neutral-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:border-emerald-700 mb-4"
                />
              )}
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
