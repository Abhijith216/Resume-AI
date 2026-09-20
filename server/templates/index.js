/**
 * Template registry.
 *
 * Single source of truth for which resume templates exist. The export route,
 * request validation, and the client-side template gallery all read from here,
 * so adding a template is a one-line change plus its render module.
 *
 * Every template is single-column and ATS-safe — see ./shared.js.
 */

const { renderClassic } = require('./classic');
const { renderModern } = require('./modern');
const { renderExecutive } = require('./executive');
const { renderMinimal } = require('./minimal');
const { renderTechnical } = require('./technical');
const { renderCreative } = require('./creative');
const { renderCompact } = require('./compact');

const TEMPLATES = {
  classic: {
    key: 'classic',
    name: 'Classic',
    tagline: 'Arial · Ruled sections',
    bestFor: 'Finance, law, government, and any traditional industry.',
    accent: '#333333',
    variant: 'ruled',
    render: renderClassic,
  },
  modern: {
    key: 'modern',
    name: 'Modern',
    tagline: 'Calibri · Accent bars',
    bestFor: 'Business, operations, and general corporate roles.',
    accent: '#2b5797',
    variant: 'bars',
    render: renderModern,
  },
  executive: {
    key: 'executive',
    name: 'Executive',
    tagline: 'Georgia · Centred letterhead',
    bestFor: 'Director, VP, and C-suite candidates.',
    accent: '#14243d',
    variant: 'centred',
    render: renderExecutive,
  },
  minimal: {
    key: 'minimal',
    name: 'Minimal',
    tagline: 'Helvetica · No rules',
    bestFor: 'Design, product, research, and academia.',
    accent: '#a8a8a8',
    variant: 'airy',
    render: renderMinimal,
  },
  technical: {
    key: 'technical',
    name: 'Technical',
    tagline: 'Mono headings · Skill chips',
    bestFor: 'Engineering, data, DevOps, and security.',
    accent: '#0d7a6f',
    variant: 'chips',
    render: renderTechnical,
  },
  creative: {
    key: 'creative',
    name: 'Creative',
    tagline: 'Colour band · Bold accents',
    bestFor: 'Marketing, brand, content, and creative direction.',
    accent: '#7c3aed',
    variant: 'band',
    render: renderCreative,
  },
  compact: {
    key: 'compact',
    name: 'Compact',
    tagline: 'Dense · One-page fit',
    bestFor: 'Long careers that need to stay on a single page.',
    accent: '#1f1f1f',
    variant: 'dense',
    render: renderCompact,
  },
};

const DEFAULT_TEMPLATE = 'classic';

/** Template keys, in gallery order. */
const TEMPLATE_KEYS = Object.keys(TEMPLATES);

/** True when `key` names a registered template. */
function isTemplate(key) {
  return typeof key === 'string' && Object.prototype.hasOwnProperty.call(TEMPLATES, key);
}

/** Resolve a template key to its render function, falling back to the default. */
function getRenderer(key) {
  return (isTemplate(key) ? TEMPLATES[key] : TEMPLATES[DEFAULT_TEMPLATE]).render;
}

/** Serialisable metadata for the client gallery (no functions). */
function listTemplates() {
  return TEMPLATE_KEYS.map((key) => {
    const { render, ...meta } = TEMPLATES[key];
    return meta;
  });
}

module.exports = {
  TEMPLATES,
  TEMPLATE_KEYS,
  DEFAULT_TEMPLATE,
  isTemplate,
  getRenderer,
  listTemplates,
};
