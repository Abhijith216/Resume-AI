(() => {
  'use strict';
  const escape = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const empty = () => ({ contact: { name: '', title: '', email: '', phone: '', location: '', links: '' }, summary: '', experience: [], education: [], skills: '' });
  function clean(data) {
    const r = empty();
    Object.keys(r.contact).forEach((k) => { r.contact[k] = typeof data?.contact?.[k] === 'string' ? data.contact[k].slice(0, 5000) : ''; });
    ['summary', 'skills'].forEach((k) => { r[k] = typeof data?.[k] === 'string' ? data[k].slice(0, 5000) : ''; });
    for (const [section, keys] of [['experience', ['role', 'company', 'dates', 'location', 'bullets']], ['education', ['degree', 'institution', 'dates', 'location']]]) {
      r[section] = (Array.isArray(data?.[section]) ? data[section] : []).slice(0, 50).filter((e) => e && typeof e === 'object').map((e, i) => {
        const item = { id: /^[\w-]{1,64}$/.test(e.id || '') ? e.id : `${section}-${i}` };
        keys.forEach((k) => { item[k] = typeof e[k] === 'string' ? e[k].slice(0, section === 'experience' ? 10000 : 5000) : ''; });
        return item;
      });
    }
    return r;
  }
  function toText(r) {
    const rows = Object.values(r.contact).filter(Boolean);
    if (r.summary.trim()) rows.push('PROFESSIONAL SUMMARY', r.summary);
    for (const [section, title, keys] of [['experience', 'PROFESSIONAL EXPERIENCE', ['role', 'company', 'dates', 'location', 'bullets']], ['education', 'EDUCATION', ['degree', 'institution', 'dates', 'location']]]) {
      const entries = r[section].filter((e) => keys.some((k) => e[k]?.trim()));
      if (entries.length) rows.push(title, ...entries.map((e) => keys.map((k) => e[k]).filter(Boolean).join('\n')));
    }
    if (r.skills.trim()) rows.push('SKILLS', r.skills);
    return rows.join('\n');
  }
  function report(data) {
    return `<details class="score-details"><summary>How this score is calculated</summary><p>${escape(data.methodology)}</p>
      <div class="score-checks">${(data.score_breakdown || []).map((c) => `<div class="score-check"><div><strong>${escape(c.label)}</strong><small>${escape(c.evidence)}</small></div><span>${c.earned}/${c.possible}</span></div>`).join('')}</div>
      <small>Scoring method v${escape(data.score_version)}</small></details>
      ${(data.keyword_evidence || []).length ? `<details class="score-details"><summary>View skill matches and evidence</summary><p>${escape(data.match_note)}</p>${data.keyword_evidence.map((k) => `<div class="skill-evidence"><strong>${escape(k.term)} <span>${k.matched ? 'Matched' : 'Missing'} · ${escape(k.priority)}</span></strong><small>Job: ${escape(k.job_context)}</small><small>${k.matched ? `Resume: ${escape(k.evidence)}` : 'Only add this skill if it reflects your actual experience.'}</small></div>`).join('')}</details>` : ''}`;
  }
  window.ResumeTools = { escape, empty, clean, toText, report, DRAFT_KEY: 'resumeai-builder-draft-v1', HANDOFF_KEY: 'resumeai-builder-handoff-v1', RETURN_KEY: 'resumeai-builder-return-v1' };
})();
