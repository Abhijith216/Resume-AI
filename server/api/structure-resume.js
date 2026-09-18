const { Router } = require('express');
const { callLlmJson } = require('../services/llm');

const router = Router();

const SYSTEM_PROMPT = `You are an expert resume parser. Your task is to accurately parse raw, unstructured resume text into a clean, structured JSON format.

You MUST respond ONLY with a raw, valid JSON object strictly matching this schema:
{
  "contact": {
    "name": string, // Full name of the candidate
    "title": string, // Professional headline or job title (e.g. Senior Full Stack Engineer)
    "email": string, // Email address or ""
    "phone": string, // Phone number or ""
    "location": string, // City, State, Country or ""
    "links": string // LinkedIn, GitHub, portfolio URLs or ""
  },
  "summary": string, // Professional summary, objective, or profile text
  "experience": [
    {
      "id": string, // Unique id like "exp-1", "exp-2"
      "role": string, // Job title / position held
      "company": string, // Employer / company name
      "dates": string, // Employment dates (e.g. "Jan 2022 - Present")
      "location": string, // Location of company or "Remote"
      "bullets": string // Key responsibilities and measurable achievements, formatted with bullet points or newlines
    }
  ],
  "education": [
    {
      "id": string, // Unique id like "edu-1", "edu-2"
      "degree": string, // Degree or field of study (e.g. "B.S. in Computer Science")
      "institution": string, // University, college, or school
      "dates": string, // Graduation year or date range (e.g. "2018 - 2022")
      "location": string // City, State or ""
    }
  ],
  "skills": string // Relevant technical and soft skills, tools, and platforms (e.g. "JavaScript, TypeScript, React, Node.js, SQL")
}

PARSING RULES:
1. Extract existing information faithfully. Do not fabricate, hallucinate, or assume missing data.
2. If any field or section is not found in the resume, leave it as an empty string "" or empty array [].
3. For each experience entry, keep all bullet points and accomplishments grouped in the "bullets" string.
4. If candidate contact info contains URLs, group them in "links".`;

/**
 * Deterministic fallback parser using regex heuristics.
 * Ensures the user's resume is always structured into the editor fields
 * even if the external LLM is busy, rate-limited, or temporarily unavailable.
 */
function buildFallbackStructuredResume(rawText) {
  const text = String(rawText || '').trim();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  // Extract contact items
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = emailMatch ? emailMatch[0] : '';

  const phoneMatch = text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const phone = phoneMatch ? phoneMatch[0] : '';

  const linksMatches = text.match(/(?:https?:\/\/[^\s]+|linkedin\.com\/[^\s]+|github\.com\/[^\s]+)/gi) || [];
  const links = linksMatches.join(' | ');

  // Candidate name heuristic: first short line that isn't an email or URL
  let name = '';
  let title = '';
  if (lines.length > 0) {
    const candidateName = lines[0];
    if (!candidateName.includes('@') && !candidateName.includes('http') && candidateName.length < 50) {
      name = candidateName;
    }
  }
  if (lines.length > 1 && !lines[1].includes('@') && lines[1].length < 60) {
    title = lines[1];
  }

  // Identify section boundaries
  const SECTION_PATTERNS = [
    { key: 'summary', regex: /^(?:professional\s+summary|summary|profile|about\s+me|objective)\b/i },
    { key: 'experience', regex: /^(?:work\s+experience|professional\s+experience|experience|employment\s+history)\b/i },
    { key: 'education', regex: /^(?:education|academic\s+background|academics)\b/i },
    { key: 'skills', regex: /^(?:skills|technical\s+skills|core\s+competencies|technologies)\b/i },
  ];

  const sections = {
    summary: [],
    experience: [],
    education: [],
    skills: [],
    other: [],
  };

  let currentSection = 'other';

  for (const line of lines) {
    const matched = SECTION_PATTERNS.find((p) => p.regex.test(line));
    if (matched) {
      currentSection = matched.key;
      continue;
    }
    sections[currentSection].push(line);
  }

  // Parse experience items
  const experience = [];
  if (sections.experience.length) {
    // Group roughly by job headers (look for date patterns or lines with '|' or '-')
    const expLines = sections.experience;
    let currentExp = null;

    for (const line of expLines) {
      const hasDate = /(?:19|20)\d{2}|present|current/i.test(line);
      const isHeaderLine = (hasDate && line.length < 80) || (!currentExp && line.length < 60);

      if (isHeaderLine) {
        if (currentExp) experience.push(currentExp);
        const parts = line.split(/\||–|-/).map((p) => p.trim());
        currentExp = {
          id: `exp-${experience.length + 1}`,
          role: parts[0] || 'Role',
          company: parts[1] || '',
          dates: parts.find((p) => /(?:19|20)\d{2}|present/i.test(p)) || '',
          location: '',
          bullets: '',
        };
      } else if (currentExp) {
        currentExp.bullets = currentExp.bullets
          ? `${currentExp.bullets}\n${line}`
          : line;
      }
    }
    if (currentExp) experience.push(currentExp);
  }

  // Parse education items
  const education = [];
  if (sections.education.length) {
    const eduLines = sections.education;
    let currentEdu = null;

    for (const line of eduLines) {
      const hasDate = /(?:19|20)\d{2}/.test(line);
      const isDegreeOrSchool = /bachelor|master|b\.s\.|b\.a\.|m\.s\.|ph\.d|university|college|school|institute/i.test(line);

      if (isDegreeOrSchool || (!currentEdu && line.length < 70)) {
        if (currentEdu) education.push(currentEdu);
        currentEdu = {
          id: `edu-${education.length + 1}`,
          degree: line,
          institution: '',
          dates: '',
          location: '',
        };
      } else if (currentEdu && hasDate && !currentEdu.dates) {
        currentEdu.dates = line;
      } else if (currentEdu && !currentEdu.institution) {
        currentEdu.institution = line;
      }
    }
    if (currentEdu) education.push(currentEdu);
  }

  return {
    contact: {
      name,
      title,
      email,
      phone,
      location: '',
      links,
    },
    summary: sections.summary.join('\n\n'),
    experience,
    education,
    skills: sections.skills.join(', '),
  };
}

router.post('/', async (req, res) => {
  const { text } = req.body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({
      error: 'Invalid request: "text" is required and must be non-empty string.',
    });
  }

  const rawResumeText = text.trim();

  try {
    const userPrompt = `### RESUME TEXT TO STRUCTURE:\n"""\n${rawResumeText}\n"""\n\nPlease structure this resume text into JSON according to the schema.`;

    const rawResult = await callLlmJson({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
    });

    // Sanitize and validate LLM output
    const contact = {
      name: String(rawResult?.contact?.name || '').trim(),
      title: String(rawResult?.contact?.title || '').trim(),
      email: String(rawResult?.contact?.email || '').trim(),
      phone: String(rawResult?.contact?.phone || '').trim(),
      location: String(rawResult?.contact?.location || '').trim(),
      links: String(rawResult?.contact?.links || '').trim(),
    };

    const summary = String(rawResult?.summary || '').trim();
    const skills = String(rawResult?.skills || '').trim();

    const experience = Array.isArray(rawResult?.experience)
      ? rawResult.experience.map((item, index) => ({
          id: String(item?.id || `exp-${index + 1}`),
          role: String(item?.role || '').trim(),
          company: String(item?.company || '').trim(),
          dates: String(item?.dates || '').trim(),
          location: String(item?.location || '').trim(),
          bullets: String(item?.bullets || '').trim(),
        }))
      : [];

    const education = Array.isArray(rawResult?.education)
      ? rawResult.education.map((item, index) => ({
          id: String(item?.id || `edu-${index + 1}`),
          degree: String(item?.degree || '').trim(),
          institution: String(item?.institution || '').trim(),
          dates: String(item?.dates || '').trim(),
          location: String(item?.location || '').trim(),
        }))
      : [];

    return res.json({
      contact,
      summary,
      experience,
      education,
      skills,
    });
  } catch (err) {
    console.warn('[structure-resume] LLM structuring failed, using deterministic parser:', err.message);

    // Fall back to rule-based parser so the user never gets an error screen
    const fallback = buildFallbackStructuredResume(rawResumeText);
    return res.json(fallback);
  }
});

module.exports = router;
