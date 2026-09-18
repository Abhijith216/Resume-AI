const { Router } = require('express');
const { callLlmJson } = require('../services/llm');
const { validateCoverLetterBody } = require('../services/validate');

const router = Router();

const SYSTEM_PROMPT = `You are an expert career coach and professional copywriter. Your task is to write a compelling, tailored cover letter.

You MUST respond ONLY with a raw, valid JSON object strictly matching this schema:
{
  "cover_letter": string // The full cover letter body text: 3-4 paragraphs separated by blank lines. Plain text with \\n\\n between paragraphs. Include a "Dear Hiring Team,"-style salutation and a "Sincerely," closing with the candidate's name. No markdown, no subject line, no sender/recipient address block, and no date — those are rendered separately. Do not fabricate employers, metrics, or credentials.
}

WRITING GUIDELINES:
1. Structure (3-4 paragraphs):
   - Paragraph 1: Strong opening — name the role and company, state why this specific opportunity fits, and a hook grounded in the candidate's real experience.
   - Paragraph 2-3: Connect 2-4 of the candidate's actual experiences and achievements to the role's key requirements. Weave in the most relevant keywords from the job description NATURALLY (do not keyword-stuff). Reference concrete outcomes from the resume where possible.
   - Paragraph 4: Confident close — reiterate fit, availability for an interview, and thanks. End with "Sincerely," and the candidate's name.
2. Tone: confident, warm, professional; not stiff or generic. Avoid clichés like "I am writing to apply for."
3. Length: 250-380 words total.
4. Never invent employers, titles, dates, degrees, or numbers that are not in the resume.
5. Output only the letter in "cover_letter" — paragraphs separated by blank lines.`;

/**
 * Deterministic fallback so the feature still works when the LLM provider is
 * unreachable. Conservative: it only rearranges facts already in the resume.
 */
function buildFallbackCoverLetter(resume, jobDescription) {
  const c = resume?.contact || {};
  const name = c.name || '';
  const firstRole = resume?.experience?.[0]?.role || '';
  const firstCompany = resume?.experience?.[0]?.company || '';

  const terms = (String(jobDescription || '').match(/[A-Za-z][A-Za-z0-9+.#/-]{2,}/g) || [])
    .filter((t) => !['the', 'and', 'for', 'with', 'you', 'our', 'your', 'will', 'are', 'this', 'that', 'role', 'team'].includes(t.toLowerCase()))
    .filter((t, i, arr) => arr.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i)
    .slice(0, 4);

  const tailoredLine = terms.length
    ? ` I understand the role emphasizes ${terms.join(', ')}, areas I have worked in throughout my career.`
    : '';

  const skillList = String(resume?.skills || '')
    .split(/,|\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5)
    .join(', ');

  return [
    `Dear Hiring Team,\n\nI am excited to apply for the ${firstRole || 'open position'}${firstCompany ? ` — and to bring my experience back into a team like ${firstCompany}'s` : ''}.` +
      `${tailoredLine} My background aligns closely with what your team is looking for, and I would welcome the chance to contribute.` +
      `${c.title ? ` As a ${c.title.toLowerCase()}, I have built my career on exactly this kind of work.` : ''}`,
    `Over the course of my career${skillList ? `, working across ${skillList}` : ''}, I have taken ownership of challenging projects and delivered measurable results. ` +
      `I bring a track record of collaborating across teams, communicating clearly, and following through on the commitments that matter most to the business.` +
      `${resume?.summary ? ` ${resume.summary.trim().split(/\.\s+/)[0]}.` : ''}`,
    `What draws me to this role is the chance to keep growing while contributing from day one. ` +
      `I would be glad to walk you through specific examples of my work and how it maps onto your goals for this position.`,
    `Thank you for your time and consideration. I look forward to the possibility of talking further.\n\nSincerely,\n${name}`,
  ].join('\n\n');
}

router.post('/', async (req, res) => {
  const { resume, jobDescription } = req.body || {};

  const validationErrors = validateCoverLetterBody(req.body);
  if (validationErrors.length) {
    return res.status(400).json({ error: validationErrors.join(' '), details: validationErrors });
  }

  const trimmedJob = typeof jobDescription === 'string' && jobDescription.trim() ? jobDescription.trim() : null;

  // Compact, LLM-friendly resume summary (no need to ship the entire object)
  const experienceLines = (resume.experience || []).map((item) =>
    `- ${item.role || 'Role'}${item.company ? ` at ${item.company}` : ''}${item.dates ? ` (${item.dates})` : ''}\n  ${String(item.bullets || '').replace(/\s*\n\s*/g, ' | ').slice(0, 400)}`
  );

  const educationLines = (resume.education || []).map((item) =>
    `- ${item.degree || 'Degree'}${item.institution ? `, ${item.institution}` : ''}${item.dates ? ` (${item.dates})` : ''}`
  );

  const userPrompt = `### CANDIDATE RESUME:
"""
Name: ${resume.contact?.name || 'Not provided'}
Title: ${resume.contact?.title || 'Not provided'}
Contact: ${[resume.contact?.email, resume.contact?.phone, resume.contact?.location, resume.contact?.links].filter(Boolean).join(' | ') || 'Not provided'}
Summary: ${resume.summary || 'Not provided'}

EXPERIENCE:
${experienceLines.join('\n') || 'None listed'}

EDUCATION:
${educationLines.join('\n') || 'None listed'}

SKILLS: ${resume.skills || 'Not provided'}
"""

### TARGET JOB DESCRIPTION:
"""
${trimmedJob || '[No job description provided — write a strong general-purpose letter based on the resume alone.]'}
"""

Please write the tailored cover letter as JSON according to the schema.`;

  try {
    const rawResult = await callLlmJson({ systemPrompt: SYSTEM_PROMPT, userPrompt });

    const letter = String(rawResult.cover_letter || '').trim();
    if (!letter) throw new Error('Empty cover letter received.');

    return res.json({ cover_letter: letter, generation_mode: 'ai' });
  } catch (err) {
    console.error('[cover-letter] LLM generation failed, using fallback:', err.message);
    const isApiKeyError = err.message.includes('LLM_API_KEY');
    if (isApiKeyError) {
      return res.status(400).json({
        error: err.message || 'An LLM API key is required to generate a cover letter.',
      });
    }
    return res.json({
      cover_letter: buildFallbackCoverLetter(resume, trimmedJob),
      generation_mode: 'fallback',
      generation_warning: 'AI generation is temporarily unavailable — showing a template-based draft you can edit.',
    });
  }
});

module.exports = router;
