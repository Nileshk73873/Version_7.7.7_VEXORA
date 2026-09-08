-- ============================================================
--  Web Security Assessment Tool — PostgreSQL Schema
--  Run: psql -U postgres -f server/db/schema.sql
--       OR use: npm run db:init
-- ============================================================

-- Create database (run separately if needed)
-- CREATE DATABASE websec_db;

-- ─────────────────────────────────────────
-- SCANS table — one row per scan job
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_url    TEXT NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- pending | running | completed | failed
  health_score  INTEGER,
  grade         VARCHAR(10),
    -- Excellent | Good | Fair | Poor | Critical
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  duration_ms   INTEGER,
  error_message TEXT,
  ip_address    VARCHAR(45),
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- RECON_RESULTS table — recon data per scan
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recon_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id         UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  ip_addresses    TEXT[],
  dns_records     JSONB,
  ssl_valid       BOOLEAN,
  ssl_issuer      TEXT,
  ssl_expires_at  TIMESTAMPTZ,
  ssl_days_left   INTEGER,
  server_header   TEXT,
  tech_stack      TEXT[],
  response_time_ms INTEGER,
  redirect_chain  TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- FINDINGS table — one row per vulnerability found
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS findings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id         UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  vuln_id         VARCHAR(50) NOT NULL,
    -- e.g. XSS_REFLECTED, MISSING_CSP, CORS_MISCONFIGURED
  name            VARCHAR(150) NOT NULL,
  category        VARCHAR(50),
    -- header | injection | cors | csrf | clickjacking | recon
  severity        VARCHAR(10) NOT NULL,
    -- CRITICAL | HIGH | MEDIUM | LOW | INFO
  cvss_score      NUMERIC(4,1),
  cwe             VARCHAR(20),
  owasp           VARCHAR(10),
  found           BOOLEAN NOT NULL DEFAULT FALSE,
  evidence        TEXT,
  description     TEXT,
  raw_data        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- AI_REMEDIATIONS table — AI output per finding
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_remediations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id      UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  scan_id         UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  explanation     TEXT,
  steps           JSONB,   -- array of step strings
  code_fix        TEXT,
  code_language   VARCHAR(30),
  prevention      JSONB,   -- array of prevention tip strings
  ai_model        VARCHAR(50),
  prompt_tokens   INTEGER,
  completion_tokens INTEGER,
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SCAN_SUMMARY_VIEW — convenience view
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW scan_summary AS
SELECT
  s.id,
  s.target_url,
  s.status,
  s.health_score,
  s.grade,
  s.started_at,
  s.completed_at,
  s.duration_ms,
  COUNT(f.id) FILTER (WHERE f.severity = 'CRITICAL' AND f.found) AS critical_count,
  COUNT(f.id) FILTER (WHERE f.severity = 'HIGH'     AND f.found) AS high_count,
  COUNT(f.id) FILTER (WHERE f.severity = 'MEDIUM'   AND f.found) AS medium_count,
  COUNT(f.id) FILTER (WHERE f.severity = 'LOW'      AND f.found) AS low_count,
  COUNT(f.id) FILTER (WHERE f.severity = 'INFO'     AND f.found) AS info_count,
  COUNT(f.id) FILTER (WHERE f.found)                             AS total_findings
FROM scans s
LEFT JOIN findings f ON f.scan_id = s.id
GROUP BY s.id;

-- ─────────────────────────────────────────
-- INDEXES for performance
-- ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_scans_status       ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_created_at   ON scans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_findings_scan_id   ON findings(scan_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity  ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_recon_scan_id      ON recon_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_ai_scan_id         ON ai_remediations(scan_id);
CREATE INDEX IF NOT EXISTS idx_ai_finding_id      ON ai_remediations(finding_id);
