import { Groq } from 'groq-sdk';

const GROQ_DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const EMERGENT_DEFAULT_MODEL = process.env.EMERGENT_MODEL || 'gemini/gemini-2.5-flash';
const OPENROUTER_DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'mistralai/mistral-7b-instruct:free';
const OPENAI_DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

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

  throw new Error('No LLM key configured. Set GROQ_API_KEY, OPENROUTER_API_KEY, EMERGENT_LLM_KEY, or OPENAI_API_KEY.');
}
