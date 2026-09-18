const { Router } = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const router = Router();

const ALLOWED_TYPES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  // Some browsers send this for .docx
  'application/octet-stream': null, // will fall back to extension check
};

const ALLOWED_EXTENSIONS = ['.pdf', '.docx'];

// Store file in memory — no disk I/O, nothing persisted
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB cap
  fileFilter(_req, file, cb) {
    const ext = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
    const mimeOk = Object.keys(ALLOWED_TYPES).includes(file.mimetype);
    const extOk = ALLOWED_EXTENSIONS.includes(ext);

    if (mimeOk || extOk) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and DOCX files are supported.'));
    }
  },
});

router.post('/', upload.single('resume'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Please attach a PDF or DOCX.' });
  }

  const ext = req.file.originalname.slice(req.file.originalname.lastIndexOf('.')).toLowerCase();
  const isPdf = ext === '.pdf' || req.file.mimetype === 'application/pdf';
  const isDocx = ext === '.docx' ||
    req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (!isPdf && !isDocx) {
    return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF or DOCX.' });
  }

  try {
    let text = '';

    if (isPdf) {
      if (typeof pdfParse === 'function') {
        const result = await pdfParse(req.file.buffer);
        text = result.text;
      } else if (pdfParse && pdfParse.PDFParse) {
        const parser = new pdfParse.PDFParse({ data: req.file.buffer });
        const result = await parser.getText();
        if (typeof parser.destroy === 'function') {
          await parser.destroy();
        }
        text = result.text;
      } else {
        throw new Error('PDF parsing library could not be initialized.');
      }
    } else {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value;
      if (result.messages.length) {
        // Log warnings but don't fail — partial extraction is still useful
        console.warn('[parse-resume] mammoth warnings:', result.messages);
      }
    }

    text = text.trim();

    if (!text) {
      return res.status(422).json({
        error: 'The file appears to be empty or contains only images/scanned content with no extractable text.',
      });
    }

    return res.json({ text });
  } catch (err) {
    console.error('[parse-resume] extraction error:', err.message);
    return res.status(422).json({
      error: 'Could not extract text from this file. It may be corrupted or password-protected.',
    });
  }
});

// Multer error handler (e.g. file too large, wrong type rejected by fileFilter)
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File is too large. Maximum size is 10 MB.' });
  }
  return res.status(400).json({ error: err.message || 'File upload failed.' });
});

module.exports = router;
