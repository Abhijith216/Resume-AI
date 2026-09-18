const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

/**
 * SQLite persistence layer.
 *
 * Uses sql.js (pure JS/WASM SQLite) with the whole database held in memory
 * and flushed to disk on every write (atomic write: tmp file + rename).
 * This works everywhere Node works, needs no native build step, and the
 * single-file DB is trivially mountable as a persistent volume on Render,
 * Railway, Fly.io, etc.
 *
 * The on-disk location is controlled by DATA_DIR:
 *   - default: server/  (local dev, no config needed)
 *   - production: set DATA_DIR to a mounted persistent volume directory
 */

const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_PATH = path.join(DATA_DIR, 'resume_builder.db');

let db = null;

/**
 * Initialise (or open) the SQLite database and create tables if needed.
 * Returns the sql.js Database instance.
 */
async function getDb() {
  if (db) return db;

  // Ensure the data directory exists (e.g. a mounted volume or custom DATA_DIR)
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS resume_versions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      resume_json TEXT NOT NULL,
      cover_letter TEXT,
      job_description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return db;
}

/** Persist the in-memory database to disk (atomic tmp + rename). */
function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  const tmpPath = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, DB_PATH);
}

/** Run a statement with bound params and persist to disk. */
function run(sql, params = []) {
  if (!db) throw new Error('Database not initialised — call getDb() first.');
  db.run(sql, params);
  saveDb();
}

/** Fetch all rows as objects. */
function all(sql, params = []) {
  if (!db) throw new Error('Database not initialised — call getDb() first.');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

/** Fetch a single row or null. */
function get(sql, params = []) {
  const rows = all(sql, params);
  return rows.length ? rows[0] : null;
}

/** Best-effort flush on process shutdown. */
function flushOnExit() {
  try { saveDb(); } catch (err) {
    console.error('[db] flush on exit failed:', err.message);
  }
}

module.exports = { getDb, saveDb, run, all, get, flushOnExit, DB_PATH };
