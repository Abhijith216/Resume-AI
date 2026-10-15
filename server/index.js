require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const express = require('express');
const path = require('path');
const { getDb, flushOnExit, DB_PATH } = require('./db');
const healthRouter = require('./api/health');
const parseResumeRouter = require('./api/parse-resume');
const analyzeRouter = require('./api/analyze');
const structureResumeRouter = require('./api/structure-resume');
const exportRouter = require('./api/export');
const coverLetterRouter = require('./api/cover-letter');
const versionsRouter = require('./api/versions');

const app = express();

// Guard against invalid PORT values (empty, non-numeric, out of range). On
// Render/Railway the platform injects PORT; locally .env supplies it.
const DEFAULT_PORT = 3000;

function resolvePort() {
  const raw = String(process.env.PORT ?? '').trim();
  if (!raw) return DEFAULT_PORT;
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) return parsed;
  console.warn(`[server] Ignoring invalid PORT "${raw}" — falling back to ${DEFAULT_PORT}.`);
  return DEFAULT_PORT;
}

const PORT = resolvePort();

// --- Middleware ---
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- API Routes ---
app.use('/api/health', healthRouter);
app.use('/api/parse-resume', parseResumeRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/writing-assist', require('./api/writing-assist'));
app.use('/api/structure-resume', structureResumeRouter);
app.use('/api/export', exportRouter);
app.use('/api/cover-letter', coverLetterRouter);
app.use('/api/versions', versionsRouter);

// --- Unknown API routes: JSON 404, never the SPA shell ---
app.use('/api', (req, res) => {
  res.status(404).json({ error: `No such API endpoint: ${req.method} /api${req.path}` });
});

// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON in request body.' });
  }
  console.error('[server] Unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error.' });
});

// --- SPA Fallback: serve index.html for any non-API, non-static request ---
app.get('/builder', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'builder.html'));
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// --- Start ---
(async () => {
  try {
    await getDb();
    console.log(`✓ SQLite database ready at ${DB_PATH}`);
  } catch (err) {
    console.error('[server] Database initialisation failed:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`✓ Server running at http://localhost:${PORT}`);
  });
})();

// --- Graceful shutdown: flush SQLite, close the shared Chromium instance ---
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  flushOnExit();
  try { await exportRouter.closeBrowser(); } catch { /* best effort */ }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
