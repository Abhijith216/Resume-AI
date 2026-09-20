/**
 * Technical Resume Template
 * -------------------------
 * ATS-safe: single column, system sans with a monospace accent, plain-text
 * headers, no tables/images. Dense and scannable — tuned for engineering,
 * data, and infrastructure roles where the skills list carries real weight.
 */

const {
  escapeHtml, highlight, highlightInline, highlightKeywords, formatBullets, contactParts,
  BASE_CSS, KEYWORD_CSS,
} = require('./shared');

/** Split a comma/newline separated skills blob into individual chips. */
function renderSkillChips(skills, keywords) {
  const items = String(skills || '')
    .split(/[,\n;|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!items.length) return '';
  return `<div class="skill-chips">${items
    .map((s) => `<span class="chip">${highlightKeywords(escapeHtml(s), [
      { terms: keywords?.matched, className: 'kw-matched' },
      { terms: keywords?.missing, className: 'kw-miss' },
    ])}</span>`)
    .join('')}</div>`;
}

function renderTechnical(resume, keywords) {
  const c = resume.contact || {};
  const parts = contactParts(c);

  const experienceHtml = (resume.experience || []).map((item) => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-role">${highlightInline(item.role, keywords)}</span>
        <span class="entry-dates">${escapeHtml(item.dates)}</span>
      </div>
      ${item.company || item.location ? `<div class="entry-meta">${highlightInline(item.company, keywords)}${item.company && item.location ? ' · ' : ''}${escapeHtml(item.location)}</div>` : ''}
      ${item.bullets ? `<div class="entry-bullets">${formatBullets(item.bullets, keywords)}</div>` : ''}
    </div>`).join('');

  const educationHtml = (resume.education || []).map((item) => `
    <div class="entry entry-tight">
      <div class="entry-header">
        <span class="entry-role">${highlightInline(item.degree, keywords)}</span>
        <span class="entry-dates">${escapeHtml(item.dates)}</span>
      </div>
      ${item.institution || item.location ? `<div class="entry-meta">${highlightInline(item.institution, keywords)}${item.institution && item.location ? ' · ' : ''}${escapeHtml(item.location)}</div>` : ''}
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
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
    color: #1f2328;
    padding: 0.55in 0.65in;
    max-width: 8.5in;
    margin: 0 auto;
    background: #fff;
  }

  /* --- Header --- */
  .resume-header { margin-bottom: 13pt; padding-bottom: 9pt; border-bottom: 1px solid #d5dae0; }
  .resume-name { font-size: 20pt; font-weight: 700; letter-spacing: -0.02em; color: #0f172a; margin-bottom: 1pt; }
  .resume-title {
    font-family: 'Consolas', 'SF Mono', Menlo, monospace;
    font-size: 9.5pt; color: #0d7a6f; margin-bottom: 6pt; letter-spacing: -0.01em;
  }
  .resume-contact { font-size: 9pt; color: #56606b; }
  .resume-contact span + span::before { content: '  •  '; color: #b3bcc5; }

  /* --- Sections --- */
  .section { margin-bottom: 12pt; }
  .section-heading {
    font-family: 'Consolas', 'SF Mono', Menlo, monospace;
    font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
    color: #0f172a; margin-bottom: 7pt; padding-bottom: 3pt;
    border-bottom: 2px solid #0d7a6f;
  }

  /* --- Entries --- */
  .entry { margin-bottom: 9pt; }
  .entry-tight { margin-bottom: 6pt; }
  .entry:last-child { margin-bottom: 0; }
  .entry-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12pt; }
  .entry-role { font-weight: 700; font-size: 10.5pt; color: #0f172a; }
  .entry-dates {
    font-family: 'Consolas', 'SF Mono', Menlo, monospace;
    font-size: 8.5pt; color: #6b7681; white-space: nowrap; flex-shrink: 0;
  }
  .entry-meta { font-size: 9.5pt; color: #4d5763; margin-top: 0.5pt; font-weight: 600; }
  .entry-bullets { margin-top: 3.5pt; padding-left: 13pt; }
  .entry-bullets ul { list-style: none; padding-left: 0; }
  .entry-bullets li { position: relative; padding-left: 10pt; margin-bottom: 2.5pt; line-height: 1.45; }
  .entry-bullets li::before { content: '▸'; position: absolute; left: 0; color: #0d7a6f; font-size: 8pt; }
  .entry-bullets p { margin-bottom: 2.5pt; }

  .summary-text { font-size: 10pt; line-height: 1.55; color: #333b44; }

  /* --- Skill chips (plain inline text — parses as a comma list) --- */
  .skill-chips { display: flex; flex-wrap: wrap; gap: 3.5pt; }
  .chip {
    font-family: 'Consolas', 'SF Mono', Menlo, monospace;
    font-size: 8.5pt; padding: 1.5pt 5pt; border: 1px solid #cfd8e0;
    border-radius: 3pt; background: #f4f7f9; color: #2a333d;
  }

  ${KEYWORD_CSS}

  @media print {
    body { padding: 0; }
    .chip { background: none; }
  }
</style>
</head>
<body>
  <div class="resume-header">
    ${c.name ? `<div class="resume-name">${escapeHtml(c.name)}</div>` : ''}
    ${c.title ? `<div class="resume-title">${escapeHtml(c.title)}</div>` : ''}
    ${parts.length ? `<div class="resume-contact">${parts.map((p) => `<span>${escapeHtml(p)}</span>`).join('')}</div>` : ''}
  </div>

  ${resume.skills ? `
  <div class="section">
    <div class="section-heading">Technical Skills</div>
    ${renderSkillChips(resume.skills, keywords)}
  </div>` : ''}

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
</body>
</html>`;
}

module.exports = { renderTechnical };
