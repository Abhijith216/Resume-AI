/**
 * Cover Letter Template
 * ---------------------
 * Professional, print-safe letterhead rendering of the cover letter.
 * Pairs visually with the Classic resume template (Arial, clean rules).
 */

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br(str) {
  return escapeHtml(str).replace(/\n/g, '<br>');
}

/**
 * @param {object} resume  - structured resume (contact used for letterhead + signature)
 * @param {string} letter  - the cover letter body text
 */
function renderCoverLetter(resume, letter) {
  const c = resume?.contact || {};
  const contactParts = [c.email, c.phone, c.location, c.links].filter(Boolean);

  const paragraphs = String(letter || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p class="cl-para">${nl2br(p)}</p>`)
    .join('');

  const body = paragraphs || '<p class="cl-para cl-empty">Your cover letter will appear here. Generate one from your resume, or write your own.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(c.name || 'Cover Letter')}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    line-height: 1.55;
    color: #1a1a1a;
    padding: 0.7in 0.8in;
    max-width: 8.5in;
    margin: 0 auto;
    background: #fff;
  }

  /* --- Letterhead --- */
  .cl-letterhead {
    display: flex; align-items: baseline; justify-content: space-between; gap: 16pt;
    padding-bottom: 10pt; border-bottom: 2px solid #2f2f2f; margin-bottom: 22pt;
  }
  .cl-name {
    font-size: 17pt; font-weight: 700; letter-spacing: -0.01em; color: #111;
  }
  .cl-contact {
    font-size: 9pt; color: #555; text-align: right; line-height: 1.5;
  }

  /* --- Date --- */
  .cl-date { font-size: 10.5pt; color: #444; margin-bottom: 18pt; }

  /* --- Body --- */
  .cl-body { max-width: 96%; }
  .cl-para { margin-bottom: 12pt; text-align: left; }
  .cl-empty { color: #999; font-style: italic; }

  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <div class="cl-letterhead">
    <div class="cl-name">${escapeHtml(c.name || '')}</div>
    <div class="cl-contact">${contactParts.map((p) => escapeHtml(p)).join('<br>')}</div>
  </div>
  <div class="cl-date">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  <div class="cl-body">
    ${body}
  </div>
</body>
</html>`;
}

module.exports = { renderCoverLetter };
