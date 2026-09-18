/**
 * Classic Resume Template
 * -----------------------
 * ATS-safe: single column, Arial, plain-text headers, no tables/images.
 * Horizontal rules separate each section.
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
 * Wrap occurrences of the given keyword groups (case-insensitive, escaped for
 * regex) in <mark> tags with a per-group class. Applied AFTER escaping, so the
 * terms themselves are regex-escaped before matching.
 */
function highlightKeywords(html, groups) {
  let out = html;
  (Array.isArray(groups) ? groups : []).forEach(({ terms, className }) => {
    const clean = (Array.isArray(terms) ? terms : [])
      .map((k) => String(k || '').trim())
      .filter((k) => k.length >= 2)
      .slice(0, 24);
    if (!clean.length) return;
    const escapedTerms = clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`\\b(${escapedTerms.join('|')})\\b`, 'gi');
    out = out.replace(pattern, `<mark class="${className}">$1</mark>`);
  });
  return out;
}

function renderClassic(resume, keywords) {
  const c = resume.contact || {};
  const contactParts = [c.email, c.phone, c.location, c.links].filter(Boolean);

  const experienceHtml = (resume.experience || []).map((item) => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${escapeHtml(item.role)}${item.company ? ` — ${escapeHtml(item.company)}` : ''}</span>
        <span class="entry-dates">${escapeHtml(item.dates)}</span>
      </div>
      ${item.location ? `<div class="entry-location">${escapeHtml(item.location)}</div>` : ''}
      ${item.bullets ? `<div class="entry-bullets">${formatBullets(item.bullets)}</div>` : ''}
    </div>`).join('');

  const educationHtml = (resume.education || []).map((item) => `
    <div class="entry">
      <div class="entry-header">
        <span class="entry-title">${escapeHtml(item.degree)}${item.institution ? ` — ${escapeHtml(item.institution)}` : ''}</span>
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
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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

  /* --- Header --- */
  .resume-name {
    font-size: 22pt;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #111;
    margin-bottom: 2pt;
  }
  .resume-title {
    font-size: 11pt;
    color: #444;
    margin-bottom: 5pt;
  }
  .resume-contact {
    font-size: 9.5pt;
    color: #555;
    margin-bottom: 14pt;
  }
  .resume-contact span + span::before {
    content: '  |  ';
    color: #aaa;
  }

  /* --- Sections --- */
  .section {
    margin-bottom: 14pt;
  }
  .section-heading {
    font-size: 11.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #222;
    padding-bottom: 4pt;
    border-bottom: 1.5px solid #333;
    margin-bottom: 8pt;
  }

  /* --- Entries --- */
  .entry {
    margin-bottom: 10pt;
  }
  .entry:last-child {
    margin-bottom: 0;
  }
  .entry-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12pt;
  }
  .entry-title {
    font-weight: 700;
    font-size: 10.5pt;
    color: #1a1a1a;
  }
  .entry-dates {
    font-size: 9.5pt;
    color: #555;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .entry-location {
    font-size: 9.5pt;
    color: #666;
    margin-top: 1pt;
  }
  .entry-bullets {
    margin-top: 4pt;
    padding-left: 14pt;
  }
  .entry-bullets ul {
    list-style: disc;
    padding-left: 0;
  }
  .entry-bullets li {
    margin-bottom: 2pt;
    font-size: 10.5pt;
    line-height: 1.45;
  }
  .entry-bullets p {
    margin-bottom: 2pt;
  }

  /* --- Summary --- */
  .summary-text {
    font-size: 10.5pt;
    line-height: 1.5;
    color: #333;
  }

  /* --- Skills --- */
  .skills-text {
    font-size: 10.5pt;
    line-height: 1.55;
  }
  .skills-text mark.kw-miss { color: #b4541e; }

  /* --- Keyword highlighting --- */
  mark.kw-miss {
    background: rgba(255, 213, 128, 0.55);
    color: inherit;
    padding: 0 1pt;
    border-radius: 2pt;
  }
  mark.kw-matched {
    background: rgba(84, 217, 182, 0.38);
    color: inherit;
    padding: 0 1pt;
    border-radius: 2pt;
  }

  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  ${c.name ? `<div class="resume-name">${escapeHtml(c.name)}</div>` : ''}
  ${c.title ? `<div class="resume-title">${escapeHtml(c.title)}</div>` : ''}
  ${contactParts.length ? `<div class="resume-contact">${contactParts.map((p) => `<span>${escapeHtml(p)}</span>`).join('')}</div>` : ''}

  ${resume.summary ? `
  <div class="section">
    <div class="section-heading">Professional Summary</div>
    <div class="summary-text">${highlightKeywords(nl2br(resume.summary), [
      { terms: keywords?.missing, className: 'kw-miss' },
      { terms: keywords?.matched, className: 'kw-matched' },
    ])}</div>
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
    <div class="skills-text">${highlightKeywords(nl2br(resume.skills), [
      { terms: keywords?.missing, className: 'kw-miss' },
      { terms: keywords?.matched, className: 'kw-matched' },
    ])}</div>
  </div>` : ''}
</body>
</html>`;
}

function formatBullets(text) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const isBulleted = lines.some((l) => /^[•\-–—*]\s/.test(l));
  if (isBulleted) {
    const items = lines.map((l) => `<li>${escapeHtml(l.replace(/^[•\-–—*]\s*/, ''))}</li>`).join('');
    return `<ul>${items}</ul>`;
  }
  return lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('');
}

module.exports = { renderClassic };
