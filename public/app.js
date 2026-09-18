(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const badge = $('#status-badge');
  const uploadCard = $('#upload-card');
  const dropZone = $('#drop-zone');
  const fileInput = $('#file-input');
  const uploadProgress = $('#upload-progress');
  const uploadError = $('#upload-error');
  const errorMessage = $('#error-message');
  const retryBtn = $('#retry-btn');
  const editorSection = $('#editor-section');
  const resumeEditor = $('#resume-editor');
  const jobDescInput = $('#job-desc');
  const clearBtn = $('#clear-btn');
  const analyzeBtn = $('#analyze-btn');
  const analysisProgress = $('#analysis-progress');
  const analysisError = $('#analysis-error');
  const analysisErrorMessage = $('#analysis-error-message');
  const analysisStatus = $('#analysis-status');
  const resumeWordCount = $('#resume-word-count');
  const atsScoreValue = $('#ats-score-value');
  const matchScoreValue = $('#match-score-value');
  const atsScoreBar = $('#ats-score-bar');
  const matchScoreBar = $('#match-score-bar');
  const matchScoreNote = $('#match-score-note');
  const missingKeywords = $('#missing-keywords');
  const keywordList = $('#keyword-list');
  const issueCount = $('#issue-count');
  const structureIssues = $('#structure-issues');
  const suggestionCount = $('#suggestion-count');
  const rewriteSuggestions = $('#rewrite-suggestions');

  // Export elements
  const exportSection = $('#export-section');
  const tplClassicBtn = $('#tpl-classic');
  const tplModernBtn = $('#tpl-modern');
  const downloadPdfBtn = $('#download-pdf-btn');
  const downloadDocxBtn = $('#download-docx-btn');
  const exportStatus = $('#export-status');
  const previewIframe = $('#preview-iframe');
  const previewLoading = $('#preview-loading');

  // Cover letter elements
  const coverLetterSection = $('#cover-letter-section');
  const coverLetterInput = $('#cover-letter-input');
  const generateLetterBtn = $('#generate-letter-btn');
  const downloadLetterBtn = $('#download-letter-btn');
  const coverLetterStatus = $('#cover-letter-status');
  const coverLetterMode = $('#cover-letter-mode');
  const coverLetterPreviewIframe = $('#cover-letter-preview-iframe');
  const coverLetterPreviewLoading = $('#cover-letter-preview-loading');

  // Saved versions elements
  const versionsList = $('#versions-list');
  const versionsCount = $('#versions-count');
  const versionNameInput = $('#version-name');
  const saveVersionBtn = $('#save-version-btn');
  const updateVersionBtn = $('#update-version-btn');
  const toastContainer = $('#toast-container');

  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
  const ALLOWED_EXTS = ['.pdf', '.docx'];
  const CONTACT_FIELDS = [
    ['name', 'Full name', 'e.g. Taylor Morgan'],
    ['title', 'Professional title', 'e.g. Product Designer'],
    ['email', 'Email address', 'name@example.com'],
    ['phone', 'Phone number', '+1 (555) 000-0000'],
    ['location', 'Location', 'City, State'],
    ['links', 'Links', 'LinkedIn, portfolio, or website'],
  ];

  let resume = createEmptyResume();
  let analysis = null;
  let debounceTimer = null;
  let requestSerial = 0;
  let analysisController = null;

  // Export state
  let selectedTemplate = 'classic';
  let previewDebounceTimer = null;
  let previewController = null;

  // Cover letter state
  let coverLetter = '';
  let coverLetterDebounceTimer = null;
  let coverLetterPreviewController = null;

  // Saved versions state
  let loadedVersionId = null;

  function createEmptyResume() {
    return {
      contact: { name: '', title: '', email: '', phone: '', location: '', links: '' },
      summary: '',
      experience: [],
      education: [],
      skills: '',
    };
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function normaliseResume(data) {
    const cleaned = createEmptyResume();
    CONTACT_FIELDS.forEach(([key]) => { cleaned.contact[key] = String(data?.contact?.[key] || '').trim(); });
    cleaned.summary = String(data?.summary || '').trim();
    cleaned.skills = String(data?.skills || '').trim();
    cleaned.experience = Array.isArray(data?.experience)
      ? data.experience.map((item, index) => ({
          id: String(item?.id || `exp-${index + 1}`),
          role: String(item?.role || '').trim(),
          company: String(item?.company || '').trim(),
          dates: String(item?.dates || '').trim(),
          location: String(item?.location || '').trim(),
          bullets: String(item?.bullets || '').trim(),
        }))
      : [];
    cleaned.education = Array.isArray(data?.education)
      ? data.education.map((item, index) => ({
          id: String(item?.id || `edu-${index + 1}`),
          degree: String(item?.degree || '').trim(),
          institution: String(item?.institution || '').trim(),
          dates: String(item?.dates || '').trim(),
          location: String(item?.location || '').trim(),
        }))
      : [];
    return cleaned;
  }

  // ===== Toasts =====
  function showToast(message, type = 'info', { duration = 4500 } = {}) {
    if (!message) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '!' : 'i';
    toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${icon}</span><span class="toast-message"></span>`;
    toast.querySelector('.toast-message').textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-out');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
      // Fallback removal if animations are unavailable
      setTimeout(() => toast.remove(), 400);
    }, duration);
  }

  // ===== Loading + error handling for API calls =====
  let activeLoaders = 0;
  function setGlobalLoading(on) {
    activeLoaders = Math.max(0, activeLoaders + (on ? 1 : -1));
    document.body.classList.toggle('is-busy', activeLoaders > 0);
  }

  /**
   * Run an API call with a loading state and error toast. Rethrows so callers
   * can add their own context-specific handling (e.g. the upload error panel).
   * AbortErrors are swallowed silently.
   */
  async function withLoading(pendingEl, asyncFn) {
    if (pendingEl) pendingEl.classList.remove('hidden');
    setGlobalLoading(true);
    try {
      return await asyncFn();
    } catch (error) {
      if (error?.name === 'AbortError') return undefined;
      console.error('[api]', error);
      showToast(error?.message || 'Something went wrong. Please try again.', 'error');
      throw error;
    } finally {
      setGlobalLoading(false);
      if (pendingEl) pendingEl.classList.add('hidden');
    }
  }

  function showUploadError(message) {
    errorMessage.textContent = message;
    uploadProgress.classList.add('hidden');
    uploadError.classList.remove('hidden');
    uploadCard.classList.remove('hidden');
  }

  function hideUploadError() {
    uploadError.classList.add('hidden');
    errorMessage.textContent = '';
  }

  function setAnalysisStatus(message, isWarning = false) {
    analysisStatus.textContent = message;
    analysisStatus.classList.toggle('analysis-status-warning', isWarning);
  }

  async function checkHealth() {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();
      if (!response.ok || data.status !== 'ok') throw new Error('Offline');
      badge.innerHTML = '<span class="status-dot"></span> API online';
      badge.classList.add('online');
    } catch {
      badge.innerHTML = '<span class="status-dot"></span> API offline';
      badge.classList.add('offline');
      showToast('API offline — the server is not reachable.', 'error');
    }
  }

  function renderEditor() {
    resumeEditor.innerHTML = `
      <section class="editor-group">
        <div class="editor-group-heading"><span class="section-number">01</span><div><h4>Contact</h4><p>The details recruiters use first.</p></div></div>
        <div class="field-grid contact-grid">
          ${CONTACT_FIELDS.map(([key, label, placeholder]) => fieldMarkup({ section: 'contact', key, label, placeholder, value: resume.contact[key] })).join('')}
        </div>
      </section>

      <section class="editor-group">
        <div class="editor-group-heading"><span class="section-number">02</span><div><h4>Summary</h4><p>Set the direction in a few memorable lines.</p></div></div>
        ${fieldMarkup({ section: 'root', key: 'summary', label: 'Professional summary', placeholder: 'Describe your strengths, experience, and the value you bring.', value: resume.summary, multiline: true, rows: 5 })}
      </section>

      <section class="editor-group">
        <div class="editor-group-heading group-heading-with-action"><div class="section-title"><span class="section-number">03</span><div><h4>Experience</h4><p>Make the scope and impact of your work clear.</p></div></div><button class="add-entry-btn" type="button" data-action="add-experience">+ Add role</button></div>
        <div class="entry-list">
          ${resume.experience.length ? resume.experience.map((item, index) => experienceMarkup(item, index)).join('') : emptyEntryMarkup('No roles added yet. Add your most recent role to begin.', 'add-experience')}
        </div>
      </section>

      <section class="editor-group">
        <div class="editor-group-heading group-heading-with-action"><div class="section-title"><span class="section-number">04</span><div><h4>Education</h4><p>Include the qualifications that support your story.</p></div></div><button class="add-entry-btn" type="button" data-action="add-education">+ Add education</button></div>
        <div class="entry-list">
          ${resume.education.length ? resume.education.map((item, index) => educationMarkup(item, index)).join('') : emptyEntryMarkup('No education entries added yet.', 'add-education')}
        </div>
      </section>

      <section class="editor-group editor-group-last">
        <div class="editor-group-heading"><span class="section-number">05</span><div><h4>Skills</h4><p>List tools, technologies, methods, and specialisms.</p></div></div>
        ${fieldMarkup({ section: 'root', key: 'skills', label: 'Skills', placeholder: 'e.g. Figma, User Research, Design Systems, A/B Testing', value: resume.skills, multiline: true, rows: 4 })}
      </section>`;
    updateResumeWordCount();
  }

  function fieldMarkup({ section, id, key, label, placeholder, value, multiline = false, rows = 3 }) {
    const idAttribute = id ? ` data-id="${escapeHtml(id)}"` : '';
    const attrs = `data-section="${section}" data-key="${key}"${idAttribute}`;
    if (multiline) {
      return `<div class="field field-full"><label>${escapeHtml(label)}<textarea ${attrs} rows="${rows}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea></label></div>`;
    }
    return `<div class="field"><label>${escapeHtml(label)}<input ${attrs} type="text" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"></label></div>`;
  }

  function experienceMarkup(item, index) {
    return `<article class="resume-entry" data-entry-id="${escapeHtml(item.id)}">
      <div class="entry-heading"><span>ROLE ${String(index + 1).padStart(2, '0')}</span><button type="button" class="remove-entry-btn" data-action="remove-experience" data-id="${escapeHtml(item.id)}">Remove</button></div>
      <div class="field-grid">
        ${fieldMarkup({ section: 'experience', id: item.id, key: 'role', label: 'Role', placeholder: 'e.g. Senior Product Designer', value: item.role })}
        ${fieldMarkup({ section: 'experience', id: item.id, key: 'company', label: 'Company', placeholder: 'e.g. Northstar Labs', value: item.company })}
        ${fieldMarkup({ section: 'experience', id: item.id, key: 'dates', label: 'Dates', placeholder: 'Jan 2022 — Present', value: item.dates })}
        ${fieldMarkup({ section: 'experience', id: item.id, key: 'location', label: 'Location', placeholder: 'Remote or City, State', value: item.location })}
      </div>
      ${fieldMarkup({ section: 'experience', id: item.id, key: 'bullets', label: 'Highlights & achievements', placeholder: '• Led…\n• Improved…', value: item.bullets, multiline: true, rows: 6 })}
    </article>`;
  }

  function educationMarkup(item, index) {
    return `<article class="resume-entry" data-entry-id="${escapeHtml(item.id)}">
      <div class="entry-heading"><span>EDUCATION ${String(index + 1).padStart(2, '0')}</span><button type="button" class="remove-entry-btn" data-action="remove-education" data-id="${escapeHtml(item.id)}">Remove</button></div>
      <div class="field-grid">
        ${fieldMarkup({ section: 'education', id: item.id, key: 'degree', label: 'Degree or program', placeholder: 'e.g. B.S. Computer Science', value: item.degree })}
        ${fieldMarkup({ section: 'education', id: item.id, key: 'institution', label: 'Institution', placeholder: 'e.g. State University', value: item.institution })}
        ${fieldMarkup({ section: 'education', id: item.id, key: 'dates', label: 'Dates', placeholder: '2016 — 2020', value: item.dates })}
        ${fieldMarkup({ section: 'education', id: item.id, key: 'location', label: 'Location', placeholder: 'City, State', value: item.location })}
      </div>
    </article>`;
  }

  function emptyEntryMarkup(copy, action) {
    return `<div class="empty-entry"><p>${copy}</p><button class="add-entry-btn" type="button" data-action="${action}">+ Add entry</button></div>`;
  }

  function updateResumeWordCount() {
    const words = resumeToText().trim().split(/\s+/).filter(Boolean).length;
    resumeWordCount.textContent = `${words} word${words === 1 ? '' : 's'}`;
  }

  function updateModelFromField(input) {
    const { section, key, id } = input.dataset;
    if (section === 'contact' || section === 'root') {
      if (section === 'contact') resume.contact[key] = input.value;
      else resume[key] = input.value;
    } else {
      const entry = resume[section].find((item) => item.id === id);
      if (entry) entry[key] = input.value;
    }
    updateResumeWordCount();
  }

  function handleEditorAction(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const { action, id } = button.dataset;
    if (action === 'add-experience') {
      resume.experience.push({ id: makeId('exp'), role: '', company: '', dates: '', location: '', bullets: '' });
    } else if (action === 'add-education') {
      resume.education.push({ id: makeId('edu'), degree: '', institution: '', dates: '', location: '' });
    } else if (action === 'remove-experience') {
      resume.experience = resume.experience.filter((item) => item.id !== id);
    } else if (action === 'remove-education') {
      resume.education = resume.education.filter((item) => item.id !== id);
    } else {
      return;
    }
    renderEditor();
    scheduleAnalysis();
    schedulePreviewUpdate();
  }

  function resumeToText() {
    const rows = [];
    const contact = [resume.contact.name, resume.contact.title, resume.contact.email, resume.contact.phone, resume.contact.location, resume.contact.links].filter(Boolean);
    if (contact.length) rows.push(contact.join(' | '));
    if (resume.summary.trim()) rows.push('PROFESSIONAL SUMMARY', resume.summary.trim());
    if (resume.experience.length) {
      rows.push('PROFESSIONAL EXPERIENCE');
      resume.experience.forEach((item) => {
        const heading = [item.role, item.company, item.dates, item.location].filter(Boolean).join(' | ');
        if (heading) rows.push(heading);
        if (item.bullets.trim()) rows.push(item.bullets.trim());
      });
    }
    if (resume.education.length) {
      rows.push('EDUCATION');
      resume.education.forEach((item) => {
        const heading = [item.degree, item.institution, item.dates, item.location].filter(Boolean).join(' | ');
        if (heading) rows.push(heading);
      });
    }
    if (resume.skills.trim()) rows.push('SKILLS', resume.skills.trim());
    return rows.join('\n\n');
  }

  function scheduleAnalysis({ immediately = false } = {}) {
    clearTimeout(debounceTimer);
    // Do not allow a score calculated for an earlier edit to flash into view
    // while the user is still composing the next one.
    if (!immediately && analysisController) {
      analysisController.abort();
      analysisController = null;
      setAnalysisLoading(false);
    }
    const resumeText = resumeToText();
    if (!resumeText.trim()) return;
    setAnalysisStatus(immediately ? 'Analysis queued…' : 'Changes detected — refreshing in 2 seconds…');
    debounceTimer = setTimeout(runAnalysis, immediately ? 0 : 2000);
  }

  function analysisPayload() {
    const payload = { resumeText: resumeToText() };
    const jobDescription = jobDescInput.value.trim();
    if (jobDescription) payload.jobDescription = jobDescription;
    return payload;
  }

  function setAnalysisLoading(isLoading) {
    analysisProgress.classList.toggle('hidden', !isLoading);
    analyzeBtn.disabled = isLoading;
    analyzeBtn.innerHTML = isLoading ? '<span class="refresh-spin" aria-hidden="true">↻</span> Checking' : '<span aria-hidden="true">↻</span> Refresh';
  }

  async function runAnalysis() {
    clearTimeout(debounceTimer);
    const resumeText = resumeToText();
    if (!resumeText.trim()) {
      setAnalysisStatus('Add resume details to start the live evaluation.');
      return;
    }

    const serial = ++requestSerial;
    if (analysisController) analysisController.abort();
    analysisController = new AbortController();
    analysisError.classList.add('hidden');
    setAnalysisLoading(true);
    setAnalysisStatus('Reading structure, relevance, and impact…');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisPayload()),
        signal: analysisController.signal,
      });
      const data = await response.json();
      if (serial !== requestSerial) return;
      if (!response.ok) throw new Error(data.error || `Analysis request failed with status ${response.status}`);
      analysis = data;
      renderAnalysis();
      setAnalysisStatus(
        data.analysis_warning || 'Updated just now · watching for your next edit',
        Boolean(data.analysis_warning)
      );
    } catch (error) {
      if (error.name === 'AbortError' || serial !== requestSerial) return;
      analysisErrorMessage.textContent = error.message || 'Unable to refresh the analysis.';
      analysisError.classList.remove('hidden');
      setAnalysisStatus('Your previous feedback remains visible.');
      showToast('Live analysis failed — showing last known results.', 'error');
    } finally {
      if (serial === requestSerial) setAnalysisLoading(false);
    }
  }

  function renderAnalysis() {
    const atsScore = clampScore(analysis?.ats_structure_score);
    const matchRaw = analysis?.content_match_score;
    const hasMatchScore = typeof matchRaw === 'number' && Number.isFinite(matchRaw);
    const matchScore = hasMatchScore ? clampScore(matchRaw) : 0;
    updateScore(atsScoreBar, atsScoreValue, atsScore, 'ATS structure score');
    updateScore(matchScoreBar, matchScoreValue, matchScore, 'Job match score', !hasMatchScore);
    matchScoreNote.textContent = hasMatchScore
      ? 'Alignment of skills, language, and experience with the target role.'
      : 'Add a target job to measure keyword alignment.';
    renderKeywords(analysis?.missing_keywords || [], analysis?.matched_keywords || []);
    renderStructureIssues(analysis?.structure_issues || []);
    renderSuggestions(analysis?.rewrite_suggestions || []);
  }

  function clampScore(value) {
    return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  }

  function updateScore(bar, label, score, ariaLabel, muted = false) {
    requestAnimationFrame(() => { bar.style.width = `${score}%`; });
    label.textContent = muted ? '—' : `${score}%`;
    bar.closest('.score-track').setAttribute('aria-valuenow', String(score));
    bar.closest('.score-track').setAttribute('aria-label', ariaLabel);
    bar.closest('.score-row').classList.toggle('score-muted', muted);
  }

  function renderKeywords(missing, matched) {
    const missingCleaned = Array.isArray(missing) ? missing.filter(Boolean).slice(0, 12) : [];
    const matchedCleaned = Array.isArray(matched) ? matched.filter(Boolean).slice(0, 12) : [];
    const hasAny = missingCleaned.length > 0 || matchedCleaned.length > 0;
    missingKeywords.classList.toggle('hidden', !hasAny);
    keywordList.innerHTML = missingCleaned.map((keyword) => `<span>${escapeHtml(keyword)}</span>`).join('') +
      matchedCleaned.map((keyword) => `<span class="kw-matched" title="Already present in your resume">${escapeHtml(keyword)}</span>`).join('');
    // Update the section label to describe the two groups
    const label = missingKeywords.querySelector('p');
    if (label) label.textContent = 'Keywords from the job description';
  }

  function renderStructureIssues(issues) {
    const cleaned = Array.isArray(issues) ? issues : [];
    issueCount.textContent = cleaned.length ? String(cleaned.length) : 'All clear';
    issueCount.classList.toggle('is-clear', cleaned.length === 0);
    if (!cleaned.length) {
      structureIssues.innerHTML = '<div class="success-insight"><span aria-hidden="true">✓</span><p>No structural red flags found in this pass.</p></div>';
      return;
    }
    structureIssues.innerHTML = `<div class="issue-list">${cleaned.map((item, index) => `
      <article class="issue-item"><span class="issue-index">${String(index + 1).padStart(2, '0')}</span><div><h4>${escapeHtml(item.issue)}</h4>${item.why_it_matters ? `<p>${escapeHtml(item.why_it_matters)}</p>` : ''}</div></article>`).join('')}
    </div>`;
  }

  function renderSuggestions(suggestions) {
    const cleaned = Array.isArray(suggestions) ? suggestions : [];
    suggestionCount.textContent = cleaned.length ? String(cleaned.length) : '—';
    if (!cleaned.length) {
      rewriteSuggestions.innerHTML = 'No rewrites surfaced yet. Keep building, then refresh your analysis.';
      return;
    }
    rewriteSuggestions.innerHTML = `<div class="suggestion-list">${cleaned.map((item, index) => {
      const target = findSuggestionTarget(item.original || '');
      const canApply = Boolean(target && item.suggested);
      return `<article class="suggestion-item">
        <div class="suggestion-copy"><p class="suggestion-label">CURRENT</p><p class="suggestion-original">${escapeHtml(item.original)}</p></div>
        <div class="suggestion-arrow" aria-hidden="true">↓</div>
        <div class="suggestion-copy suggestion-proposed"><p class="suggestion-label">SUGGESTED</p><p>${escapeHtml(item.suggested)}</p></div>
        ${item.reason ? `<p class="suggestion-reason">${escapeHtml(item.reason)}</p>` : ''}
        <button class="apply-button" type="button" data-suggestion-index="${index}" ${canApply ? '' : 'disabled title="This source text has changed. Refresh to generate a new suggestion."'}>${canApply ? 'Apply rewrite' : 'Refresh needed'}</button>
      </article>`;
    }).join('')}</div>`;
  }

  function getTextFields() {
    const fields = [
      ...CONTACT_FIELDS.map(([key]) => ({ section: 'contact', key, value: resume.contact[key] })),
      { section: 'root', key: 'summary', value: resume.summary },
      { section: 'root', key: 'skills', value: resume.skills },
    ];
    resume.experience.forEach((item) => ['role', 'company', 'dates', 'location', 'bullets'].forEach((key) => fields.push({ section: 'experience', id: item.id, key, value: item[key] })));
    resume.education.forEach((item) => ['degree', 'institution', 'dates', 'location'].forEach((key) => fields.push({ section: 'education', id: item.id, key, value: item[key] })));
    return fields;
  }

  function findSuggestionTarget(original) {
    const needle = String(original || '').trim();
    if (!needle) return null;
    return getTextFields().find((field) => String(field.value || '').toLocaleLowerCase().includes(needle.toLocaleLowerCase())) || null;
  }

  function applySuggestion(index) {
    const suggestion = analysis?.rewrite_suggestions?.[index];
    const target = suggestion && findSuggestionTarget(suggestion.original);
    if (!target || !suggestion.suggested) return;
    const current = String(target.value || '');
    const startIndex = current.toLocaleLowerCase().indexOf(String(suggestion.original).toLocaleLowerCase());
    if (startIndex === -1) return;
    const replacement = `${current.slice(0, startIndex)}${suggestion.suggested}${current.slice(startIndex + suggestion.original.length)}`;
    if (target.section === 'contact') resume.contact[target.key] = replacement;
    else if (target.section === 'root') resume[target.key] = replacement;
    else {
      const entry = resume[target.section].find((item) => item.id === target.id);
      if (entry) entry[target.key] = replacement;
    }
    renderEditor();
    const targetInput = target.id
      ? resumeEditor.querySelector(`[data-section="${target.section}"][data-id="${target.id}"][data-key="${target.key}"]`)
      : resumeEditor.querySelector(`[data-section="${target.section}"][data-key="${target.key}"]`);
    if (targetInput) {
      targetInput.classList.add('field-applied');
      targetInput.focus({ preventScroll: true });
      targetInput.closest('.editor-group').scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => targetInput.classList.remove('field-applied'), 1200);
    }
    renderSuggestions(analysis.rewrite_suggestions);
    scheduleAnalysis();
    schedulePreviewUpdate();
  }

  async function structureResume(rawText) {
    const response = await fetch('/api/structure-resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rawText }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Could not organize the extracted resume.');
    }
    return response.json();
  }

  async function handleFile(file) {
    if (!file) return;
    const fileName = file.name || '';
    const ext = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      showUploadError(`Unsupported file format (${ext || 'unknown'}). Please upload a PDF or DOCX.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      showUploadError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum size is 10 MB.`);
      return;
    }

    hideUploadError();
    uploadCard.classList.add('hidden');
    editorSection.classList.add('hidden');
    exportSection.classList.add('hidden');
    uploadProgress.classList.remove('hidden');
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const parseResponse = await fetch('/api/parse-resume', { method: 'POST', body: formData });
      const parsed = await parseResponse.json();
      if (!parseResponse.ok) throw new Error(parsed.error || 'The file could not be read.');
      const structured = await structureResume(parsed.text);
      resume = normaliseResume(structured);
      analysis = null;
      coverLetter = '';
      coverLetterInput.value = '';
      coverLetterPreviewIframe.srcdoc = '';
      downloadLetterBtn.disabled = true;
      coverLetterMode.hidden = true;
      loadedVersionId = null;
      updateVersionBtn.classList.add('hidden');
      renderEditor();
      resetInsightPlaceholders();
      editorSection.classList.remove('hidden');
      exportSection.classList.remove('hidden');
      setAnalysisStatus('Your resume is ready — running the first evaluation…');
      scheduleAnalysis({ immediately: true });
      schedulePreviewUpdate({ immediately: true });
      refreshVersions();
    } catch (error) {
      showUploadError(error.message || 'Unable to prepare that resume. Please try another file.');
    } finally {
      uploadProgress.classList.add('hidden');
      fileInput.value = '';
    }
  }

  function resetInsightPlaceholders() {
    atsScoreValue.textContent = '—';
    matchScoreValue.textContent = '—';
    atsScoreBar.style.width = '0%';
    matchScoreBar.style.width = '0%';
    matchScoreNote.textContent = 'Add a target job to measure keyword alignment.';
    missingKeywords.classList.add('hidden');
    keywordList.innerHTML = '';
    issueCount.textContent = '—';
    issueCount.classList.remove('is-clear');
    suggestionCount.textContent = '—';
    structureIssues.textContent = 'Run an analysis to uncover anything that could confuse an ATS.';
    rewriteSuggestions.textContent = 'Suggestions will appear here after your first analysis.';
  }

  function renderPreviewKeywords() {
    const matched = analysis?.matched_keywords || [];
    const missing = analysis?.missing_keywords || [];
    const legend = document.getElementById('preview-keyword-legend');
    if (legend) legend.remove();
    if (!matched.length && !missing.length) {
      schedulePreviewUpdate();
      return;
    }
    const wrapper = previewIframe.closest('.preview-frame-wrapper');
    const el = document.createElement('div');
    el.id = 'preview-keyword-legend';
    el.className = 'matched-legend';
    el.innerHTML =
      (missing.length ? `<span><span class="legend-swatch legend-missed"></span> Missing: ${escapeHtml(missing.slice(0, 8).join(', '))}</span>` : '') +
      (matched.length ? `<span><span class="legend-swatch legend-matched"></span> Matched: ${escapeHtml(matched.slice(0, 8).join(', '))}</span>` : '');
    wrapper.appendChild(el);
    schedulePreviewUpdate();
  }

  function resetState() {
    clearTimeout(debounceTimer);
    clearTimeout(previewDebounceTimer);
    clearTimeout(coverLetterDebounceTimer);
    if (analysisController) analysisController.abort();
    if (previewController) previewController.abort();
    if (coverLetterPreviewController) coverLetterPreviewController.abort();
    resume = createEmptyResume();
    analysis = null;
    coverLetter = '';
    loadedVersionId = null;
    updateVersionBtn.classList.add('hidden');
    versionNameInput.value = '';
    jobDescInput.value = '';
    fileInput.value = '';
    coverLetterInput.value = '';
    hideUploadError();
    uploadProgress.classList.add('hidden');
    analysisError.classList.add('hidden');
    analysisProgress.classList.add('hidden');
    uploadCard.classList.remove('hidden');
    editorSection.classList.add('hidden');
    exportSection.classList.add('hidden');
    coverLetterSection.classList.add('hidden');
    resetInsightPlaceholders();
    exportStatus.textContent = '';
    exportStatus.classList.remove('is-error');
    previewIframe.srcdoc = '';
    coverLetterPreviewIframe.srcdoc = '';
    coverLetterMode.hidden = true;
    setCoverLetterStatus('');
  }

  // ===== Export / Preview Functions =====

  function schedulePreviewUpdate({ immediately = false } = {}) {
    clearTimeout(previewDebounceTimer);
    if (previewController) {
      previewController.abort();
      previewController = null;
    }
    previewDebounceTimer = setTimeout(updatePreview, immediately ? 0 : 1000);
  }

  async function updatePreview() {
    const resumeText = resumeToText();
    if (!resumeText.trim()) return;

    if (previewController) previewController.abort();
    previewController = new AbortController();
    previewLoading.classList.remove('hidden');

    try {
      const payload = { resume, template: selectedTemplate };
      if (analysis && ((analysis.matched_keywords || []).length || (analysis.missing_keywords || []).length)) {
        payload.keywords = [...(analysis.matched_keywords || []), ...(analysis.missing_keywords || [])];
      }
      const response = await fetch('/api/export/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: previewController.signal,
      });
      if (!response.ok) throw new Error('Preview failed');
      const html = await response.text();
      previewIframe.srcdoc = html;
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('[preview] Update failed:', err.message);
      showToast('Live preview failed to update.', 'error', { duration: 3500 });
    } finally {
      previewLoading.classList.add('hidden');
    }
  }

  function setExportStatus(message, isError = false) {
    exportStatus.textContent = message;
    exportStatus.classList.toggle('is-error', isError);
    if (message && !isError) {
      setTimeout(() => { if (exportStatus.textContent === message) exportStatus.textContent = ''; }, 4000);
    }
  }

  async function downloadExport(format) {
    const btn = format === 'pdf' ? downloadPdfBtn : downloadDocxBtn;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = `Generating ${format.toUpperCase()}…`;
    setExportStatus('');

    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, template: selectedTemplate, format }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const name = (resume.contact?.name || 'Resume').replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'Resume';
      const ext = format === 'pdf' ? '.pdf' : '.docx';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportStatus(`${format.toUpperCase()} downloaded successfully.`);
      showToast(`${format.toUpperCase()} downloaded.`, 'success', { duration: 3000 });
    } catch (err) {
      setExportStatus(err.message || 'Export failed. Please try again.', true);
      showToast(err.message || 'Export failed. Please try again.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<span class="export-icon" aria-hidden="true">⬇</span> Download ${format.toUpperCase()}`;
    }
  }

  // ===== Cover Letter Functions =====

  function setCoverLetterStatus(message, isError = false) {
    coverLetterStatus.textContent = message;
    coverLetterStatus.classList.toggle('is-error', isError);
    if (message && !isError) {
      setTimeout(() => { if (coverLetterStatus.textContent === message) coverLetterStatus.textContent = ''; }, 5000);
    }
  }

  async function generateCoverLetter() {
    if (!resumeToText().trim()) {
      setCoverLetterStatus('Add resume details first.', true);
      return;
    }
    generateLetterBtn.disabled = true;
    const originalLabel = generateLetterBtn.textContent;
    generateLetterBtn.textContent = '✍ Writing…';
    setCoverLetterStatus('');
    try {
      const payload = { resume };
      const jobDescription = jobDescInput.value.trim();
      if (jobDescription) payload.jobDescription = jobDescription;
      const response = await fetch('/api/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not generate a cover letter.');
      coverLetter = String(data.cover_letter || '');
      coverLetterInput.value = coverLetter;
      const isFallback = data.generation_mode === 'fallback';
      coverLetterMode.hidden = !isFallback;
      coverLetterMode.textContent = 'Fallback draft';
      if (data.generation_warning) {
        setCoverLetterStatus(data.generation_warning, true);
      } else {
        setCoverLetterStatus('Draft generated — edit it freely, then download the PDF.');
      }
      downloadLetterBtn.disabled = !coverLetter.trim();
      scheduleCoverLetterPreviewUpdate({ immediately: true });
    } catch (err) {
      setCoverLetterStatus(err.message || 'Cover letter generation failed. Please try again.', true);
      showToast(err.message || 'Cover letter generation failed. Please try again.', 'error');
    } finally {
      generateLetterBtn.disabled = false;
      generateLetterBtn.textContent = originalLabel;
    }
  }

  function scheduleCoverLetterPreviewUpdate({ immediately = false } = {}) {
    clearTimeout(coverLetterDebounceTimer);
    if (coverLetterPreviewController) {
      coverLetterPreviewController.abort();
      coverLetterPreviewController = null;
    }
    coverLetterDebounceTimer = setTimeout(updateCoverLetterPreview, immediately ? 0 : 1000);
  }

  async function updateCoverLetterPreview() {
    if (!coverLetter.trim()) {
      coverLetterPreviewIframe.srcdoc = '';
      return;
    }
    if (coverLetterPreviewController) coverLetterPreviewController.abort();
    coverLetterPreviewController = new AbortController();
    coverLetterPreviewLoading.classList.remove('hidden');
    try {
      const response = await fetch('/api/export/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, coverLetter }),
        signal: coverLetterPreviewController.signal,
      });
      if (!response.ok) throw new Error('Preview failed');
      coverLetterPreviewIframe.srcdoc = await response.text();
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('[cover-letter preview] Update failed:', err.message);
    } finally {
      coverLetterPreviewLoading.classList.add('hidden');
    }
  }

  async function downloadCoverLetter() {
    if (!coverLetter.trim()) return;
    downloadLetterBtn.disabled = true;
    downloadLetterBtn.textContent = 'Generating PDF…';
    setCoverLetterStatus('');
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, coverLetter, format: 'pdf' }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Export failed (${response.status})`);
      }
      const blob = await response.blob();
      const name = (resume.contact?.name || 'CoverLetter').replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'CoverLetter';
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${name}-Cover-Letter.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setCoverLetterStatus('PDF downloaded successfully.');
      showToast('Cover letter PDF downloaded.', 'success', { duration: 3000 });
    } catch (err) {
      setCoverLetterStatus(err.message || 'Export failed. Please try again.', true);
      showToast(err.message || 'Cover letter export failed. Please try again.', 'error');
    } finally {
      downloadLetterBtn.disabled = !coverLetter.trim();
      downloadLetterBtn.innerHTML = '<span class="export-icon" aria-hidden="true">⬇</span> Download PDF';
    }
  }

  // ===== Saved Versions Functions =====

  function formatVersionDate(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  async function refreshVersions() {
    await withLoading(null, async () => {
      const response = await fetch('/api/versions');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load saved versions.');
      renderVersionsList(data.versions || []);
    }).catch(() => {}); // error already toasted
  }

  function renderVersionsList(versions) {
    versionsCount.textContent = versions.length ? String(versions.length) : '0';
    if (!versions.length) {
      versionsList.innerHTML = '<p class="versions-empty">No saved versions yet. Name your resume above and hit Save.</p>';
      return;
    }
    versionsList.innerHTML = versions.map((v) => `
      <div class="version-item${v.id === loadedVersionId ? ' is-loaded' : ''}" data-id="${escapeHtml(v.id)}">
        <div class="version-info" data-action="load" role="button" tabindex="0" title="Load this version">
          <strong>${escapeHtml(v.name)}</strong>
          <small>Saved ${escapeHtml(formatVersionDate(v.updated_at))}</small>
      </div>
        <div class="version-actions">
          <button class="version-btn" data-action="update" title="Save current edits into this version">↻</button>
          <button class="version-btn" data-action="duplicate" title="Duplicate">⧉</button>
          <button class="version-btn danger" data-action="delete" title="Delete">✕</button>
        </div>
      </div>`).join('');
  }

  async function saveVersion() {
    const name = versionNameInput.value.trim();
    if (!name) {
      showToast('Give this version a name first, e.g. “Backend role — Company X”.', 'info');
      versionNameInput.focus();
      return;
    }
    if (!resumeToText().trim()) {
      showToast('Nothing to save yet — the resume is empty.', 'info');
      return;
    }
    saveVersionBtn.disabled = true;
    saveVersionBtn.textContent = 'Saving…';
    await withLoading(null, async () => {
      const response = await fetch('/api/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, resume, coverLetter, jobDescription: jobDescInput.value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save this version.');
      loadedVersionId = data.id;
      versionNameInput.value = '';
      updateVersionBtn.classList.remove('hidden');
      showToast(`Saved “${name}”.`, 'success');
      await refreshVersions();
    }).catch(() => {});
    saveVersionBtn.disabled = false;
    saveVersionBtn.textContent = 'Save';
  }

  async function loadVersion(id) {
    await withLoading(null, async () => {
      const response = await fetch(`/api/versions/${encodeURIComponent(id)}`);
      const data = await response.json().catch(() => {});
      if (!response.ok) throw new Error(data.error || 'Could not load that version.');
      resume = normaliseResume(data.resume);
      coverLetter = String(data.cover_letter || '');
      coverLetterInput.value = coverLetter;
      jobDescInput.value = String(data.job_description || '');
      analysis = null;
      loadedVersionId = id;
      renderEditor();
      resetInsightPlaceholders();
      editorSection.classList.remove('hidden');
      exportSection.classList.remove('hidden');
      coverLetterSection.classList.remove('hidden');
      downloadLetterBtn.disabled = !coverLetter.trim();
      coverLetterMode.hidden = true;
      scheduleAnalysis({ immediately: true });
      schedulePreviewUpdate({ immediately: true });
      scheduleCoverLetterPreviewUpdate({ immediately: true });
      showToast(`Loaded “${data.name}”.`, 'success', { duration: 3000 });
      refreshVersions();
    }).catch(() => {});
  }

  async function updateVersion(id) {
    await withLoading(null, async () => {
      const response = await fetch(`/api/versions/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, coverLetter, jobDescription: jobDescInput.value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not update that version.');
      showToast('Changes saved into the version.', 'success', { duration: 3000 });
      await refreshVersions();
    }).catch(() => {});
  }

  async function duplicateVersion(id) {
    await withLoading(null, async () => {
      const response = await fetch(`/api/versions/${encodeURIComponent(id)}/duplicate`, { method: 'POST' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not duplicate that version.');
      showToast(`Created “${data.name}”.`, 'success', { duration: 3000 });
      await refreshVersions();
    }).catch(() => {});
  }

  async function deleteVersion(id) {
    await withLoading(null, async () => {
      const response = await fetch(`/api/versions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not delete that version.');
      if (loadedVersionId === id) {
        loadedVersionId = null;
        updateVersionBtn.classList.add('hidden');
      }
      showToast('Version deleted.', 'success', { duration: 3000 });
      await refreshVersions();
    }).catch(() => {});
  }

  function selectTemplate(templateKey) {
    selectedTemplate = templateKey;
    tplClassicBtn.classList.toggle('active', templateKey === 'classic');
    tplModernBtn.classList.toggle('active', templateKey === 'modern');
    schedulePreviewUpdate({ immediately: true });
  }

  // ===== Event Listeners =====

  ['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.add('drag-over');
  }));
  ['dragleave', 'dragend'].forEach((name) => dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
  }));
  dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFile(event.dataTransfer?.files?.[0]);
  });
  dropZone.addEventListener('click', (event) => {
    if (!event.target.closest('#browse-label')) fileInput.click();
  });
  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener('change', (event) => handleFile(event.target.files?.[0]));
  retryBtn.addEventListener('click', resetState);
  clearBtn.addEventListener('click', resetState);
  resumeEditor.addEventListener('input', (event) => {
    if (!event.target.matches('input, textarea')) return;
    updateModelFromField(event.target);
    scheduleAnalysis();
    schedulePreviewUpdate();
  });
  resumeEditor.addEventListener('click', handleEditorAction);
  jobDescInput.addEventListener('input', () => scheduleAnalysis());
  analyzeBtn.addEventListener('click', () => scheduleAnalysis({ immediately: true }));

  // Saved versions listeners
  saveVersionBtn.addEventListener('click', saveVersion);
  versionNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); saveVersion(); }
  });
  updateVersionBtn.addEventListener('click', () => {
    if (loadedVersionId) updateVersion(loadedVersionId);
  });
  versionsList.addEventListener('click', (event) => {
    const item = event.target.closest('.version-item');
    if (!item) return;
    const id = item.dataset.id;
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'update') updateVersion(id);
    else if (action === 'duplicate') duplicateVersion(id);
    else if (action === 'delete') deleteVersion(id);
    else if (action === 'load' || !action) loadVersion(id);
  });
  rewriteSuggestions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-suggestion-index]');
    if (button && !button.disabled) applySuggestion(Number(button.dataset.suggestionIndex));
  });

  // Export listeners
  tplClassicBtn.addEventListener('click', () => selectTemplate('classic'));
  tplModernBtn.addEventListener('click', () => selectTemplate('modern'));
  downloadPdfBtn.addEventListener('click', () => downloadExport('pdf'));
  downloadDocxBtn.addEventListener('click', () => downloadExport('docx'));

  // Cover letter listeners
  generateLetterBtn.addEventListener('click', generateCoverLetter);
  downloadLetterBtn.addEventListener('click', downloadCoverLetter);
  coverLetterInput.addEventListener('input', () => {
    coverLetter = coverLetterInput.value;
    downloadLetterBtn.disabled = !coverLetter.trim();
    scheduleCoverLetterPreviewUpdate();
  });

  checkHealth();
})();
