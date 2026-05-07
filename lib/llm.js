import { Groq } from 'groq-sdk';

const GROQ_DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const EMERGENT_DEFAULT_MODEL = process.env.EMERGENT_MODEL || 'gemini/gemini-2.5-flash';
const OPENROUTER_DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct:free';
const OPENAI_DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const GEMINI_DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const WAITER_ACTION_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    actions: {
      type: 'object',
      properties: {
        suggest_items: {
          type: 'array',
          items: { type: 'string' },
        },
        add_items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              quantity: { type: 'integer' },
            },
          },
        },
        set_allergy: { type: 'string' },
        set_preference: { type: 'string' },
        set_avoid: { type: 'string' },
        set_spicy: { type: 'string' },
        set_notes: { type: 'string' },
        show_menu: { type: 'boolean' },
        show_bill: { type: 'boolean' },
        clear_last: { type: 'boolean' },
        place_order: { type: 'boolean' },
        pay_now: { type: 'boolean' },
      },
    },
  },
  required: ['reply'],
};

function buildWaiterSystemPrompt({ restaurantName, menu, cart, allergy, preference, avoid, notes, stage, language }) {
  const menuLines = (menu || []).slice(0, 100).map((m) => {
    const desc = m.description ? ` — ${String(m.description).slice(0, 120)}` : '';
    const cat = m.category ? ` [${m.category}]` : '';
    const moods = (m.moodTags || []).length ? ` mood:${m.moodTags.join('/')}` : '';
    const tastes = (m.tasteTags || []).length ? ` taste:${m.tasteTags.join('/')}` : '';
    const diet = (m.dietaryTags || []).length ? ` diet:${m.dietaryTags.join('/')}` : '';
    return `- id="${m.id}" | ${m.name} | $${Number(m.price || 0).toFixed(2)}${cat}${desc}${moods}${tastes}${diet}`;
  }).join('\n');

  const cartLines = (cart || []).length
    ? cart.map((c) => `  • ${c.qty}× ${c.name} ($${Number(c.price || 0).toFixed(2)} each)`).join('\n')
    : '  • (empty)';

  const cartTotal = (cart || []).reduce((s, c) => s + (Number(c.price) || 0) * (c.qty || 0), 0);

  return `You are a real human waiter at "${restaurantName || 'our restaurant'}", chatting with a guest at their table. Your name doesn't matter — you sound like a person, not a bot.

═══════ HOW YOU TALK ═══════
• Short. 1-2 sentences usually. Sometimes just one. Never a paragraph.
• Engage in both formal and informal ways. Be highly polite, respectful, and professional (formal), while simultaneously warm, conversational, and highly engaging (informal). Vary your wording every turn — never reuse the same opener twice. Welcome the customer warmly and proactively offer the menu if they ask.
• NO robotic templates like "Tonight I'd recommend:" or "Adding X to your cart." Speak fresh each time.
• Light emojis OK (max 1 per reply). Use **bold** sparingly for dish names. No bullet lists unless listing 3+ items.
• Read the guest's mood/cravings. If they say "light and tangy", suggest dishes that ACTUALLY match — citrusy, fresh, salads, grilled fish, lemon-based — NOT just whatever's expensive or popular. If nothing on the menu fits, say so honestly and offer the closest alternative.
• Don't oversell. A confident "you'll love it" beats five adjectives.
• Never invent dishes. Only recommend or add items that exist in the menu below.

═══════ MENU (use the EXACT id when adding or suggesting items) ═══════
Each line includes optional tags after the description:
  • mood:tag/tag — when this dish fits a guest's mood (light, comfort, celebratory, etc.)
  • taste:tag/tag — flavour profile (tangy, smoky, creamy, etc.)
  • diet:tag/tag — dietary fits (vegan, gluten-free, etc.)
Use these to MATCH the guest's vibe — never suggest dishes whose tags contradict what they asked for.

${menuLines || '(menu is empty — apologise and tell the guest you can\'t take orders right now)'}

═══════ CURRENT TABLE STATE ═══════
Stage: ${stage || 'browsing'}    (browsing | ordered | served | paying)
Cart so far:
${cartLines}
Cart total: $${cartTotal.toFixed(2)}
Allergy on file: ${allergy || '(not asked yet)'}
Guest wants: ${preference || '(not asked yet)'}
Guest avoids: ${avoid || '(not asked yet)'}
Chef notes: ${notes || '(not asked yet)'}

═══════ RESPONSE FORMAT ═══════
Always reply with this JSON object — nothing else:
{ "reply": "<what you say to the guest>", "actions": { ...optional fields... } }

Action fields (include only the ones you need):
- suggest_items: [ "<menu_id>", "<menu_id>", ... ] — when you RECOMMEND dishes (mood/craving/recommendation request, not a direct order yet). The chat UI shows these as tappable cards inline so the guest can add them with one tap. Always populate this when you mention dishes by name in your reply (1-3 ids, never more). Use the mood/taste/diet tags above to pick items that genuinely match — never default to popular or expensive ones.
- add_items: [{ id, name, quantity }] — copy id EXACTLY from the menu above. Use only when the guest has clearly asked to ADD/order an item ("I'll have…", "give me 2…", "add the pasta"). Quantity defaults to 1, max 20.
- set_allergy: string. Set when the guest tells you their allergies. "none" if they have none.
- set_preference: string. What they want ("extra cheese", "well done", "extra lemon", etc).
- set_avoid: string. What they do NOT want ("no onions", "no garlic", etc).
- set_notes: string of any extra chef instructions ("extra crispy", "sauce on the side", etc). "none" to skip.
- show_menu: true if the guest asks to browse the menu / see what's available.
- show_bill: true if the guest asks for the bill (only after they've placed an order).
- clear_last: true if they want to remove the last thing they added.
- place_order: true ONLY at the very end, after the guest explicitly confirms.
- pay_now: true if the guest asks to pay/checkout (only after the order is placed).

═══════ ORDERING FLOW ═══════
The flow is: add items → ask allergies → ask what they want → ask what they don't want → ask chef notes → confirm → place_order.
1. When the guest names a dish, set add_items and acknowledge naturally — don't always say the same thing.
2. When they say "that's all" / "place order" / "I'm done":
  • If allergy is "(not asked yet)" → ask casually about allergies. Do NOT set place_order yet.
  • Else if preference is "(not asked yet)" → ask what they want (extras, doneness, etc.).
  • Else if avoid is "(not asked yet)" → ask what they don't want.
  • Else if notes is "(not asked yet)" → ask any chef notes.
  • Else → recap the order in one sentence and ask them to confirm.
3. ONLY set place_order: true after they say yes/confirm. Never on the first turn.
4. If the cart is empty when they try to place an order, gently nudge them to pick something first.

═══════ HARD RULES ═══════
• Never say "Tonight I'd recommend:" or any phrase you've used in the last 4 messages.
• Never list ALL the items just because the guest asked for a recommendation — pick 1-3 that fit their actual request and put them in suggest_items.
• When the menu has clear tag matches for what the guest wants (e.g. they say "tangy" → pick items with taste:tangy), prefer those. Don't pad with unrelated items.
• Don't repeat the dish name + price in the reply text when you've already put the item in suggest_items — the UI already shows that. Just say something natural like "These two might hit the spot —" or "How about these?".
• Never wrap your output in \`\`\`json fences. Output the raw JSON object only.
${language && language !== 'en' ? `• Reply in the guest's language (code: ${language}).` : ''}`;
}

function safeParseJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const fenced = String(text).match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
  const first = String(text).indexOf('{');
  const last = String(text).lastIndexOf('}');
  if (first >= 0 && last > first) {
    try { return JSON.parse(String(text).slice(first, last + 1)); } catch {}
  }
  return null;
}

let _geminiKeyWarned = false;

// Calls Gemini with structured JSON output and conversation history.
// Returns { reply, actions } or null on failure (caller should fall back).
export async function geminiWaiterChat({ context, history = [], userMessage }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    if (!_geminiKeyWarned) {
      console.warn('[gemini-waiter] GEMINI_API_KEY not set — falling back to local NLU. Add it to .env.local and RESTART the dev server.');
      _geminiKeyWarned = true;
    }
    return null;
  }

  const model = context.model || GEMINI_DEFAULT_MODEL;
  const systemPrompt = buildWaiterSystemPrompt(context);

  const contents = [];
  for (const m of history.slice(-14)) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const text = String(m.content || '').trim();
    if (!text) continue;
    contents.push({ role, parts: [{ text }] });
  }
  contents.push({ role: 'user', parts: [{ text: String(userMessage || '').trim() || '...' }] });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      temperature: 0.85,         // higher → more varied phrasing
      topP: 0.95,
      maxOutputTokens: 600,
      responseMimeType: 'application/json',
      responseSchema: WAITER_ACTION_SCHEMA,
      thinkingConfig: { thinkingBudget: 0 },   // disable internal "thinking" tokens — faster, deterministic
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    ],
  };

  let res;
  const t0 = Date.now();
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error('[gemini-waiter] fetch failed:', e?.message || e);
    return null;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.error(`[gemini-waiter] HTTP ${res.status} (${model}):`, errText.slice(0, 500));
    return null;
  }

  let data;
  try { data = await res.json(); } catch { return null; }
  const finishReason = data?.candidates?.[0]?.finishReason;
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('') || '';
  const parsed = safeParseJson(text);
  if (!parsed || typeof parsed.reply !== 'string') {
    console.error(`[gemini-waiter] could not parse reply (finishReason=${finishReason}, text length=${text.length}):`, text.slice(0, 200));
    return null;
  }

  const actions = (parsed.actions && typeof parsed.actions === 'object') ? parsed.actions : {};
  if (Array.isArray(actions.suggest_items)) {
    const validIds = new Set((context.menu || []).map((m) => m.id));
    actions.suggest_items = actions.suggest_items
      .map((x) => (typeof x === 'string' ? x : x?.id || ''))
      .filter((id) => id && validIds.has(id))
      .slice(0, 4);
    if (actions.suggest_items.length === 0) delete actions.suggest_items;
  }
  if (Array.isArray(actions.add_items)) {
    actions.add_items = actions.add_items
      .filter((it) => it && (it.id || it.name))
      .map((it) => ({
        id: it.id || '',
        name: it.name || '',
        quantity: Math.max(1, Math.min(20, parseInt(it.quantity || 1, 10) || 1)),
      }));
    if (actions.add_items.length === 0) delete actions.add_items;
  }
  if (actions.set_preference) actions.set_preference = String(actions.set_preference).slice(0, 160);
  if (actions.set_avoid) actions.set_avoid = String(actions.set_avoid).slice(0, 160);
  if (actions.set_notes) actions.set_notes = String(actions.set_notes).slice(0, 220);
  if (actions.set_spicy) {
    const norm = String(actions.set_spicy).toLowerCase().trim();
    const allowed = ['mild', 'medium', 'hot', 'extra-hot'];
    if (allowed.includes(norm)) actions.set_spicy = norm;
    else if (/extra/.test(norm)) actions.set_spicy = 'extra-hot';
    else if (/(spic|hot|fire)/.test(norm)) actions.set_spicy = 'hot';
    else if (/(mild|low|none)/.test(norm)) actions.set_spicy = 'mild';
    else delete actions.set_spicy;
  }
  console.log(`[gemini-waiter] ✓ ${model} in ${Date.now() - t0}ms (${parsed.reply.length} chars, ${Object.keys(actions).length} actions)`);
  return { reply: parsed.reply.trim(), actions };
}

const OPENROUTER_FALLBACK_MODELS = [
  OPENROUTER_DEFAULT_MODEL,
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
  'google/gemma-2-9b-it:free',
];

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

async function callOpenRouter({ messages, model, temperature }) {
  const candidates = unique([model, ...OPENROUTER_FALLBACK_MODELS]);
  let lastErr = null;

  for (const selectedModel of candidates) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://netrik-mu.vercel.app',
          'X-Title': process.env.OPENROUTER_APP_TITLE || 'Netrik Shop',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages,
          temperature,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        lastErr = new Error(`OpenRouter error ${res.status}: ${text}`);
        // Some free models can be unavailable at times; try next candidate.
        continue;
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      if (content) return content;
    } catch (error) {
      lastErr = error;
    }
  }

  throw lastErr || new Error('OpenRouter returned no response');
}

export async function llmChat({ messages, model, temperature = 0.8 }) {
  const formattedMessages = (messages || []).map((m) => ({
    role: m.role === 'system' || m.role === 'user' ? m.role : 'assistant',
    content: m.content || '',
  }));

  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      const sys = formattedMessages.find((m) => m.role === 'system');
      const conv = formattedMessages.filter((m) => m.role !== 'system');
      const contents = conv.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model || GEMINI_DEFAULT_MODEL)}:generateContent?key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(sys ? { systemInstruction: { role: 'system', parts: [{ text: sys.content }] } } : {}),
          contents,
          generationConfig: { temperature, maxOutputTokens: 1024 },
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Gemini error ${res.status}: ${text}`);
      }
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('') || '';
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw new Error(`Gemini LLM error: ${error.message}`);
    }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const chatCompletion = await groq.chat.completions.create({
        messages: formattedMessages,
        model: model || GROQ_DEFAULT_MODEL,
        temperature,
        max_tokens: 1024,
        top_p: 1,
        stream: false,
      });
      return chatCompletion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('Groq API Error:', error);
      throw new Error(`Groq LLM error: ${error.message}`);
    }
  }

  if (process.env.EMERGENT_LLM_KEY) {
    try {
      const res = await fetch('https://integrations.emergentagent.com/llm/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.EMERGENT_LLM_KEY}`,
        },
        body: JSON.stringify({
          model: model || EMERGENT_DEFAULT_MODEL,
          messages: formattedMessages,
          temperature,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Emergent error ${res.status}: ${text}`);
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('Emergent API Error:', error);
      throw new Error(`Emergent LLM error: ${error.message}`);
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await callOpenRouter({
        messages: formattedMessages,
        model,
        temperature,
      });
    } catch (error) {
      console.error('OpenRouter API Error:', error);
      throw new Error(`OpenRouter LLM error: ${error.message}`);
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: model || OPENAI_DEFAULT_MODEL,
          messages: formattedMessages,
          temperature,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`OpenAI error ${res.status}: ${text}`);
      }

      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw new Error(`OpenAI LLM error: ${error.message}`);
    }
  }

  throw new Error('No LLM key configured. Set GEMINI_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, EMERGENT_LLM_KEY, or OPENAI_API_KEY.');
}
