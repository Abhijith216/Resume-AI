/**
 * Classic Resume Template
 * -----------------------
 * ATS-safe: single column, Arial, plain-text headers, no tables/images.
 * Horizontal rules separate each section. The timeless default.
 */

const {
  escapeHtml, highlight, highlightInline, formatBullets, contactParts,
  BASE_CSS, KEYWORD_CSS,
} = require('./shared');

function renderClassic(resume, keywords) {
  const c = resume.contact || {};
  const parts = contactParts(c);

  const experienceHtml = (resume.experience || []).map((item) => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${highlightInline(item.role, keywords)}${item.company ? ` — ${highlightInline(item.company, keywords)}` : ''}</span>
        <span class="entry-dates">${escapeHtml(item.dates)}</span>
      </div>
      ${item.location ? `<div class="entry-location">${escapeHtml(item.location)}</div>` : ''}
      ${item.bullets ? `<div class="entry-bullets">${formatBullets(item.bullets, keywords)}</div>` : ''}
    </div>`).join('');

  const educationHtml = (resume.education || []).map((item) => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${highlightInline(item.degree, keywords)}${item.institution ? ` — ${highlightInline(item.institution, keywords)}` : ''}</span>
        <span class="entry-dates">${escapeHtml(item.dates)}</span>
      </div>
      ${item.location ? `<div class="entry-location">${escapeHtml(item.location)}</div>` : ''}
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
    font-size: 10.5pt;
    line-height: 1.45;
    color: #1a1a1a;
    padding: 0.6in 0.7in;
    max-width: 8.5in;
    margin: 0 auto;
    background: #fff;
  }

  .resume-name { font-size: 22pt; font-weight: 700; letter-spacing: -0.02em; color: #111; margin-bottom: 2pt; }
  .resume-title { font-size: 11pt; color: #444; margin-bottom: 5pt; }
  .resume-contact { font-size: 9.5pt; color: #555; margin-bottom: 14pt; }
  .resume-contact span + span::before { content: '  |  '; color: #aaa; }

  .section { margin-bottom: 14pt; }
  .section-heading {
    font-size: 11.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    color: #222; padding-bottom: 4pt; border-bottom: 1.5px solid #333; margin-bottom: 8pt;
  }

  .entry { margin-bottom: 10pt; }
  .entry:last-child { margin-bottom: 0; }
  .entry-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; }
  .entry-title { font-weight: 700; font-size: 10.5pt; color: #1a1a1a; }
  .entry-dates { font-size: 9.5pt; color: #555; white-space: nowrap; flex-shrink: 0; }
  .entry-location { font-size: 9.5pt; color: #666; margin-top: 1pt; }
  .entry-bullets { margin-top: 4pt; padding-left: 14pt; }
  .entry-bullets ul { list-style: disc; padding-left: 0; }
  .entry-bullets li { margin-bottom: 2pt; font-size: 10.5pt; line-height: 1.45; }
  .entry-bullets p { margin-bottom: 2pt; }

  .summary-text { font-size: 10.5pt; line-height: 1.5; color: #333; }
  .skills-text { font-size: 10.5pt; line-height: 1.55; }

  ${KEYWORD_CSS}

  @media print { body { padding: 0; } }
</style>
</head>
<body>
  ${c.name ? `<div class="resume-name">${escapeHtml(c.name)}</div>` : ''}
  ${c.title ? `<div class="resume-title">${escapeHtml(c.title)}</div>` : ''}
  ${parts.length ? `<div class="resume-contact">${parts.map((p) => `<span>${escapeHtml(p)}</span>`).join('')}</div>` : ''}

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

module.exports = { renderClassic };
