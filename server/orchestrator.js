/**
 * orchestrator.js
 * Coordinates the full scan pipeline:
 *   1. Fetch the target URL
 *   2. Run all scanner modules in parallel
 *   3. Aggregate & deduplicate findings
 *   4. Compute security health score
 *   5. Generate AI remediations
 *   6. Persist everything to PostgreSQL
 *   7. Return the complete report
 */

require('dotenv').config();
const axios              = require('axios');
const pool               = require('./db/index');
const { runRecon }       = require('./modules/recon');
const { analyseHeaders } = require('./modules/headerAnalyzer');
const { scanXSS }        = require('./modules/xssScanner');
const { scanCORS }       = require('./modules/corsScanner');
const { scanCSRF }       = require('./modules/csrfScanner');
const { scanClickjacking }      = require('./modules/clickjackScanner');
const { computeScore }         = require('./scorer');
const { generateRemediations } = require('./aiRemediator');
const logger                   = require('./utils/logger');

const SCAN_TIMEOUT = parseInt(process.env.SCAN_TIMEOUT_MS || '30000', 10);

/**
 * Fetches the target URL and collects response metadata.
 * @param {string} targetUrl
 * @returns {Promise<object>}
 */
async function fetchTarget(targetUrl) {
  const start    = Date.now();
  const redirectChain = [];

  const response = await axios.get(targetUrl, {
    timeout:        SCAN_TIMEOUT,
    maxRedirects:   5,
    validateStatus: () => true,
    headers: {
      'User-Agent': 'SecurityAssessmentBot/1.0 (Authorized Security Test)',
      'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    // Track redirect chain
    maxBodyLength: 5 * 1024 * 1024, // 5MB limit
  });

  return {
    statusCode:    response.status,
    headers:       response.headers,
    html:          typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
    responseTimeMs: Date.now() - start,
    redirectChain,
    finalUrl:      response.request?.res?.responseUrl || targetUrl,
  };
}

/**
 * Updates the scan status in PostgreSQL.
 */
async function updateScanStatus(scanId, status, extra = {}) {
  const fields = ['status = $2'];
  const values = [scanId, status];
  let idx = 3;

  if (extra.completedAt) { fields.push(`completed_at = $${idx++}`); values.push(extra.completedAt); }
  if (extra.durationMs)  { fields.push(`duration_ms = $${idx++}`);  values.push(extra.durationMs); }
  if (extra.score != null){ fields.push(`health_score = $${idx++}`); values.push(extra.score); }
  if (extra.grade)       { fields.push(`grade = $${idx++}`);        values.push(extra.grade); }
  if (extra.error)       { fields.push(`error_message = $${idx++}`); values.push(extra.error); }

  await pool.query(`UPDATE scans SET ${fields.join(', ')} WHERE id = $1`, values);
}

/**
 * Persists recon data to the database.
 */
async function saveRecon(scanId, recon) {
  await pool.query(
    `INSERT INTO recon_results
      (scan_id, ip_addresses, dns_records, ssl_valid, ssl_issuer, ssl_expires_at,
       ssl_days_left, server_header, tech_stack, response_time_ms, redirect_chain)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      scanId,
      recon.ipAddresses    || [],
      JSON.stringify(recon.dnsRecords || {}),
      recon.ssl?.valid     ?? null,
      recon.ssl?.issuer    || null,
      recon.ssl?.expiresAt || null,
      recon.ssl?.daysLeft  ?? null,
      recon.serverHeader   || null,
      recon.techStack      || [],
      recon.responseTimeMs || null,
      recon.redirectChain  || [],
    ]
  );
}

/**
 * Persists findings and their AI remediations to the database.
 */
async function saveFindings(scanId, findings, remediations) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const finding of findings) {
      const { rows } = await client.query(
        `INSERT INTO findings
          (scan_id, vuln_id, name, category, severity, cvss_score, cwe, owasp,
           found, evidence, description, raw_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [
          scanId,
          finding.id,
          finding.name,
          finding.category  || null,
          finding.severity,
          finding.cvss      || null,
          finding.cwe       || null,
          finding.owasp     || null,
          finding.found,
          finding.evidence  || null,
          finding.description || null,
          JSON.stringify(finding.raw_data || {}),
        ]
      );

      const findingDbId = rows[0].id;

      // Save AI remediation if available
      const remediation = remediations.get(finding.id);
      if (remediation) {
        await client.query(
          `INSERT INTO ai_remediations
            (finding_id, scan_id, explanation, steps, code_fix, code_language,
             prevention, ai_model, prompt_tokens, completion_tokens)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            findingDbId,
            scanId,
            remediation.explanation    || null,
            JSON.stringify(remediation.steps || []),
            remediation.code_fix       || null,
            remediation.code_language  || null,
            JSON.stringify(remediation.prevention || []),
            remediation.ai_model       || null,
            remediation.prompt_tokens  || null,
            remediation.completion_tokens || null,
          ]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Main scan function — called by the route handler.
 * @param {string} scanId    - UUID from the scans table
 * @param {string} targetUrl - Validated target URL
 */
async function runScan(scanId, targetUrl) {
  const scanStart = Date.now();
  logger.info(`Scan started`, { scanId, targetUrl });

  try {
    await updateScanStatus(scanId, 'running');

    // ── Step 1: Fetch target ─────────────────────────────────
    let fetchResult;
    try {
      fetchResult = await fetchTarget(targetUrl);
      logger.debug('Target fetched', { statusCode: fetchResult.statusCode, ms: fetchResult.responseTimeMs });
    } catch (err) {
      throw new Error(`Failed to reach target: ${err.message}`);
    }

    const { headers, html } = fetchResult;

    // ── Step 2: Run all scanners in parallel ─────────────────
    const [recon, headerFindings, xssFinding, corsFinding] = await Promise.all([
      runRecon(targetUrl, fetchResult),
      Promise.resolve(analyseHeaders(headers)),
      scanXSS(targetUrl),
      scanCORS(targetUrl),
    ]);

    // Sync scanners (need HTML / headers from fetchResult)
    const csrfFinding       = scanCSRF(html, headers);
    const clickjackFinding  = scanClickjacking(headers);

    // ── Step 3: Aggregate findings ───────────────────────────
    const allFindings = [
      ...headerFindings,
      xssFinding,
      corsFinding,
      csrfFinding,
      clickjackFinding,
    ];

    // ── Step 4: Score ────────────────────────────────────────
    const scoreResult = computeScore(allFindings, recon);
    logger.info('Score computed', { score: scoreResult.score, grade: scoreResult.grade });

    // ── Step 5: AI Remediations ──────────────────────────────
    const remediations = await generateRemediations(allFindings);

    // ── Step 6: Persist to DB ────────────────────────────────
    await saveRecon(scanId, recon);
    await saveFindings(scanId, allFindings, remediations);

    const durationMs  = Date.now() - scanStart;
    const completedAt = new Date().toISOString();

    await updateScanStatus(scanId, 'completed', {
      completedAt,
      durationMs,
      score: scoreResult.score,
      grade: scoreResult.grade,
    });

    // ── Step 7: Build and return full report ─────────────────
    const report = {
      scanId,
      targetUrl,
      status:      'completed',
      completedAt,
      durationMs,
      score:       scoreResult,
      recon,
      findings:    allFindings.map(f => ({
        ...f,
        remediation: remediations.get(f.id) || null,
      })),
      summary: {
        total:    allFindings.filter(f => f.found).length,
        critical: scoreResult.breakdown.CRITICAL,
        high:     scoreResult.breakdown.HIGH,
        medium:   scoreResult.breakdown.MEDIUM,
        low:      scoreResult.breakdown.LOW,
      },
    };

    logger.info('Scan complete', { scanId, score: scoreResult.score, durationMs });
    return report;

  } catch (err) {
    logger.error('Scan failed', { scanId, error: err.message });
    await updateScanStatus(scanId, 'failed', { error: err.message });
    throw err;
  }
}

module.exports = { runScan };
