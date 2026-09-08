/**
 * api.js
 * Vulnora Backend API Client for the new frontend.
 * Automatically uses VITE_API_URL in production or proxies through Vite in development.
 */

const envApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
export const API_BASE = envApiUrl ? (envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl}/api`) : '/api';

/**
 * Start a new security scan.
 * @param {string} url 
 * @returns {Promise<{scanId: string, status: string, pollUrl: string}>}
 */
export async function startScan(url) {
  const res = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.trim(), authorized: true }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to start scan');
  }
  return data;
}

/**
 * Retrieve scan status and full results.
 * @param {string} scanId 
 */
export async function getScan(scanId) {
  const res = await fetch(`${API_BASE}/scan/${scanId}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch scan results');
  }
  return data;
}

/**
 * List recent scans.
 */
export async function listScans() {
  const res = await fetch(`${API_BASE}/scan`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to fetch recent scans');
  }
  return data.scans || [];
}

/**
 * Delete a scan.
 * @param {string} scanId 
 */
export async function deleteScan(scanId) {
  const res = await fetch(`${API_BASE}/scan/${scanId}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete scan');
  }
}

/**
 * Get direct download / view URL for scan report.
 * @param {string} scanId 
 */
export function getReportUrl(scanId) {
  return `${API_BASE}/report/${scanId}`;
}

/**
 * Check backend health.
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return await res.json();
  } catch (err) {
    return { status: 'offline', error: err.message };
  }
}
