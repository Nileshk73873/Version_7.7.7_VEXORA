/**
 * modules/headerAnalyzer.js
 * Analyses HTTP security headers for presence, value correctness, and risk.
 */

const logger = require('../utils/logger');

/**
 * Header definitions — what to check and how to score each.
 */
const HEADER_CHECKS = [
  {
    id:          'MISSING_CSP',
    header:      'content-security-policy',
    name:        'Content-Security-Policy (CSP)',
    severity:    'HIGH',
    cvss:        7.5,
    cwe:         'CWE-693',
    owasp:       'A05:2021',
    description: 'Content-Security-Policy header is missing. This allows attackers to inject malicious scripts (XSS) that the browser will execute without restriction.',
    checkValue:  (val) => {
      if (!val) return { found: true, issue: 'Header completely absent' };
      if (val.includes("'unsafe-inline'") && val.includes("'unsafe-eval'")) {
        return { found: true, issue: "CSP present but uses 'unsafe-inline' and 'unsafe-eval' — severely weakens protection", severity: 'MEDIUM' };
      }
      if (val.includes("'unsafe-inline'")) {
        return { found: true, issue: "CSP present but uses 'unsafe-inline'", severity: 'MEDIUM' };
      }
      return { found: false };
    },
  },
  {
    id:          'MISSING_HSTS',
    header:      'strict-transport-security',
    name:        'HTTP Strict Transport Security (HSTS)',
    severity:    'HIGH',
    cvss:        7.4,
    cwe:         'CWE-319',
    owasp:       'A02:2021',
    description: 'HSTS header is missing. Attackers can perform SSL stripping to downgrade connections from HTTPS to HTTP, intercepting sensitive data.',
    checkValue:  (val) => {
      if (!val) return { found: true, issue: 'Header completely absent' };
      const maxAge = val.match(/max-age=(\d+)/)?.[1];
      if (!maxAge || parseInt(maxAge) < 31536000) {
        return { found: true, issue: `max-age too short (${maxAge || 0}s). Recommend >= 31536000s (1 year)`, severity: 'MEDIUM' };
      }
      return { found: false };
    },
  },
  {
    id:          'MISSING_XFRAME',
    header:      'x-frame-options',
    name:        'X-Frame-Options',
    severity:    'MEDIUM',
    cvss:        5.4,
    cwe:         'CWE-1021',
    owasp:       'A05:2021',
    description: 'X-Frame-Options header is missing. The site can be embedded in iframes, enabling clickjacking attacks where users are tricked into clicking hidden elements.',
    checkValue:  (val) => {
      if (!val) return { found: true, issue: 'Header completely absent' };
      if (!['deny', 'sameorigin'].includes(val.toLowerCase().trim())) {
        return { found: true, issue: `Invalid value "${val}". Use DENY or SAMEORIGIN`, severity: 'LOW' };
      }
      return { found: false };
    },
  },
  {
    id:          'MISSING_XCTO',
    header:      'x-content-type-options',
    name:        'X-Content-Type-Options',
    severity:    'MEDIUM',
    cvss:        4.3,
    cwe:         'CWE-430',
    owasp:       'A05:2021',
    description: 'X-Content-Type-Options: nosniff is missing. Browsers may MIME-sniff responses and execute uploaded files as scripts.',
    checkValue:  (val) => {
      if (!val || val.toLowerCase().trim() !== 'nosniff') {
        return { found: true, issue: val ? `Invalid value "${val}", expected "nosniff"` : 'Header absent' };
      }
      return { found: false };
    },
  },
  {
    id:          'MISSING_REFERRER_POLICY',
    header:      'referrer-policy',
    name:        'Referrer-Policy',
    severity:    'LOW',
    cvss:        3.1,
    cwe:         'CWE-200',
    owasp:       'A01:2021',
    description: 'Referrer-Policy header is missing. Sensitive URL parameters may leak via the Referer header to third-party sites.',
    checkValue:  (val) => (!val ? { found: true, issue: 'Header absent' } : { found: false }),
  },
  {
    id:          'MISSING_PERMISSIONS_POLICY',
    header:      'permissions-policy',
    name:        'Permissions-Policy',
    severity:    'LOW',
    cvss:        2.5,
    cwe:         'CWE-284',
    owasp:       'A01:2021',
    description: 'Permissions-Policy header is missing. Browser features (camera, microphone, geolocation) are unrestricted for embedded content.',
    checkValue:  (val) => (!val ? { found: true, issue: 'Header absent' } : { found: false }),
  },
  {
    id:          'SERVER_VERSION_EXPOSED',
    header:      'server',
    name:        'Server Version Disclosure',
    severity:    'LOW',
    cvss:        3.5,
    cwe:         'CWE-200',
    owasp:       'A01:2021',
    description: 'The Server header reveals software version information, helping attackers identify known CVEs for your specific version.',
    checkValue:  (val) => {
      if (!val) return { found: false };
      const versionPattern = /[\d]+\.[\d]+/;
      if (versionPattern.test(val)) {
        return { found: true, issue: `Version exposed in Server header: "${val}"` };
      }
      return { found: false };
    },
  },
  {
    id:          'XPOWEREDBY_EXPOSED',
    header:      'x-powered-by',
    name:        'X-Powered-By Disclosure',
    severity:    'LOW',
    cvss:        3.1,
    cwe:         'CWE-200',
    owasp:       'A01:2021',
    description: 'X-Powered-By header reveals your technology stack, helping attackers narrow down exploits.',
    checkValue:  (val) => (val ? { found: true, issue: `Exposed: "${val}"` } : { found: false }),
  },
];

/**
 * Analyses HTTP headers for security issues.
 * @param {object} headers - Raw HTTP response headers (keys lowercased)
 * @returns {object[]} Array of finding objects
 */
function analyseHeaders(headers) {
  const normalised = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );

  const findings = [];

  for (const check of HEADER_CHECKS) {
    const val    = normalised[check.header] || null;
    const result = check.checkValue(val);

    findings.push({
      id:          check.id,
      name:        check.name,
      category:    'header',
      severity:    result.severity || check.severity,
      cvss:        check.cvss,
      cwe:         check.cwe,
      owasp:       check.owasp,
      found:       result.found,
      evidence:    result.found ? (result.issue || `Header "${check.header}" missing or misconfigured`) : null,
      description: check.description,
      raw_data:    { headerValue: val },
    });
  }

  logger.debug('Header analysis complete', {
    total: findings.length,
    issues: findings.filter(f => f.found).length,
  });

  return findings;
}

module.exports = { analyseHeaders };
