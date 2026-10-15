// Run against an already running local app: npm run test:builder.
// AI responses are stubbed; scoring, templates, handoff and exports use real APIs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('puppeteer');
const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const artifacts = path.join(__dirname, '..', '.test-artifacts');

(async () => {
  fs.mkdirSync(artifacts, { recursive: true });
  const installed = [process.env.TEST_CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find((p) => fs.existsSync(p));
  const browser = await puppeteer.launch({ headless: true, ...(installed ? { executablePath: installed } : {}), args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  let page;
  const errors = [];
  try {
    page = await browser.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 1000 });
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().endsWith('/api/writing-assist')) {
        return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ suggested: '- Built Python reporting tools for 500 users.\n- Reduced reporting time by 25%.', explanation: 'Kept your facts and clarified the wording.' }) });
      }
      if (request.url().startsWith('https://fonts.')) return request.abort();
      return request.continue();
    });
    const click = async (selector) => { await page.waitForSelector(selector, { visible: true }); await page.click(selector); };
    const fill = async (field, value) => {
      await page.$eval(`[data-field="${field}"]`, (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    };
    await page.goto(base + '/builder', { waitUntil: 'networkidle0' });
    await page.screenshot({ path: path.join(artifacts, 'builder-start.png'), fullPage: true });
    assert.equal(await page.$$eval('[data-start]', (els) => els.length), 3);
    await click('[data-start="first"]');
    await click('#builder-next');
    assert.equal(await page.$eval('#step-title', (el) => el.textContent), 'Let’s start with you.');
    await fill('contact.name', 'Alex Morgan');
    await fill('contact.title', 'Software Engineer');
    await fill('contact.email', 'alex@example.com');
    await fill('contact.phone', '+91 98765 43210');
    await fill('contact.location', 'Bengaluru, India');
    await fill('contact.links', 'https://example.com/alex');
    await click('#builder-next');
    await fill('experience.0.role', 'Student project lead');
    await fill('experience.0.company', 'Example University');
    await fill('experience.0.dates', 'Jan 2024 - Dec 2025');
    const original = 'I built Python reporting tools for 500 users.\nI reduced reporting time by 25%.';
    await fill('experience.0.bullets', original);
    await click('[data-ai]');
    await page.waitForSelector('#ai-dialog[open]');
    assert.equal(await page.$eval('[data-field="experience.0.bullets"]', (el) => el.value), original);
    await click('#ai-apply');
    assert.ok((await page.$eval('[data-field="experience.0.bullets"]', (el) => el.value)).startsWith('- Built'));
    await click('[data-add="experience"]');
    await fill('experience.1.role', 'Temporary role');
    await click('[data-remove="experience.1"]');
    assert.equal(await page.$$('.builder-entry').then((els) => els.length), 1);
    await click('#builder-next');
    await fill('education.0.degree', 'B.Tech Computer Science');
    await fill('education.0.institution', 'Example University');
    await fill('education.0.dates', '2026');
    await click('#builder-next');
    await fill('skills', 'Python, SQL, Amazon Web Services');
    await fill('summary', 'Software engineer building reliable reporting tools and data workflows. Experienced in Python and SQL, with practical experience supporting university teams.');
    await fill('jobDescription', 'Required: Python, SQL and AWS.\nPreferred: Docker.');
    await click('#builder-next');
    await page.waitForSelector('[data-template="modern"]');
    assert.equal(await page.$$eval('[data-template]', (els) => els.length), 7);
    await click('[data-template="modern"]');
    await page.waitForFunction(() => document.querySelector('#builder-preview').contentDocument?.body.textContent.includes('Alex Morgan'));
    await page.screenshot({ path: path.join(artifacts, 'builder-template.png'), fullPage: true });
    await click('#builder-next');
    await click('#check-ats');
    await page.waitForSelector('#improve-ats');
    assert.ok((await page.$eval('#builder-score-report', (el) => el.textContent)).includes('90%'));
    const score = await page.$eval('.builder-score strong', (el) => el.textContent);
    await page.screenshot({ path: path.join(artifacts, 'builder-review.png'), fullPage: true });
    await page.reload({ waitUntil: 'networkidle0' });
    assert.equal(await page.$eval('#step-title', (el) => el.textContent), 'Ready for your next chapter?');
    assert.ok((await page.$eval('#builder-form', (el) => el.textContent)).includes('Alex Morgan'));
    await click('#check-ats');
    await page.waitForSelector('#improve-ats');
    assert.equal(await page.$eval('.builder-score strong', (el) => el.textContent), score);
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), click('#improve-ats')]);
    await page.waitForFunction(() => /^\d+$/.test(document.querySelector('#ats-score-value').textContent));
    assert.equal(await page.$eval('[data-section="contact"][data-key="name"]', (el) => el.value), 'Alex Morgan');
    assert.equal(await page.$eval('.tpl-card.active', (el) => el.dataset.template), 'modern');
    assert.equal(await page.$eval('#ats-score-value', (el) => el.textContent), score.split('/')[0].trim());
    await page.$eval('[data-section="contact"][data-key="name"]', (el) => { el.value = 'Alex Morgan Updated'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), click('#builder-nav-link')]);
    assert.ok((await page.$eval('#builder-form', (el) => el.textContent)).includes('Alex Morgan Updated'));
    // Real binary exports and all template renderers, no test records written to the database.
    const exportResults = await page.evaluate(async () => {
      const s = JSON.parse(localStorage.getItem('resumeai-builder-draft-v1'));
      const results = [];
      for (const format of ['docx', 'pdf']) {
        const response = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resume: s.resume, template: s.template, format }) });
        const bytes = new Uint8Array(await response.arrayBuffer());
        results.push({ format, status: response.status, mime: response.headers.get('content-type'), bytes: bytes.length, signature: Array.from(bytes.slice(0, 4)) });
      }
      return results;
    });
    for (const result of exportResults) {
      assert.equal(result.status, 200, JSON.stringify(result)); assert.ok(result.bytes > 1000);
      assert.deepEqual(result.signature.slice(0, 2), result.format === 'pdf' ? [37, 80] : [80, 75]);
    }
    await page.setViewport({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(artifacts, 'builder-mobile.png'), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile layout overflows');
    await click('#builder-theme');
    await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => {}))));
    await page.screenshot({ path: path.join(artifacts, 'builder-mobile-light.png'), fullPage: true });
    await click('#restart-builder');
    await click('#restart-cancel');
    assert.ok((await page.$eval('#builder-form', (el) => el.textContent)).includes('Alex Morgan Updated'));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ result: 'PASS', score, exportResults, checked: 'guided creation, required fields, AI review/apply, add/remove, 7 templates, preview, draft restoration, deterministic scores, handoff and return, PDF/DOCX, mobile, light theme, no JS errors', screenshots: artifacts }, null, 2));
  } catch (error) {
    if (page) {
      console.error('Browser diagnostics:', JSON.stringify({ errors, state: await page.evaluate(() => ({ title: document.querySelector('#step-title')?.textContent, message: document.querySelector('#builder-message')?.textContent, preview: document.querySelector('#builder-preview-status')?.textContent, previewText: document.querySelector('#builder-preview')?.contentDocument?.body?.textContent?.slice(0, 200) })) }));
      await page.screenshot({ path: path.join(artifacts, 'builder-failure.png'), fullPage: true });
    }
    throw error;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
