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

    const escapeHtml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vulnora Security Assessment Report - ${escapeHtml(scan.target_url)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1000px; margin: 0 auto; padding: 20px; }
    h1, h2, h3 { color: #1a202c; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .header { background: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px; border: 1px solid #e2e8f0; }
    .score-box { display: inline-block; padding: 10px 20px; border-radius: 8px; font-size: 24px; font-weight: bold; margin-top: 10px; color: white; }
    .score-excellent { background: #48bb78; } .score-good { background: #38b2ac; } .score-fair { background: #ecc94b; color: #744210; } .score-poor { background: #ed8936; } .score-critical { background: #e53e3e; }
    .meta-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    .meta-table th, .meta-table td { padding: 12px; border: 1px solid #e2e8f0; text-align: left; }
    .meta-table th { background: #edf2f7; width: 30%; }
    .finding { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }
    .finding-header { padding: 15px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; }
    .finding-body { padding: 20px; }
    .sev-CRITICAL { background: #fff5f5; border-left: 4px solid #e53e3e; } .sev-CRITICAL .finding-header { background: #fed7d7; color: #c53030; }
    .sev-HIGH { background: #fffaf0; border-left: 4px solid #dd6b20; } .sev-HIGH .finding-header { background: #feebc8; color: #c05621; }
    .sev-MEDIUM { background: #fffff0; border-left: 4px solid #d69e2e; } .sev-MEDIUM .finding-header { background: #fefcbf; color: #b7791f; }
    .sev-LOW { background: #f0fff4; border-left: 4px solid #38a169; } .sev-LOW .finding-header { background: #c6f6d5; color: #2f855a; }
    .sev-INFO { background: #ebf8ff; border-left: 4px solid #3182ce; } .sev-INFO .finding-header { background: #bee3f8; color: #2b6cb0; }
    .not-found { opacity: 0.7; } .not-found .finding-header { background: #edf2f7; color: #4a5568; }
    pre { background: #1a202c; color: #a0aec0; padding: 15px; border-radius: 6px; overflow-x: auto; }
    .tags { display: flex; gap: 8px; margin-top: 10px; }
    .tag { background: #edf2f7; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #4a5568; }
    .remediation { background: #f0f9ff; border: 1px solid #bae6fd; padding: 15px; border-radius: 6px; margin-top: 15px; }
    .footer { margin-top: 50px; text-align: center; color: #a0aec0; font-size: 14px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  </style>
</head>
<body>

  <div class="header">
    <h1>🛡️ Vulnora Security Assessment Report</h1>
    <p><strong>Target URL:</strong> <a href="${escapeHtml(scan.target_url)}" target="_blank">${escapeHtml(scan.target_url)}</a></p>
    <p><strong>Scan Date:</strong> ${new Date(scan.completed_at).toLocaleString()}</p>
    
    <div class="score-box score-${scan.grade ? scan.grade.toLowerCase() : 'fair'}">
      Score: ${scan.health_score} / 100 (${escapeHtml(scan.grade)})
    </div>

    <table class="meta-table">
      <tr><th>IP Addresses</th><td>${reconRows[0]?.ip_addresses?.join(', ') || 'N/A'}</td></tr>
      <tr><th>Tech Stack</th><td>${reconRows[0]?.tech_stack?.join(', ') || 'None detected'}</td></tr>
      <tr><th>Server Header</th><td>${escapeHtml(reconRows[0]?.server_header || 'Hidden')}</td></tr>
    </table>
  </div>

  <h2>Vulnerability Findings</h2>
  ${findingRows.map(f => `
    <div class="finding sev-${f.severity} ${!f.found ? 'not-found' : ''}">
      <div class="finding-header">
        <span>${escapeHtml(f.severity)} - ${escapeHtml(f.name)}</span>
        <span>${f.found ? '⚠️ Detected' : '✅ Pass'}</span>
      </div>
      <div class="finding-body">
        <p>${escapeHtml(f.description)}</p>
        
        ${f.found && f.evidence ? `
          <h4>Evidence:</h4>
          <p style="font-family: monospace; background: rgba(0,0,0,0.05); padding: 10px; border-radius: 4px;">${escapeHtml(f.evidence)}</p>
        ` : ''}

        ${f.found && f.explanation ? `
          <div class="remediation">
            <h4>🤖 AI Remediation Guidance</h4>
            <p>${escapeHtml(f.explanation)}</p>
            
            ${f.steps ? `
              <h5>How to Fix:</h5>
              <ol>
                ${f.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
              </ol>
            ` : ''}

            ${f.code_fix ? `
              <h5>Code Fix (${escapeHtml(f.code_language)}):</h5>
              <pre><code>${escapeHtml(f.code_fix)}</code></pre>
            ` : ''}
            
            ${f.prevention ? `
              <h5>Prevention:</h5>
              <ul>
                ${f.prevention.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        ` : ''}
        
        <div class="tags">
          ${f.cwe ? `<span class="tag">${escapeHtml(f.cwe)}</span>` : ''}
          ${f.owasp ? `<span class="tag">OWASP ${escapeHtml(f.owasp)}</span>` : ''}
          ${f.cvss_score ? `<span class="tag">CVSS ${f.cvss_score}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('')}

  <div class="footer">
    <p>Generated by Vulnora v1.0. This report is for authorized security testing only.</p>
  </div>
</body>
</html>
    `;

    const filename = `vulnora-report-${scanId.slice(0, 8)}-${Date.now()}.html`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlReport);

  } catch (err) {
    logger.error('Report generation failed', { scanId, error: err.message });
    res.status(500).json({ error: 'Failed to generate report.' });
  }
});

module.exports = router;
