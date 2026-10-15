const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
let aiResult;
let aiCalls = 0;
// Exercise the real HTTP routes with a controlled provider, without sending personal data.
require.cache[require.resolve('../server/services/llm')] = { exports: { callLlmJson: async () => { aiCalls++; if (aiResult instanceof Error) throw aiResult; return aiResult; } } };
const app = express(); app.use(express.json());
app.use('/api/analyze', require('../server/api/analyze'));
app.use('/api/writing-assist', require('../server/api/writing-assist'));
let server;
let base;
before(async () => { server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = `http://127.0.0.1:${server.address().port}`; });
after(() => new Promise((resolve) => server.close(resolve)));
async function post(path, body) { return fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }

test('analysis works without AI and validates malformed requests', async () => {
  const start = aiCalls;
  let response = await post('/api/analyze', { resumeText: 'Alex Morgan\nalex@example.com' });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).analysis_mode, 'deterministic');
  assert.equal(aiCalls, start);
  for (const body of [{}, { resumeText: 'x', resume: null }, { resumeText: 'x', includeAi: 'true' }, { resumeText: 'x', jobDescription: [] }]) {
    response = await post('/api/analyze', body); assert.equal(response.status, 400);
  }
});
test('AI failure never prevents a deterministic score', async () => {
  aiResult = new Error('LLM_API_KEY missing');
  const response = await post('/api/analyze', { resumeText: 'Alex Morgan\nalex@example.com', includeAi: true });
  const body = await response.json();
  assert.equal(response.status, 200); assert.ok(Number.isFinite(body.ats_structure_score)); assert.ok(body.analysis_warning);
});
test('rewrites must quote existing text and cannot invent numeric results', async () => {
  const original = 'Built reporting tools for 10 users.';
  aiResult = { rewrite_suggestions: [
    { original, suggested: 'Developed reporting tools for 10 users.', reason: 'Clarity' },
    { original, suggested: 'Increased revenue by 50%.', reason: 'Bad metric' },
    { original: 'Not in this resume at all.', suggested: 'Invented work.' },
  ] };
  const result = await (await post('/api/analyze', { resumeText: original, includeAi: true })).json();
  assert.equal(result.rewrite_suggestions.length, 1);
});
test('writing assistance returns a reviewable draft and rejects invented metrics', async () => {
  aiResult = { suggested: '- Built reporting tools for 10 users.', explanation: 'Clearer action.' };
  let response = await post('/api/writing-assist', { section: 'experience', text: 'I built reporting tools for 10 users.' });
  assert.equal(response.status, 200); assert.ok((await response.json()).suggested);
  aiResult = { suggested: '- Built reporting tools for 999 users.' };
  response = await post('/api/writing-assist', { section: 'experience', text: 'I built reporting tools for 10 users.' });
  assert.equal(response.status, 503);
  response = await post('/api/writing-assist', { section: 'experience', text: 'short' });
  assert.equal(response.status, 400);
});
