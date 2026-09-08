import { useState, useCallback } from 'react';
import { useScan } from './hooks/useScan';
import { getScan, getReportUrl } from './api/client';
import ScanInput     from './components/ScanInput';
import ScoreGauge    from './components/ScoreGauge';
import SeverityCards from './components/SeverityCards';
import ReconPanel    from './components/ReconPanel';
import FindingCard   from './components/FindingCard';
import HistoryList   from './components/HistoryList';
import './index.css';

const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

export default function App() {
  const { scanId, status, progress, progressMsg, result, error, runScan, reset } = useScan();
  const [filter, setFilter]           = useState('all');
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const isScanning = ['starting', 'running'].includes(status);

  // Triggered when user clicks a history item
  const handleLoadScan = useCallback(async (id) => {
    try {
      const data = await getScan(id);
      // Inject the result directly via a hack — simpler than duplicating state
      window.__loadedScan = data;
      window.dispatchEvent(new CustomEvent('vulnora:loadscan', { detail: data }));
    } catch {}
  }, []);

  // Listen for loaded scan event
  const [loadedResult, setLoadedResult] = useState(null);

  useState(() => {
    const handler = (e) => setLoadedResult(e.detail);
    window.addEventListener('vulnora:loadscan', handler);
    return () => window.removeEventListener('vulnora:loadscan', handler);
  });

  const displayResult = result || loadedResult;

  const filteredFindings = (displayResult?.findings || [])
    .filter(f => filter === 'all' || f.severity === filter)
    .sort((a, b) => {
      if (a.found !== b.found) return a.found ? -1 : 1;
      return (SEV_ORDER[a.severity] ?? 5) - (SEV_ORDER[b.severity] ?? 5);
    });

  const handleScan = async (url) => {
    setLoadedResult(null);
    setFilter('all');
    setHistoryRefresh(n => n + 1);
    await runScan(url);
    setHistoryRefresh(n => n + 1);
  };

  const handleReset = () => {
    reset();
    setLoadedResult(null);
    setFilter('all');
  };

  return (
    <div>
      {/* ── Header ─────────────────────────────────────── */}
      <header className="site-header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-icon">🛡️</span>
            <span className="logo-text">Vuln<span className="logo-accent">ora</span></span>
          </div>
          <nav className="header-nav">
            <a href="#scan-section" className="nav-link">New Scan</a>
            <a href="#history-section" className="nav-link">History</a>
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-badge">AI-Powered Security Scanner</div>
          <h1 className="hero-title">Find Vulnerabilities.<br/>Fix Them Instantly.</h1>
          <p className="hero-subtitle">
            Scan your authorized web application for common security vulnerabilities.
            Get a Security Health Score and AI-generated, copy-pasteable remediation code.
          </p>
        </div>
      </section>

      {/* ── Scan Input ─────────────────────────────────── */}
      <section id="scan-section" className="section">
        <div className="container">
          <ScanInput onScan={handleScan} isScanning={isScanning} />

          {/* Progress bar */}
          {isScanning && (
            <div className="scan-card card" style={{ marginTop: '16px' }}>
              <div className="scan-progress">
                <div className="progress-header">
                  <span className="progress-label">{progressMsg}</span>
                  <span className="progress-dots"><span>.</span><span>.</span><span>.</span></span>
                </div>
                <div className="progress-bar-track">
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="progress-steps">
                  <span className={`step ${progress >= 15 ? 'done' : progress >= 5 ? 'active' : ''}`}>🔗 Fetching</span>
                  <span className={`step ${progress >= 45 ? 'done' : progress >= 20 ? 'active' : ''}`}>🔍 Recon</span>
                  <span className={`step ${progress >= 75 ? 'done' : progress >= 45 ? 'active' : ''}`}>🛡️ Scanning</span>
                  <span className={`step ${progress >= 100 ? 'done' : progress >= 75 ? 'active' : ''}`}>🤖 AI</span>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="scan-card card" style={{ marginTop: '16px', borderColor: 'var(--sev-critical)' }}>
              <p style={{ color: 'var(--sev-critical)' }}>❌ {error}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Results Dashboard ──────────────────────────── */}
      {displayResult && (
        <>
          {/* Score + Summary */}
          <section className="section">
            <div className="container">
              <div className="results-header-row">
                <ScoreGauge
                  score={displayResult.score?.score}
                  grade={displayResult.score?.grade}
                  targetUrl={displayResult.targetUrl}
                  durationMs={displayResult.durationMs}
                />
                <SeverityCards summary={displayResult.summary} />
                <div className="action-card card">
                  <h3 className="card-subtitle">Actions</h3>
                  <a
                    href={getReportUrl(displayResult.scanId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '10px', textDecoration: 'none' }}
                  >
                    <span>📥</span> Download Report
                  </a>
                  <button onClick={handleReset} className="btn btn-ghost">
                    <span>🔄</span> New Scan
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Recon */}
          <section className="section">
            <div className="container">
              <ReconPanel recon={displayResult.recon} />
            </div>
          </section>

          {/* Findings */}
          <section className="section">
            <div className="container">
              <div className="card">
                <div className="findings-header">
                  <h3 className="card-title">🛡️ Vulnerability Findings</h3>
                  <div className="findings-filters">
                    {['all', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(f => (
                      <button
                        key={f}
                        className={`filter-btn ${filter === f ? 'active' : ''}`}
                        onClick={() => setFilter(f)}
                      >{f === 'all' ? 'All' : f}</button>
                    ))}
                  </div>
                </div>
                <div className="findings-list">
                  {filteredFindings.length === 0
                    ? <p className="empty-state">No findings match this filter.</p>
                    : filteredFindings.map(f => <FindingCard key={f.id} finding={f} />)
                  }
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ── History ────────────────────────────────────── */}
      <section id="history-section" className="section">
        <div className="container">
          <HistoryList onLoadScan={handleLoadScan} refreshTrigger={historyRefresh} />
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="site-footer">
        <div className="container">
          <div className="disclaimer">
            ⚠️ <strong>Legal Disclaimer:</strong> This tool is for authorized security testing only.
            Unauthorized scanning of systems you do not own is illegal and unethical.
          </div>
          <p className="footer-copy">Vulnora v1.0 · Built for authorized security assessment</p>
        </div>
      </footer>
    </div>
  );
}
