/**
 * routes/report.js
 * Report download route — returns the full scan as downloadable JSON.
 */

const express = require('express');
const pool    = require('../db/index');
const logger  = require('../utils/logger');

const router = express.Router();

// GET /api/report/:scanId
// Downloads the full scan report as a JSON file.
router.get('/:scanId', async (req, res) => {
  const { scanId } = req.params;

  try {
    const { rows: scanRows } = await pool.query(
      'SELECT * FROM scans WHERE id = $1 AND status = $2',
      [scanId, 'completed']
    );

    if (scanRows.length === 0) {
      return res.status(404).json({ error: 'Completed scan not found.' });
    }

    const scan = scanRows[0];

    const { rows: reconRows }   = await pool.query('SELECT * FROM recon_results WHERE scan_id = $1', [scanId]);
    const { rows: findingRows } = await pool.query(
      `SELECT f.*, r.explanation, r.steps, r.code_fix, r.code_language, r.prevention
       FROM findings f
       LEFT JOIN ai_remediations r ON r.finding_id = f.id
       WHERE f.scan_id = $1
       ORDER BY CASE f.severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 ELSE 5 END`,
      [scanId]
    );

    const report = {
      meta: {
        reportVersion:   '1.0',
        generatedAt:     new Date().toISOString(),
        tool:            'WebSec Assessment Tool v1.0',
        disclaimer:      'This report is for authorized security testing only.',
      },
      scan: {
        id:          scan.id,
        targetUrl:   scan.target_url,
        status:      scan.status,
        healthScore: scan.health_score,
        grade:       scan.grade,
        startedAt:   scan.started_at,
        completedAt: scan.completed_at,
        durationMs:  scan.duration_ms,
      },
      recon:    reconRows[0] || null,
      findings: findingRows.map(f => ({
        vulnId:      f.vuln_id,
        name:        f.name,
        category:    f.category,
        severity:    f.severity,
        cvss:        f.cvss_score,
        cwe:         f.cwe,
        owasp:       f.owasp,
        found:       f.found,
        evidence:    f.evidence,
        description: f.description,
        remediation: f.explanation ? {
          explanation: f.explanation,
          steps:       f.steps,
          codeFix:     f.code_fix,
          language:    f.code_language,
          prevention:  f.prevention,
        } : null,
      })),
    };

    const filename = `websec-report-${scanId.slice(0, 8)}-${Date.now()}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(report);

  } catch (err) {
    logger.error('Report generation failed', { scanId, error: err.message });
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

module.exports = router;
