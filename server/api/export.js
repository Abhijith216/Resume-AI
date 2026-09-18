const { Router } = require('express');
const { renderClassic } = require('../templates/classic');
const { renderModern } = require('../templates/modern');
const { renderCoverLetter } = require('../templates/cover-letter');
const { buildDocx } = require('../services/docx-builder');
const { validateExportBody } = require('../services/validate');

const router = Router();

const TEMPLATES = {
  classic: renderClassic,
  modern: renderModern,
};

/**
 * POST /api/preview
 * Returns rendered HTML string for the live preview iframe.
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

  const templateFn = TEMPLATES[template] || TEMPLATES.classic;
  const html = templateFn(resume, keywords);
  return res.type('html').send(html);
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

  // Cover letter PDF export
  if (coverLetter !== undefined) {
    const coverName = resume.contact?.name || 'CoverLetter';
    const safeCoverName = (coverName.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'CoverLetter') + '-Cover-Letter';
    try {
      const html = renderCoverLetter(resume, coverLetter);
      const pdfBuffer = await htmlToPdf(html);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeCoverName}.pdf"`,
      });
      return res.send(pdfBuffer);
    } catch (err) {
      console.error('[export] Cover letter PDF failed:', err.message);
      return res.status(500).json({ error: `Cover letter export failed: ${err.message || 'Unknown error'}. Please try again.` });
    }
  }

  const validFormats = ['pdf', 'docx'];
  const chosenFormat = validFormats.includes(format) ? format : 'pdf';
  const templateKey = TEMPLATES[template] ? template : 'classic';
  const name = resume.contact?.name || 'Resume';
  const safeName = name.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'Resume';

  try {
    if (chosenFormat === 'docx') {
      const buffer = await buildDocx(resume);
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${safeName}.docx"`,
      });
      return res.send(Buffer.from(buffer));
    }    // PDF via Puppeteer
    const html = TEMPLATES[templateKey](resume, keywords);
    const pdfBuffer = await htmlToPdf(html);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('[export] Error generating export:', err.message);
    return res.status(500).json({
      error: `Export failed: ${err.message || 'Unknown error'}. Please try again.`,
    });
  }
});

/**
 * Render HTML to PDF via Puppeteer.
 */
async function htmlToPdf(html) {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
  } finally {
    await browser.close();
  }
}

module.exports = router;
