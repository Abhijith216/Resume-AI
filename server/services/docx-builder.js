/**
 * DOCX Builder
 * Generates a .docx file from structured resume data using the `docx` package.
 * Single-column, ATS-safe, matching the same content structure as the HTML templates.
 */
const docx = require('docx');

const {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
  TabStopPosition,
  TabStopType,
} = docx;

const FONT = 'Calibri';
const FONT_SIZE = 21; // half-points → 10.5pt
const HEADING_COLOR = '2B5797';

function buildSectionHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 100 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: HEADING_COLOR },
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        font: FONT,
        size: 23, // ~11.5pt
        bold: true,
        color: HEADING_COLOR,
      }),
    ],
  });
}

function buildBulletParagraphs(bulletsText) {
  const lines = String(bulletsText || '').split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => {
    const cleaned = line.replace(/^[•\-–—*]\s*/, '');
    return new Paragraph({
      bullet: { level: 0 },
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: cleaned,
          font: FONT,
          size: FONT_SIZE,
        }),
      ],
    });
  });
}

async function buildDocx(resume) {
  const c = resume.contact || {};
  const children = [];

  // ===== Name =====
  if (c.name) {
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: c.name,
            font: FONT,
            size: 44, // 22pt
            bold: true,
            color: '111111',
          }),
        ],
      })
    );
  }

  // ===== Title =====
  if (c.title) {
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: c.title,
            font: FONT,
            size: 23,
            color: '444444',
          }),
        ],
      })
    );
  }

  // ===== Contact Line =====
  const contactParts = [c.email, c.phone, c.location, c.links].filter(Boolean);
  if (contactParts.length) {
    children.push(
      new Paragraph({
        spacing: { after: 200 },
        children: contactParts.flatMap((part, i) => {
          const runs = [];
          if (i > 0) {
            runs.push(new TextRun({ text: '  |  ', font: FONT, size: 19, color: 'AAAAAA' }));
          }
          runs.push(new TextRun({ text: part, font: FONT, size: 19, color: '555555' }));
          return runs;
        }),
      })
    );
  }

  // ===== Summary =====
  if (resume.summary) {
    children.push(buildSectionHeading('Professional Summary'));
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: resume.summary,
            font: FONT,
            size: FONT_SIZE,
            color: '333333',
          }),
        ],
      })
    );
  }

  // ===== Experience =====
  if (resume.experience?.length) {
    children.push(buildSectionHeading('Professional Experience'));

    for (const item of resume.experience) {
      // Role + Dates on same line using tab stop
      const roleRuns = [
        new TextRun({
          text: item.role || '',
          font: FONT,
          size: FONT_SIZE,
          bold: true,
          color: '1A1A1A',
        }),
      ];
      if (item.dates) {
        roleRuns.push(
          new TextRun({ text: '\t', font: FONT }),
          new TextRun({
            text: item.dates,
            font: FONT,
            size: 19,
            color: '555555',
          })
        );
      }

      children.push(
        new Paragraph({
          spacing: { before: 100, after: 20 },
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: roleRuns,
        })
      );

      // Company + Location
      const metaParts = [item.company, item.location].filter(Boolean);
      if (metaParts.length) {
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            children: metaParts.flatMap((part, i) => {
              const runs = [];
              if (i > 0) {
                runs.push(new TextRun({ text: '  |  ', font: FONT, size: 19, color: 'BBBBBB' }));
              }
              runs.push(new TextRun({ text: part, font: FONT, size: 19, color: '555555', italics: i === 0 }));
              return runs;
            }),
          })
        );
      }

      // Bullets
      if (item.bullets) {
        children.push(...buildBulletParagraphs(item.bullets));
      }
    }
  }

  // ===== Education =====
  if (resume.education?.length) {
    children.push(buildSectionHeading('Education'));

    for (const item of resume.education) {
      const degreeRuns = [
        new TextRun({
          text: item.degree || '',
          font: FONT,
          size: FONT_SIZE,
          bold: true,
          color: '1A1A1A',
        }),
      ];
      if (item.dates) {
        degreeRuns.push(
          new TextRun({ text: '\t', font: FONT }),
          new TextRun({
            text: item.dates,
            font: FONT,
            size: 19,
            color: '555555',
          })
        );
      }

      children.push(
        new Paragraph({
          spacing: { before: 100, after: 20 },
          tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
          children: degreeRuns,
        })
      );

      const metaParts = [item.institution, item.location].filter(Boolean);
      if (metaParts.length) {
        children.push(
          new Paragraph({
            spacing: { after: 60 },
            children: metaParts.flatMap((part, i) => {
              const runs = [];
              if (i > 0) {
                runs.push(new TextRun({ text: '  |  ', font: FONT, size: 19, color: 'BBBBBB' }));
              }
              runs.push(new TextRun({ text: part, font: FONT, size: 19, color: '555555' }));
              return runs;
            }),
          })
        );
      }
    }
  }

  // ===== Skills =====
  if (resume.skills) {
    children.push(buildSectionHeading('Skills'));
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: resume.skills,
            font: FONT,
            size: FONT_SIZE,
            color: '333333',
          }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,   // 0.5in
              bottom: 720,
              left: 940,  // ~0.65in
              right: 940,
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

module.exports = { buildDocx };
