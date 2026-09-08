/**
 * utils/validator.js
 * URL validation and security guardrails.
 * Blocks private IPs, localhost, and obviously invalid targets.
 */

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

const BLOCKED_HOSTNAMES = ['localhost', '0.0.0.0', 'metadata.google.internal'];

/**
 * Validates a target URL for scanning.
 * @param {string} url
 * @returns {{ valid: boolean, reason?: string, parsed?: URL }}
 */
function validateTargetUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, reason: 'URL is required.' };
  }

  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { valid: false, reason: 'Invalid URL format. Include http:// or https://' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, reason: 'Only HTTP and HTTPS protocols are supported.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, reason: `Scanning "${hostname}" is not permitted.` };
  }

  for (const pattern of PRIVATE_IP_RANGES) {
    if (pattern.test(hostname)) {
      return {
        valid: false,
        reason: 'Scanning private/internal IP addresses is not permitted.',
      };
    }
  }

  return { valid: true, parsed };
}

/**
 * Sanitises a URL for safe storage (strips credentials from URL).
 * @param {string} url
 * @returns {string}
 */
function sanitiseUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

module.exports = { validateTargetUrl, sanitiseUrl };
