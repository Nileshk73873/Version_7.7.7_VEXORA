/**
 * routes/scan.js
 * Scan-related API routes.
 */

const express            = require('express');
const { v4: uuidv4 }    = require('uuid');
const pool               = require('../db/index');
const { runScan }        = require('../orchestrator');
const { validateTargetUrl, sanitiseUrl } = require('../utils/validator');
const logger             = require('../utils/logger');

const router = express.Router();

// ──────────────────────────────────────────────────────────
// POST /api/scan
// Body: { url: string, authorized: boolean }
// Starts a new scan. Returns the scan ID immediately;
// scan runs asynchronously.
// ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { url, authorized } = req.body;

  // Authorisation consent check
  if (!authorized) {
    return res.status(403).json({
      error: 'You must confirm that you are authorized to scan this target.',
    });
  }

  // URL validation
  const validation = validateTargetUrl(url);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.reason });
  }

  const cleanUrl   = sanitiseUrl(url.trim());
  const scanId     = uuidv4();
  const ipAddress  = req.ip || req.connection?.remoteAddress || null;
  const userAgent  = req.headers['user-agent'] || null;

  try {
    // Insert scan record (status = pending)
    await pool.query(
      `INSERT INTO scans (id, target_url, status, ip_address, user_agent)
       VALUES ($1, $2, 'pending', $3, $4)`,
      [scanId, cleanUrl, ipAddress, userAgent]
    );

    // Run scan asynchronously (don't await)
    runScan(scanId, cleanUrl).catch(err => {
      logger.error('Background scan error', { scanId, error: err.message });
    });

    res.status(202).json({
      scanId,
      status:  'pending',
      message: 'Scan started. Poll /api/scan/:id for results.',
      pollUrl: `/api/scan/${scanId}`,
    });

  } catch (err) {
    logger.error('Failed to create scan', { error: err.message });
    res.status(500).json({ error: 'Failed to start scan. Please try again.' });
  }
});

// ──────────────────────────────────────────────────────────
// GET /api/scan/:id
// Returns scan status and full results when completed.
// ──────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Get scan record
    const { rows: scanRows } = await pool.query(
      'SELECT * FROM scans WHERE id = $1',
      [id]
    );

    if (scanRows.length === 0) {
      return res.status(404).json({ error: 'Scan not found.' });
    }

    const scan = scanRows[0];

    // If not complete, return status only
    if (scan.status !== 'completed') {
      return res.json({
        scanId:    scan.id,
        status:    scan.status,
        targetUrl: scan.target_url,
        startedAt: scan.started_at,
        error:     scan.error_message || null,
      });
    }

    // Get recon data
    const { rows: reconRows } = await pool.query(
      'SELECT * FROM recon_results WHERE scan_id = $1',
      [id]
    );

    // Get findings with AI remediations
    const { rows: findingRows } = await pool.query(
      `SELECT
         f.*,
         r.explanation, r.steps, r.code_fix, r.code_language,
         r.prevention, r.ai_model, r.prompt_tokens, r.completion_tokens
       FROM findings f
       LEFT JOIN ai_remediations r ON r.finding_id = f.id
       WHERE f.scan_id = $1
       ORDER BY
         CASE f.severity
           WHEN 'CRITICAL' THEN 1
           WHEN 'HIGH'     THEN 2
           WHEN 'MEDIUM'   THEN 3
           WHEN 'LOW'      THEN 4
           ELSE 5
         END`,
      [id]
    );

    // Shape findings with nested remediation
    const findings = findingRows.map(f => ({
      id:          f.vuln_id,
      name:        f.name,
      category:    f.category,
      severity:    f.severity,
      cvss:        f.cvss_score,
      cwe:         f.cwe,
      owasp:       f.owasp,
      found:       f.found,
      evidence:    f.evidence,
      description: f.description,
      raw_data:    f.raw_data,
      remediation: f.explanation ? {
        explanation:       f.explanation,
        steps:             f.steps,
        code_fix:          f.code_fix,
        code_language:     f.code_language,
        prevention:        f.prevention,
        ai_model:          f.ai_model,
        prompt_tokens:     f.prompt_tokens,
        completion_tokens: f.completion_tokens,
      } : null,
    }));

    const recon = reconRows[0] || null;

    res.json({
      scanId:      scan.id,
      status:      scan.status,
      targetUrl:   scan.target_url,
      startedAt:   scan.started_at,
      completedAt: scan.completed_at,
      durationMs:  scan.duration_ms,
      score: {
        score: scan.health_score,
        grade: scan.grade,
      },
      recon: recon ? {
        ipAddresses:    recon.ip_addresses,
        dnsRecords:     recon.dns_records,
        ssl:            {
          valid:      recon.ssl_valid,
          issuer:     recon.ssl_issuer,
          expiresAt:  recon.ssl_expires_at,
          daysLeft:   recon.ssl_days_left,
        },
        serverHeader:   recon.server_header,
        techStack:      recon.tech_stack,
        responseTimeMs: recon.response_time_ms,
        redirectChain:  recon.redirect_chain,
      } : null,
      findings,
      summary: {
        total:    findings.filter(f => f.found).length,
        critical: findings.filter(f => f.found && f.severity === 'CRITICAL').length,
        high:     findings.filter(f => f.found && f.severity === 'HIGH').length,
        medium:   findings.filter(f => f.found && f.severity === 'MEDIUM').length,
        low:      findings.filter(f => f.found && f.severity === 'LOW').length,
      },
    });

  } catch (err) {
    logger.error('Failed to get scan', { id, error: err.message });
    res.status(500).json({ error: 'Failed to retrieve scan.' });
  }
});

// ──────────────────────────────────────────────────────────
// GET /api/scan
// Lists recent scans (last 20).
// ──────────────────────────────────────────────────────────
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, target_url, status, health_score, grade,
              started_at, completed_at, duration_ms,
              critical_count, high_count, medium_count, low_count, total_findings
       FROM scan_summary
       ORDER BY started_at DESC
       LIMIT 20`
    );
    res.json({ scans: rows });
  } catch (err) {
    logger.error('Failed to list scans', { error: err.message });
    res.status(500).json({ error: 'Failed to retrieve scan history.' });
  }
});

// ──────────────────────────────────────────────────────────
// DELETE /api/scan/:id
// Deletes a scan and all related data (cascade).
// ──────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM scans WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Scan not found.' });
    res.json({ message: 'Scan deleted.' });
  } catch (err) {
    logger.error('Failed to delete scan', { id, error: err.message });
    res.status(500).json({ error: 'Failed to delete scan.' });
  }
});

module.exports = router;
