'use strict';

// Versioned heuristic, not a simulation of a particular employer's ATS.
const SKILLS = [
  ['JavaScript', 'javascript', 'js'], ['TypeScript', 'typescript', 'ts'], ['React', 'react', 'react.js', 'reactjs'],
  ['Node.js', 'node.js', 'nodejs', 'node js'], ['Python', 'python'], ['Java', 'java'], ['C++', 'c++'], ['C#', 'c#'],
  ['.NET', '.net', 'dotnet'], ['Go', 'golang'], ['Rust', 'rust'], ['Ruby', 'ruby'], ['PHP', 'php'], ['Swift', 'swift'],
  ['Kotlin', 'kotlin'], ['SQL', 'sql', 'structured query language'], ['PostgreSQL', 'postgresql', 'postgres'],
  ['MySQL', 'mysql'], ['MongoDB', 'mongodb'], ['Redis', 'redis'], ['HTML', 'html', 'html5'], ['CSS', 'css', 'css3'],
  ['Angular', 'angular', 'angularjs'], ['Vue', 'vue', 'vue.js', 'vuejs'], ['Next.js', 'next.js', 'nextjs'],
  ['Django', 'django'], ['Flask', 'flask'], ['Spring', 'spring boot', 'spring framework'],
  ['AWS', 'aws', 'amazon web services'], ['Azure', 'azure', 'microsoft azure'], ['Google Cloud', 'gcp', 'google cloud'],
  ['Docker', 'docker'], ['Kubernetes', 'kubernetes', 'k8s'], ['Terraform', 'terraform'], ['Linux', 'linux'],
  ['Git', 'git'], ['CI/CD', 'ci/cd', 'continuous integration', 'continuous delivery'],
  ['REST APIs', 'rest api', 'rest apis', 'restful', 'restful apis'], ['GraphQL', 'graphql'],
  ['Unit testing', 'unit testing', 'unit tests'], ['Jest', 'jest'], ['Cypress', 'cypress'], ['Playwright', 'playwright'],
  ['Machine learning', 'machine learning', 'ml'], ['Deep learning', 'deep learning'], ['TensorFlow', 'tensorflow'],
  ['PyTorch', 'pytorch'], ['Pandas', 'pandas'], ['NumPy', 'numpy'], ['Spark', 'apache spark'],
  ['Data analysis', 'data analysis', 'data analytics'], ['Data visualization', 'data visualization', 'data visualisation'],
  ['Tableau', 'tableau'], ['Power BI', 'power bi', 'powerbi'], ['Excel', 'excel', 'microsoft excel'],
  ['Statistics', 'statistics', 'statistical analysis'], ['ETL', 'etl', 'extract transform load'],
  ['Figma', 'figma'], ['User research', 'user research', 'ux research'], ['UI design', 'ui design', 'user interface design'],
  ['UX design', 'ux design', 'user experience design'], ['Accessibility', 'accessibility', 'wcag'],
  ['Product management', 'product management'], ['Project management', 'project management'],
  ['Agile', 'agile'], ['Scrum', 'scrum'], ['Jira', 'jira'], ['Stakeholder management', 'stakeholder management'],
  ['Leadership', 'leadership'], ['Communication', 'communication', 'communication skills'],
  ['Collaboration', 'collaboration', 'cross-functional collaboration'], ['Problem solving', 'problem solving', 'problem-solving'],
  ['Salesforce', 'salesforce'], ['HubSpot', 'hubspot'], ['CRM', 'crm', 'customer relationship management'],
  ['SEO', 'seo', 'search engine optimization', 'search engine optimisation'], ['SEM', 'sem', 'search engine marketing'],
  ['Google Analytics', 'google analytics', 'ga4'], ['Content marketing', 'content marketing'],
  ['Digital marketing', 'digital marketing'], ['Copywriting', 'copywriting'], ['Social media', 'social media'],
  ['A/B testing', 'a/b testing', 'ab testing'], ['Customer service', 'customer service', 'customer support'],
  ['Account management', 'account management'], ['Business development', 'business development'],
  ['Financial modeling', 'financial modeling', 'financial modelling'], ['Accounting', 'accounting'],
  ['Budgeting', 'budgeting', 'budget management'], ['Forecasting', 'forecasting'], ['QuickBooks', 'quickbooks'],
  ['SAP', 'sap'], ['ERP', 'erp', 'enterprise resource planning'], ['Supply chain', 'supply chain'],
  ['Inventory management', 'inventory management'], ['Procurement', 'procurement'], ['Logistics', 'logistics'],
  ['AutoCAD', 'autocad'], ['SolidWorks', 'solidworks'], ['Six Sigma', 'six sigma'], ['Quality assurance', 'quality assurance'],
  ['Patient care', 'patient care'], ['Clinical research', 'clinical research'], ['BLS', 'bls', 'basic life support'],
  ['HIPAA', 'hipaa'], ['Electronic health records', 'ehr', 'electronic health records'],
  ['PMP', 'pmp', 'project management professional'], ['CPA', 'cpa', 'certified public accountant'],
  ['CISSP', 'cissp'], ['Cybersecurity', 'cybersecurity', 'cyber security'], ['Network security', 'network security'],
  ['Recruiting', 'recruiting', 'recruitment'], ['Payroll', 'payroll'], ['Training', 'training'],
];
const normalize = (s) => String(s || '').normalize('NFKC').toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function contains(text, term) {
  return new RegExp(`(?:^|[^\\p{L}\\p{N}_+#])${escapeRegex(normalize(term))}(?=$|[^\\p{L}\\p{N}_+#])`, 'u').test(normalize(text));
}

function resumeToText(resume) {
  const rows = Object.values(resume.contact || {}).filter(Boolean);
  if (resume.summary?.trim()) rows.push('PROFESSIONAL SUMMARY', resume.summary.trim());
  for (const [key, heading, fields] of [
    ['experience', 'PROFESSIONAL EXPERIENCE', ['role', 'company', 'dates', 'location', 'bullets']],
    ['education', 'EDUCATION', ['degree', 'institution', 'dates', 'location']],
  ]) {
    const entries = (resume[key] || []).filter((item) => fields.some((f) => item[f]?.trim()));
    if (entries.length) rows.push(heading, ...entries.map((item) => fields.map((f) => item[f]).filter(Boolean).join('\n')));
  }
  if (resume.skills?.trim()) rows.push('SKILLS', resume.skills.trim());
  return rows.join('\n');
}
const HEADINGS = {
  summary: /^(?:professional summary|summary|profile|objective)$/i,
  experience: /^(?:professional experience|work experience|experience|employment history|relevant experience|internships?|projects?|project experience|volunteer experience)$/i,
  education: /^(?:education|academic background|qualifications|education and certifications|certifications|training)$/i,
  skills: /^(?:skills|technical skills|core competencies|key skills|technical competencies)$/i,
};
function sectionsOf(text) {
  const sections = {};
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/:$/, '');
    const key = Object.keys(HEADINGS).find((k) => HEADINGS[k].test(line));
    if (key) { current = key; sections[current] ||= []; }
    else if (current && line) sections[current].push(line);
  }
  return sections;
}
const YEAR = '(?:19|20)\\d{2}';
const DATE = `(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?\\s+${YEAR}|(?:0?[1-9]|1[0-2])[/.-]${YEAR}|${YEAR}(?:-(?:0[1-9]|1[0-2]))?)`;
const DATE_RANGE = new RegExp(`\\b${DATE}\\s*(?:-|–|—|to)\\s*(?:${DATE}|present|current|now)\\b`, 'i');
const DATE_PARTS = new RegExp(`\\b(${DATE})\\s*(?:-|–|—|to)\\s*(${DATE}|present|current|now)\\b`, 'i');
function validDateRange(value) {
  const match = String(value || '').match(DATE_PARTS);
  if (!match) return false;
  const ordinal = (part) => {
    if (/^(present|current|now)$/i.test(part)) return Infinity;
    const year = Number(part.match(/(?:19|20)\d{2}/)?.[0]);
    const monthName = part.slice(0, 3).toLowerCase();
    const named = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(monthName);
    const numeric = part.match(/^(\d{1,2})[/.-]/)?.[1] || part.match(/^\d{4}-(\d{2})$/)?.[1];
    return year * 12 + (named >= 0 ? named : numeric ? Number(numeric) - 1 : 0);
  };
  return ordinal(match[1]) <= ordinal(match[2]);
}
const ACTION = /^(?:[-*•]\s*)?(?:achieved|built|created|designed|developed|delivered|led|managed|implemented|improved|reduced|increased|launched|automated|analyzed|analysed|supported|coordinated|organized|organised|resolved|trained|maintained|produced|conducted|collaborated|researched|assisted|tested|wrote|deployed|optimized|optimised|streamlined|processed|served|taught|mentored|planned)\b/i;
const METRIC = /(?:\b\d+(?:\.\d+)?\s*(?:%|percent\b|hours?\b|days?\b|users?\b|customers?\b|clients?\b|patients?\b|students?\b|projects?\b|people\b|members?\b|requests?\b|records?\b|transactions?\b)|[$£€₹]\s*\d+)/i;

function jobMatch(text, description) {
  if (!description?.trim()) return { content_match_score: null, matched_keywords: [], missing_keywords: [], keyword_evidence: [], match_note: 'Add a job description to measure skill alignment.' };
  let headingWeight = 2;
  const clauses = description.split(/\n|[.;](?:\s|$)/).map((line) => {
    if (/^(?:\s*[-*•]?\s*)(?:preferred|nice.to.have|bonus|desirable)/i.test(line)) headingWeight = 1;
    if (/^(?:\s*[-*•]?\s*)(?:required|requirements|must.have|minimum|essential)/i.test(line)) headingWeight = 3;
    const weight = /\b(required|must|essential|mandatory)\b/i.test(line) ? 3 : /\b(preferred|nice.to.have|bonus|desirable)\b/i.test(line) ? 1 : headingWeight;
    return { line, weight };
  });
  const terms = SKILLS.map(([label, ...aliases]) => ({ label, aliases })).filter(({ aliases }) => aliases.some((a) => contains(description, a)));
  const evidence = terms.map(({ label, aliases }) => {
    const relevant = clauses.filter(({ line }) => aliases.some((a) => contains(line, a)));
    const weight = Math.max(1, ...relevant.map((c) => c.weight));
    const matched = aliases.some((a) => contains(text, a));
    const line = text.split(/\r?\n/).find((l) => aliases.some((a) => contains(l, a)));
    return { term: label, matched, weight, priority: weight === 3 ? 'Required' : weight === 1 ? 'Preferred' : 'Mentioned', evidence: line?.trim().slice(0, 220) || '', job_context: relevant[0]?.line.trim().slice(0, 220) || '' };
  }).sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term));
  const total = evidence.reduce((sum, e) => sum + e.weight, 0);
  const earned = evidence.reduce((sum, e) => sum + (e.matched ? e.weight : 0), 0);
  return {
    content_match_score: total ? Math.round(earned / total * 100) : null,
    matched_keywords: evidence.filter((e) => e.matched).map((e) => e.term),
    missing_keywords: evidence.filter((e) => !e.matched).map((e) => e.term),
    keyword_evidence: evidence,
    match_note: total ? `Weighted coverage of ${evidence.length} recognized skills. Required: 3, mentioned: 2, preferred: 1. Aliases count once; repetition adds no points. This does not assess all qualifications, seniority, or eligibility.` : 'No supported skill terms found. Add a more detailed job description; a reliable keyword score is unavailable.',
  };
}

function analyzeResume(resumeText, jobDescription, resume) {
  const text = resume ? resumeToText(resume) : resumeText.trim();
  const sections = sectionsOf(text);
  const checks = [];
  function check(id, category, label, max, ratio, evidence, advice) {
    const earned = Math.round(max * Math.max(0, Math.min(1, ratio)));
    checks.push({ id, category, label, earned, possible: max, passed: earned === max, evidence, advice });
  }
  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(resume ? resume.contact?.email || '' : text);
  const phone = ((resume ? resume.contact?.phone || '' : text).match(/\+?\d[\d(). -]{6,}\d/g) || []).some((v) => {
    const digits = v.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15 && !/^\d{4}\s*[-–—]\s*\d{4}$/.test(v.trim());
  });
  const first = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const name = resume ? Boolean(resume.contact?.name?.trim()) : /^[\p{L}][\p{L} .'-]{2,70}(?:\s*\||$)/u.test(first) && !Object.values(HEADINGS).some((p) => p.test(first));
  check('name', 'Contact', 'Name', 5, name ? 1 : 0, name ? 'A candidate name is present.' : 'No clear candidate name found.', 'Add your full name at the top.');
  check('email', 'Contact', 'Email', 10, email ? 1 : 0, email ? 'A readable email address is present.' : 'No valid email address found.', 'Add a plain-text email address.');
  check('phone', 'Contact', 'Phone', 5, phone ? 1 : 0, phone ? 'A phone number is present.' : 'No recognizable phone number found.', 'Add a phone number with country/area code.');
  const experience = resume ? (resume.experience || []).filter((e) => e.role?.trim() && e.company?.trim() && e.bullets?.trim()) : (sections.experience || []).filter((l) => l.length > 15);
  const education = resume ? (resume.education || []).filter((e) => e.degree?.trim() && e.institution?.trim()) : (sections.education || []).filter((l) => l.length > 8);
  const skills = resume ? resume.skills?.trim() : (sections.skills || []).join(' ');
  check('experience', 'Sections', 'Experience or project evidence', 15, experience.length ? 1 : 0, experience.length ? 'Substantive experience or project details found.' : 'No complete experience/project entry found.', 'Add a role, organization or project, and what you did. Internships and volunteer work count.');
  check('education', 'Sections', 'Education or qualifications', 8, education.length ? 1 : 0, education.length ? 'Education or qualification details found.' : 'No complete qualification entry found.', 'Add your qualification and institution, or relevant training.');
  check('skills', 'Sections', 'Skills', 7, skills?.length >= 3 ? 1 : 0, skills?.length >= 3 ? 'A populated skills section is present.' : 'No populated skills section found.', 'List relevant skills you can demonstrate.');
  const roles = resume ? (resume.experience || []).filter((e) => Object.entries(e).some(([k, v]) => k !== 'id' && v?.trim())) : null;
  const dated = roles ? roles.filter((e) => validDateRange(e.dates)).length / Math.max(1, roles.length) : Number(validDateRange((sections.experience || []).join('\n')));
  check('role-dates', 'Chronology', 'Experience date ranges', 15, dated, roles ? `${roles.filter((e) => validDateRange(e.dates)).length} of ${roles.length} entries have recognizable, ordered date ranges.` : dated ? 'Date ranges found.' : 'No valid date ranges found.', 'Use dates for each role/project, e.g. Jan 2023 - Present or 2021 - 2024. End dates should not precede start dates.');
  const studies = resume ? (resume.education || []).filter((e) => e.degree?.trim() || e.institution?.trim()) : null;
  const eduDates = studies ? studies.filter((e) => /\b(?:19|20)\d{2}\b/.test(e.dates || '')).length / Math.max(1, studies.length) : Number(/\b(?:19|20)\d{2}\b/.test((sections.education || []).join('\n')));
  check('education-dates', 'Chronology', 'Qualification dates', 5, eduDates, eduDates === 1 ? 'Qualification years are present.' : 'Some qualification years are missing.', 'Include graduation or expected completion year.');
  const lines = (resume ? (resume.experience || []).flatMap((e) => (e.bullets || '').split('\n')) : (sections.experience || [])).map((l) => l.trim()).filter((l) => l.length >= 15 && !DATE_RANGE.test(l));
  const actionLines = lines.filter((l) => ACTION.test(l));
  check('actions', 'Content evidence', 'Specific actions', 10, actionLines.length / Math.max(1, lines.length), `${actionLines.length} of ${lines.length} experience lines start with a recognized action verb.`, 'Describe your contribution with verbs such as built, led, supported, or researched.');
  const metrics = lines.filter((l) => METRIC.test(l));
  check('outcomes', 'Content evidence', 'Measurable scope or outcomes', 10, Math.min(1, metrics.length / Math.max(1, Math.ceil(lines.length / 3))), `${metrics.length} experience lines include measurable scope or outcomes.`, 'Where relevant, add real scope or results. Do not invent numbers; this is a writing signal, not a parsing requirement.');
  const words = text.split(/\s+/).filter(Boolean).length;
  check('substance', 'Text quality', 'Sufficient detail', 5, Math.min(1, words / 150), `${words} words supplied. Full credit at 150 words; longer is not automatically better.`, 'Add enough detail to explain your background and contributions.');
  const placeholders = /\b(?:lorem ipsum|your name|your email|insert here|company name|job title|tbd)\b|\[(?:insert|your|add)[^\]]*\]/i.test(text);
  const corruption = /\uFFFD/.test(text);
  check('clean-text', 'Text quality', 'Clean, finished text', 5, text.length >= 40 && !placeholders && !corruption ? 1 : 0, placeholders ? 'Unfinished placeholder text found.' : corruption ? 'Unreadable replacement characters found.' : text.length < 40 ? 'Too little text to inspect.' : 'No common placeholders or replacement characters found.', 'Replace placeholders and review any corrupted characters.');
  return {
    ats_structure_score: checks.reduce((sum, c) => sum + c.earned, 0),
    score_version: '2.0.0', analysis_mode: 'deterministic', score_breakdown: checks,
    structure_issues: checks.filter((c) => !c.passed).sort((a, b) => (b.possible - b.earned) - (a.possible - a.earned)).map((c) => ({ issue: c.advice, why_it_matters: `${c.label}: ${c.evidence} (${c.earned}/${c.possible} points)`, check_id: c.id })),
    ...jobMatch(text, jobDescription), rewrite_suggestions: [],
    methodology: 'Resume readiness is a rule-based estimate: Contact 20, Sections 30, Chronology 20, Content evidence 20, Text quality 10. It is not an employer ATS score or an interview prediction. Text checks cannot verify the original file layout, columns, images, or extraction order. Keyword coverage uses a curated English skill vocabulary, not every requirement in the job description.',
  };
}

module.exports = { analyzeResume, contains, jobMatch, resumeToText, DATE_RANGE, validDateRange };
