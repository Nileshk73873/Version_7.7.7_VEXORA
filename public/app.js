/**
 * app.js — WebSec AI Frontend Logic
 * Handles scan initiation, polling, result rendering, and history.
 * Well-structured for handoff — each function is clearly named and documented.
 */

'use strict';

// ═══════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════
const API_BASE    = 'http://localhost:5000/api';
const POLL_MS     = 3000;  // How often to poll for scan results
const MAX_POLLS   = 60;    // Max poll attempts before giving up (~3 min)

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════
let currentScanId  = null;
let pollInterval   = null;
let pollCount      = 0;
let currentFilter  = 'all';
let allFindings    = [];

// ═══════════════════════════════════════════════════════════
// DOM REFERENCES
// ═══════════════════════════════════════════════════════════
const $   = (id) => document.getElementById(id);
const $$  = (sel) => document.querySelectorAll(sel);

const urlInput        = $('target-url');
const authCheck       = $('authorized-check');
const scanBtn         = $('scan-btn');
const scanProgress    = $('scan-progress');
const progressBar     = $('progress-bar');
const progressLabel   = $('progress-label');
const resultsSection  = $('results-section');
const findingsList    = $('findings-list');
const historyList     = $('history-list');
const urlError        = $('url-error');

// ═══════════════════════════════════════════════════════════
// INITIALISATION
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  loadHistory();
});

// ═══════════════════════════════════════════════════════════
// EVENT BINDING
// ═══════════════════════════════════════════════════════════
function bindEvents() {
  // Enable/disable scan button based on auth checkbox
  authCheck.addEventListener('change', () => {
    scanBtn.disabled = !authCheck.checked || !urlInput.value.trim();
  });

  // Enable/disable based on URL input
  urlInput.addEventListener('input', () => {
    scanBtn.disabled = !authCheck.checked || !urlInput.value.trim();
    urlError.textContent = '';
  });

  // Scan button click
  scanBtn.addEventListener('click', startScan);

  // Enter key in URL input
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !scanBtn.disabled) startScan();
  });

  // Download report
  $('download-report-btn').addEventListener('click', downloadReport);

  // New scan
  $('new-scan-btn').addEventListener('click', resetUI);

  // Refresh history
  $('refresh-history-btn').addEventListener('click', loadHistory);

  // Findings filter buttons
  $$('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderFindings(allFindings);
    });
  });
}

// ═══════════════════════════════════════════════════════════
// SCAN — START
// ═══════════════════════════════════════════════════════════
async function startScan() {
  const url = urlInput.value.trim();
  if (!url) return;

  // Basic URL validation on frontend
  try { new URL(url); } catch {
    urlError.textContent = 'Please enter a valid URL including http:// or https://';
    return;
  }

  resetScanState();
  showProgress(true);
  setProgressStep('step-fetch', 'active');
  setProgress(10, 'Connecting to target…');

  try {
    const res  = await fetch(`${API_BASE}/scan`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url, authorized: true }),
    });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || 'Failed to start scan.');
      return;
    }

    currentScanId = data.scanId;
    startPolling();

  } catch (err) {
    showError('Cannot reach the server. Is it running on port 5000?');
  }
}

// ═══════════════════════════════════════════════════════════
// SCAN — POLLING
// ═══════════════════════════════════════════════════════════
function startPolling() {
  pollCount = 0;
  pollInterval = setInterval(async () => {
    pollCount++;
    if (pollCount > MAX_POLLS) {
      clearInterval(pollInterval);
      showError('Scan timed out. Please try again.');
      return;
    }
    await pollScanStatus();
  }, POLL_MS);
}

async function pollScanStatus() {
  try {
    const res  = await fetch(`${API_BASE}/scan/${currentScanId}`);
    const data = await res.json();

    if (!res.ok) {
      clearInterval(pollInterval);
      showError(data.error || 'Failed to retrieve scan.');
      return;
    }

    updateProgressFromStatus(data.status, pollCount);

    if (data.status === 'completed') {
      clearInterval(pollInterval);
      setProgress(100, 'Scan complete!');
      setTimeout(() => renderResults(data), 500);
    } else if (data.status === 'failed') {
      clearInterval(pollInterval);
      showError(data.error || 'Scan failed.');
    }

  } catch (err) {
    // Network blip — keep polling
    console.warn('Poll error:', err.message);
  }
}

function updateProgressFromStatus(status, poll) {
  if (status === 'running') {
    const pct = Math.min(20 + poll * 8, 85);
    if (poll < 3)  { setProgress(pct, 'Running reconnaissance…');       setProgressStep('step-recon', 'active'); }
    if (poll >= 3) { setProgress(pct, 'Running vulnerability scanners…'); setProgressStep('step-scan', 'active'); setProgressStep('step-recon', 'done'); }
    if (poll >= 6) { setProgress(pct, 'Generating AI remediations…');   setProgressStep('step-ai', 'active');   setProgressStep('step-scan', 'done'); }
  }
}

// ═══════════════════════════════════════════════════════════
// RENDER RESULTS
// ═══════════════════════════════════════════════════════════
function renderResults(data) {
  showProgress(false);
  resultsSection.classList.remove('hidden');

  renderScore(data);
  renderSummary(data.summary);
  renderRecon(data.recon);

  allFindings = data.findings || [];
  renderFindings(allFindings);

  $('score-target-url').textContent = data.targetUrl;
  $('score-duration').textContent   = `Scan duration: ${((data.durationMs || 0) / 1000).toFixed(1)}s`;

  // Scroll to results
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Refresh history
  loadHistory();
}

// ── Score gauge ───────────────────────────────────────────
function renderScore(data) {
  const score = data.score?.score ?? 0;
  const grade = data.score?.grade ?? '--';

  $('gauge-score').textContent = score;
  $('gauge-grade').textContent = grade;

  // Animate gauge arc (semi-circle = 251.2 total length)
  const arc    = document.getElementById('gauge-arc');
  const pct    = score / 100;
  const offset = 251.2 * (1 - pct);
  arc.style.strokeDashoffset = offset;
  arc.style.stroke = scoreColor(score);
  $('gauge-score').style.color = scoreColor(score);
}

function scoreColor(score) {
  if (score >= 90) return '#00ff88';
  if (score >= 70) return '#7ed321';
  if (score >= 50) return '#f5a623';
  if (score >= 30) return '#ff6b35';
  return '#ff3b3b';
}

// ── Severity summary ──────────────────────────────────────
function renderSummary(summary = {}) {
  $('sev-critical').textContent = summary.critical || 0;
  $('sev-high').textContent     = summary.high     || 0;
  $('sev-medium').textContent   = summary.medium   || 0;
  $('sev-low').textContent      = summary.low      || 0;
  $('sev-total').textContent    = summary.total    || 0;
}

// ── Recon panel ───────────────────────────────────────────
function renderRecon(recon) {
  const grid = $('recon-grid');
  if (!recon) { grid.innerHTML = '<p class="empty-state">No recon data.</p>'; return; }

  const ssl      = recon.ssl || {};
  const sslClass = ssl.valid && ssl.daysLeft > 30 ? 'good' : ssl.valid ? 'warn' : 'bad';
  const sslText  = ssl.valid
    ? `✅ Valid · ${ssl.daysLeft}d remaining · ${ssl.issuer || 'Unknown issuer'}`
    : '❌ Invalid or HTTPS not used';

  const items = [
    { key: 'IP Addresses',   val: (recon.ipAddresses || []).join(', ') || 'N/A' },
    { key: 'SSL / TLS',      val: sslText, cls: sslClass },
    { key: 'Response Time',  val: recon.responseTimeMs ? `${recon.responseTimeMs}ms` : 'N/A' },
    { key: 'Server',         val: recon.serverHeader || 'Hidden / Not exposed', cls: recon.serverHeader ? 'warn' : 'good' },
    { key: 'Tech Stack',     val: (recon.techStack || []).length
        ? recon.techStack.map(t => `<span class="tag">${t}</span>`).join('')
        : 'Not detected', isHtml: true },
    { key: 'NS Records',     val: (recon.dnsRecords?.ns || []).slice(0, 3).join(', ') || 'N/A' },
    { key: 'MX Records',     val: (recon.dnsRecords?.mx || []).slice(0, 2).join(', ') || 'N/A' },
    { key: 'Redirect Chain', val: (recon.redirectChain || []).length > 0
        ? recon.redirectChain.join(' → ')
        : 'No redirects', cls: 'good' },
  ];

  grid.innerHTML = items.map(item => `
    <div class="recon-item">
      <div class="recon-key">${item.key}</div>
      <div class="recon-val ${item.cls || ''}">${item.isHtml ? item.val : escapeHtml(item.val)}</div>
    </div>
  `).join('');
}

// ── Findings list ─────────────────────────────────────────
function renderFindings(findings) {
  const filtered = currentFilter === 'all'
    ? findings
    : findings.filter(f => f.severity === currentFilter);

  // Sort: found first, then by severity weight
  const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
  const sorted   = [...filtered].sort((a, b) => {
    if (a.found !== b.found) return a.found ? -1 : 1;
    return (sevOrder[a.severity] || 5) - (sevOrder[b.severity] || 5);
  });

  if (sorted.length === 0) {
    findingsList.innerHTML = '<p class="empty-state">No findings match this filter.</p>';
    return;
  }

  findingsList.innerHTML = sorted.map(f => buildFindingHTML(f)).join('');

  // Bind expand/collapse
  findingsList.querySelectorAll('.finding-header').forEach(header => {
    header.addEventListener('click', () => {
      const body   = header.nextElementSibling;
      const toggle = header.querySelector('.finding-toggle');
      const open   = body.style.display !== 'none';
      body.style.display  = open ? 'none' : 'block';
      toggle.textContent  = open ? '▼' : '▲';
    });
  });

  // Bind copy buttons
  findingsList.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const code = btn.closest('.code-fix-wrapper').querySelector('.code-block').textContent;
      navigator.clipboard.writeText(code).then(() => {
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
      });
    });
  });
}

function buildFindingHTML(f) {
  const rem = f.remediation;
  return `
  <div class="finding-item ${f.found ? '' : 'not-found'}" data-severity="${f.severity}">
    <div class="finding-header">
      <span class="sev-badge ${f.severity}">${f.severity}</span>
      <span class="finding-name">${escapeHtml(f.name)}</span>
      <span class="finding-cwe">${f.cwe || ''}</span>
      <span class="finding-status">${f.found ? '🔴' : '✅'}</span>
      <span class="finding-toggle">▼</span>
    </div>
    <div class="finding-body" style="display:none;">
      <p class="finding-desc">${escapeHtml(f.description || '')}</p>

      ${f.found && f.evidence ? `
        <div class="evidence-box">⚠️ Evidence: ${escapeHtml(f.evidence)}</div>
      ` : ''}

      ${!f.found ? `<p style="color:var(--sev-low);font-size:0.875rem;">✅ No issue detected for this check.</p>` : ''}

      ${f.found && rem ? `
        <div class="remediation-panel">
          <div class="remediation-title">🤖 AI Remediation (${rem.ai_model || 'Gemini'})</div>
          <p class="ai-explanation">${escapeHtml(rem.explanation || '')}</p>

          ${rem.steps?.length ? `
            <div class="ai-steps">
              <div class="ai-steps-title">📋 Fix Steps</div>
              <ol>${rem.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
            </div>
          ` : ''}

          ${rem.code_fix ? `
            <div class="code-fix-title">💻 Code Fix (${rem.code_language || 'generic'})</div>
            <div class="code-fix-wrapper">
              <pre class="code-block">${escapeHtml(rem.code_fix)}</pre>
              <button class="copy-btn">Copy</button>
            </div>
          ` : ''}

          ${rem.prevention?.length ? `
            <div class="prevention-title">🛡️ Prevention</div>
            <ul class="prevention-list">
              ${rem.prevention.map(p => `<li>${escapeHtml(p)}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
      ` : ''}

      <div style="margin-top:12px;display:flex;gap:12px;flex-wrap:wrap;">
        ${f.owasp ? `<span class="tag">OWASP ${f.owasp}</span>` : ''}
        ${f.cvss  ? `<span class="tag">CVSS ${f.cvss}</span>`  : ''}
        ${f.cwe   ? `<span class="tag">${f.cwe}</span>`        : ''}
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// HISTORY
// ═══════════════════════════════════════════════════════════
async function loadHistory() {
  try {
    const res  = await fetch(`${API_BASE}/scan`);
    const data = await res.json();
    renderHistory(data.scans || []);
  } catch {
    historyList.innerHTML = '<p class="empty-state">Could not load history.</p>';
  }
}

function renderHistory(scans) {
  if (!scans.length) {
    historyList.innerHTML = '<p class="empty-state">No scans yet. Run your first scan above.</p>';
    return;
  }

  historyList.innerHTML = scans.map(s => `
    <div class="history-item" data-scan-id="${s.id}" title="Click to load results">
      <span class="history-url">${escapeHtml(s.target_url)}</span>
      <span class="history-grade">${s.grade || '--'}</span>
      <span class="history-score" style="color:${scoreColor(s.health_score || 0)}">${s.health_score ?? '--'}</span>
      <span class="status-pill ${s.status}">${s.status}</span>
      <span class="history-date">${s.started_at ? new Date(s.started_at).toLocaleString() : ''}</span>
    </div>
  `).join('');

  // Click to load completed scan
  historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', async () => {
      const scanId = item.dataset.scanId;
      try {
        const res  = await fetch(`${API_BASE}/scan/${scanId}`);
        const data = await res.json();
        if (data.status === 'completed') {
          currentScanId = scanId;
          renderResults(data);
          document.getElementById('scan-section').scrollIntoView({ behavior: 'smooth' });
        }
      } catch {
        // Silent fail
      }
    });
  });
}

// ═══════════════════════════════════════════════════════════
// REPORT DOWNLOAD
// ═══════════════════════════════════════════════════════════
function downloadReport() {
  if (!currentScanId) return;
  window.open(`${API_BASE}/report/${currentScanId}`, '_blank');
}

// ═══════════════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════════════
function showProgress(show) {
  scanProgress.classList.toggle('hidden', !show);
  scanBtn.disabled = show;
}

function setProgress(pct, label) {
  progressBar.style.width  = `${pct}%`;
  progressLabel.textContent = label;
}

function setProgressStep(stepId, cls) {
  const step = $(stepId);
  if (!step) return;
  step.classList.remove('active', 'done');
  if (cls) step.classList.add(cls);
}

function showError(msg) {
  showProgress(false);
  urlError.textContent = `❌ ${msg}`;
  scanBtn.disabled = false;
}

function resetScanState() {
  urlError.textContent = '';
  resultsSection.classList.add('hidden');
  currentScanId = null;
  pollCount     = 0;
  allFindings   = [];
  if (pollInterval) clearInterval(pollInterval);
  setProgress(0, 'Initialising…');
  ['step-fetch','step-recon','step-scan','step-ai'].forEach(id => setProgressStep(id, ''));
}

function resetUI() {
  resetScanState();
  showProgress(false);
  urlInput.value      = '';
  authCheck.checked   = false;
  scanBtn.disabled    = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
