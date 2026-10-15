const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeResume, contains, jobMatch, resumeToText, DATE_RANGE, validDateRange } = require('../server/services/ats');

const resume = {
  contact: { name: 'Alex Morgan', email: 'alex@example.com', phone: '+91 98765 43210', title: 'Software Engineer', location: 'Bengaluru' },
  summary: 'Software engineer building reliable tools for customer support teams.',
  experience: [{ id: 'exp-1', role: 'Software Engineer', company: 'Example Studio', dates: 'Jan 2022 - Dec 2025', bullets: '- Built Python and SQL reporting tools for 500 users.\n- Reduced manual reporting time by 25% through automated validation.\n- Collaborated with support teams to resolve customer issues.' }],
  education: [{ id: 'edu-1', degree: 'B.Tech Computer Science', institution: 'Example University', dates: '2021' }],
  skills: 'Python, SQL, Amazon Web Services',
};

test('same input produces the same score and exact breakdown sum', () => {
  const a = analyzeResume('', 'Required: Python and SQL. Preferred: AWS.', resume);
  assert.deepEqual(a, analyzeResume('', 'Required: Python and SQL. Preferred: AWS.', resume));
  assert.equal(a.ats_structure_score, a.score_breakdown.reduce((sum, c) => sum + c.earned, 0));
  assert.equal(a.score_breakdown.reduce((sum, c) => sum + c.possible, 0), 100);
  assert.equal(a.content_match_score, 100);
});
test('skill boundaries preserve punctuation and avoid substring false positives', () => {
  assert.equal(contains('JavaScript', 'Java'), false);
  assert.equal(contains('NoSQL', 'SQL'), false);
  assert.equal(contains('React.js developer', 'React'), true);
  assert.equal(contains('C++, C# and .NET', 'C++'), true);
  assert.equal(contains('C++, C# and .NET', 'C#'), true);
  assert.equal(contains('C++, C# and .NET', '.NET'), true);
  assert.equal(contains('C++', 'C'), false);
});
test('aliases and repetition count once, required terms carry more weight', () => {
  const a = jobMatch('Amazon Web Services AWS AWS', 'Required: AWS\nPreferred: Python');
  assert.equal(a.content_match_score, 75);
  assert.deepEqual(a.matched_keywords, ['AWS']);
  assert.deepEqual(a.missing_keywords, ['Python']);
  assert.equal(jobMatch('AWS', 'Required: AWS AWS AWS\nPreferred: Python').content_match_score, 75);
  assert.equal(jobMatch('Python', 'Required: AWS\nPreferred: Python').content_match_score, 25);
});
test('no JD and unrecognized JD do not manufacture a score', () => {
  for (const jd of [null, '', 'Join our wonderful growing company.']) {
    const result = jobMatch('Python', jd);
    assert.equal(result.content_match_score, null);
    assert.deepEqual(result.matched_keywords, []);
    assert.deepEqual(result.missing_keywords, []);
  }
});
test('headings and empty entries do not earn populated section credit', () => {
  const empty = { contact: {}, experience: [{ id: 'e' }], education: [{ id: 'd' }], skills: '' };
  const result = analyzeResume('SKILLS\nEXPERIENCE\nEDUCATION', null, empty);
  assert.equal(result.ats_structure_score, 0);
  assert.equal(resumeToText(empty), '');
  const raw = analyzeResume('EXPERIENCE\nEDUCATION\nSKILLS', null);
  assert.equal(raw.score_breakdown.filter((c) => c.category === 'Sections').reduce((sum, c) => sum + c.earned, 0), 0);
});
test('international phone and common date formats are recognized', () => {
  const result = analyzeResume('', null, resume);
  assert.equal(result.score_breakdown.find((c) => c.id === 'phone').earned, 5);
  for (const value of ['Jan 2022 - Present', 'January 2022 – December 2024', '2022-01 - 2024-12', '01/2022 to 04/2025', '2021 - 2024']) assert.equal(DATE_RANGE.test(value), true, value);
  const withoutPhone = structuredClone(resume); withoutPhone.contact.phone = '';
  assert.equal(analyzeResume('', null, withoutPhone).score_breakdown.find((c) => c.id === 'phone').earned, 0);
});
test('incomplete roles reduce date coverage and genuine corrections improve score', () => {
  const r = structuredClone(resume);
  r.experience.push({ id: 'exp-2', role: 'Intern', company: 'Another Studio', dates: '', bullets: '- Supported the internal reporting team.' });
  const before = analyzeResume('', null, r);
  r.experience[1].dates = 'Jan 2020 - Dec 2020';
  const after = analyzeResume('', null, r);
  assert.ok(after.ats_structure_score > before.ats_structure_score);
  assert.equal(after.score_breakdown.find((c) => c.id === 'role-dates').earned, 15);
});
test('reversed chronology does not earn date credit', () => {
  for (const dates of ['2025 - 2022', 'Dec 2024 - Jan 2024', '12/2024 - 01/2024']) assert.equal(validDateRange(dates), false, dates);
  for (const dates of ['2020 - 2025', 'Jan 2024 - Dec 2024', '12/2024 - Present', '2022-01 - 2024-12']) assert.equal(validDateRange(dates), true, dates);
});
test('first-time applicants can use projects and qualifications', () => {
  const result = analyzeResume('Alex Morgan\nalex@example.com\nPROJECTS\nBuilt a Python research tool for 30 students.\nJan 2025 - Mar 2025\nEDUCATION\nBSc at Example University, 2026\nSKILLS\nPython, SQL', null);
  assert.equal(result.score_breakdown.find((c) => c.id === 'experience').earned, 15);
});
test('placeholder text is reported and missing skills never overlap matched skills', () => {
  const result = analyzeResume('Your name\nSkills\nJavaScript and C++', 'Required: Java, JavaScript, C++, Python');
  assert.ok(result.structure_issues.some((i) => i.check_id === 'clean-text'));
  assert.ok(result.missing_keywords.includes('Java'));
  assert.ok(result.matched_keywords.every((k) => !result.missing_keywords.includes(k)));
});
