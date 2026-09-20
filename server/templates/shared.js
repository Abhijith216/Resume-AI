/**
 * Shared helpers used by every resume template.
 *
 * Every template is a single-column, ATS-safe HTML document: no tables, no
 * multi-column text flow, no images, and conventional section headings. The
 * visual differences between templates are typography, rules, and accent
 * colour only — never structural tricks that break text extraction.
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
 * Wrap occurrences of the given keyword groups in <mark> tags with a per-group
 * class. Runs AFTER escaping, and the terms themselves are regex-escaped, so
 * neither the resume text nor the keyword list can inject markup.
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
    // Never re-highlight inside an existing <mark>: split on tags and only
    // substitute in the text segments.
    out = out
      .split(/(<[^>]+>)/)
      .map((chunk, i) => (i % 2 === 1 ? chunk : chunk.replace(pattern, `<mark class="${className}">$1</mark>`)))
      .join('');
  });
  return out;
}

/** Escape + linebreak + keyword-highlight a free-text field. */
function highlight(text, keywords) {
  return highlightKeywords(nl2br(text), [
    { terms: keywords?.matched, className: 'kw-matched' },
    { terms: keywords?.missing, className: 'kw-miss' },
  ]);
}

/** Escape + keyword-highlight a short single-line field (role, company…). */
function highlightInline(text, keywords) {
  return highlightKeywords(escapeHtml(text), [
    { terms: keywords?.matched, className: 'kw-matched' },
    { terms: keywords?.missing, className: 'kw-miss' },
  ]);
}

/**
 * Render a bullets blob as a <ul> when it looks bulleted, otherwise as
 * paragraphs. Keywords are highlighted inside each line — experience bullets
 * are where most job-description terms actually live.
 */
function formatBullets(text, keywords) {
  const lines = String(text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return '';
  const isBulleted = lines.some((l) => /^[•\-–—*]\s/.test(l));
  if (isBulleted) {
    const items = lines
      .map((l) => `<li>${highlightInline(l.replace(/^[•\-–—*]\s*/, ''), keywords)}</li>`)
      .join('');
    return `<ul>${items}</ul>`;
  }
  return lines.map((l) => `<p>${highlightInline(l, keywords)}</p>`).join('');
}

/** Ordered, non-empty contact values for the header line. */
function contactParts(contact) {
  const c = contact || {};
  return [c.email, c.phone, c.location, c.links].filter(Boolean);
}

/** Reset + print rules every template starts from. */
const BASE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ul { list-style-position: outside; }
  li { break-inside: avoid; }
  .entry, .section { break-inside: avoid-page; }
  .section { page-break-inside: auto; }
`;

/** Keyword highlight styling, identical across templates. */
const KEYWORD_CSS = `
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
`;

module.exports = {
  escapeHtml,
  nl2br,
  highlightKeywords,
  highlight,
  highlightInline,
  formatBullets,
  contactParts,
  BASE_CSS,
  KEYWORD_CSS,
};
