/**
 * Modern Resume Template
 * ----------------------
 * ATS-safe: single column, Calibri, plain-text headers, no tables/images.
 * Left accent bars on section headings give a contemporary feel.
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
 * Wrap occurrences of the given keywords (case-insensitive, escaped for regex)
 * in <mark> tags. Applied AFTER escaping, so keywords are escaped for matching.
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

function renderModern(resume, keywords) {
  const c = resume.contact || {};
  const contactParts = [c.email, c.phone, c.location, c.links].filter(Boolean);

  const experienceHtml = (resume.experience || []).map((item) => `
    <div class="entry">
      <div class="entry-role">${escapeHtml(item.role)}</div>
      <div class="entry-meta">
        ${item.company ? `<span class="entry-company">${escapeHtml(item.company)}</span>` : ''}
        ${item.location ? `<span class="entry-loc">${escapeHtml(item.location)}</span>` : ''}
        ${item.dates ? `<span class="entry-dates">${escapeHtml(item.dates)}</span>` : ''}
      </div>
      ${item.bullets ? `<div class="entry-bullets">${formatBullets(item.bullets)}</div>` : ''}
    </div>`).join('');

  const educationHtml = (resume.education || []).map((item) => `
    <div class="entry">
      <div class="entry-role">${escapeHtml(item.degree)}</div>
      <div class="entry-meta">
        ${item.institution ? `<span class="entry-company">${escapeHtml(item.institution)}</span>` : ''}
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
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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

  /* --- Header --- */
  .resume-header {
    margin-bottom: 16pt;
    padding-bottom: 10pt;
    border-bottom: 2px solid #2b5797;
  }
  .resume-name {
    font-size: 24pt;
    font-weight: 700;
    color: #2b5797;
    letter-spacing: -0.01em;
    margin-bottom: 2pt;
  }
  .resume-title {
    font-size: 11.5pt;
    font-weight: 400;
    color: #555;
    margin-bottom: 6pt;
  }
  .resume-contact {
    font-size: 9.5pt;
    color: #444;
    line-height: 1.6;
  }
  .resume-contact span + span::before {
    content: '  ·  ';
    color: #999;
  }

  /* --- Sections --- */
  .section {
    margin-bottom: 14pt;
  }
  .section-heading {
    font-size: 11pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #2b5797;
    padding: 3pt 0 3pt 10pt;
    border-left: 3px solid #2b5797;
    margin-bottom: 8pt;
    background: rgba(43, 87, 151, 0.04);
  }

  /* --- Entries --- */
  .entry {
    margin-bottom: 10pt;
  }
  .entry:last-child {
    margin-bottom: 0;
  }
  .entry-role {
    font-weight: 700;
    font-size: 10.5pt;
    color: #1a1a1a;
  }
  .entry-meta {
    font-size: 9.5pt;
    color: #555;
    margin-top: 1pt;
    margin-bottom: 4pt;
  }
  .entry-meta span + span::before {
    content: '  |  ';
    color: #bbb;
  }
  .entry-company {
    font-weight: 600;
    color: #444;
  }
  .entry-loc {
    color: #666;
  }
  .entry-dates {
    color: #666;
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
    line-height: 1.48;
  }
  .entry-bullets p {
    margin-bottom: 2pt;
  }

  /* --- Summary --- */
  .summary-text {
    font-size: 10.5pt;
    line-height: 1.52;
    color: #333;
  }

  /* --- Skills --- */
  .skills-text {
    font-size: 10.5pt;
    line-height: 1.55;
    color: #333;
  }

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
    .section-heading { background: none; }
  }
</style>
</head>
<body>
  <div class="resume-header">
    ${c.name ? `<div class="resume-name">${escapeHtml(c.name)}</div>` : ''}
    ${c.title ? `<div class="resume-title">${escapeHtml(c.title)}</div>` : ''}
    ${contactParts.length ? `<div class="resume-contact">${contactParts.map((p) => `<span>${escapeHtml(p)}</span>`).join('')}</div>` : ''}
  </div>

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
  <section class="section">
    <div class="section-heading">Skills</div>
    <div class="skills-text">${highlightKeywords(nl2br(resume.skills), [
      { terms: keywords?.missing, className: 'kw-miss' },
      { terms: keywords?.matched, className: 'kw-matched' },
    ])}</div>
  </section>` : ''}
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

module.exports = { renderModern };
