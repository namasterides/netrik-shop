// Local Natural-Language Understanding (NLU) engine for the AI Waiter.
// No external API. Pattern-based intent detection + slot filling.
// Stateless: derives the conversation step from the last assistant message,
// the cart, and the allergy/spicy/notes flags coming from the client.

const SPICE_MAP = [
  { re: /\bextra[ -]?hot|extra[ -]?spicy|very\s+spicy|fiery|nuclear\b/i, value: 'extra-hot' },
  { re: /\b(hot|spicy|picante)\b/i, value: 'hot' },
  { re: /\b(medium|moderate|medio)\b/i, value: 'medium' },
  { re: /\b(mild|low|light|less\s+spicy|no\s+spice|not\s+spicy|suave|sin\s+picante)\b/i, value: 'mild' },
];

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  a: 1, an: 1, single: 1, couple: 2, pair: 2, dozen: 12,
};

const AFFIRMATIVE = /^(yes|yeah|yep|yup|sure|ok(ay)?|please\s+do|go\s+ahead|confirm|do\s+it|send\s+it|place\s+it|that'?s\s+all|done|that'?s\s+it|all\s+good|ready)\b/i;
const NEGATIVE = /^(no|nope|nah|none|nothing|skip|never\s*mind|not\s+now|cancel\s+that|wait)\b/i;

function norm(s) { return String(s || '').toLowerCase().trim(); }

function escapeReg(s = '') {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseQuantity(text, itemName) {
  const lower = norm(text);
  const safeName = escapeReg(norm(itemName));
  // numeric prefix: "2 pasta", "2x pasta", "two burgers"
  const numRe = new RegExp('(\\d+)\\s*(?:x|\\*)?\\s*' + safeName);
  const m = lower.match(numRe);
  if (m) return Math.max(1, Math.min(20, parseInt(m[1], 10)));
  // word prefix: "two pasta"
  const wordRe = new RegExp('\\b(' + Object.keys(NUMBER_WORDS).join('|') + ')\\s+' + safeName);
  const wm = lower.match(wordRe);
  if (wm) return NUMBER_WORDS[wm[1]] || 1;
  return 1;
}

// Fuzzy menu matcher
function findMenuMatches(message, menu) {
  const lower = norm(message);
  const out = [];
  const seen = new Set();
  for (const item of menu || []) {
    const name = norm(item.name);
    if (!name) continue;
    // direct substring match
    if (lower.includes(name)) {
      if (!seen.has(item.id)) {
        out.push({ item, qty: parseQuantity(message, name) });
        seen.add(item.id);
      }
      continue;
    }
    // partial token match (at least one substantial word from item name appears)
    const tokens = name.split(/\s+/).filter((t) => t.length >= 4);
    for (const t of tokens) {
      if (lower.includes(t) && !seen.has(item.id)) {
        out.push({ item, qty: parseQuantity(message, t) });
        seen.add(item.id);
        break;
      }
    }
  }
  return out;
}

function pickRecommendations(menu, n = 3) {
  if (!menu || menu.length === 0) return [];
  // Prefer items with descriptions; fall back to any.
  const sorted = [...menu].sort((a, b) => (b.description?.length || 0) - (a.description?.length || 0));
  return sorted.slice(0, n);
}

function getLastAssistant(history = []) {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === 'assistant') return String(history[i].content || '');
  }
  return '';
}

// Pre-order question step inferred from last bot message.
function detectPreOrderStep(lastBot) {
  const fullText = String(lastBot || '');
  // Extract the LAST question (sentence ending with '?'). The bot's previous
  // confirmation may include words like "Spice set to medium" but the actual
  // QUESTION is what we want to match against.
  const questions = fullText.match(/[^.!?]*\?/g) || [];
  const lastQ = (questions[questions.length - 1] || fullText).toLowerCase();

  // Order matters — most specific first.
  if (/(ready\s+to\s+(place|send)|send\s+(it\s+)?to\s+the\s+kitchen|confirm\s+(your\s+)?order|shall\s+i\s+(place|send))/i.test(lastQ)) return 'confirm';
  if (/(extra\s+notes|any\s+notes|notes\s+for\s+the\s+chef|sauce|special\s+request|on\s+the\s+side)/i.test(lastQ)) return 'notes';
  if (/(how\s+spicy|spice\s+level|spicy\s+would\s+you)/i.test(lastQ)) return 'spice';
  if (/allerg/i.test(lastQ)) return 'allergy';
  return null;
}

function detectIntent(message) {
  const lower = norm(message);
  if (!lower) return 'idle';
  if (/^(hi|hey|hello|yo|hola|namaste|good\s+(morning|afternoon|evening))\b/i.test(lower)) return 'greet';
  if (/(menu|dishes|what\s+do\s+you\s+have|what'?s\s+(on|available)|show\s+me.*(food|menu))/i.test(lower)) return 'menu';
  if (/(recommend|suggest|popular|best|signature|special|chef'?s\s+pick)/i.test(lower)) return 'recommend';
  if (/(view|show|see|generate|print)\s+(the\s+)?bill|bill\s+please|invoice/i.test(lower)) return 'bill';
  if (/(pay|payment|upi|checkout\s+payment|settle|paid)/i.test(lower)) return 'pay';
  if (/(place|submit|send|confirm|finalize|finish).{0,20}(order|food)|that'?s\s+all|i'?m\s+done|done\s+ordering|checkout/i.test(lower)) return 'place_order';
  if (/(cancel|remove|delete|drop)\s+(that|the|my|last)/i.test(lower)) return 'cancel';
  if (/(thanks|thank\s+you|gracias|cheers|appreciate)/i.test(lower)) return 'thanks';
  return 'unknown';
}

function summarizeCart(cart) {
  if (!cart || cart.length === 0) return '';
  const parts = cart.map((c) => `${c.qty}x ${c.name}`).join(', ');
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  return `${parts} — total $${total.toFixed(2)}`;
}

// ─── Main entrypoint ──────────────────────────────────────────────────────────
// context = {
//   message, menu, cart, allergy, spicy, notes, stage,
//   restaurantName, history, language
// }
// returns { reply, actions } where actions is the same JSON shape the frontend already consumes.
export function nluRespond(context = {}) {
  const {
    message = '',
    menu = [],
    cart = [],
    allergy = '',
    spicy = '',
    notes = '',
    stage = 'browsing',
    restaurantName = 'our restaurant',
    history = [],
    language = 'en',
  } = context;

  const actions = {};
  let reply = '';

  const lower = norm(message);
  const lastBot = getLastAssistant(history);
  const step = detectPreOrderStep(lastBot);
  const intent = detectIntent(message);

  // ─── 1. Pre-order question flow (state-machine driven by last bot question) ──
  if (step === 'allergy') {
    if (NEGATIVE.test(lower) || /\b(no|none|nothing|n\/a)\b/.test(lower)) {
      actions.set_allergy = 'none';
    } else {
      actions.set_allergy = message.slice(0, 120).trim() || 'none';
    }
    reply = `Got it — I noted "${actions.set_allergy}". 🌶 How spicy would you like it? You can say **mild, medium, hot, or extra-hot**.`;
    return { reply, actions };
  }

  if (step === 'spice') {
    let spice = '';
    for (const m of SPICE_MAP) { if (m.re.test(lower)) { spice = m.value; break; } }
    if (!spice && NEGATIVE.test(lower)) spice = 'mild';
    if (!spice) spice = 'medium';
    actions.set_spicy = spice;
    reply = `Spice set to **${spice}**. ✍️ Any extra notes for the chef? (e.g. "no onions", "extra cheese", "ketchup on the side") — or say *no* to skip.`;
    return { reply, actions };
  }

  if (step === 'notes') {
    if (NEGATIVE.test(lower) || /\b(no|none|nothing|skip)\b/.test(lower)) {
      actions.set_notes = 'none';
    } else {
      actions.set_notes = message.slice(0, 200).trim();
    }
    const cartText = summarizeCart(cart);
    reply = `Perfect. Here is your final summary:\n• Items: ${cartText || '(empty)'}\n• Allergy: ${allergy || 'none'}\n• Spice: ${spicy || 'medium'}\n• Notes: ${actions.set_notes}\n\nShall I send this to the kitchen? Reply **yes** to confirm.`;
    return { reply, actions };
  }

  if (step === 'confirm') {
    if (AFFIRMATIVE.test(lower) || /\b(yes|confirm|place|go|send)\b/.test(lower)) {
      actions.place_order = true;
      reply = `🎉 Awesome! Sending your order to the kitchen now. I'll let you know when it's ready.`;
      return { reply, actions };
    }
    if (NEGATIVE.test(lower)) {
      reply = `No problem — I'll hold off. You can keep adding items, or say "place order" whenever you're ready.`;
      return { reply, actions };
    }
    // unclear — re-ask
    reply = `Just say **yes** to send the order to the kitchen, or **no** to keep browsing.`;
    return { reply, actions };
  }

  // ─── 2. Try to detect "add items" from any message (fuzzy match menu) ──────
  const matches = findMenuMatches(message, menu);
  if (matches.length > 0) {
    actions.add_items = matches.map((m) => ({ id: m.item.id, name: m.item.name, quantity: m.qty }));
    const desc = matches.map((m) => `${m.qty} × ${m.item.name}`).join(' and ');
    reply = `Adding **${desc}** to your cart. 🛒 Want anything else, or shall I take it to the kitchen?`;
    // don't return — let further intent processing override (e.g. if they also said "and place order")
  }

  // Apply spice / allergy detection passively (if user mentions them in any message)
  for (const m of SPICE_MAP) { if (m.re.test(lower)) { actions.set_spicy = m.value; break; } }
  if (/(allergic\s+to|i\s+have\s+(an?\s+)?allerg|nut\s+allerg|gluten\s+free|lactose|peanut\s+allerg)/i.test(lower)) {
    actions.set_allergy = message.slice(0, 120).trim();
  }

  // ─── 3. Intent-based responses ─────────────────────────────────────────────
  if (intent === 'greet') {
    reply = `Hi there! 👋 Welcome to ${restaurantName}. I'm your digital waiter. Tell me what you're craving, ask for **menu** or **recommendations**, and I'll handle the rest.`;
    return { reply, actions };
  }

  if (intent === 'menu') {
    actions.show_menu = true;
    const top = pickRecommendations(menu, 4).map((m) => `${m.name} ($${Number(m.price || 0).toFixed(2)})`).join(', ');
    reply = top
      ? `Sure — opening our visual menu now. A few favourites: **${top}**. Tap any item to add, or just tell me what you want.`
      : `Opening the menu now. Tap any item to add it to your cart.`;
    return { reply, actions };
  }

  if (intent === 'recommend') {
    const recs = pickRecommendations(menu, 3);
    if (recs.length === 0) {
      reply = `Our chef's specials are loading — give me a second!`;
      return { reply, actions };
    }
    const names = recs.map((r) => `**${r.name}** ($${Number(r.price || 0).toFixed(2)})`).join(', ');
    reply = `Tonight I'd recommend: ${names}. ✨ Want me to add any of these?`;
    return { reply, actions };
  }

  if (intent === 'cancel') {
    reply = `No problem — I cleared the last add. Want to start fresh, or pick something else?`;
    actions.clear_last = true;
    return { reply, actions };
  }

  if (intent === 'bill') {
    actions.show_bill = true;
    reply = stage === 'browsing'
      ? `You'll see the bill after you place your order. Want me to send the order to the kitchen first?`
      : `Pulling up your itemised bill now. 🧾`;
    return { reply, actions };
  }

  if (intent === 'pay') {
    if (stage === 'browsing' || !cart || cart.length === 0) {
      reply = `Let's add a few items first! Tell me what you'd like, or ask for **menu**.`;
      return { reply, actions };
    }
    actions.show_bill = true;
    actions.pay_now = true;
    reply = `Opening your bill and the UPI payment now. 💳`;
    return { reply, actions };
  }

  if (intent === 'thanks') {
    reply = `My pleasure! 🙏 Anything else I can get for you?`;
    return { reply, actions };
  }

  // ─── 4. "place_order" — start the instruction flow ─────────────────────────
  if (intent === 'place_order') {
    if (!cart || cart.length === 0) {
      reply = `Your cart is empty — add a few items first. Try saying "show me the menu" or "recommend something".`;
      return { reply, actions };
    }
    // Begin the instructions Q-flow (allergy → spice → notes → confirm).
    if (!allergy) {
      reply = `Before I send your order to the chef, a few quick questions. 🥜 **Any allergies** I should warn the kitchen about? (or say *none*)`;
      return { reply, actions };
    }
    if (!spicy) {
      reply = `🌶 **How spicy** would you like your food? (mild / medium / hot / extra-hot)`;
      return { reply, actions };
    }
    if (!notes) {
      reply = `✍️ Any **extra notes** for the chef? (e.g. "no onions", "extra sauce on the side") — or say *no* to skip.`;
      return { reply, actions };
    }
    // All collected — confirm
    const cartText = summarizeCart(cart);
    reply = `Final check: ${cartText}. Allergy: ${allergy}. Spice: ${spicy}. Notes: ${notes}. **Ready to send to the kitchen?** (yes/no)`;
    return { reply, actions };
  }

  // ─── 5. If we already added items above, the reply is set. Return it. ─────
  if (reply) return { reply, actions };

  // ─── 6. Default acknowledgement ────────────────────────────────────────────
  if (cart && cart.length > 0) {
    const cartText = summarizeCart(cart);
    reply = `Got it. Your cart so far: ${cartText}. Want to add more, or say "place order" when you're ready.`;
  } else {
    reply = `I can help you order, recommend dishes, take allergies & spice prefs, and handle payment — all here in the chat. Try "show me the menu" or "recommend something".`;
  }
  return { reply, actions };
}

export default nluRespond;
