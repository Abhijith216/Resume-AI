require('dotenv').config();

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

// Guard against invalid PORT values (0, empty, non-numeric). On Render/Railway
// the platform injects PORT; locally .env supplies it.
function resolvePort() {
  const raw = String(process.env.PORT ?? '').trim();
  const parsed = Number(raw);
  if (Number.isInteger(parsed) && parsed >= 1024 && parsed <= 65535) return parsed;
  if (raw === '0' && process.env.NODE_ENV !== 'production') return 3000;
  return 3000;
}

const PORT = resolvePort();

// --- Middleware ---
app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- API Routes ---
app.use('/api/health', healthRouter);
app.use('/api/parse-resume', parseResumeRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/structure-resume', structureResumeRouter);
app.use('/api/export', exportRouter);
app.use('/api/cover-letter', coverLetterRouter);
app.use('/api/versions', versionsRouter);

// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON in request body.' });
  }
  console.error('[server] Unhandled error:', err);
  return res.status(500).json({ error: 'Internal server error.' });
});

// --- SPA Fallback: serve index.html for any non-API, non-static request ---
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

// --- Graceful shutdown: flush SQLite to disk ---
process.on('SIGTERM', () => { flushOnExit(); process.exit(0); });
process.on('SIGINT', () => { flushOnExit(); process.exit(0); });
