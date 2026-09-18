const { Router } = require('express');
const { callLlmJson } = require('../services/llm');
const { validateAnalyzeBody } = require('../services/validate');

const router = Router();

const COMMON_WORDS = new Set([
  'about', 'across', 'after', 'also', 'and', 'are', 'based', 'best', 'build', 'building',
  'business', 'candidate', 'company', 'customer', 'customers', 'degree', 'design', 'develop',
  'drive', 'driving', 'each', 'experience', 'for', 'from', 'have', 'help', 'high', 'into',
  'join', 'knowledge', 'looking', 'manage', 'members', 'more', 'must', 'new', 'our', 'partner',
  'position', 'program', 'project', 'role', 'skills', 'support', 'team', 'teams', 'the', 'their',
  'they', 'this', 'through', 'using', 'will', 'with', 'work', 'working', 'years', 'you', 'your',
]);

const SYSTEM_PROMPT = `You are an expert ATS (Applicant Tracking System) parser evaluator and senior technical recruiter.
Your task is to analyze resume text for structural ATS compatibility, formatting vulnerabilities, and (when a job description is provided) keyword alignment.

You MUST respond ONLY with a raw, valid JSON object strictly matching this schema:
{
  "ats_structure_score": number, // An integer between 0 and 100 assessing ATS readability and standard layout.
  "structure_issues": [
    {
      "issue": string, // Clear description of the structural or formatting issue found.
      "why_it_matters": string // Why this breaks or lowers scoring in ATS parsing algorithms.
    }
  ],
  "content_match_score": number | null, // An integer between 0 and 100 based on keyword and skill overlap with the job description. If NO job description is provided, this MUST be null.
  "matched_keywords": string[], // Key technical skills, credentials, tools, or domain terms from the job description that ARE present in the resume. Must NOT overlap missing_keywords. If NO job description is provided, this MUST be an empty array [].
  "missing_keywords": string[], // List of key technical skills, credentials, tools, or domain terms from the job description missing from the resume. If NO job description is provided, this MUST be an empty array [].
  "rewrite_suggestions": [
    {
      "original": string, // The original bullet point or sentence from the resume that could be improved.
      "suggested": string, // High-impact rewrite using strong action verbs, quantifiable metrics, and relevant terminology.
      "reason": string // Rationale for why the suggested version is more compelling to recruiters and ATS scanners.
    }
  ]
}

EVALUATION CRITERIA:
1. ATS Structure Score (0-100):
   - Heavily penalize indicators of tables, multi-column layouts, or tabbed columns that cause text extraction order to scramble.
   - Check if contact information (email, phone, location, LinkedIn) is cleanly present as plain text, or if it appears to rely on icons/images (which ATS parsers drop).
   - Check for universally recognized section headers ("Work Experience" / "Professional Experience", "Education", "Skills", "Projects", "Certifications"). Penalize unconventional headers (e.g., "My Story", "What I Do", "Toolbox").
   - Check for presence of all standard sections: Experience, Education, Skills. Deduct significantly if any standard section is absent.
   - Check date formatting consistency (e.g., "MM/YYYY - Present" or "Jan 2022 - Present") and clear role hierarchy (Title, Company, Dates).

2. Content Match Score (0-100 or null):
   - If NO job description is provided: content_match_score MUST be null, and matched_keywords and missing_keywords MUST be [].
   - If a job description IS provided: score between 0 and 100 evaluating hard skills, domain knowledge, years of experience, and responsibilities overlap. List all critical missing keywords, and list the important terms that ARE already present as matched_keywords (no overlap between the two lists).

3. Rewrite Suggestions:
   - Provide 2 to 5 actionable bullet point rewrites focusing on measurable business impact, action verbs, and clarity.
   - The "original" value MUST be an exact, continuous copy of text that appears in the supplied resume. Do not paraphrase, truncate with ellipses, or combine text from different fields. The editor uses this exact value to safely apply the rewrite.`;

function hasSection(text, names) {
  const pattern = new RegExp(`(^|\\n)\\s*(?:${names.join('|')})\\s*:?(?=\\s|$)`, 'im');
  return pattern.test(text);
}

function extractJobTerms(jobDescription) {
  const seen = new Set();
  return (jobDescription.match(/[A-Za-z][A-Za-z0-9+.#/-]{2,}/g) || [])
    .filter((term) => !COMMON_WORDS.has(term.toLowerCase()))
    .filter((term) => {
      const key = term.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 30);
}

/**
 * Keep the editor useful when the external model provider is temporarily
 * unreachable. This is intentionally conservative: it detects only clear ATS
 * signals and never fabricates content rewrites.
 */
function buildFallbackAnalysis(resumeText, jobDescription) {
  const issues = [];
  const text = resumeText.trim();
  const hasExperience = hasSection(text, ['professional experience', 'work experience', 'experience', 'employment history']);
  const hasEducation = hasSection(text, ['education', 'academic background']);
  const hasSkills = hasSection(text, ['skills', 'technical skills', 'core competencies']);
  const hasEmail = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
  const hasPhone = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text);
  const hasDates = /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)?\\.?\\s*20\\d{2}\s*(?:-|–|—|to)\s*(?:present|current|20\\d{2})/i.test(text);
  const hasMetrics = /(?:\d+%|\$\s?\d+|\d+[+x]|\d+\s*(?:users|customers|hours|days|weeks|months|projects|people|team members))/i.test(text);
  const hasRecognizableYear = /\b(?:19|20)\d{2}\b/.test(text);

  if (!hasExperience) issues.push({ issue: 'Add a standard Experience section heading.', why_it_matters: 'ATS parsers recognize conventional headings more reliably than custom labels.' });
  if (!hasEducation) issues.push({ issue: 'Add a standard Education section heading.', why_it_matters: 'Education is a core resume section that many ATS workflows expect to find.' });
  if (!hasSkills) issues.push({ issue: 'Add a dedicated Skills section.', why_it_matters: 'A clearly labeled skills list improves keyword extraction and recruiter scanning.' });
  if (!hasEmail || !hasPhone) issues.push({ issue: 'Make contact details easy to parse.', why_it_matters: 'Include a plain-text email address and phone number near the top of the resume.' });
  if (!hasDates && !hasRecognizableYear) issues.push({ issue: 'Use consistent date ranges for roles and education.', why_it_matters: 'Consistent dates help ATS systems understand your chronology.' });
  if (!hasMetrics) issues.push({ issue: 'Add measurable outcomes to your experience.', why_it_matters: 'Specific scope and outcomes make accomplishments more compelling to recruiters.' });
  if (/\t| {5,}/.test(text)) issues.push({ issue: 'Avoid tabbed or column-like spacing.', why_it_matters: 'Complex spacing can scramble the reading order in some ATS parsers.' });

  const atsScore = Math.max(35, Math.min(96, 94 - (issues.length * 8)));
  let contentMatchScore = null;
  let matchedKeywords = [];
  let missingKeywords = [];
  if (jobDescription) {
    const terms = extractJobTerms(jobDescription);
    const lowerResume = text.toLowerCase();
    const matchedTerms = terms.filter((term) => lowerResume.includes(term.toLowerCase()));
    matchedKeywords = matchedTerms.slice(0, 12);
    missingKeywords = terms.filter((term) => !lowerResume.includes(term.toLowerCase())).slice(0, 12);
    contentMatchScore = terms.length ? Math.round((matchedTerms.length / terms.length) * 100) : 0;
  }

  return {
    ats_structure_score: atsScore,
    structure_issues: issues,
    content_match_score: contentMatchScore,
    matched_keywords: matchedKeywords,
    missing_keywords: missingKeywords,
    rewrite_suggestions: [],
  };
}

router.post('/', async (req, res) => {
  const { resumeText, jobDescription } = req.body || {};

  const validationErrors = validateAnalyzeBody(req.body);
  if (validationErrors.length) {
    return res.status(400).json({ error: validationErrors.join(' '), details: validationErrors });
  }

  const trimmedResume = resumeText.trim();
  const trimmedJob = typeof jobDescription === 'string' && jobDescription.trim() ? jobDescription.trim() : null;
  const hasJobDesc = Boolean(trimmedJob);

  const userPrompt = `### RESUME TEXT TO ANALYZE:
"""
${trimmedResume}
"""

${
  hasJobDesc
    ? `### TARGET JOB DESCRIPTION:
"""
${trimmedJob}
"""

Please evaluate both the ATS structure score and content match score against this job description.`
    : `### TARGET JOB DESCRIPTION:
[No job description provided. Evaluate ONLY ATS structure and provide general high-impact rewrite suggestions. Set "content_match_score" to null and "missing_keywords" to [].]`
}`;

  try {
    const rawResult = await callLlmJson({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
    });

    // Normalize & validate the response
    const atsScore = Math.max(
      0,
      Math.min(100, Math.round(Number(rawResult.ats_structure_score) || 0))
    );

    const structureIssues = Array.isArray(rawResult.structure_issues)
      ? rawResult.structure_issues
          .filter((item) => item && typeof item.issue === 'string')
          .map((item) => ({
            issue: String(item.issue).trim(),
            why_it_matters: String(item.why_it_matters || '').trim(),
          }))
      : [];

    let contentMatchScore = null;
    let matchedKeywords = [];
    let missingKeywords = [];

    if (hasJobDesc && rawResult.content_match_score !== null && rawResult.content_match_score !== undefined) {
      contentMatchScore = Math.max(
        0,
        Math.min(100, Math.round(Number(rawResult.content_match_score) || 0))
      );
      if (Array.isArray(rawResult.matched_keywords)) {
        matchedKeywords = rawResult.matched_keywords
          .map((kw) => (typeof kw === 'string' ? kw.trim() : ''))
          .filter(Boolean)
          .slice(0, 12);
      }
      if (Array.isArray(rawResult.missing_keywords)) {
        missingKeywords = rawResult.missing_keywords
          .map((kw) => (typeof kw === 'string' ? kw.trim() : ''))
          .filter(Boolean)
          .slice(0, 12);
      }
      const matchedSet = new Set(matchedKeywords.map((kw) => kw.toLowerCase()));
      missingKeywords = missingKeywords.filter((kw) => !matchedSet.has(kw.toLowerCase()));
    }

    const rewriteSuggestions = Array.isArray(rawResult.rewrite_suggestions)
      ? rawResult.rewrite_suggestions
          .filter((item) => item && typeof item.original === 'string')
          .map((item) => ({
            original: String(item.original).trim(),
            suggested: String(item.suggested || '').trim(),
            reason: String(item.reason || '').trim(),
          }))
      : [];

    const sanitizedResponse = {
      ats_structure_score: atsScore,
      structure_issues: structureIssues,
      content_match_score: contentMatchScore,
      matched_keywords: matchedKeywords,
      missing_keywords: missingKeywords,
      rewrite_suggestions: rewriteSuggestions,
    };

    return res.json(sanitizedResponse);
  } catch (err) {
    console.error('[analyze] Error processing resume analysis:', err.message);
    const isApiKeyError = err.message.includes('LLM_API_KEY');
    if (isApiKeyError) {
      return res.status(400).json({
        error: err.message || 'An LLM API key is required to run the AI analysis.',
      });
    }

    return res.json({
      ...buildFallbackAnalysis(trimmedResume, trimmedJob),
      analysis_mode: 'fallback',
      analysis_warning: 'AI review is temporarily unavailable. Showing live baseline checks; use Refresh to try the AI review again.',
    });
  }
});

module.exports = router;
