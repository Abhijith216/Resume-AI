(() => {
  'use strict';
  const T = window.ResumeTools;
  const $ = (s) => document.querySelector(s);
  const e = T.escape;
  const steps = [
    ['Start', 'How would you like to start?', 'Choose a starting point. We’ll help with the words and the finishing touches.'],
    ['Your details', 'Let’s start with you.', 'Make it easy for your next employer to get in touch.'],
    ['Experience', 'Show what you bring.', 'Work, internships, volunteer roles, and projects all tell your story.'],
    ['Education', 'Build on your foundation.', 'Add education, relevant training, or professional qualifications.'],
    ['Skills & summary', 'Connect the dots.', 'Bring your strengths together in a few clear, honest sentences.'],
    ['Template', 'Find your finishing touch.', 'Seven single-column layouts. Your content stays with you as you switch.'],
    ['Review', 'Ready for your next chapter?', 'Check the details, download your resume, and see where you can improve.'],
  ];
  let state = { resume: T.empty(), step: 0, path: '', template: 'classic', jobDescription: '' };
  let templates = [];
  let score = null;
  let revision = 0;
  let previewSerial = 0;
  let previewTimer;
  let pendingAI = null;
  let aiBusy = false;
  const newId = () => crypto.randomUUID();

  function hydrate(value) {
    if (!value || typeof value !== 'object' || !value.resume) return;
    state = { resume: T.clean(value.resume), step: Math.max(0, Math.min(6, Number(value.step) || 0)), path: ['guided', 'first', 'blank'].includes(value.path) ? value.path : 'guided', template: typeof value.template === 'string' ? value.template : 'classic', jobDescription: typeof value.jobDescription === 'string' ? value.jobDescription.slice(0, 100000) : '' };
  }
  try {
    hydrate(JSON.parse(localStorage.getItem(T.DRAFT_KEY)));
    const returned = sessionStorage.getItem(T.RETURN_KEY);
    if (returned) { hydrate({ ...state, ...JSON.parse(returned), step: 6 }); sessionStorage.removeItem(T.RETURN_KEY); }
  } catch { /* A damaged draft must not prevent starting a new resume. */ }
  function save() {
    try { localStorage.setItem(T.DRAFT_KEY, JSON.stringify(state)); $('#draft-status').textContent = 'Draft saved in this browser'; }
    catch { $('#draft-status').textContent = 'Browser storage unavailable — keep this tab open'; }
  }
  function message(text = '') { $('#builder-message').textContent = text; }
  function invalidate() { revision++; score = null; save(); clearTimeout(previewTimer); previewTimer = setTimeout(updatePreview, 400); }
  function cleanResume() {
    const r = T.clean(state.resume);
    ['experience', 'education'].forEach((key) => { r[key] = r[key].filter((item) => Object.entries(item).some(([k, v]) => k !== 'id' && v.trim())); });
    return r;
  }
  function field(path, label, value, { placeholder = '', rows = 0, type = 'text', required = false, help = '' } = {}) {
    const id = `field-${path.replace(/\./g, '-')}`;
    const attrs = `id="${id}" data-field="${path}" maxlength="${path.endsWith('bullets') ? 10000 : path === 'jobDescription' ? 100000 : 5000}" ${required ? 'required' : ''} placeholder="${e(placeholder)}" ${help ? `aria-describedby="${id}-help"` : ''}`;
    return `<div class="builder-field ${rows || path === 'contact.links' ? 'full' : ''}"><label for="${id}">${e(label)}${required ? ' *' : ''}</label>${rows ? `<textarea ${attrs} rows="${rows}">${e(value)}</textarea>` : `<input ${attrs} type="${type}" value="${e(value)}">`}${help ? `<small id="${id}-help">${e(help)}</small>` : ''}</div>`;
  }
  function get(path) { return path === 'jobDescription' ? state.jobDescription : path.split('.').reduce((obj, key) => obj?.[key], state.resume); }
  function set(path, value) {
    if (path === 'jobDescription') { state.jobDescription = value; return; }
    const keys = path.split('.');
    const last = keys.pop();
    const obj = keys.reduce((o, key) => o[key], state.resume);
    obj[last] = value;
  }
  function aiButton(path, section) { return `<button type="button" class="btn btn-ghost btn-sm ai-write" data-ai="${path}" data-section="${section}" ${aiBusy ? 'disabled' : ''}>✦ Help me write this</button>`; }
  function startMarkup() {
    return `<div class="start-options">
      <button type="button" class="start-option" data-start="guided"><span class="start-icon">↗</span><span><strong>Build with guidance</strong><small>For your next career move. Walk through your experience, skills, and achievements.</small></span><span>→</span></button>
      <button type="button" class="start-option" data-start="first"><span class="start-icon">✧</span><span><strong>My first resume</strong><small>Starting out? Turn your studies, projects, and internships into a compelling story.</small></span><span>→</span></button>
      <button type="button" class="start-option" data-start="blank"><span class="start-icon">＋</span><span><strong>Start with a blank canvas</strong><small>Know what you want to say? Move freely between sections and make it yours.</small></span><span>→</span></button>
    </div><p class="builder-tip">Already have a resume? <a href="/" style="color:var(--violet)">Open the ATS workspace →</a></p>`;
  }
  function contactMarkup() {
    const c = state.resume.contact;
    return `<div class="builder-fields">${field('contact.name', 'Full name', c.name, { required: true, placeholder: 'e.g. Alex Morgan' })}${field('contact.title', 'Professional headline', c.title, { placeholder: 'e.g. Software developer' })}${field('contact.email', 'Email address', c.email, { type: 'email', required: true, placeholder: 'you@example.com' })}${field('contact.phone', 'Phone number', c.phone, { type: 'tel', placeholder: '+91 98765 43210' })}${field('contact.location', 'Location', c.location, { placeholder: 'City, country' })}${field('contact.links', 'Portfolio or professional links', c.links, { placeholder: 'linkedin.com/in/your-profile' })}</div><p class="builder-tip">A city and country are enough. Include links that help demonstrate your work.</p>`;
  }
  function entriesMarkup(section) {
    const isExp = section === 'experience';
    const items = state.resume[section];
    return items.map((item, i) => `<article class="builder-entry"><div class="builder-entry-heading"><h3>${isExp ? state.path === 'first' ? 'Experience / project' : 'Experience' : 'Qualification'} ${i + 1}</h3><button type="button" class="btn btn-ghost btn-sm" data-remove="${section}.${i}">Remove<span class="visually-hidden"> entry ${i + 1}</span></button></div><div class="builder-fields">${isExp ?
      field(`${section}.${i}.role`, state.path === 'first' ? 'Role or project title' : 'Role / title', item.role, { placeholder: state.path === 'first' ? 'e.g. Student project lead' : 'e.g. Product designer' }) + field(`${section}.${i}.company`, 'Company or organization', item.company, { placeholder: 'Company, university, or independent project' }) :
      field(`${section}.${i}.degree`, 'Degree or qualification', item.degree, { placeholder: 'e.g. B.Tech in Computer Science' }) + field(`${section}.${i}.institution`, 'Institution', item.institution, { placeholder: 'University or training provider' })}
      ${field(`${section}.${i}.dates`, isExp ? 'Dates' : 'Graduation / completion year', item.dates, { placeholder: isExp ? 'Jan 2023 - Present' : '2026 (expected)' })}${field(`${section}.${i}.location`, 'Location (optional)', item.location, { placeholder: 'City or remote' })}${isExp ? field(`${section}.${i}.bullets`, 'Contributions and achievements', item.bullets, { rows: 5, placeholder: 'What did you do? What tools did you use? What changed because of your work?', help: 'One contribution per line. Include real scope or results where available.' }) : ''}</div>${isExp ? aiButton(`${section}.${i}.bullets`, 'experience') : ''}</article>`).join('') + `${!items.length ? `<p class="builder-muted">${isExp ? 'Add a role, internship, volunteer experience, or project. You can also skip this section for now.' : 'Add your studies, a course, or a qualification. You can skip this section if it does not apply.'}</p>` : ''}<button type="button" class="btn btn-ghost builder-add" data-add="${section}">＋ Add ${isExp ? 'experience or project' : 'qualification'}</button><p class="builder-tip">${isExp ? 'Use your own facts. AI can improve wording after you add notes; you choose whether to apply the draft.' : 'Still studying? Use your expected completion year. Recent graduates can include relevant coursework in their summary.'}</p>`;
  }
  function skillsMarkup() {
    return `<div class="builder-fields">${field('skills', 'Your skills', state.resume.skills, { rows: 3, placeholder: 'e.g. Python, SQL, data analysis, stakeholder communication', help: 'List skills and tools you can confidently discuss. Separate them with commas.' })}${field('summary', 'Professional summary', state.resume.summary, { rows: 6, placeholder: 'Describe your background, strengths, and the kind of contribution you want to make.', help: 'Start with your own notes. AI can help turn them into 2–3 focused sentences.' })}</div>${aiButton('summary', 'summary')}<p class="builder-tip">Be specific about what you bring. A short, truthful summary is stronger than a list of buzzwords.</p><div class="builder-fields">${field('jobDescription', 'Target job description (optional)', state.jobDescription, { rows: 5, placeholder: 'Paste a job description to check skill alignment in your final review.', help: 'This stays out of your exported resume.' })}</div>`;
  }
  function templatesMarkup() {
    if (!templates.length) return '<p class="builder-muted">Templates could not be loaded. Your Classic template is still selected.</p><button class="btn btn-ghost" type="button" data-retry-templates>Retry templates</button>';
    return `<div class="builder-templates">${templates.map((t) => `<button type="button" class="builder-template" data-template="${e(t.key)}" aria-pressed="${state.template === t.key}" style="--template-accent:${/^#[0-9a-f]{6}$/i.test(t.accent) ? t.accent : '#333333'}"><span class="template-mini" aria-hidden="true"><b></b>${'<i></i>'.repeat(9)}</span><strong>${e(t.name)}${state.template === t.key ? ' ✓' : ''}</strong><small>${e(t.bestFor)}</small></button>`).join('')}</div><p class="builder-tip">Select a template to see it with your own content. Check the downloaded file for final page breaks.</p>`;
  }
  function reviewMarkup() {
    const r = cleanResume();
    const rows = [
      ['Contact details', [r.contact.name, r.contact.email].filter(Boolean).join(' · ') || 'Add your name and email', 1],
      ['Experience', `${r.experience.length} experience / project ${r.experience.length === 1 ? 'entry' : 'entries'}`, 2],
      ['Education', `${r.education.length} ${r.education.length === 1 ? 'qualification' : 'qualifications'}`, 3],
      ['Skills & summary', `${r.skills ? 'Skills added' : 'No skills yet'} · ${r.summary ? 'Summary added' : 'No summary yet'}`, 4],
      ['Template', templates.find((t) => t.key === state.template)?.name || state.template, 5],
    ];
    return `<h3>The final look-over</h3><p class="builder-muted">Check spelling, dates, links, and every factual claim in the preview.</p>${rows.map(([title, detail, step]) => `<div class="review-row"><div><strong>${title}</strong><small>${e(detail)}</small></div><button type="button" class="btn btn-ghost btn-sm" data-step="${step}" aria-label="Edit ${title}">Edit</button></div>`).join('')}
      <div class="review-actions"><button type="button" class="btn btn-primary" data-download="pdf">↓ Download PDF</button><button type="button" class="btn btn-ghost" data-download="docx">↓ Download DOCX</button></div>
      <section class="ats-invite"><p class="eyebrow">ONE MORE USEFUL CHECK</p><h3>How ready is your resume?</h3><p>Check your ATS readiness estimate and job-keyword coverage. Then open the improvement workspace to act on the feedback.</p><button type="button" class="btn btn-primary" id="check-ats">Check ATS score →</button><div id="builder-score-report" aria-live="polite">${score ? scoreMarkup() : ''}</div></section>`;
  }
  function scoreMarkup() {
    if (!score) return '';
    return `<div class="builder-scores"><div class="builder-score"><strong>${score.ats_structure_score}<small style="font-size:.8rem"> / 100</small></strong><span>Resume readiness</span></div><div class="builder-score"><strong>${score.content_match_score === null ? '—' : score.content_match_score + '%'}</strong><span>Job keyword coverage</span></div></div><p>${e(score.match_note)}</p>${score.structure_issues.slice(0, 4).map((i) => `<div class="builder-issue">${e(i.issue)}</div>`).join('')}<p class="builder-muted">An estimate based on your resume text, not an employer’s ATS result.</p><button type="button" class="btn btn-primary" id="improve-ats">Open ATS improvement workspace →</button>${T.report(score)}`;
  }
  function render(focus = false) {
    const [label, title, description] = steps[state.step];
    $('#step-counter').textContent = state.step === 0 ? 'YOUR NEW RESUME' : `STEP ${String(state.step).padStart(2, '0')} OF 06 · ${label.toUpperCase()}`;
    $('#step-title').textContent = title;
    $('#step-description').textContent = description;
    $('#builder-progress-fill').style.width = `${state.step / 6 * 100}%`;
    $('#builder-steps').innerHTML = steps.map(([name], i) => `<button class="builder-step" type="button" data-step="${i}" ${i === state.step ? 'aria-current="step"' : ''} ${!state.path && i > 0 ? 'disabled' : ''}><span>${i + 1}</span>${name}</button>`).join('');
    $('#builder-form').innerHTML = [startMarkup, contactMarkup, () => entriesMarkup('experience'), () => entriesMarkup('education'), skillsMarkup, templatesMarkup, reviewMarkup][state.step]();
    $('#builder-controls').hidden = state.step === 0;
    $('#builder-next').hidden = state.step === 6;
    $('#builder-next').textContent = state.step === 5 ? 'Review my resume →' : 'Continue →';
    $('#step-hint').textContent = state.step === 1 ? '* Required' : state.step < 5 ? 'You can return to this later' : '';
    message();
    if (focus) $('#step-title').focus({ preventScroll: true });
  }
  function navigate(step) {
    if (!state.path && step > 0) return;
    state.step = Math.max(0, Math.min(6, step));
    save(); render(true);
  }
  function validateContact() {
    const c = state.resume.contact;
    if (!c.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) {
      navigate(1); message('Add your name and a valid email address before reviewing or downloading.'); $('#builder-form').reportValidity(); return false;
    }
    return true;
  }
  async function updatePreview() {
    const serial = ++previewSerial;
    const resume = cleanResume();
    const empty = !T.toText(resume).trim();
    $('#preview-empty').hidden = !empty;
    $('#builder-template-name').textContent = templates.find((t) => t.key === state.template)?.name || 'Classic';
    if (empty) { $('#builder-preview').srcdoc = ''; return; }
    $('#builder-preview-status').textContent = 'Updating preview…';
    try {
      const response = await fetch('/api/export/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resume, template: state.template }) });
      if (!response.ok) throw new Error('Preview unavailable. Check your inputs and try again.');
      const html = await response.text();
      if (serial !== previewSerial) return;
      $('#builder-preview').srcdoc = html;
      $('#builder-preview-status').textContent = 'Single-column layout · Selectable text';
    } catch (err) { if (serial === previewSerial) $('#builder-preview-status').textContent = err.message; }
  }
  async function loadTemplates() {
    try {
      const response = await fetch('/api/export/templates');
      if (!response.ok) throw new Error('Template request failed');
      const data = await response.json(); templates = data.templates || [];
      if (!templates.some((t) => t.key === state.template)) { state.template = data.default || 'classic'; save(); }
      if (state.step === 5 || state.step === 6) render();
      updatePreview();
    } catch { if (state.step === 5) render(); }
  }
  async function assist(button) {
    const path = button.dataset.ai;
    const original = get(path) || '';
    if (original.trim().length < 15) { message('Add a few notes about your actual experience first (at least 15 characters).'); return; }
    const snapshot = revision;
    aiBusy = true; button.disabled = true; button.textContent = '✦ Working on your draft…'; message();
    try {
      const context = path === 'summary' ? [state.resume.contact.title, state.resume.skills].filter(Boolean).join('\n') : [state.resume.contact.title, get(path.replace('.bullets', '.role'))].filter(Boolean).join('\n');
      const response = await fetch('/api/writing-assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ section: button.dataset.section, text: original, context }), signal: AbortSignal.timeout(60000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI writing could not be completed.');
      if (snapshot !== revision) { message('Your notes changed while AI was writing. Try again with your latest notes.'); return; }
      pendingAI = { path, original, revision: snapshot };
      $('#ai-suggestion').value = data.suggested;
      $('#ai-explanation').textContent = data.explanation;
      $('#ai-dialog').showModal();
    } catch (err) { message(err.name === 'TimeoutError' ? 'AI writing took too long. Your notes are safe; please try again.' : err.message); }
    finally { aiBusy = false; document.querySelectorAll('[data-ai]').forEach((b) => { b.disabled = false; b.textContent = '✦ Help me write this'; }); }
  }
  async function checkScore(button) {
    if (!validateContact()) return;
    const resume = cleanResume(); const snapshot = revision;
    button.disabled = true; button.textContent = 'Checking…'; message();
    try {
      const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resume, resumeText: T.toText(resume), jobDescription: state.jobDescription }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not check the resume.');
      if (snapshot !== revision) return;
      score = data;
      if (state.step === 6) $('#builder-score-report').innerHTML = scoreMarkup();
    } catch (err) { message(err.message); }
    finally { button.disabled = false; button.textContent = 'Check ATS score →'; }
  }
  async function download(button) {
    if (!validateContact()) return;
    const format = button.dataset.download;
    const label = button.textContent; button.disabled = true; button.textContent = 'Preparing…'; message();
    try {
      const response = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resume: cleanResume(), template: state.template, format }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Download failed.'); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `${state.resume.contact.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'Resume'}.${format}`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      message(`${format.toUpperCase()} downloaded. Check the final layout before sending.`);
    } catch (err) { message(err.message); }
    finally { button.disabled = false; button.textContent = label; }
  }
  function handoff() {
    try { sessionStorage.setItem(T.HANDOFF_KEY, JSON.stringify({ ...state, resume: cleanResume() })); save(); window.location.href = '/?from=builder#editor-section'; }
    catch { message('Browser storage is unavailable. Download your resume and upload it in the ATS workspace.'); }
  }

  $('#builder-form').addEventListener('submit', (event) => event.preventDefault());
  $('#builder-form').addEventListener('input', (event) => {
    const path = event.target.dataset.field;
    if (!path) return;
    set(path, event.target.value); invalidate(); message();
  });
  document.addEventListener('click', (event) => {
    const b = event.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.start) {
      state.path = b.dataset.start;
      if (state.path !== 'blank' && !state.resume.experience.length) state.resume.experience.push({ id: newId(), role: '', company: '', dates: '', location: '', bullets: '' });
      if (state.path !== 'blank' && !state.resume.education.length) state.resume.education.push({ id: newId(), degree: '', institution: '', dates: '', location: '' });
      invalidate(); navigate(1);
    } else if (b.dataset.step) { const target = Number(b.dataset.step); if (target === 6 && !validateContact()) return; navigate(target); }
    else if (b.dataset.add) {
      const section = b.dataset.add;
      if (state.resume[section].length >= 50) { message('You can add up to 50 entries.'); return; }
      state.resume[section].push(section === 'experience' ? { id: newId(), role: '', company: '', dates: '', location: '', bullets: '' } : { id: newId(), degree: '', institution: '', dates: '', location: '' });
      invalidate(); render(); document.querySelector('.builder-entry:last-of-type input')?.focus();
    } else if (b.dataset.remove) { const [section, i] = b.dataset.remove.split('.'); state.resume[section].splice(Number(i), 1); invalidate(); render(); }
    else if (b.dataset.template) { state.template = b.dataset.template; save(); render(); updatePreview(); }
    else if (b.dataset.ai) assist(b);
    else if (b.dataset.download) download(b);
    else if (b.hasAttribute('data-retry-templates')) loadTemplates();
    else if (b.id === 'check-ats') checkScore(b);
    else if (b.id === 'improve-ats') handoff();
  });
  $('#builder-next').addEventListener('click', () => {
    if (!$('#builder-form').reportValidity()) return;
    if ((state.step === 1 || state.step === 5) && !validateContact()) return;
    navigate(state.step + 1);
  });
  $('#builder-back').addEventListener('click', () => navigate(state.step - 1));
  $('#ai-cancel').addEventListener('click', () => { pendingAI = null; $('#ai-dialog').close(); });
  $('#ai-apply').addEventListener('click', () => {
    const value = $('#ai-suggestion').value.trim();
    if (!value) { $('#ai-suggestion').focus(); return; }
    if (pendingAI && pendingAI.revision === revision && get(pendingAI.path) === pendingAI.original) { set(pendingAI.path, value.slice(0, pendingAI.path === 'summary' ? 5000 : 10000)); invalidate(); render(); }
    else message('Your notes changed. Request a fresh suggestion before applying.');
    pendingAI = null; $('#ai-dialog').close();
  });
  $('#restart-builder').addEventListener('click', () => $('#restart-dialog').showModal());
  $('#restart-cancel').addEventListener('click', () => $('#restart-dialog').close());
  $('#restart-confirm').addEventListener('click', () => {
    state = { resume: T.empty(), step: 0, path: '', template: 'classic', jobDescription: '' }; invalidate(); render(); updatePreview(); $('#restart-dialog').close();
  });
  function theme(value) { document.documentElement.dataset.theme = value; $('#builder-theme').textContent = value === 'dark' ? 'Light theme' : 'Dark theme'; try { localStorage.setItem('resumeai-theme', value); } catch {} }
  $('#builder-theme').addEventListener('click', () => theme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  try { theme(localStorage.getItem('resumeai-theme') === 'light' ? 'light' : 'dark'); } catch { theme('dark'); }
  render(); save(); loadTemplates(); updatePreview();
})();
