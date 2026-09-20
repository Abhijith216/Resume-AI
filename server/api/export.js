const { Router } = require('express');
const { renderCoverLetter } = require('../templates/cover-letter');
const { getRenderer, DEFAULT_TEMPLATE, isTemplate, listTemplates } = require('../templates');
const { buildDocx, buildCoverLetterDocx } = require('../services/docx-builder');
const { validateExportBody } = require('../services/validate');

const router = Router();

/**
 * GET /api/export/templates
 * Metadata for the client-side template gallery.
 */
router.get('/templates', (_req, res) => {
  res.json({ templates: listTemplates(), default: DEFAULT_TEMPLATE });
});

/**
 * POST /api/export/preview
 * Returns rendered HTML for the live preview iframe.
 */
router.post('/preview', (req, res) => {
  const { resume, template, keywords, coverLetter } = req.body || {};

  const validationErrors = validateExportBody(req.body);
  if (validationErrors.length) {
    return res.status(400).json({ error: validationErrors.join(' '), details: validationErrors });
  }

  // Cover letter preview mode
  if (coverLetter !== undefined) {
    return res.type('html').send(renderCoverLetter(resume, coverLetter));
  }

  return res.type('html').send(getRenderer(template)(resume, keywords));
});

/**
 * POST /api/export
 * Generates and returns a downloadable PDF or DOCX.
 */
router.post('/', async (req, res) => {
  const { resume, template, format, keywords, coverLetter } = req.body || {};

  const validationErrors = validateExportBody(req.body);
  if (validationErrors.length) {
    return res.status(400).json({ error: validationErrors.join(' '), details: validationErrors });
  }

  const chosenFormat = ['pdf', 'docx'].includes(format) ? format : 'pdf';

  // --- Cover letter export ---
  if (coverLetter !== undefined) {
    const safeCoverName = `${safeFileName(resume.contact?.name, 'CoverLetter')}-Cover-Letter`;
    try {
      if (chosenFormat === 'docx') {
        const buffer = await buildCoverLetterDocx(resume, coverLetter);
        return sendFile(res, Buffer.from(buffer), DOCX_MIME, `${safeCoverName}.docx`);
      }
      const pdfBuffer = await htmlToPdf(renderCoverLetter(resume, coverLetter));
      return sendFile(res, pdfBuffer, 'application/pdf', `${safeCoverName}.pdf`);
    } catch (err) {
      console.error('[export] Cover letter export failed:', err.message);
      return res.status(500).json({
        error: `Cover letter export failed: ${err.message || 'Unknown error'}. Please try again.`,
      });
    }
  }

  // --- Resume export ---
  const templateKey = isTemplate(template) ? template : DEFAULT_TEMPLATE;
  const safeName = safeFileName(resume.contact?.name, 'Resume');

  try {
    if (chosenFormat === 'docx') {
      const buffer = await buildDocx(resume, templateKey);
      return sendFile(res, Buffer.from(buffer), DOCX_MIME, `${safeName}.docx`);
    }
    const pdfBuffer = await htmlToPdf(getRenderer(templateKey)(resume, keywords));
    return sendFile(res, pdfBuffer, 'application/pdf', `${safeName}.pdf`);
  } catch (err) {
    console.error('[export] Error generating export:', err.message);
    return res.status(500).json({
      error: `Export failed: ${err.message || 'Unknown error'}. Please try again.`,
    });
  }
});

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Strip anything that would be awkward in a Content-Disposition filename. */
function safeFileName(raw, fallback) {
  return String(raw || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim() || fallback;
}

/**
 * Send a binary buffer as a download.
 *
 * Express only treats a real Buffer as binary — a Uint8Array (what Puppeteer
 * returns) would be JSON-serialised into `{"0":37,...}`, producing a corrupt
 * file. Callers must hand this a Buffer.
 */
function sendFile(res, buffer, contentType, filename) {
  res.set({
    'Content-Type': contentType,
    'Content-Length': String(buffer.length),
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
  return res.end(buffer);
}

// --- Puppeteer browser reuse -------------------------------------------------
// Launching Chromium costs several seconds. Keep one instance alive across
// exports and relaunch only if it dies or is disconnected.

let browserPromise = null;

async function getBrowser() {
  const puppeteer = require('puppeteer');

  if (browserPromise) {
    try {
      const existing = await browserPromise;
      if (existing.connected) return existing;
    } catch {
      // fall through and relaunch
    }
    browserPromise = null;
  }

  browserPromise = puppeteer
    .launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    })
    .then((browser) => {
      browser.on('disconnected', () => { browserPromise = null; });
      return browser;
    })
    .catch((err) => {
      browserPromise = null;
      throw err;
    });

  return browserPromise;
}

/** Render HTML to a PDF Buffer via Puppeteer. */
async function htmlToPdf(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    // Puppeteer >= 23 returns a Uint8Array; Express needs a Buffer.
    return Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

/** Close the shared browser on shutdown. */
async function closeBrowser() {
  if (!browserPromise) return;
  const pending = browserPromise;
  browserPromise = null;
  try {
    const browser = await pending;
    await browser.close();
  } catch {
    // nothing useful to do while shutting down
  }
}

module.exports = router;
module.exports.closeBrowser = closeBrowser;
