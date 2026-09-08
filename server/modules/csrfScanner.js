/**
 * modules/csrfScanner.js
 * Checks for missing CSRF protections in HTML forms.
 * Looks for anti-CSRF token fields in forms and SameSite cookie attributes.
 */

const cheerio = require('cheerio');
const logger  = require('../utils/logger');

// Common CSRF token field name patterns
const CSRF_TOKEN_PATTERNS = [
  /csrf/i, /xsrf/i, /_token/i, /authenticity_token/i,
  /nonce/i, /anti_forgery/i, /__requestverificationtoken/i,
];

/**
 * @param {string} html    - Page HTML body
 * @param {object} headers - Response headers (for Set-Cookie analysis)
 * @returns {object} Finding object
 */
function scanCSRF(html, headers) {
  const finding = {
    id:          'MISSING_CSRF_PROTECTION',
    name:        'Missing CSRF Protection',
    category:    'csrf',
    severity:    'MEDIUM',
    cvss:        6.5,
    cwe:         'CWE-352',
    owasp:       'A01:2021',
    found:       false,
    evidence:    null,
    description: 'Forms on this page do not appear to include anti-CSRF tokens. Attackers can trick authenticated users into submitting unintended requests from malicious sites.',
    raw_data:    {},
  };

  const $ = cheerio.load(html || '');
  const forms = $('form');

  if (forms.length === 0) {
    finding.found    = false;
    finding.evidence = 'No HTML forms found on page — CSRF not applicable here.';
    return finding;
  }

  let vulnerableForms = 0;
  const formDetails   = [];

  forms.each((i, form) => {
    const method  = ($(form).attr('method') || 'get').toUpperCase();
    const action  = $(form).attr('action') || '(current page)';
    const inputs  = $(form).find('input[type="hidden"]');

    // Only POST forms are CSRF-relevant
    if (method !== 'POST') return;

    let hasToken = false;
    inputs.each((_, input) => {
      const name = ($(input).attr('name') || '').toLowerCase();
      if (CSRF_TOKEN_PATTERNS.some(p => p.test(name))) {
        hasToken = true;
      }
    });

    formDetails.push({ action, method, hasToken });
    if (!hasToken) vulnerableForms++;
  });

  // Check cookie SameSite attribute
  const setCookieHeader = headers['set-cookie'];
  let missingSameSite   = false;
  if (setCookieHeader) {
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    const sessionCookies = cookies.filter(c =>
      /sess|auth|token|login/i.test(c)
    );
    if (sessionCookies.some(c => !/samesite=/i.test(c))) {
      missingSameSite = true;
    }
  }

  if (vulnerableForms > 0 || missingSameSite) {
    finding.found    = true;
    finding.evidence = [
      vulnerableForms > 0  ? `${vulnerableForms} POST form(s) missing CSRF token` : null,
      missingSameSite      ? 'Session cookie missing SameSite attribute'          : null,
    ].filter(Boolean).join('; ');
    finding.raw_data = { formDetails, missingSameSite };
  }

  logger.debug('CSRF scan complete', { forms: forms.length, vulnerableForms });
  return finding;
}

module.exports = { scanCSRF };
