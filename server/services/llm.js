/**
 * Multi-provider LLM caller using native fetch.
 * Supports OpenAI / OpenAI-compatible, Google Gemini, and Anthropic.
 */

function detectProvider(apiKey, explicitProvider) {
  if (explicitProvider && explicitProvider.trim()) {
    return explicitProvider.trim().toLowerCase();
  }
  if (!apiKey) return 'openai';
  if (apiKey.startsWith('AIzaSy') || apiKey.startsWith('AQ.')) return 'gemini';
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  return 'openai';
}

// Guard against a stalled provider request hanging the request forever.
const LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS) || 45000;

function llmFetch(url, options) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(LLM_TIMEOUT_MS) });
}

function cleanJsonText(raw) {
  if (typeof raw !== 'string') return '';
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  return text;
}

async function callOpenAI({ apiKey, model, systemPrompt, userPrompt, baseURL }) {
  const endpoint = (baseURL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const url = `${endpoint}/chat/completions`;

  const res = await llmFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let message = `OpenAI API returned ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error?.message) message = errJson.error.message;
    } catch {}
    throw new Error(message);
  }

  const data = await res.json();
  const rawContent = data.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error('Empty response received from LLM provider.');
  }

  return cleanJsonText(rawContent);
}

async function callGemini({ apiKey, model, systemPrompt, userPrompt }) {
  const candidateModels = model
    ? [model]
    : ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3-flash-preview'];

  let lastError = null;

  for (const chosenModel of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${chosenModel}:generateContent?key=${apiKey}`;

      const res = await llmFetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              role: 'user',
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        let message = `Gemini API (${chosenModel}) returned ${res.status}`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson.error?.message) message = errJson.error.message;
        } catch {}

        // If high demand or overloaded, try next model candidate
        if (
          res.status === 429 ||
          res.status === 503 ||
          message.toLowerCase().includes('high demand') ||
          message.toLowerCase().includes('quota')
        ) {
          console.warn(`[gemini] ${chosenModel} busy or high demand: ${message}. Trying next model...`);
          lastError = new Error(message);
          continue;
        }

        throw new Error(message);
      }

      const data = await res.json();
      const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawContent) {
        throw new Error(`Empty response received from Gemini (${chosenModel}).`);
      }

      return cleanJsonText(rawContent);
    } catch (err) {
      lastError = err;
      if (err.message.toLowerCase().includes('high demand') || err.message.includes('429')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All Gemini model candidates are currently busy. Please try again in a few moments.');
}

async function callAnthropic({ apiKey, model, systemPrompt, userPrompt }) {
  const url = 'https://api.anthropic.com/v1/messages';

  const res = await llmFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-3-5-haiku-20241022',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    let message = `Anthropic API returned ${res.status}`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.error?.message) message = errJson.error.message;
    } catch {}
    throw new Error(message);
  }

  const data = await res.json();
  const rawContent = data.content?.[0]?.text;
  if (!rawContent) {
    throw new Error('Empty response received from Anthropic.');
  }

  return cleanJsonText(rawContent);
}

/**
 * Invoke the configured LLM provider and return parsed JSON object.
 */
async function callLlmJson({ systemPrompt, userPrompt }) {
  const apiKey = (process.env.LLM_API_KEY || '').trim();

  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error(
      'LLM_API_KEY is not configured in .env. Please configure your API key to run resume analysis.'
    );
  }

  const provider = detectProvider(apiKey, process.env.LLM_PROVIDER);
  const model = process.env.LLM_MODEL;
  const baseURL = process.env.LLM_BASE_URL;

  let jsonText = '';

  if (provider === 'gemini') {
    jsonText = await callGemini({ apiKey, model, systemPrompt, userPrompt });
  } else if (provider === 'anthropic') {
    jsonText = await callAnthropic({ apiKey, model, systemPrompt, userPrompt });
  } else {
    // Default to OpenAI / OpenAI-compatible
    jsonText = await callOpenAI({ apiKey, model, systemPrompt, userPrompt, baseURL });
  }

  try {
    return JSON.parse(jsonText);
  } catch (parseErr) {
    console.error('[llm] JSON parse failed on text:', jsonText);
    throw new Error('The AI model returned an invalid JSON response. Please try again.');
  }
}

module.exports = {
  callLlmJson,
  detectProvider,
};
