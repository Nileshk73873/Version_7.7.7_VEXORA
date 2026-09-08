# 🛡️ Vulnora — Automated Web Security Assessment Tool

> An AI-powered web security scanner that detects common vulnerabilities in authorized web applications and generates developer-friendly remediation guidance using Google Gemini.

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Database Schema](#database-schema)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Scanner Modules](#scanner-modules)
- [Scoring Engine](#scoring-engine)
- [AI Remediation Engine](#ai-remediation-engine)
- [Frontend](#frontend-handoff-notes)
- [Running the App](#running-the-app)
- [Legal Disclaimer](#legal-disclaimer)

---

## ✨ Features

| Feature                 | Description                                           |
| ----------------------- | ----------------------------------------------------- |
| 🔍 Reconnaissance       | DNS records, SSL/TLS info, tech stack fingerprinting  |
| 🛡️ Header Analysis      | 8 security headers checked (CSP, HSTS, X-Frame, etc.) |
| 💉 XSS Scanner          | Reflected XSS payload injection across query params   |
| 🌐 CORS Scanner         | Origin reflection and wildcard misconfiguration       |
| 🔐 CSRF Scanner         | Form token detection + SameSite cookie check          |
| 🖼️ Clickjacking Scanner | X-Frame-Options + CSP frame-ancestors                 |
| 📊 Health Score         | 0–100 CVSS-weighted Security Health Score with grade  |
| 🤖 AI Remediation       | Gemini-generated plain-English fix + copy-paste code  |
| 🗄️ PostgreSQL           | Persistent scan history with full relational schema   |
| 📥 Report Export        | Full JSON report download                             |
| ⚡ Rate Limiting        | 10 scans/hour per IP                                  |
| 🔒 Guardrails           | Private IP blocking + authorization consent           |

---

## 🧱 Tech Stack

| Layer        | Technology                             |
| ------------ | -------------------------------------- |
| Backend      | Node.js 18+ · Express.js               |
| Database     | PostgreSQL 14+ · `pg` (node-postgres)  |
| AI           | Google Gemini API (`gemini-1.5-flash`) |
| HTTP Client  | Axios                                  |
| HTML Parsing | Cheerio                                |
| Logging      | Winston                                |
| Security     | Helmet · express-rate-limit            |
| Frontend     | HTML5 · Vanilla CSS · Vanilla JS       |

---

## 📁 Project Structure

```
project/
├── public/                     ← Frontend (handoff-ready)
│   ├── index.html              ← Dashboard UI (all sections)
│   ├── style.css               ← Full design system (CSS variables, dark theme)
│   └── app.js                  ← Frontend logic (scan, poll, render, history)
│
├── server/
│   ├── server.js               ← Express app (middleware, routes, static serve)
│   ├── orchestrator.js         ← Scan pipeline coordinator
│   ├── scorer.js               ← Risk score computation (0–100)
│   ├── aiRemediator.js         ← Google Gemini API integration
│   │
│   ├── db/
│   │   ├── index.js            ← PostgreSQL connection pool (shared)
│   │   ├── schema.sql          ← Full DB schema (tables, views, indexes)
│   │   └── init.js             ← DB setup script (npm run db:init)
│   │
│   ├── modules/                ← Individual scanner modules
│   │   ├── recon.js            ← DNS, SSL, tech stack detection
│   │   ├── headerAnalyzer.js   ← Security header analysis
│   │   ├── xssScanner.js       ← Reflected XSS detection
│   │   ├── corsScanner.js      ← CORS misconfiguration detection
│   │   ├── csrfScanner.js      ← CSRF protection check
│   │   └── clickjackScanner.js ← Clickjacking detection
│   │
│   ├── routes/
│   │   ├── scan.js             ← POST/GET/DELETE /api/scan
│   │   └── report.js           ← GET /api/report/:scanId
│   │
│   └── utils/
│       ├── logger.js           ← Winston structured logger
│       └── validator.js        ← URL validation + private IP blocking
│
├── logs/                       ← Auto-created by Winston
├── .env                        ← Your environment config (from .env.example)
├── .env.example                ← Template for env vars
├── .gitignore
└── package.json
```

---

## ✅ Prerequisites

- **Node.js** >= 18.0.0 → [nodejs.org](https://nodejs.org)
- **PostgreSQL** >= 14 → [postgresql.org](https://www.postgresql.org/download/)
- **Google Gemini API Key** (free) → [aistudio.google.com](https://aistudio.google.com)

---

## 🚀 Setup & Installation

### 1. Clone / Open the project

```bash
cd path/to/project
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create your `.env` file

```bash
copy .env.example .env
```

Then open `.env` and fill in your values (see [Environment Variables](#environment-variables)).

### 4. Create the PostgreSQL database

```sql
-- In psql or pgAdmin:
CREATE DATABASE vulnora ;
```

### 5. Initialize the database schema

```bash
npm run db:init
```

This creates all tables, views, and indexes. To reset:

```bash
npm run db:reset
```

### 6. Start the server

```bash
npm run dev    # Development (auto-restart on changes)
npm start      # Production
```

### 7. Open the app

```
http://localhost:5000
```

---

## 🗄️ Database Schema

### Tables

#### `scans`

Main scan job record. One row per scan.

| Column          | Type        | Description                                    |
| --------------- | ----------- | ---------------------------------------------- |
| `id`            | UUID PK     | Auto-generated scan ID                         |
| `target_url`    | TEXT        | The scanned URL                                |
| `status`        | VARCHAR     | `pending` · `running` · `completed` · `failed` |
| `health_score`  | INTEGER     | 0–100 security score                           |
| `grade`         | VARCHAR     | Excellent · Good · Fair · Poor · Critical      |
| `started_at`    | TIMESTAMPTZ | Scan start timestamp                           |
| `completed_at`  | TIMESTAMPTZ | Scan end timestamp                             |
| `duration_ms`   | INTEGER     | Total scan duration                            |
| `error_message` | TEXT        | Error details if failed                        |
| `ip_address`    | VARCHAR     | Requester IP (for audit)                       |

#### `recon_results`

DNS, SSL, and tech stack data for each scan.

| Column             | Type            | Description              |
| ------------------ | --------------- | ------------------------ |
| `scan_id`          | UUID FK → scans | Parent scan              |
| `ip_addresses`     | TEXT[]          | Resolved IPv4 addresses  |
| `dns_records`      | JSONB           | `{ mx, txt, ns }` arrays |
| `ssl_valid`        | BOOLEAN         | Certificate validity     |
| `ssl_issuer`       | TEXT            | CA name                  |
| `ssl_expires_at`   | TIMESTAMPTZ     | Certificate expiry       |
| `ssl_days_left`    | INTEGER         | Days until expiry        |
| `server_header`    | TEXT            | Raw Server header value  |
| `tech_stack`       | TEXT[]          | Detected technologies    |
| `response_time_ms` | INTEGER         | Target response time     |

#### `findings`

One row per vulnerability check (found or not).

| Column        | Type            | Description                                               |
| ------------- | --------------- | --------------------------------------------------------- |
| `scan_id`     | UUID FK → scans | Parent scan                                               |
| `vuln_id`     | VARCHAR         | e.g. `XSS_REFLECTED`, `MISSING_CSP`                       |
| `name`        | VARCHAR         | Human-readable name                                       |
| `category`    | VARCHAR         | `header` · `injection` · `cors` · `csrf` · `clickjacking` |
| `severity`    | VARCHAR         | `CRITICAL` · `HIGH` · `MEDIUM` · `LOW` · `INFO`           |
| `cvss_score`  | NUMERIC         | CVSS v3 base score                                        |
| `cwe`         | VARCHAR         | CWE identifier                                            |
| `owasp`       | VARCHAR         | OWASP Top 10 category                                     |
| `found`       | BOOLEAN         | Whether the issue was detected                            |
| `evidence`    | TEXT            | Specific evidence/proof                                   |
| `description` | TEXT            | Technical description                                     |
| `raw_data`    | JSONB           | Scanner raw output                                        |

#### `ai_remediations`

AI-generated fix guidance, linked to a finding.

| Column              | Type               | Description                                  |
| ------------------- | ------------------ | -------------------------------------------- |
| `finding_id`        | UUID FK → findings | Parent finding                               |
| `scan_id`           | UUID FK → scans    | Parent scan (for fast lookups)               |
| `explanation`       | TEXT               | Plain-English explanation                    |
| `steps`             | JSONB              | Array of fix step strings                    |
| `code_fix`          | TEXT               | Copy-pasteable code snippet                  |
| `code_language`     | VARCHAR            | `nodejs` · `python` · `php` · `nginx` · etc. |
| `prevention`        | JSONB              | Array of prevention tips                     |
| `ai_model`          | VARCHAR            | Gemini model used                            |
| `prompt_tokens`     | INTEGER            | Tokens used in prompt                        |
| `completion_tokens` | INTEGER            | Tokens in response                           |

#### View: `scan_summary`

Pre-aggregated scan + severity counts. Used by `GET /api/scan`.

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Server
PORT=5000
NODE_ENV=development

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vulnora
DB_USER=postgres
DB_PASSWORD=your_postgres_password

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# Rate Limiting
RATE_LIMIT_WINDOW_MS=3600000   # 1 hour
RATE_LIMIT_MAX=10               # max 10 scans per hour per IP

# Scanner
SCAN_TIMEOUT_MS=30000
```

---

## 📡 API Reference

### Base URL: `http://localhost:5000/api`

---

### `POST /api/scan`

**Start a new scan.**

**Request Body:**

```json
{
  "url": "https://example.com",
  "authorized": true
}
```

**Response `202 Accepted`:**

```json
{
  "scanId": "uuid-here",
  "status": "pending",
  "message": "Scan started. Poll /api/scan/:id for results.",
  "pollUrl": "/api/scan/uuid-here"
}
```

**Error Responses:**

- `400` — Invalid URL or validation failed
- `403` — `authorized` not set to `true`
- `429` — Rate limit exceeded

---

### `GET /api/scan/:id`

**Get scan status and results.**

- If `status` is `pending` or `running`, returns status only.
- If `status` is `completed`, returns full report.

**Response (completed):**

```json
{
  "scanId": "...",
  "status": "completed",
  "targetUrl": "https://example.com",
  "startedAt": "...",
  "completedAt": "...",
  "durationMs": 12500,
  "score": {
    "score": 62,
    "grade": "Fair"
  },
  "recon": {
    "ipAddresses": ["93.184.216.34"],
    "ssl": { "valid": true, "issuer": "DigiCert", "daysLeft": 120 },
    "techStack": ["Nginx", "React"],
    "serverHeader": "nginx",
    "responseTimeMs": 340,
    "dnsRecords": { "mx": [], "txt": [], "ns": [] }
  },
  "findings": [
    {
      "id": "MISSING_CSP",
      "name": "Content-Security-Policy (CSP)",
      "category": "header",
      "severity": "HIGH",
      "cvss": 7.5,
      "cwe": "CWE-693",
      "owasp": "A05:2021",
      "found": true,
      "evidence": "Header completely absent",
      "description": "...",
      "remediation": {
        "explanation": "...",
        "steps": ["step 1", "step 2"],
        "code_fix": "// Express.js example\napp.use(helmet.contentSecurityPolicy({...}))",
        "code_language": "nodejs",
        "prevention": ["tip 1", "tip 2", "tip 3"]
      }
    }
  ],
  "summary": {
    "total": 5,
    "critical": 0,
    "high": 3,
    "medium": 1,
    "low": 1
  }
}
```

---

### `GET /api/scan`

**List recent scans (last 20).**

```json
{
  "scans": [
    {
      "id": "...",
      "target_url": "https://example.com",
      "status": "completed",
      "health_score": 62,
      "grade": "Fair",
      "total_findings": 5,
      "critical_count": 0,
      "high_count": 3,
      "started_at": "..."
    }
  ]
}
```

---

### `DELETE /api/scan/:id`

**Delete a scan and all its data.**

```json
{ "message": "Scan deleted." }
```

---

### `GET /api/report/:scanId`

**Download the full scan as a JSON report.**

Returns a `.json` file attachment with complete scan data.

---

### `GET /api/health`

**Server health check.**

```json
{
  "status": "ok",
  "timestamp": "...",
  "version": "1.0.0",
  "env": "development"
}
```

---

## 🔬 Scanner Modules

Each module in `server/modules/` follows the same interface:

```js
// Returns a finding object:
{
  id:          'VULN_ID',           // Unique identifier
  name:        'Human Name',        // Display name
  category:    'header|injection|cors|csrf|clickjacking',
  severity:    'CRITICAL|HIGH|MEDIUM|LOW|INFO',
  cvss:        7.5,                 // CVSS v3 base score
  cwe:         'CWE-79',            // CWE identifier
  owasp:       'A03:2021',          // OWASP category
  found:       true,                // Was the issue detected?
  evidence:    'Specific proof...', // Human-readable evidence
  description: 'Technical desc...', // What this means
  raw_data:    {}                   // Scanner-specific raw data
}
```

### Module Summary

| File                  | Checks                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `recon.js`            | DNS A/MX/TXT/NS, SSL validity/expiry/issuer, tech stack detection, server header                                      |
| `headerAnalyzer.js`   | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Server version, X-Powered-By |
| `xssScanner.js`       | Injects 5 XSS payloads into URL query params, checks for unescaped reflection                                         |
| `corsScanner.js`      | Sends forged Origin headers, checks Access-Control-Allow-Origin reflection + wildcard                                 |
| `csrfScanner.js`      | Inspects HTML forms for CSRF token fields, checks SameSite cookie attributes                                          |
| `clickjackScanner.js` | Checks X-Frame-Options validity + CSP frame-ancestors directive                                                       |

---

## 📊 Scoring Engine

**File:** `server/scorer.js`

```
Security Health Score = 100 − Σ(severity_weight × occurrences)

Severity Weights:
  CRITICAL → −25 pts
  HIGH     → −15 pts
  MEDIUM   → −8  pts
  LOW      → −3  pts
  INFO     → −1  pt

Bonus:
  +2 pts if SSL is valid with > 30 days remaining

Floor: 0 (score never goes negative)

Grade Bands:
  90–100 → Excellent  🟢
  70–89  → Good       🟡
  50–69  → Fair       🟠
  30–49  → Poor       🔴
   0–29  → Critical   💀
```

---

## 🤖 AI Remediation Engine

**File:** `server/aiRemediator.js`

### How it works

1. After all scanners finish, findings with severity `CRITICAL`, `HIGH`, or `MEDIUM` are sent to Gemini.
2. A structured prompt is built per finding, asking for:
   - Plain-English explanation (for junior devs)
   - Step-by-step fix instructions
   - Copy-pasteable code in the most relevant language
   - 3 prevention best practices
3. Gemini returns structured JSON, parsed and stored in `ai_remediations`.
4. Results are sequentially processed (500ms delay between calls to respect rate limits).

### Prompt Template

```
You are a senior web security engineer providing remediation guidance.
Vulnerability: {name} ({cwe})
Severity: {severity}
Evidence: {evidence}
...
Return JSON: { explanation, steps[], code_fix, code_language, prevention[] }
```

### Getting a Gemini API Key (Free)

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **Get API Key** → Create API key
3. Copy the key into your `.env` as `GEMINI_API_KEY`

---

## 🎨 Frontend Handoff Notes

The frontend (`public/`) is intentionally kept clean and well-structured for another developer to build on.

### Files

| File         | Purpose                                                                        |
| ------------ | ------------------------------------------------------------------------------ |
| `index.html` | Full page structure with semantic HTML, all IDs documented                     |
| `style.css`  | Complete design system — CSS custom properties at top, all components labelled |
| `app.js`     | All logic in clearly named functions, state at top, no framework dependencies  |

### CSS Custom Properties (Design Tokens)

All colors, spacing, and effects are defined as CSS variables in `:root` at the top of `style.css`. Change these to retheme the entire app.

```css
--accent: #00ff88; /* Primary brand color */
--bg-base: #080d14; /* Page background */
--sev-critical: #ff3b3b; /* Critical severity */
--sev-high: #ff6b35; /* High severity */
/* ... etc */
```

### Key JS Functions for Extension

| Function                    | Description                                     |
| --------------------------- | ----------------------------------------------- |
| `renderResults(data)`       | Main renderer — called with completed scan JSON |
| `renderFindings(findings)`  | Renders the filtered findings list              |
| `renderRecon(recon)`        | Renders recon panel                             |
| `buildFindingHTML(finding)` | Returns HTML string for one finding card        |
| `loadHistory()`             | Fetches and renders scan history                |
| `startScan()`               | Initiates a new scan                            |

### API Base URL

Change `API_BASE` at the top of `app.js` if the backend moves:

```js
const API_BASE = "http://localhost:5000/api";
```

---

## ▶️ Running the App

```bash
# Install
npm install

# Initialize database (one time)
npm run db:init

# Development (auto-restart)
npm run dev

# Production
npm start
```

Access at: **http://localhost:5000**

---

## ⚠️ Legal Disclaimer

This tool is designed for **authorized security testing only**.

- **Only scan systems you own or have explicit written permission to test.**
- Unauthorized scanning of systems is illegal under laws including the Computer Fraud and Abuse Act (CFAA), Computer Misuse Act (CMA), and similar legislation worldwide.
- The authors accept no liability for misuse.

Recommended safe test targets:

- Your own local development servers
- `https://httpbin.org` (public test HTTP service)
- Intentionally vulnerable apps: DVWA, WebGoat, Juice Shop (run locally)
