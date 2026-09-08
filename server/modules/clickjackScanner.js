/**
 * modules/clickjackScanner.js
 * Detects clickjacking vulnerabilities by checking X-Frame-Options
 * and Content-Security-Policy frame-ancestors directive.
 */

const logger = require('../utils/logger');

/**
 * @param {object} headers - HTTP response headers (lowercase keys)
 * @returns {object} Finding object
 */
function scanClickjacking(headers) {
  const finding = {
    id:          'CLICKJACKING_VULNERABLE',
    name:        'Clickjacking Vulnerability',
    category:    'clickjacking',
    severity:    'MEDIUM',
    cvss:        5.4,
    cwe:         'CWE-1021',
    owasp:       'A05:2021',
    found:       false,
    evidence:    null,
    description: 'The page can be embedded in an iframe by other websites. Attackers can overlay invisible frames on top of legitimate UI elements to trick users into clicking malicious actions.',
    raw_data:    {},
  };

  const h               = Object.fromEntries(Object.entries(headers).map(([k,v]) => [k.toLowerCase(), v]));
  const xFrameOptions   = h['x-frame-options'];
  const csp             = h['content-security-policy'];

  // Check X-Frame-Options
  const xfoValid = xFrameOptions &&
    ['deny', 'sameorigin'].includes(xFrameOptions.toLowerCase().trim());

  // Check CSP frame-ancestors
  const cspHasFrameAncestors = csp && /frame-ancestors\s+(?!'\*'|\*)/i.test(csp);
  const cspFrameNone         = csp && /frame-ancestors\s+'none'/i.test(csp);
  const cspFrameSelf         = csp && /frame-ancestors\s+'self'/i.test(csp);

  const isProtected = xfoValid || cspHasFrameAncestors;

  if (!isProtected) {
    finding.found = true;

    const reasons = [];
    if (!xFrameOptions) {
      reasons.push('X-Frame-Options header is absent');
    } else if (!xfoValid) {
      reasons.push(`X-Frame-Options has invalid value: "${xFrameOptions}"`);
    }

    if (!csp) {
      reasons.push('Content-Security-Policy absent (no frame-ancestors)');
    } else if (!cspHasFrameAncestors) {
      reasons.push('CSP present but missing frame-ancestors directive');
    }

    finding.evidence = reasons.join('; ');
    finding.raw_data = {
      xFrameOptions: xFrameOptions || null,
      cspFrameAncestors: csp ? (csp.match(/frame-ancestors[^;]*/)?.[0] || null) : null,
    };
  }

  logger.debug('Clickjacking scan complete', { protected: isProtected });
  return finding;
}

module.exports = { scanClickjacking };
