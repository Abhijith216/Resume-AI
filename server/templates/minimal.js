/**
 * Minimal Resume Template
 * -----------------------
 * ATS-safe: single column, Helvetica/Arial, plain-text headers, no rules.
 * Whitespace does the work — nothing but type hierarchy. Reads beautifully
 * for design, product, and research roles.
 */

const {
  escapeHtml, highlight, highlightInline, formatBullets, contactParts,
  BASE_CSS, KEYWORD_CSS,
} = require('./shared');

function renderMinimal(resume, keywords) {
  const c = resume.contact || {};
  const parts = contactParts(c);

  const experienceHtml = (resume.experience || []).map((item) => `
    <div class="entry">
      <div class="entry-dates">${escapeHtml(item.dates)}</div>
      <div class="entry-body">
        <div class="entry-role">${highlightInline(item.role, keywords)}</div>
        ${item.company || item.location ? `<div class="entry-meta">${highlightInline(item.company, keywords)}${item.company && item.location ? ', ' : ''}${escapeHtml(item.location)}</div>` : ''}
        ${item.bullets ? `<div class="entry-bullets">${formatBullets(item.bullets, keywords)}</div>` : ''}
      </div>
    </div>`).join('');

  const educationHtml = (resume.education || []).map((item) => `
    <div class="entry">
      <div class="entry-dates">${escapeHtml(item.dates)}</div>
      <div class="entry-body">
        <div class="entry-role">${highlightInline(item.degree, keywords)}</div>
        ${item.institution || item.location ? `<div class="entry-meta">${highlightInline(item.institution, keywords)}${item.institution && item.location ? ', ' : ''}${escapeHtml(item.location)}</div>` : ''}
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
    font-family: Helvetica, Arial, 'Segoe UI', sans-serif;
    font-size: 10pt;
    line-height: 1.55;
    color: #2b2b2b;
    padding: 0.75in 0.8in;
    max-width: 8.5in;
    margin: 0 auto;
    background: #fff;
  }

  /* --- Header --- */
  .resume-header { margin-bottom: 26pt; }
  .resume-name { font-size: 19pt; font-weight: 600; letter-spacing: -0.015em; color: #111; margin-bottom: 3pt; }
  .resume-title { font-size: 10pt; font-weight: 400; color: #767676; margin-bottom: 8pt; }
  .resume-contact { font-size: 8.5pt; color: #767676; letter-spacing: 0.01em; }
  .resume-contact span + span::before { content: '   '; white-space: pre; }

  /* --- Sections: label sits above, no rules at all --- */
  .section { margin-bottom: 20pt; }
  .section-heading {
    font-size: 7.5pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.22em; color: #a8a8a8; margin-bottom: 9pt;
  }

  /* --- Entries: hanging date column, still linear in the DOM --- */
  .entry { display: flex; gap: 14pt; margin-bottom: 13pt; }
  .entry:last-child { margin-bottom: 0; }
  .entry-dates {
    flex: 0 0 78pt; font-size: 8.5pt; color: #a0a0a0;
    padding-top: 1.5pt; letter-spacing: 0.01em;
  }
  .entry-body { flex: 1; min-width: 0; }
  .entry-role { font-size: 10.5pt; font-weight: 600; color: #171717; }
  .entry-meta { font-size: 9pt; color: #787878; margin-top: 0.5pt; }
  .entry-bullets { margin-top: 5pt; }
  .entry-bullets ul { list-style: none; padding-left: 0; }
  .entry-bullets li { position: relative; padding-left: 11pt; margin-bottom: 3pt; line-height: 1.55; }
  .entry-bullets li::before { content: '—'; position: absolute; left: 0; color: #c4c4c4; }
  .entry-bullets p { margin-bottom: 3pt; }

  .summary-text { font-size: 10.5pt; line-height: 1.65; color: #3a3a3a; max-width: 92%; }
  .skills-text { font-size: 10pt; line-height: 1.75; color: #3a3a3a; }

  ${KEYWORD_CSS}

  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="resume-header">
    ${c.name ? `<div class="resume-name">${escapeHtml(c.name)}</div>` : ''}
    ${c.title ? `<div class="resume-title">${escapeHtml(c.title)}</div>` : ''}
    ${parts.length ? `<div class="resume-contact">${parts.map((p) => `<span>${escapeHtml(p)}</span>`).join('')}</div>` : ''}
  </div>

  ${resume.summary ? `
  <div class="section">
    <div class="section-heading">Summary</div>
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
</body>
</html>`;
}

module.exports = { renderMinimal };
