/**
 * DOCX Builder
 * Generates a .docx file from structured resume data using the `docx` package.
 * Single-column, ATS-safe, matching the same content structure as the HTML templates.
 *
 * DOCX output intentionally stays typographically plain across templates — Word
 * has no equivalent for the HTML templates' colour bands or chip styling, and a
 * faithful "creative" DOCX would rely on the very constructs (shapes, tables)
 * that break ATS parsing. What varies per template is the body font and the
 * heading accent colour.
 */
const docx = require('docx');
const { TEMPLATES, DEFAULT_TEMPLATE } = require('../templates');

const {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
  Packer,
  TabStopPosition,
  TabStopType,
} = docx;

const FONT_SIZE = 21; // half-points → 10.5pt

/** Per-template body font; heading colour comes from the registry accent. */
const DOCX_FONTS = {
  classic: 'Arial',
  modern: 'Calibri',
  executive: 'Georgia',
  minimal: 'Helvetica',
  technical: 'Segoe UI',
  creative: 'Segoe UI',
  compact: 'Arial',
};

function resolveStyle(templateKey) {
  const key = Object.prototype.hasOwnProperty.call(DOCX_FONTS, templateKey)
    ? templateKey
    : DEFAULT_TEMPLATE;
  return {
    font: DOCX_FONTS[key],
    headingColor: (TEMPLATES[key]?.accent || '#2B5797').replace('#', '').toUpperCase(),
  };
}

function buildSectionHeading(text, style) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: style.headingColor },
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        font: style.font,
        size: 23, // ~11.5pt
        bold: true,
        color: style.headingColor,
      }),
    ],
  });
}

function buildBulletParagraphs(bulletsText, style) {
  const lines = String(bulletsText || '').split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => {
    const cleaned = line.replace(/^[•\-–—*]\s*/, '');
    return new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 40 },
      children: [new TextRun({ text: cleaned, font: style.font, size: FONT_SIZE })],
    });
  });
}

/** "Title <tab> Dates" line with the dates flushed right. */
function buildTitleWithDates(title, dates, style) {
  const runs = [
    new TextRun({ text: title || '', font: style.font, size: FONT_SIZE, bold: true, color: '1A1A1A' }),
  ];
  if (dates) {
    runs.push(
      new TextRun({ text: '\t', font: style.font }),
      new TextRun({ text: dates, font: style.font, size: 19, color: '555555' })
    );
  }
  return new Paragraph({
    spacing: { before: 100, after: 20 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: runs,
  });
}

/** Pipe-separated meta line (company | location, institution | location…). */
function buildMetaLine(parts, style, { after = 40, italicFirst = false } = {}) {
  const present = parts.filter(Boolean);
  if (!present.length) return null;
  return new Paragraph({
    spacing: { after },
    children: present.flatMap((part, i) => {
      const runs = [];
      if (i > 0) runs.push(new TextRun({ text: '  |  ', font: style.font, size: 19, color: 'BBBBBB' }));
      runs.push(new TextRun({
        text: part, font: style.font, size: 19, color: '555555', italics: italicFirst && i === 0,
      }));
      return runs;
    }),
  });
}

/** Shared page setup for every generated document. */
function wrapDocument(children) {
  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 940, right: 940 }, // 0.5in / ~0.65in
          },
        },
        children,
      },
    ],
  });
}

/** Name / title / contact block shared by the resume and the cover letter. */
function buildLetterhead(contact, style, { contactSpacing = 200 } = {}) {
  const c = contact || {};
  const children = [];

  if (c.name) {
    children.push(new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: c.name, font: style.font, size: 44, bold: true, color: '111111' })],
    }));
  }

  if (c.title) {
    children.push(new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: c.title, font: style.font, size: 23, color: '444444' })],
    }));
  }

  const contactParts = [c.email, c.phone, c.location, c.links].filter(Boolean);
  if (contactParts.length) {
    children.push(new Paragraph({
      spacing: { after: contactSpacing },
      children: contactParts.flatMap((part, i) => {
        const runs = [];
        if (i > 0) runs.push(new TextRun({ text: '  |  ', font: style.font, size: 19, color: 'AAAAAA' }));
        runs.push(new TextRun({ text: part, font: style.font, size: 19, color: '555555' }));
        return runs;
      }),
    }));
  }

  return children;
}

/**
 * Build a resume .docx.
 * @param {object} resume       structured resume
 * @param {string} templateKey  template whose font/accent to mirror
 */
async function buildDocx(resume, templateKey = DEFAULT_TEMPLATE) {
  const style = resolveStyle(templateKey);
  const children = [...buildLetterhead(resume.contact, style)];

  // ===== Summary =====
  if (resume.summary) {
    children.push(buildSectionHeading('Professional Summary', style));
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: resume.summary, font: style.font, size: FONT_SIZE, color: '333333' })],
    }));
  }

  // ===== Experience =====
  if (resume.experience?.length) {
    children.push(buildSectionHeading('Professional Experience', style));
    for (const item of resume.experience) {
      children.push(buildTitleWithDates(item.role, item.dates, style));
      const meta = buildMetaLine([item.company, item.location], style, { italicFirst: true });
      if (meta) children.push(meta);
      if (item.bullets) children.push(...buildBulletParagraphs(item.bullets, style));
    }
  }

  // ===== Education =====
  if (resume.education?.length) {
    children.push(buildSectionHeading('Education', style));
    for (const item of resume.education) {
      children.push(buildTitleWithDates(item.degree, item.dates, style));
      const meta = buildMetaLine([item.institution, item.location], style, { after: 60 });
      if (meta) children.push(meta);
    }
  }

  // ===== Skills =====
  if (resume.skills) {
    children.push(buildSectionHeading('Skills', style));
    children.push(new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: resume.skills, font: style.font, size: FONT_SIZE, color: '333333' })],
    }));
  }

  return Packer.toBuffer(wrapDocument(children));
}

/**
 * Build a cover letter .docx: the same letterhead as the resume, a date line,
 * then the letter body one paragraph per blank-line-separated block.
 */
async function buildCoverLetterDocx(resume, letter, templateKey = DEFAULT_TEMPLATE) {
  const style = resolveStyle(templateKey);
  const children = [...buildLetterhead(resume?.contact, style, { contactSpacing: 360 })];

  children.push(new Paragraph({
    spacing: { after: 300 },
    children: [new TextRun({
      text: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      font: style.font,
      size: FONT_SIZE,
      color: '444444',
    })],
  }));

  const paragraphs = String(letter || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  for (const para of paragraphs) {
    // Preserve single newlines inside a paragraph (e.g. the signature block).
    const lines = para.split('\n');
    children.push(new Paragraph({
      spacing: { after: 240, line: 300 },
      children: lines.flatMap((line, i) => {
        const runs = i > 0 ? [new TextRun({ break: 1 })] : [];
        runs.push(new TextRun({ text: line, font: style.font, size: FONT_SIZE, color: '1A1A1A' }));
        return runs;
      }),
    }));
  }

  return Packer.toBuffer(wrapDocument(children));
}

module.exports = { buildDocx, buildCoverLetterDocx };
