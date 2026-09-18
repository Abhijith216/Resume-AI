const { Router } = require('express');
const crypto = require('crypto');
const { run, all, get } = require('../db');
const { validateVersionSaveBody, validateResume, validateVersionId } = require('../services/validate');

const router = Router();

function nowIso() {
  return new Date().toISOString();
}

function rowToListItem(row) {
  return {
    id: row.id,
    name: row.name,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToFull(row) {
  let resume = null;
  try { resume = JSON.parse(row.resume_json); } catch { resume = null; }
  return {
    id: row.id,
    name: row.name,
    resume,
    cover_letter: row.cover_letter || '',
    job_description: row.job_description || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * GET /api/versions
 * List all saved versions (metadata only, ordered by most recently updated).
 */
router.get('/', (_req, res) => {
  try {
    const rows = all('SELECT id, name, created_at, updated_at FROM resume_versions ORDER BY updated_at DESC');
    return res.json({ versions: rows.map(rowToListItem) });
  } catch (err) {
    console.error('[versions] list failed:', err.message);
    return res.status(500).json({ error: 'Could not load saved versions.' });
  }
});

/**
 * GET /api/versions/:id
 * Fetch one full version (resume + cover letter + job description).
 */
router.get('/:id', (req, res) => {
  const idErrors = validateVersionId(req.params.id);
  if (idErrors.length) return res.status(400).json({ error: idErrors.join(' ') });

  try {
    const row = get('SELECT * FROM resume_versions WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Saved version not found.' });
    return res.json(rowToFull(row));
  } catch (err) {
    console.error('[versions] get failed:', err.message);
    return res.status(500).json({ error: 'Could not load that version.' });
  }
});

/**
 * POST /api/versions
 * Save the current workspace as a new named version.
 * Body: { name, resume, coverLetter?, jobDescription? }
 */
router.post('/', (req, res) => {
  const errors = validateVersionSaveBody(req.body);
  if (errors.length) return res.status(400).json({ error: errors.join(' '), details: errors });

  const { name, resume, coverLetter = '', jobDescription = '' } = req.body;
  const id = crypto.randomUUID();
  const ts = nowIso();

  try {
    run(
      `INSERT INTO resume_versions (id, name, resume_json, cover_letter, job_description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name.trim(), JSON.stringify(resume), coverLetter, jobDescription, ts, ts]
    );
    const row = get('SELECT * FROM resume_versions WHERE id = ?', [id]);
    return res.status(201).json(rowToFull(row));
  } catch (err) {
    console.error('[versions] save failed:', err.message);
    return res.status(500).json({ error: 'Could not save this version.' });
  }
});

/**
 * PUT /api/versions/:id
 * Update an existing version (partial: only provided fields change).
 */
router.put('/:id', (req, res) => {
  const idErrors = validateVersionId(req.params.id);
  if (idErrors.length) return res.status(400).json({ error: idErrors.join(' ') });

  const body = req.body || {};
  if (typeof body !== 'object') return res.status(400).json({ error: 'Request body must be an object.' });

  const errors = [];
  if (body.name !== undefined && (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 120)) {
    errors.push('"name" must be a non-empty string of at most 120 characters.');
  }
  if (body.coverLetter !== undefined && (typeof body.coverLetter !== 'string' || body.coverLetter.length > 100000)) {
    errors.push('"coverLetter" must be a string of at most 100000 characters.');
  }
  if (body.jobDescription !== undefined && (typeof body.jobDescription !== 'string' || body.jobDescription.length > 100000)) {
    errors.push('"jobDescription" must be a string of at most 100000 characters.');
  }
  let resumeProvided = false;
  if (body.resume !== undefined) {
    resumeProvided = true;
    errors.push(...validateResume(body.resume));
  }
  if (errors.length) return res.status(400).json({ error: errors.join(' '), details: errors });

  try {
    const existing = get('SELECT * FROM resume_versions WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Saved version not found.' });

    const next = {
      name: body.name !== undefined ? body.name.trim() : existing.name,
      resume_json: resumeProvided ? JSON.stringify(body.resume) : existing.resume_json,
      cover_letter: body.coverLetter !== undefined ? body.coverLetter : existing.cover_letter,
      job_description: body.jobDescription !== undefined ? body.jobDescription : existing.job_description,
      updated_at: nowIso(),
    };

    run(
      `UPDATE resume_versions SET name = ?, resume_json = ?, cover_letter = ?, job_description = ?, updated_at = ? WHERE id = ?`,
      [next.name, next.resume_json, next.cover_letter, next.job_description, next.updated_at, req.params.id]
    );
    const row = get('SELECT * FROM resume_versions WHERE id = ?', [req.params.id]);
    return res.json(rowToFull(row));
  } catch (err) {
    console.error('[versions] update failed:', err.message);
    return res.status(500).json({ error: 'Could not update that version.' });
  }
});

/**
 * POST /api/versions/:id/duplicate
 * Copy a version under a new id ("Name (copy)").
 */
router.post('/:id/duplicate', (req, res) => {
  const idErrors = validateVersionId(req.params.id);
  if (idErrors.length) return res.status(400).json({ error: idErrors.join(' ') });

  try {
    const existing = get('SELECT * FROM resume_versions WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Saved version not found.' });

    const id = crypto.randomUUID();
    const ts = nowIso();
    run(
      `INSERT INTO resume_versions (id, name, resume_json, cover_letter, job_description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, `${existing.name} (copy)`, existing.resume_json, existing.cover_letter, existing.job_description, ts, ts]
    );
    const row = get('SELECT * FROM resume_versions WHERE id = ?', [id]);
    return res.status(201).json(rowToFull(row));
  } catch (err) {
    console.error('[versions] duplicate failed:', err.message);
    return res.status(500).json({ error: 'Could not duplicate that version.' });
  }
});

/**
 * DELETE /api/versions/:id
 */
router.delete('/:id', (req, res) => {
  const idErrors = validateVersionId(req.params.id);
  if (idErrors.length) return res.status(400).json({ error: idErrors.join(' ') });

  try {
    const existing = get('SELECT id FROM resume_versions WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Saved version not found.' });
    run('DELETE FROM resume_versions WHERE id = ?', [req.params.id]);
    return res.json({ ok: true, id: req.params.id });
  } catch (err) {
    console.error('[versions] delete failed:', err.message);
    return res.status(500).json({ error: 'Could not delete that version.' });
  }
});

module.exports = router;
