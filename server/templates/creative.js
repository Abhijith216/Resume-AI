/**
 * Creative Resume Template
 * ------------------------
 * ATS-safe: single column, plain-text headers, no tables/images — the colour
 * band is a styled <div>, not an image, so extraction is unaffected.
 * A confident accent palette for design, marketing, and brand roles.
 */

const {
  escapeHtml, highlight, highlightInline, formatBullets, contactParts,
  BASE_CSS, KEYWORD_CSS,
} = require('./shared');

function renderCreative(resume, keywords) {
  const c = resume.contact || {};
  const parts = contactParts(c);

  const experienceHtml = (resume.experience || []).map((item) => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-role">${highlightInline(item.role, keywords)}</span>
        <span class="entry-dates">${escapeHtml(item.dates)}</span>
      </div>
      ${item.company || item.location ? `<div class="entry-meta">${highlightInline(item.company, keywords)}${item.company && item.location ? ' — ' : ''}${escapeHtml(item.location)}</div>` : ''}
      ${item.bullets ? `<div class="entry-bullets">${formatBullets(item.bullets, keywords)}</div>` : ''}
    </div>`).join('');

  const educationHtml = (resume.education || []).map((item) => `
    <div class="entry entry-tight">
      <div class="entry-header">
        <span class="entry-role">${highlightInline(item.degree, keywords)}</span>
        <span class="entry-dates">${escapeHtml(item.dates)}</span>
      </div>
      ${item.institution || item.location ? `<div class="entry-meta">${highlightInline(item.institution, keywords)}${item.institution && item.location ? ' — ' : ''}${escapeHtml(item.location)}</div>` : ''}
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(c.name || 'Resume')}</title>
<style>
  ${BASE_CSS}
  body {
    font-family: 'Segoe UI', Candara, Optima, Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.5;
    color: #262433;
    max-width: 8.5in;
    margin: 0 auto;
    background: #fff;
  }
  .page { padding: 0 0.7in 0.6in; }

  /* --- Colour band header --- */
  .resume-header {
    background: linear-gradient(115deg, #5b21b6 0%, #8b2fb0 55%, #c2410c 100%);
    color: #fff; padding: 0.42in 0.7in 0.34in; margin-bottom: 16pt;
  }
  .resume-name { font-size: 24pt; font-weight: 700; letter-spacing: -0.025em; margin-bottom: 2pt; }
  .resume-title {
    font-size: 11pt; font-weight: 600; letter-spacing: 0.04em;
    color: rgba(255, 255, 255, 0.86); margin-bottom: 8pt;
  }
  .resume-contact { font-size: 9pt; color: rgba(255, 255, 255, 0.92); }
  .resume-contact span + span::before { content: '  ·  '; color: rgba(255, 255, 255, 0.5); }

  /* --- Sections --- */
  .section { margin-bottom: 14pt; }
  .section-heading {
    display: flex; align-items: center; gap: 8pt;
    font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.13em;
    color: #6d28d9; margin-bottom: 8pt;
  }
  .section-heading::after { content: ''; flex: 1; height: 2px; background: linear-gradient(90deg, #d8c4f5, transparent); }

  /* --- Entries --- */
  .entry { margin-bottom: 11pt; padding-left: 11pt; border-left: 2px solid #ece3fa; }
  .entry-tight { margin-bottom: 7pt; }
  .entry:last-child { margin-bottom: 0; }
  .entry-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; }
  .entry-role { font-weight: 700; font-size: 11pt; color: #1f1b2e; }
  .entry-dates {
    font-size: 8.5pt; font-weight: 600; color: #7c3aed; white-space: nowrap; flex-shrink: 0;
    background: #f3ecfd; padding: 1pt 5pt; border-radius: 8pt;
  }
  .entry-meta { font-size: 9.5pt; color: #5f5a70; font-weight: 600; margin-top: 1.5pt; }
  .entry-bullets { margin-top: 4pt; }
  .entry-bullets ul { list-style: none; padding-left: 0; }
  .entry-bullets li { position: relative; padding-left: 12pt; margin-bottom: 3pt; line-height: 1.5; }
  .entry-bullets li::before { content: '●'; position: absolute; left: 0; color: #c084fc; font-size: 6pt; top: 4pt; }
  .entry-bullets p { margin-bottom: 3pt; }

  .summary-text { font-size: 10.5pt; line-height: 1.6; color: #3b3649; }
  .skills-text { font-size: 10.5pt; line-height: 1.7; color: #3b3649; }

  ${KEYWORD_CSS}

  @media print {
    .page { padding: 0 0.7in 0; }
    .entry-dates { background: none; padding: 0; color: #7c3aed; }
  }
</style>
</head>
<body>
  <div class="resume-header">
    ${c.name ? `<div class="resume-name">${escapeHtml(c.name)}</div>` : ''}
    ${c.title ? `<div class="resume-title">${escapeHtml(c.title)}</div>` : ''}
    ${parts.length ? `<div class="resume-contact">${parts.map((p) => `<span>${escapeHtml(p)}</span>`).join('')}</div>` : ''}
  </div>

  <div class="page">
    ${resume.summary ? `
    <div class="section">
      <div class="section-heading">Profile</div>
      <div class="summary-text">${highlight(resume.summary, keywords)}</div>
    </div>` : ''}

    ${(resume.experience || []).length ? `
    <div class="section">
      <div class="section-heading">Experience</div>
      ${experienceHtml}
    </div>` : ''}

    ${(resume.education || []).length ? `
    <div class="section">
      <div class="section-heading">Education</div>
      ${educationHtml}
    </div>` : ''}

    ${resume.skills ? `
    <div class="section">
      <div class="section-heading">Skills</div>
      <div class="skills-text">${highlight(resume.skills, keywords)}</div>
    </div>` : ''}
  </div>
</body>
</html>`;
}

module.exports = { renderCreative };
