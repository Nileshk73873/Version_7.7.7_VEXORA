// API Base URL
// In development: Vite proxy forwards '/api' to backend
// In production (separated URLs): VITE_API_URL is e.g. 'https://vulnora-server.onrender.com'
const envApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const API_BASE = envApiUrl ? (envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl}/api`) : '/api';

export const startScan = async (url) => {
  const res = await fetch(`${API_BASE}/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, authorized: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to start scan');
  return data;
};

export const getScan = async (scanId) => {
  const res = await fetch(`${API_BASE}/scan/${scanId}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get scan');
  return data;
};

export const listScans = async () => {
  const res = await fetch(`${API_BASE}/scan`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to list scans');
  return data.scans || [];
};

export const deleteScan = async (scanId) => {
  const res = await fetch(`${API_BASE}/scan/${scanId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete scan');
};

export const getReportUrl = (scanId) => `${API_BASE}/report/${scanId}`;
