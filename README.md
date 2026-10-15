# ResumeAI — AI-Powered Resume Builder

A web app for crafting polished, role-tailored resumes with live AI assistance, ATS scoring, and interactive editing.

## Tech Stack

| Layer    | Technology              |
| -------- | ----------------------- |
| Backend  | Node.js + Express       |
| Parsing  | pdf-parse + mammoth     |
| AI Engine| OpenAI / Gemini / Anthropic via native fetch |
| Frontend | Vanilla HTML / CSS / JS (Split-screen glassmorphism editor) |
| Database | SQLite (sql.js)         |

## Project Structure

```
├── server/
│   ├── index.js             # Express entry point (DB init before listen)
│   ├── db.js                # SQLite (sql.js) — DATA_DIR, schema init, atomic saves
│   ├── services/
│   │   ├── llm.js           # Multi-provider LLM service (OpenAI, Gemini, Anthropic)
│   │   └── validate.js      # Shared input validation for all API routes
│   ├── templates/
│   │   ├── classic.js       # Classic resume template (+ keyword highlighting)
│   │   ├── modern.js        # Modern resume template (+ keyword highlighting)
│   │   └── cover-letter.js  # Cover letter letterhead template
│   └── api/
│       ├── health.js        # GET /api/health
│       ├── parse-resume.js  # POST /api/parse-resume
│       ├── structure-resume.js # POST /api/structure-resume
│       ├── analyze.js       # POST /api/analyze
│       ├── cover-letter.js  # POST /api/cover-letter
│       ├── versions.js      # GET/POST/PUT/DELETE /api/versions — saved versions CRUD
│       └── export.js        # POST /api/export + /api/export/preview (PDF/DOCX)
├── public/
│   ├── index.html           # App UI (Drop zone & Split-screen editor)
│   ├── styles.css           # Glassmorphism design system & score animations
│   └── app.js               # Client editor state, debounced scoring, rewrite applier
├── .env.example             # Environment variable template
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js** ≥ 18

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure .env with your LLM API key
# (e.g. OpenAI sk-..., Google Gemini AQ... / AIzaSy..., or Anthropic sk-ant-...)
cp .env.example .env

# 3. Start development server (with watch mode)
npm run dev
```

## Deployment (Railway — recommended)

This app ships with a `Dockerfile` (Alpine + system Chromium for Puppeteer) and a `railway.json`. Railway is the best free-tier fit for this stack:

- **Docker builds work out of the box** — important because Puppeteer needs Chromium, which the Dockerfile installs cleanly.
- **Persistent volumes on the free/hobby tier** — mount a volume at `/data` and set `DATA_DIR=/data`; the SQLite file survives deploys and restarts.
- **Injects `PORT` automatically** — `server/index.js` reads it (with a safe fallback).

### Deploy steps

1. Push this repo to GitHub.
2. In [Railway](https://railway.app): **New Project → Deploy from GitHub repo**.
3. Add a **volume**: Service → Variables/Settings → Volumes → mount path `/data`.
4. Set variables: `LLM_API_KEY` (required), optional `LLM_PROVIDER`, `LLM_MODEL`, `LLM_BASE_URL`, and `DATA_DIR=/data`.
5. Deploy. Health check at `/api/health` confirms the build.

> **Note on the free tier:** Railway's trial gives limited one-off credit rather than a permanently free service; the volume itself is a small monthly add-on. If you want strictly $0/month, use **Render**'s free web-service plan instead — but note that Render's **free plan does not include persistent disks**, so the SQLite file resets on each deploy (saved versions would be lost; you'd need to upgrade or accept ephemeral storage).

## Deployment (Render — alternative)

A `render.yaml` blueprint is included: it defines the Docker web service, the `/data` disk, and marks `LLM_API_KEY` as set-in-dashboard. Deploy via **New → Blueprint** and point it at the repo. Choose the `starter`/paid plan if you need the persistent disk for saved versions.

### Local Docker test

```bash
docker build -t resumeai .
docker run -p 3000:3000 -v resumeai-data:/data -e LLM_API_KEY=your_key resumeai
```

The app is available at **http://localhost:3000**. Data is stored in SQLite at `server/resume_builder.db` (override the location with `DATA_DIR`).

### API Endpoints

| Method | Path                    | Description                                       |
| ------ | ----------------------- | ------------------------------------------------- |
| GET    | `/api/health`           | Health check (`{ status: "ok" }`)                 |
| POST   | `/api/parse-resume`     | Upload PDF/DOCX and extract plain text            |
| POST   | `/api/structure-resume` | Structure raw resume text into sections and items |
| POST   | `/api/analyze`          | Deterministic readiness and weighted skill coverage; optional AI rewrites |
| POST   | `/api/writing-assist`   | Rewrite user-provided summary or experience notes for review |
| POST   | `/api/cover-letter`     | Generate a tailored cover letter (resume + JD)    |
| GET    | `/api/versions`         | List saved versions                                |
| GET    | `/api/versions/:id`     | Load one version (resume + letter + JD)           |
| POST   | `/api/versions`         | Save a new named version                          |
| PUT    | `/api/versions/:id`     | Update a version (partial update)                 |
| POST   | `/api/versions/:id/duplicate` | Duplicate a version                        |
| DELETE | `/api/versions/:id`     | Delete a version                                  |
| POST   | `/api/export`           | Export PDF/DOCX (resume or cover letter)          |
| POST   | `/api/export/preview`   | Rendered HTML preview (resume or cover letter)    |

### Editor Features

- **Split-Screen Workspace**:
  - **Left Panel**: Editable resume fields grouped into 5 clear sections (Contact, Summary, Experience, Education, Skills) with dynamic add/remove entry controls.
  - **Right Panel**: Resume readiness and job keyword coverage, point-by-point evidence, prioritized improvements, and on-demand AI rewrites.
- **Debounced Live Analysis**: Edits trigger a 2-second debounce timer for local deterministic scoring. AI rewrites run only when requested with **Get AI rewrites**, avoiding model calls on every edit.
- **One-Click Rewrite Application**: Each suggestion includes an "Apply rewrite" button that finds the matching field, swaps in the suggested bullet point, highlights the field, and re-triggers analysis.
- **Job Description Targeting**: Paste a target job above the editor to get content-match scoring, matched-vs-missing keyword highlighting in the live preview, and a tailored cover letter draft.
- **Cover Letter Studio**: Generate a 3–4 paragraph tailored cover letter, edit it inline, watch the letterhead preview update live, and export it as its own PDF.
- **Saved Versions (SQLite)**: Name and save resume versions (e.g. "Backend role — Company X"), then list, load, update, duplicate, or delete them from the Library card.
- **Robustness**: Input validation on every endpoint, loading states on every API call, and toast notifications instead of silent failures.

### New resume studio

Open **http://localhost:3000/builder**, or choose **Create a new resume** on the home page. Choose guided, first-resume, or blank-canvas mode, then enter contact details, experience/projects, education, skills, and a summary. AI can rewrite the candidate's notes; drafts must be reviewed and explicitly applied. Seven existing templates render a live preview and export to PDF/DOCX.

The final review offers **Check ATS score** and **Open ATS improvement workspace**. Structured data, job description, and selected template transfer without a file upload. **Back to builder** brings edited content back to the studio. The active builder draft is stored in browser local storage; it is not a cloud account or multi-device library. The existing Saved versions feature remains available in the improvement workspace.

### Scoring v2

The same inputs produce the same scores, including when AI is unavailable. `/api/analyze` accepts the existing `resumeText` and optional `jobDescription`; clients should also send the structured `resume` for field-level checks. Set `includeAi: true` only to request writing suggestions. Structured fields are authoritative when both text and fields are supplied.

Readiness weights total 100: contact 20, populated sections 30, chronology 20, content evidence 20, and text quality 10. Each check returns earned/possible points, evidence, and advice. Empty entries and headings alone earn no section points. Action verbs and measured outcomes are writing heuristics, not ATS parsing requirements; no numbers should be invented to increase a score.

Job keyword coverage uses a curated English skill vocabulary with aliases and punctuation-aware boundaries. Required terms weigh 3, mentioned terms 2, preferred terms 1. Repetition and aliases cannot inflate the score. No job description, or no recognized skills, returns `null` rather than a misleading zero. Missing and matched lists are disjoint and evidence is available in the UI. Unrecognized skills, alternative qualifications, seniority, years of experience, and eligibility require manual review.

These scores are application heuristics, not an employer's ATS result or an interview prediction. Text alone cannot establish original-file layout or extraction order. [Greenhouse's parsing guidance](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) explains why tables, columns, images, and header/footer placement can affect parsing; this app does not claim to detect them from plain text.

### Verification

- `npm test`: scoring regression and real HTTP route tests with a controlled AI provider.
- `npm run test:builder`: browser flow against the running app at port 3000. Exercises creation, draft restore, AI review/apply (stubbed), templates, scoring, round-trip handoff, real binary exports, mobile layout, and light theme. Uses installed Chrome/Edge when available; override with `TEST_CHROME_PATH`. `TEST_BASE_URL` selects another local server. Screenshots are written to ignored `.test-artifacts/`.
- AI writing requires the existing provider configuration. Provider failures preserve the user's notes and do not interrupt scoring.
