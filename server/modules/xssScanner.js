/**
 * modules/xssScanner.js
 * Tests for Reflected Cross-Site Scripting (XSS) vulnerabilities
 * by injecting payloads into URL query parameters and checking if
 * they appear unescaped in the response body.
 *
 * ⚠️  For authorised testing only.
 */

const axios  = require('axios');
const logger = require('../utils/logger');

const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '"><script>alert(1)</script>',
  "'><img src=x onerror=alert(1)>",
  '<svg onload=alert(1)>',
  'javascript:alert(1)',
];

// Unique marker to detect reflection without triggering real browsers
const MARKER = 'XSSTEST_7f3a';

/**
 * Injects payloads into query parameters and checks for unescaped reflection.
 * @param {string} targetUrl
 * @returns {Promise<object>} Finding object
 */
async function scanXSS(targetUrl) {
  const finding = {
    id:          'XSS_REFLECTED',
    name:        'Reflected Cross-Site Scripting (XSS)',
    category:    'injection',
    severity:    'HIGH',
    cvss:        7.2,
    cwe:         'CWE-79',
    owasp:       'A03:2021',
    found:       false,
    evidence:    null,
    description: 'Reflected XSS occurs when user-supplied data is returned in an HTTP response without proper encoding, allowing an attacker to inject and execute scripts in the victim\'s browser.',
    raw_data:    {},
  };

  const parsed = new URL(targetUrl);
  const params = [...parsed.searchParams.keys()];

  // If no query params, inject a test param
  const testParams = params.length > 0 ? params : ['q', 'search', 'id', 'page', 'query'];

  for (const payload of XSS_PAYLOADS) {
    for (const param of testParams.slice(0, 5)) { // limit to 5 params
      try {
        const testUrl = new URL(targetUrl);
        testUrl.searchParams.set(param, MARKER + payload);

        const response = await axios.get(testUrl.toString(), {
          timeout: 8000,
          maxRedirects: 3,
          validateStatus: () => true,
          headers: { 'User-Agent': 'SecurityAssessmentBot/1.0 (Authorized Test)' },
        });

        const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

        // Check if our marker + payload appears unescaped
        if (body.includes(MARKER + payload)) {
          finding.found    = true;
          finding.evidence = `Payload reflected in response: param="${param}", payload="${payload}"`;
          finding.raw_data = { reflectedParam: param, payload, testUrl: testUrl.toString() };
          logger.warn('XSS vulnerability found', { url: testUrl.toString(), param });
          return finding;
        }

        // Check if just the marker is reflected (potential partial reflection)
        if (body.includes(MARKER)) {
          finding.found    = true;
          finding.severity = 'MEDIUM';
          finding.evidence = `Partial payload reflection detected in param="${param}"`;
          finding.raw_data = { reflectedParam: param, testUrl: testUrl.toString() };
          return finding;
        }
      } catch (err) {
        logger.debug('XSS test request failed', { param, error: err.message });
      }
    }
  }

  return finding;
}

module.exports = { scanXSS };
