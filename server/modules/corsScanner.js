/**
 * modules/corsScanner.js
 * Tests for CORS (Cross-Origin Resource Sharing) misconfigurations.
 * Sends requests with forged Origin headers and inspects the response.
 */

const axios  = require('axios');
const logger = require('../utils/logger');

const FORGED_ORIGINS = [
  'https://evil.com',
  'https://attacker.example.com',
  'null',
];

/**
 * @param {string} targetUrl
 * @returns {Promise<object>} Finding object
 */
async function scanCORS(targetUrl) {
  const finding = {
    id:          'CORS_MISCONFIGURED',
    name:        'CORS Misconfiguration',
    category:    'cors',
    severity:    'HIGH',
    cvss:        7.5,
    cwe:         'CWE-942',
    owasp:       'A05:2021',
    found:       false,
    evidence:    null,
    description: 'CORS is misconfigured to allow arbitrary origins. Attackers from any domain can make credentialed cross-origin requests, potentially accessing sensitive API data.',
    raw_data:    {},
  };

  for (const origin of FORGED_ORIGINS) {
    try {
      const response = await axios.get(targetUrl, {
        timeout: 8000,
        maxRedirects: 3,
        validateStatus: () => true,
        headers: {
          'Origin': origin,
          'User-Agent': 'SecurityAssessmentBot/1.0 (Authorized Test)',
        },
      });

      const acao  = response.headers['access-control-allow-origin'];
      const acac  = response.headers['access-control-allow-credentials'];

      if (!acao) continue;

      // Wildcard origin — high risk but OK if no credentials
      if (acao === '*') {
        finding.found    = true;
        finding.severity = acac === 'true' ? 'CRITICAL' : 'MEDIUM';
        finding.cvss     = acac === 'true' ? 9.1 : 5.3;
        finding.evidence = `Access-Control-Allow-Origin: * ${acac === 'true' ? '+ Allow-Credentials: true (CRITICAL combination)' : ''}`;
        finding.raw_data = { acao, acac, testedOrigin: origin };
        logger.warn('CORS wildcard detected', { url: targetUrl, credentialed: acac === 'true' });
        return finding;
      }

      // Reflected origin — server echoes back whatever Origin we sent
      if (acao === origin || acao.includes(origin.replace('https://', ''))) {
        finding.found    = true;
        finding.severity = acac === 'true' ? 'CRITICAL' : 'HIGH';
        finding.cvss     = acac === 'true' ? 9.1 : 7.5;
        finding.evidence = `Server reflects forged origin "${origin}" in Access-Control-Allow-Origin${acac === 'true' ? ' with Allow-Credentials: true' : ''}`;
        finding.raw_data = { acao, acac, testedOrigin: origin };
        logger.warn('CORS origin reflection detected', { url: targetUrl, origin });
        return finding;
      }

    } catch (err) {
      logger.debug('CORS test failed', { origin, error: err.message });
    }
  }

  return finding;
}

module.exports = { scanCORS };
