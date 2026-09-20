/**
 * Modern Resume Template
 * ----------------------
 * ATS-safe: single column, Calibri, plain-text headers, no tables/images.
 * Left accent bars on section headings give a contemporary feel.
 */

const {
  escapeHtml, highlight, highlightInline, formatBullets, contactParts,
  BASE_CSS, KEYWORD_CSS,
} = require('./shared');

function renderModern(resume, keywords) {
  const c = resume.contact || {};
  const parts = contactParts(c);

  const experienceHtml = (resume.experience || []).map((item) => `
    <div class="entry">
      <div class="entry-role">${highlightInline(item.role, keywords)}</div>
      <div class="entry-meta">
        ${item.company ? `<span class="entry-company">${highlightInline(item.company, keywords)}</span>` : ''}
        ${item.location ? `<span class="entry-loc">${escapeHtml(item.location)}</span>` : ''}
        ${item.dates ? `<span class="entry-dates">${escapeHtml(item.dates)}</span>` : ''}
      </div>
      ${item.bullets ? `<div class="entry-bullets">${formatBullets(item.bullets, keywords)}</div>` : ''}
    </div>`).join('');

  const educationHtml = (resume.education || []).map((item) => `
    <div class="entry">
      <div class="entry-role">${highlightInline(item.degree, keywords)}</div>
      <div class="entry-meta">
        ${item.institution ? `<span class="entry-company">${highlightInline(item.institution, keywords)}</span>` : ''}
        ${item.location ? `<span class="entry-loc">${escapeHtml(item.location)}</span>` : ''}
        ${item.dates ? `<span class="entry-dates">${escapeHtml(item.dates)}</span>` : ''}
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
    font-family: Calibri, 'Segoe UI', Tahoma, sans-serif;
    font-size: 10.5pt;
    line-height: 1.48;
    color: #222;
    padding: 0.55in 0.65in;
    max-width: 8.5in;
    margin: 0 auto;
    background: #fff;
  }

  .resume-header { margin-bottom: 16pt; padding-bottom: 10pt; border-bottom: 2px solid #2b5797; }
  .resume-name { font-size: 24pt; font-weight: 700; color: #2b5797; letter-spacing: -0.01em; margin-bottom: 2pt; }
  .resume-title { font-size: 11.5pt; font-weight: 400; color: #555; margin-bottom: 6pt; }
  .resume-contact { font-size: 9.5pt; color: #444; line-height: 1.6; }
  .resume-contact span + span::before { content: '  ·  '; color: #999; }

  .section { margin-bottom: 14pt; }
  .section-heading {
    font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em;
    color: #2b5797; padding: 3pt 0 3pt 10pt; border-left: 3px solid #2b5797;
    margin-bottom: 8pt; background: rgba(43, 87, 151, 0.04);
  }

  .entry { margin-bottom: 10pt; }
  .entry:last-child { margin-bottom: 0; }
  .entry-role { font-weight: 700; font-size: 10.5pt; color: #1a1a1a; }
  .entry-meta { font-size: 9.5pt; color: #555; margin-top: 1pt; margin-bottom: 4pt; }
  .entry-meta span + span::before { content: '  |  '; color: #bbb; }
  .entry-company { font-weight: 600; color: #444; }
  .entry-loc, .entry-dates { color: #666; }
  .entry-bullets { margin-top: 4pt; padding-left: 14pt; }
  .entry-bullets ul { list-style: disc; padding-left: 0; }
  .entry-bullets li { margin-bottom: 2pt; font-size: 10.5pt; line-height: 1.48; }
  .entry-bullets p { margin-bottom: 2pt; }

  .summary-text { font-size: 10.5pt; line-height: 1.52; color: #333; }
  .skills-text { font-size: 10.5pt; line-height: 1.55; color: #333; }

  ${KEYWORD_CSS}

  @media print {
    body { padding: 0; }
    .section-heading { background: none; }
  }
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
    <div class="section-heading">Professional Summary</div>
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

module.exports = { renderModern };
