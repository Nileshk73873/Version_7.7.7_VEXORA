/**
 * modules/recon.js
 * Reconnaissance module — DNS, SSL, tech stack, response info.
 */

const dns   = require('dns').promises;
const https = require('https');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Detects the technology stack from response headers and HTML.
 * @param {object} headers - HTTP response headers
 * @param {string} html    - Response body HTML
 * @returns {string[]}
 */
function detectTechStack(headers, html = '') {
  const stack = [];
  const h = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).toLowerCase()])
  );

  // Server software
  if (h['server']) {
    if (h['server'].includes('nginx'))   stack.push('Nginx');
    if (h['server'].includes('apache'))  stack.push('Apache');
    if (h['server'].includes('iis'))     stack.push('IIS');
    if (h['server'].includes('cloudflare')) stack.push('Cloudflare');
    if (h['server'].includes('caddy'))   stack.push('Caddy');
  }

  // Backend language/framework
  if (h['x-powered-by']) {
    if (h['x-powered-by'].includes('php'))    stack.push('PHP');
    if (h['x-powered-by'].includes('express')) stack.push('Express.js');
    if (h['x-powered-by'].includes('asp.net')) stack.push('ASP.NET');
    if (h['x-powered-by'].includes('next.js')) stack.push('Next.js');
  }

  // HTML-based detection
  const htmlLower = html.toLowerCase();
  if (htmlLower.includes('wp-content') || htmlLower.includes('wordpress'))    stack.push('WordPress');
  if (htmlLower.includes('drupal'))                                            stack.push('Drupal');
  if (htmlLower.includes('joomla'))                                            stack.push('Joomla');
  if (htmlLower.includes('react') || htmlLower.includes('__react'))           stack.push('React');
  if (htmlLower.includes('vue') || htmlLower.includes('__vue'))               stack.push('Vue.js');
  if (htmlLower.includes('angular'))                                           stack.push('Angular');
  if (htmlLower.includes('jquery'))                                            stack.push('jQuery');
  if (htmlLower.includes('bootstrap'))                                         stack.push('Bootstrap');

  return [...new Set(stack)];
}

/**
 * Gets SSL certificate details by making an HTTPS request.
 * @param {string} hostname
 * @returns {Promise<object>}
 */
function getSSLInfo(hostname) {
  return new Promise((resolve) => {
    const req = https.request({ host: hostname, port: 443, method: 'HEAD', rejectUnauthorized: false }, (res) => {
      const cert = res.socket.getPeerCertificate();
      if (!cert || !cert.subject) {
        return resolve({ valid: false, issuer: null, expiresAt: null, daysLeft: null });
      }
      const expiresAt = new Date(cert.valid_to);
      const daysLeft  = Math.floor((expiresAt - Date.now()) / 86_400_000);
      resolve({
        valid:     daysLeft > 0,
        issuer:    cert.issuer?.O || cert.issuer?.CN || 'Unknown',
        subject:   cert.subject?.CN || hostname,
        expiresAt: expiresAt.toISOString(),
        daysLeft,
        selfSigned: cert.issuer?.CN === cert.subject?.CN,
      });
    });
    req.on('error', () => resolve({ valid: false, issuer: null, expiresAt: null, daysLeft: null }));
    req.setTimeout(8000, () => { req.destroy(); resolve({ valid: false, issuer: null, expiresAt: null, daysLeft: null }); });
    req.end();
  });
}

/**
 * Main recon function.
 * @param {string} targetUrl
 * @param {object} [fetchResult] - Pre-fetched { headers, html, statusCode, redirectChain, responseTimeMs }
 * @returns {Promise<object>}
 */
async function runRecon(targetUrl, fetchResult = {}) {
  const parsed   = new URL(targetUrl);
  const hostname = parsed.hostname;
  const results  = { hostname };

  // ── DNS Resolution ───────────────────────────────────────
  try {
    const [a, mx, txt, ns] = await Promise.allSettled([
      dns.resolve4(hostname),
      dns.resolveMx(hostname),
      dns.resolveTxt(hostname),
      dns.resolveNs(hostname),
    ]);
    results.ipAddresses = a.status === 'fulfilled'  ? a.value  : [];
    results.dnsRecords  = {
      mx:  mx.status  === 'fulfilled' ? mx.value.map(r => r.exchange) : [],
      txt: txt.status === 'fulfilled' ? txt.value.flat()              : [],
      ns:  ns.status  === 'fulfilled' ? ns.value                      : [],
    };
  } catch (err) {
    logger.warn('Recon DNS error:', err.message);
    results.ipAddresses = [];
    results.dnsRecords  = {};
  }

  // ── SSL Info ─────────────────────────────────────────────
  if (parsed.protocol === 'https:') {
    results.ssl = await getSSLInfo(hostname);
  } else {
    results.ssl = { valid: false, reason: 'Site does not use HTTPS' };
  }

  // ── Tech Stack ───────────────────────────────────────────
  results.techStack      = detectTechStack(fetchResult.headers || {}, fetchResult.html || '');
  results.serverHeader   = fetchResult.headers?.['server'] || fetchResult.headers?.['Server'] || null;
  results.responseTimeMs = fetchResult.responseTimeMs || null;
  results.redirectChain  = fetchResult.redirectChain  || [];
  results.statusCode     = fetchResult.statusCode     || null;

  logger.debug('Recon complete', { hostname, ip: results.ipAddresses?.[0] });
  return results;
}

module.exports = { runRecon };
