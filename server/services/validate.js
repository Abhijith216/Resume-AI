/**
 * Shared, dependency-free input validation for API routes.
 * Each validator returns an array of error strings; empty array = valid.
 */

const { TEMPLATE_KEYS, isTemplate } = require('../templates');

function isNonEmptyString(v, max) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

function isOptionalString(v, max) {
  return v === undefined || v === null || (typeof v === 'string' && v.length <= max);
}

function isSafeId(v) {
  // IDs are generated client-side: word chars, hyphens, 1-64 chars
  return typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
}

/**
 * Validate a structured resume object (same shape the editor produces).
 * Returns array of error strings.
 */
function validateResume(resume) {
  const errors = [];

  if (!resume || typeof resume !== 'object' || Array.isArray(resume)) {
    return ['"resume" must be an object.'];
  }

  const c = resume.contact || {};
  const stringFields = [
    ['contact.name', c.name], ['contact.title', c.title], ['contact.email', c.email],
    ['contact.phone', c.phone], ['contact.location', c.location], ['contact.links', c.links],
    ['summary', resume.summary], ['skills', resume.skills],
  ];
  for (const [field, value] of stringFields) {
    if (!isOptionalString(value, 5000)) errors.push(`"${field}" must be a string of at most 5000 characters.`);
  }
  if (c.email && typeof c.email === 'string' && c.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) {
    errors.push('"contact.email" does not look like a valid email address.');
  }

  if (resume.experience !== undefined && !Array.isArray(resume.experience)) {
    errors.push('"resume.experience" must be an array.');
  } else if (Array.isArray(resume.experience)) {
    if (resume.experience.length > 50) errors.push('"resume.experience" has too many entries (max 50).');
    resume.experience.forEach((item, i) => {
      if (!item || typeof item !== 'object') { errors.push(`"resume.experience[${i}]" must be an object.`); return; }
      if (!isSafeId(item.id)) errors.push(`"resume.experience[${i}].id" is missing or invalid.`);
      for (const key of ['role', 'company', 'dates', 'location', 'bullets']) {
        if (!isOptionalString(item[key], 10000)) errors.push(`"resume.experience[${i}].${key}" must be a string of at most 10000 characters.`);
      }
    });
  }

  if (resume.education !== undefined && !Array.isArray(resume.education)) {
    errors.push('"resume.education" must be an array.');
  } else if (Array.isArray(resume.education)) {
    if (resume.education.length > 50) errors.push('"resume.education" has too many entries (max 50).');
    resume.education.forEach((item, i) => {
      if (!item || typeof item !== 'object') { errors.push(`"resume.education[${i}]" must be an object.`); return; }
      if (!isSafeId(item.id)) errors.push(`"resume.education[${i}].id" is missing or invalid.`);
      for (const key of ['degree', 'institution', 'dates', 'location']) {
        if (!isOptionalString(item[key], 5000)) errors.push(`"resume.education[${i}].${key}" must be a string of at most 5000 characters.`);
      }
    });
  }

  return errors;
}

/** Validate /api/analyze body. */
function validateAnalyzeBody(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['Request body must be an object.'];
  if (!isNonEmptyString(body.resumeText, 200000)) {
    errors.push('"resumeText" is required and must be a non-empty string of at most 200000 characters.');
  }
  if (!isOptionalString(body.jobDescription, 100000)) {
    errors.push('"jobDescription" must be a string of at most 100000 characters.');
  }
  return errors;
}

/** Validate /api/cover-letter body. */
function validateCoverLetterBody(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['Request body must be an object.'];
  errors.push(...validateResume(body.resume));
  if (!isOptionalString(body.jobDescription, 100000)) {
    errors.push('"jobDescription" must be a string of at most 100000 characters.');
  }
  return errors;
}

/** Validate /api/export body (resume export or cover letter export/preview). */
function validateExportBody(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['Request body must be an object.'];

  if (body.format !== undefined && !['pdf', 'docx'].includes(body.format)) {
    errors.push('"format" must be "pdf" or "docx".');
  }

  const isCoverLetter = body.coverLetter !== undefined;
  if (isCoverLetter) {
    if (typeof body.coverLetter !== 'string' || body.coverLetter.length > 100000) {
      errors.push('"coverLetter" must be a string of at most 100000 characters.');
    }
    errors.push(...validateResume(body.resume));
    return errors;
  }

  errors.push(...validateResume(body.resume));
  if (body.template !== undefined && !isTemplate(body.template)) {
    errors.push(`"template" must be one of: ${TEMPLATE_KEYS.join(', ')}.`);
  }
  if (body.keywords !== undefined) {
    const k = body.keywords;
    if (!k || typeof k !== 'object' || Array.isArray(k)) {
      errors.push('"keywords" must be an object with optional "matched" and "missing" arrays.');
    } else {
      for (const key of ['matched', 'missing']) {
        if (k[key] !== undefined) {
          if (!Array.isArray(k[key]) || k[key].some((t) => typeof t !== 'string' || t.length > 100)) {
            errors.push(`"keywords.${key}" must be an array of short strings.`);
          }
        }
      }
    }
  }
  return errors;
}

/** Validate /api/versions save body. */
function validateVersionSaveBody(body) {
  const errors = [];
  if (!body || typeof body !== 'object') return ['Request body must be an object.'];
  if (!isNonEmptyString(body.name, 120)) {
    errors.push('"name" is required and must be a non-empty string of at most 120 characters.');
  }
  errors.push(...validateResume(body.resume));
  if (!isOptionalString(body.coverLetter, 100000)) {
    errors.push('"coverLetter" must be a string of at most 100000 characters.');
  }
  if (!isOptionalString(body.jobDescription, 100000)) {
    errors.push('"jobDescription" must be a string of at most 100000 characters.');
  }
  return errors;
}

/** Validate a version id route param. */
function validateVersionId(id) {
  return isSafeId(id) ? [] : ['Version id must contain only letters, numbers, hyphens, or underscores (max 64 chars).'];
}

module.exports = {
  validateResume,
  validateAnalyzeBody,
  validateCoverLetterBody,
  validateExportBody,
  validateVersionSaveBody,
  validateVersionId,
};
