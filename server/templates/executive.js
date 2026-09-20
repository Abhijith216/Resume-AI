/**
 * Executive Resume Template
 * -------------------------
 * ATS-safe: single column, Georgia serif, plain-text headers, no tables/images.
 * Centred letterhead and spaced small-caps headings — built for senior,
 * leadership, and board-level candidates.
 */

const {
  escapeHtml, highlight, highlightInline, formatBullets, contactParts,
  BASE_CSS, KEYWORD_CSS,
} = require('./shared');

function renderExecutive(resume, keywords) {
  const c = resume.contact || {};
  const parts = contactParts(c);

  const experienceHtml = (resume.experience || []).map((item) => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-company">${highlightInline(item.company, keywords)}</span>
        <span class="entry-dates">${escapeHtml(item.dates)}</span>
      </div>
      <div class="entry-role">${highlightInline(item.role, keywords)}${item.location ? `<span class="entry-loc"> · ${escapeHtml(item.location)}</span>` : ''}</div>
      ${item.bullets ? `<div class="entry-bullets">${formatBullets(item.bullets, keywords)}</div>` : ''}
    </div>`).join('');

  const educationHtml = (resume.education || []).map((item) => `
    <div class="entry entry-tight">
      <div class="entry-header">
        <span class="entry-company">${highlightInline(item.degree, keywords)}</span>
        <span class="entry-dates">${escapeHtml(item.dates)}</span>
      </div>
      ${item.institution || item.location ? `<div class="entry-role">${highlightInline(item.institution, keywords)}${item.location ? `<span class="entry-loc"> · ${escapeHtml(item.location)}</span>` : ''}</div>` : ''}
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
    font-family: Georgia, 'Times New Roman', Times, serif;
    font-size: 10.5pt;
    line-height: 1.5;
    color: #1c1c1c;
    padding: 0.6in 0.75in;
    max-width: 8.5in;
    margin: 0 auto;
    background: #fff;
  }

  /* --- Centred letterhead --- */
  .resume-header { text-align: center; margin-bottom: 16pt; }
  .resume-name {
    font-size: 23pt; font-weight: 400; letter-spacing: 0.08em;
    text-transform: uppercase; color: #14243d; margin-bottom: 4pt;
  }
  .resume-title {
    font-size: 10.5pt; font-style: italic; color: #8a6a2f;
    letter-spacing: 0.04em; margin-bottom: 7pt;
  }
  .resume-rule { height: 0; border-top: 2px solid #14243d; border-bottom: 1px solid #14243d; padding-top: 2pt; margin-bottom: 7pt; }
  .resume-contact { font-size: 9pt; color: #4a4a4a; letter-spacing: 0.02em; }
  .resume-contact span + span::before { content: '  ·  '; color: #a08a5e; }

  /* --- Sections --- */
  .section { margin-bottom: 13pt; }
  .section-heading {
    font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.18em;
    color: #14243d; text-align: center; padding-bottom: 3pt;
    border-bottom: 1px solid #c9b48a; margin-bottom: 8pt;
  }

  /* --- Entries --- */
  .entry { margin-bottom: 10pt; }
  .entry-tight { margin-bottom: 7pt; }
  .entry:last-child { margin-bottom: 0; }
  .entry-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; }
  .entry-company { font-weight: 700; font-size: 11pt; color: #14243d; }
  .entry-dates { font-size: 9pt; font-style: italic; color: #6a6a6a; white-space: nowrap; flex-shrink: 0; }
  .entry-role { font-size: 10pt; font-style: italic; color: #3d3d3d; margin-top: 1pt; }
  .entry-loc { font-style: normal; color: #777; }
  .entry-bullets { margin-top: 4pt; padding-left: 16pt; }
  .entry-bullets ul { list-style: square; padding-left: 0; }
  .entry-bullets li { margin-bottom: 3pt; line-height: 1.48; }
  .entry-bullets p { margin-bottom: 3pt; }

  .summary-text { font-size: 10.5pt; line-height: 1.58; color: #2e2e2e; text-align: justify; }
  .skills-text { font-size: 10.5pt; line-height: 1.6; color: #2e2e2e; text-align: center; }

  ${KEYWORD_CSS}

  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <div class="resume-header">
    ${c.name ? `<div class="resume-name">${escapeHtml(c.name)}</div>` : ''}
    ${c.title ? `<div class="resume-title">${escapeHtml(c.title)}</div>` : ''}
    <div class="resume-rule"></div>
    ${parts.length ? `<div class="resume-contact">${parts.map((p) => `<span>${escapeHtml(p)}</span>`).join('')}</div>` : ''}
  </div>

  ${resume.summary ? `
  <div class="section">
    <div class="section-heading">Executive Summary</div>
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
    <div class="section-heading">Core Competencies</div>
    <div class="skills-text">${highlight(resume.skills, keywords)}</div>
  </div>` : ''}
</body>
</html>`;
}

module.exports = { renderExecutive };
