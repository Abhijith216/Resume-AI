/**
 * Compact Resume Template
 * -----------------------
 * ATS-safe: single column, Arial narrow-ish metrics, plain-text headers.
 * Tight leading and small margins fit a long career onto one page without
 * shrinking type below the 9.5pt readability floor.
 */

const {
  escapeHtml, highlight, highlightInline, formatBullets, contactParts,
  BASE_CSS, KEYWORD_CSS,
} = require('./shared');

function renderCompact(resume, keywords) {
  const c = resume.contact || {};
  const parts = contactParts(c);

  const experienceHtml = (resume.experience || []).map((item) => `
    <div class="entry">
      <div class="entry-line">
        <span class="entry-role">${highlightInline(item.role, keywords)}</span>${item.company ? `<span class="entry-sep">,</span> <span class="entry-company">${highlightInline(item.company, keywords)}</span>` : ''}${item.location ? `<span class="entry-loc"> · ${escapeHtml(item.location)}</span>` : ''}
        <span class="entry-dates">${escapeHtml(item.dates)}</span>
      </div>
      ${item.bullets ? `<div class="entry-bullets">${formatBullets(item.bullets, keywords)}</div>` : ''}
    </div>`).join('');

  const educationHtml = (resume.education || []).map((item) => `
    <div class="entry entry-tight">
      <div class="entry-line">
        <span class="entry-role">${highlightInline(item.degree, keywords)}</span>${item.institution ? `<span class="entry-sep">,</span> <span class="entry-company">${highlightInline(item.institution, keywords)}</span>` : ''}${item.location ? `<span class="entry-loc"> · ${escapeHtml(item.location)}</span>` : ''}
        <span class="entry-dates">${escapeHtml(item.dates)}</span>
      </div>
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
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9.5pt;
    line-height: 1.34;
    color: #212121;
    padding: 0.4in 0.5in;
    max-width: 8.5in;
    margin: 0 auto;
    background: #fff;
  }

  /* --- Header: name and contact share one tight block --- */
  .resume-header {
    display: flex; align-items: baseline; justify-content: space-between; gap: 14pt;
    padding-bottom: 5pt; border-bottom: 1.5px solid #1f1f1f; margin-bottom: 9pt;
  }
  .resume-ident { min-width: 0; }
  .resume-name { font-size: 16pt; font-weight: 700; letter-spacing: -0.025em; color: #111; line-height: 1.1; }
  .resume-title { font-size: 9.5pt; color: #4a4a4a; margin-top: 1pt; }
  .resume-contact { font-size: 8pt; color: #555; text-align: right; line-height: 1.42; flex-shrink: 0; }
  .resume-contact span { display: block; }

  /* --- Sections --- */
  .section { margin-bottom: 8pt; }
  .section-heading {
    font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.09em;
    color: #1f1f1f; padding-bottom: 1.5pt; border-bottom: 1px solid #b8b8b8; margin-bottom: 5pt;
  }

  /* --- Entries --- */
  .entry { margin-bottom: 6pt; }
  .entry-tight { margin-bottom: 3pt; }
  .entry:last-child { margin-bottom: 0; }
  .entry-line { display: flex; align-items: baseline; gap: 8pt; flex-wrap: wrap; }
  .entry-role { font-weight: 700; font-size: 9.5pt; color: #161616; }
  .entry-sep { color: #161616; }
  .entry-company { font-weight: 600; color: #3a3a3a; }
  .entry-loc { color: #6f6f6f; font-size: 8.5pt; }
  .entry-dates { margin-left: auto; font-size: 8.5pt; color: #5f5f5f; white-space: nowrap; }
  .entry-bullets { margin-top: 1.5pt; padding-left: 11pt; }
  .entry-bullets ul { list-style: disc; padding-left: 0; }
  .entry-bullets li { margin-bottom: 0.5pt; line-height: 1.34; }
  .entry-bullets p { margin-bottom: 0.5pt; }

  .summary-text { font-size: 9.5pt; line-height: 1.42; color: #303030; }
  .skills-text { font-size: 9.5pt; line-height: 1.45; color: #303030; }

  ${KEYWORD_CSS}

  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="resume-header">
    <div class="resume-ident">
      ${c.name ? `<div class="resume-name">${escapeHtml(c.name)}</div>` : ''}
      ${c.title ? `<div class="resume-title">${escapeHtml(c.title)}</div>` : ''}
    </div>
    ${parts.length ? `<div class="resume-contact">${parts.map((p) => `<span>${escapeHtml(p)}</span>`).join('')}</div>` : ''}
  </div>

  ${resume.summary ? `
  <div class="section">
    <div class="section-heading">Summary</div>
    <div class="summary-text">${highlight(resume.summary, keywords)}</div>
  </div>` : ''}

  ${(resume.experience || []).length ? `
  <div class="section">
    <div class="section-heading">Professional Experience</div>
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
</body>
</html>`;
}

module.exports = { renderCompact };
