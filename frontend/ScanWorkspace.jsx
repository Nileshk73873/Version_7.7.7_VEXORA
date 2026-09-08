import React, { useState, useRef, useEffect, useCallback } from 'react';
import Aurora from './Aurora';
import BorderGlow from './BorderGlow';
import SpecularButton from './SpecularButton';
import { startScan, getScan, listScans, getReportUrl, deleteScan } from './api';
import ScanChat from './ScanChat';

const tokens = {
  void: '#0A0E14',
  panel: '#121826',
  panelRaised: '#1B2430',
  hairline: '#263140',
  textMuted: '#8B98A9',
  accent: '#7C6FFF',
  crit: '#FF5C5C',
  high: '#F5A623',
  medium: '#FACC15',
  low: '#5EEAD4',
  success: '#10B981',
};

// Initial fallback findings if database is fresh
const defaultFindings = [
  {
    id: 'CHK-01',
    severity: 'HIGH',
    cwe: 'CWE-693',
    owasp: 'OWASP A05:2021',
    cvss: '7.5',
    title: 'Content-Security-Policy (CSP)',
    desc: 'Content-Security-Policy header is missing. This allows attackers to inject malicious scripts (XSS) that the browser will execute without restriction.',
    evidence: 'Header completely absent',
    passed: false,
    remediation: {
      explanation: 'Content-Security-Policy restricts which domains and resources can be loaded by the browser.',
      steps: ['Install helmet or set header manually', 'Define default-src and script-src', 'Test in staging'],
      code_fix: `// Express.js Helmet CSP header configuration:\napp.use(helmet.contentSecurityPolicy({\n  directives: {\n    defaultSrc: ["'self'"],\n    scriptSrc: ["'self'", "'unsafe-inline'"],\n  }\n}));`,
      prevention: ['Avoid inline scripts', 'Use nonces or hashes for scripts'],
    },
  },
  {
    id: 'CHK-02',
    severity: 'MEDIUM',
    cwe: 'CWE-1021',
    owasp: 'OWASP A05:2021',
    cvss: '5.4',
    title: 'X-Frame-Options (Clickjacking)',
    desc: 'X-Frame-Options header is missing. This allows malicious websites to embed your page inside invisible frames to hijack user clicks.',
    evidence: 'X-Frame-Options header not set',
    passed: false,
    remediation: {
      explanation: 'Without this header, malicious sites can frame your application.',
      steps: ['Add SAMEORIGIN or DENY to response headers'],
      code_fix: `res.setHeader('X-Frame-Options', 'SAMEORIGIN');`,
      prevention: ['Use CSP frame-ancestors directive alongside X-Frame-Options'],
    },
  },
];

export default function ScanWorkspace({ onBack }) {
  const [targetUrl, setTargetUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatusMessage, setScanStatusMessage] = useState('');
  const [scanError, setScanError] = useState('');
  const [activeTab, setActiveTab] = useState('scan');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Current active scan state (null initially until user starts or selects a scan)
  const [currentScan, setCurrentScan] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  // Per-scan chat history — persisted for the entire page session
  const [chatHistories, setChatHistories] = useState({});

  const saveChatHistory = useCallback((scanId, messages) => {
    setChatHistories(prev => ({ ...prev, [scanId]: messages }));
  }, []);

  const historyRef = useRef(null);
  const resultsRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // Fetch scan history on component mount
  useEffect(() => {
    loadHistory();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const loadHistory = async () => {
    try {
      const scans = await listScans();
      if (Array.isArray(scans)) {
        const formatted = scans.map((s) => ({
          id: s.id,
          url: s.target_url,
          timestamp: new Date(s.started_at).toLocaleString(),
          status: (s.status || 'COMPLETED').toUpperCase(),
          score: s.health_score,
          grade: s.grade || '--',
          durationMs: s.duration_ms,
        }));
        setRecentScans(formatted);
      }
    } catch (err) {
      console.warn('Could not load scan history:', err.message);
    }
  };

  const loadScanDetails = async (scanId) => {
    try {
      const data = await getScan(scanId);
      if (data && data.status === 'completed') {
        setCurrentScan(data);
        if (data.targetUrl) setTargetUrl(data.targetUrl);
      }
    } catch (err) {
      console.error('Failed to load scan details:', err);
    }
  };

  const handleStartScan = async (e) => {
    e.preventDefault();
    let url = targetUrl.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
      setTargetUrl(url);
    }

    setScanError('');
    setIsScanning(true);
    setScanStatusMessage('Initializing security audit...');

    // Optimistically add to history list
    const tempId = `temp-${Date.now()}`;
    setRecentScans((prev) => [
      {
        id: tempId,
        url,
        timestamp: new Date().toLocaleString(),
        status: 'RUNNING',
        score: null,
        grade: '--',
      },
      ...prev.filter((item) => !item.id.startsWith('temp-')),
    ]);

    try {
      const initResult = await startScan(url);
      const scanId = initResult.scanId;

      setScanStatusMessage('Probing headers, SSL & testing vulnerabilities...');

      // Start polling backend for completion
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      const startTime = Date.now();
      pollIntervalRef.current = setInterval(async () => {
        try {
          const scan = await getScan(scanId);

          if (scan.status === 'completed') {
            clearInterval(pollIntervalRef.current);
            setCurrentScan(scan);
            setIsScanning(false);
            setScanStatusMessage('');
            await loadHistory();

            // Smoothly scroll down to results
            setTimeout(() => {
              if (resultsRef.current) {
                resultsRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }, 300);
          } else if (scan.status === 'failed') {
            clearInterval(pollIntervalRef.current);
            setIsScanning(false);
            setScanError(scan.error || 'Scan encountered an error.');
            setScanStatusMessage('');
            await loadHistory();
          } else {
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            if (elapsed > 10) {
              setScanStatusMessage('Generating AI remediation guidance with Gemini...');
            }
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
        }
      }, 1500);
    } catch (err) {
      setIsScanning(false);
      setScanStatusMessage('');
      setScanError(err.message || 'Failed to connect to backend server');
    }
  };

  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const downloadReport = () => {
    if (currentScan && currentScan.scanId) {
      window.open(getReportUrl(currentScan.scanId), '_blank');
      return;
    }
    // No scan yet — nothing to download
    alert('Run a scan first to generate a downloadable report.');
  };

  const handleDeleteScan = async (e, scanId) => {
    e.stopPropagation(); // Don't trigger row click
    if (!window.confirm('Delete this scan and all its data?')) return;
    setDeletingId(scanId);
    try {
      await deleteScan(scanId);
      // If the deleted scan is the currently displayed one, clear it
      if (currentScan && currentScan.scanId === scanId) {
        setCurrentScan(null);
      }
      await loadHistory();
    } catch (err) {
      alert('Failed to delete scan: ' + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const scrollToHistory = () => {
    setActiveTab('history');
    if (historyRef.current) {
      historyRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Extract score and grade
  const currentScore = currentScan?.score?.score ?? 0;
  const currentGrade = currentScan ? (currentScan?.score?.grade || '--').toUpperCase() : '--';
  const durationSec = currentScan?.durationMs ? (currentScan.durationMs / 1000).toFixed(1) + 's' : '--';

  // Extract summary breakdown
  const summary = currentScan?.summary || {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    total: 0,
  };

  // Extract recon data
  const recon = currentScan?.recon || {};
  const ipAddressesStr = Array.isArray(recon.ipAddresses) && recon.ipAddresses.length > 0
    ? recon.ipAddresses.join(', ')
    : '--';
  const sslStatus = recon.ssl
    ? (recon.ssl.valid ? `Valid (${recon.ssl.issuer || 'Secure'})` : 'Invalid or HTTPS not used')
    : '--';
  const responseTimeStr = recon.responseTimeMs ? `${recon.responseTimeMs}ms` : '--';
  const serverHeaderStr = recon.serverHeader || '--';
  const techStackList = Array.isArray(recon.techStack) && recon.techStack.length > 0
    ? recon.techStack
    : [];
  const redirectsStr = Array.isArray(recon.redirectChain) && recon.redirectChain.length > 0
    ? `${recon.redirectChain.length} Hop(s)`
    : '--';

  // Normalize findings list
  const rawFindings = currentScan?.findings;
  const displayFindings = Array.isArray(rawFindings)
    ? rawFindings.map((f) => ({
        id: f.id,
        severity: f.severity,
        cwe: f.cwe || 'CWE-N/A',
        owasp: f.owasp ? (f.owasp.startsWith('OWASP') ? f.owasp : `OWASP ${f.owasp}`) : 'OWASP A05:2021',
        cvss: f.cvss ? `CVSS ${f.cvss}` : 'CVSS 5.0',
        title: f.name || f.title || f.id,
        desc: f.description || f.desc || '',
        evidence: f.evidence ? `Evidence: ${f.evidence}` : 'Detected via automated scanning',
        passed: !f.found,
        remediation: f.remediation,
      }))
    : [];

  // Filter findings
  const filteredFindings = displayFindings.filter((item) => {
    if (selectedSeverity === 'ALL') return true;
    return item.severity === selectedSeverity;
  });

  return (
    <div className="relative min-h-screen text-white overflow-x-hidden font-sans" style={{ background: tokens.void }}>
      {/* WebGL Aurora Background Shader */}
      <div className="absolute inset-0 z-0 opacity-100 pointer-events-none">
        <Aurora colorStops={['#A855F7', '#C084FC', '#5227FF']} blend={0.5} amplitude={1.3} speed={0.8} />
      </div>

      {/* Vignette Overlay for readability */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle at 50% 30%, rgba(10,14,20,0.2) 0%, rgba(10,14,20,0.7) 70%, #0A0E14 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Navigation — Identical to mvp.jsx Navbar styling with Talina font */}
        <header className="fixed top-5 inset-x-0 z-50 max-w-3xl mx-auto px-4 pointer-events-auto font-talina">
          <div
            className="px-6 h-13 flex items-center justify-between rounded-full backdrop-blur-xl shadow-2xl transition-all"
            style={{
              background: 'rgba(18, 24, 38, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.28)',
              boxShadow: '0 0 25px rgba(124, 111, 255, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.5), 0 12px 36px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Logo */}
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-[18px] tracking-wide" style={{ fontFamily: "'Talina', 'Poppins', sans-serif" }}>
                Vulnora
              </span>
            </div>

            {/* Nav Action Links */}
            <div className="flex items-center gap-6 text-[13.5px] font-medium" style={{ color: tokens.textMuted, fontFamily: "'Talina', 'Poppins', sans-serif" }}>
              <button
                onClick={() => {
                  setActiveTab('scan');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`hover:text-white transition-colors cursor-pointer ${
                  activeTab === 'scan' ? 'text-white font-semibold' : ''
                }`}
              >
                New Scan
              </button>
              <button
                onClick={scrollToHistory}
                className={`hover:text-white transition-colors cursor-pointer ${
                  activeTab === 'history' ? 'text-white font-semibold' : ''
                }`}
              >
                History
              </button>
            </div>

            {/* CTA Back Button */}
            <button
              onClick={onBack}
              className="text-[13px] font-semibold px-4 py-1.5 rounded-full transition-transform active:scale-95 shadow-md hover:brightness-110 cursor-pointer"
              style={{ background: tokens.accent, color: tokens.void, fontFamily: "'Talina', 'Poppins', sans-serif" }}
            >
              Back to Home
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-6xl mx-auto px-6 w-full flex-grow flex flex-col items-center">
          {/* Target Scanner Hero MVP */}
          <div className="w-full max-w-4xl text-center flex flex-col items-center justify-center min-h-[calc(100vh-140px)] my-auto py-12">
            <h1
              className="text-[44px] sm:text-[62px] md:text-[76px] lg:text-[84px] font-black tracking-tight leading-[1.06] mb-6 text-center text-white"
              style={{
                fontFamily: "'Poppins', sans-serif",
                textShadow: '0 10px 40px rgba(0,0,0,0.6)',
              }}
            >
              Run Automated<br />
              <span style={{ color: tokens.accent }}>Vulnerability Audit</span>
            </h1>

            <p className="text-[16px] sm:text-[19px] text-[#8B98A9] max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
              Analyze headers, SSL parameters, exposed endpoints, and security posture in real-time.
            </p>

            {/* URL Input Bar with Embedded Audit SpecularButton */}
            <form onSubmit={handleStartScan} className="w-full max-w-2xl mx-auto">
              <div
                className="relative w-full flex items-center p-2 rounded-full backdrop-blur-2xl transition-all shadow-2xl"
                style={{
                  background: 'rgba(18, 24, 38, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  boxShadow: '0 0 40px rgba(124, 111, 255, 0.25), inset 0 1px 2px rgba(255, 255, 255, 0.3), 0 20px 50px rgba(0, 0, 0, 0.7)',
                }}
              >
                <div className="pl-4 pr-2 flex items-center pointer-events-none text-white/40">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10z" />
                  </svg>
                </div>

                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://example.com"
                  disabled={isScanning}
                  className="flex-1 bg-transparent px-3 py-3 text-white placeholder-white/40 focus:outline-none font-mono text-[14.5px]"
                />

                <SpecularButton
                  type="submit"
                  size="md"
                  radius={999}
                  tint="#161E2E"
                  tintOpacity={0.9}
                  blur={12}
                  textColor="#ffffff"
                  lineColor="#C084FC"
                  baseColor="#7C6FFF"
                  intensity={1.5}
                  shineSize={16}
                  shineFade={45}
                  thickness={1.2}
                  speed={0.4}
                  autoAnimate={isScanning}
                  disabled={isScanning}
                  className="px-6 py-2 shadow-lg font-bold"
                >
                  {isScanning ? 'Scanning...' : 'Start Audit'}
                </SpecularButton>
              </div>
            </form>

            {/* Scan Progress / Status Banner */}
            {isScanning && (
              <div className="mt-6 px-6 py-3 rounded-full bg-[#7C6FFF]/15 border border-[#7C6FFF]/30 backdrop-blur-md flex items-center gap-3 text-[14px] text-[#A78BFA] animate-pulse">
                <svg className="w-4 h-4 animate-spin text-[#7C6FFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                <span>{scanStatusMessage || 'Scanning target system in real-time...'}</span>
              </div>
            )}

            {/* Error Message */}
            {scanError && (
              <div className="mt-6 px-6 py-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-[#FF5C5C] text-[13.5px] font-medium flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{scanError}</span>
              </div>
            )}
          </div>

          {/* Audit Dashboard Workspace */}
          <div ref={resultsRef} className="w-full flex flex-col gap-10 pt-16 pb-20 mt-8 border-t border-white/10">
            {/* Top Stats Dashboard Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full items-stretch">
              {/* Security Health Score Arc Dial Box */}
              <div className="lg:col-span-4 p-6 rounded-3xl bg-[#121826]/80 border border-white/15 backdrop-blur-xl flex flex-col items-center justify-between text-center shadow-2xl min-h-[220px]">
                <p className="text-[11px] font-mono font-bold tracking-widest text-[#8B98A9] uppercase mb-1">
                  SECURITY HEALTH SCORE
                </p>

                {/* SVG Upward Radial Gauge */}
                <div className="relative w-52 h-28 flex flex-col items-center justify-center my-1">
                  <svg className="w-52 h-28" viewBox="0 0 120 65">
                    {/* Background Track Arc */}
                    <path
                      d="M 12 58 A 48 48 0 0 1 108 58"
                      fill="none"
                      stroke="#1F293D"
                      strokeWidth="9"
                      strokeLinecap="round"
                    />
                    {/* Active Score Gauge Arc */}
                    <path
                      d="M 12 58 A 48 48 0 0 1 108 58"
                      fill="none"
                      stroke={currentScore >= 80 ? '#10B981' : currentScore >= 50 ? '#F5A623' : '#FF5C5C'}
                      strokeWidth="9"
                      strokeDasharray="150.8"
                      strokeDashoffset={150.8 * (1 - currentScore / 100)}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute bottom-1 flex flex-col items-center justify-center">
                    <span className="text-[38px] font-black tracking-tight leading-none text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
                      {currentScore}
                    </span>
                    <span
                      className={`text-[11px] font-mono font-bold tracking-widest uppercase mt-0.5 ${
                        currentScore >= 80 ? 'text-[#10B981]' : currentScore >= 50 ? 'text-[#F5A623]' : 'text-[#FF5C5C]'
                      }`}
                    >
                      {currentGrade}
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-[12px] text-[#8B98A9]">
                  <p className="font-mono text-white/80 truncate max-w-[220px] mx-auto">{currentScan?.targetUrl || targetUrl}</p>
                  <p className="mt-0.5">Duration: {durationSec}</p>
                </div>
              </div>

              {/* Severity Breakdown Counter Cards */}
              <div className="lg:col-span-5 grid grid-cols-5 gap-2.5 p-6 rounded-3xl bg-[#121826]/80 border border-white/15 backdrop-blur-xl items-center shadow-2xl min-h-[220px]">
                <div className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 border border-white/10 h-full">
                  <span className="text-[24px] font-bold text-[#FF5C5C] font-mono">{summary.critical}</span>
                  <span className="text-[9px] font-mono font-bold uppercase text-[#FF5C5C] tracking-wider mt-1">CRITICAL</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 border border-white/10 h-full">
                  <span className="text-[24px] font-bold text-[#F5A623] font-mono">{summary.high}</span>
                  <span className="text-[9px] font-mono font-bold uppercase text-[#F5A623] tracking-wider mt-1">HIGH</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 border border-white/10 h-full">
                  <span className="text-[24px] font-bold text-[#FACC15] font-mono">{summary.medium}</span>
                  <span className="text-[9px] font-mono font-bold uppercase text-[#FACC15] tracking-wider mt-1">MEDIUM</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 border border-white/10 h-full">
                  <span className="text-[24px] font-bold text-[#5EEAD4] font-mono">{summary.low}</span>
                  <span className="text-[9px] font-mono font-bold uppercase text-[#5EEAD4] tracking-wider mt-1">LOW</span>
                </div>
                <div className="flex flex-col items-center justify-center p-2.5 rounded-2xl bg-white/5 border border-white/10 h-full">
                  <span className="text-[24px] font-bold text-[#7C6FFF] font-mono">{summary.total}</span>
                  <span className="text-[9px] font-mono font-bold uppercase text-[#7C6FFF] tracking-wider mt-1">TOTAL</span>
                </div>
              </div>

              {/* Actions Quick Access Card */}
              <div className="lg:col-span-3 p-6 rounded-3xl bg-[#121826]/80 border border-white/15 backdrop-blur-xl flex flex-col justify-between shadow-2xl min-h-[220px]">
                <p className="text-[11px] font-mono font-bold tracking-widest text-[#8B98A9] uppercase mb-2">ACTIONS</p>
                <div className="flex flex-col gap-3 my-auto">
                  <button
                    onClick={downloadReport}
                    className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 font-semibold text-[13.5px] transition-all cursor-pointer shadow-md"
                  >
                    <svg className="w-4 h-4 text-[#7C6FFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <polyline points="9 15 12 18 15 15" />
                    </svg>
                    Download Report
                  </button>

                  <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-[#7C6FFF]/20 hover:bg-[#7C6FFF]/30 border border-[#7C6FFF]/40 text-[#A78BFA] font-semibold text-[13.5px] transition-all cursor-pointer shadow-md"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    New Scan
                  </button>
                </div>
              </div>
            </div>

            {/* Reconnaissance Section Grid */}
            <div className="p-8 rounded-3xl bg-[#121826]/80 border border-white/15 backdrop-blur-xl shadow-2xl flex flex-col gap-6">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-[#7C6FFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                  <path d="M2 12h20" />
                </svg>
                <h2 className="text-[20px] font-bold tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  Reconnaissance
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* IP ADDRESSES */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">IP ADDRESSES</p>
                  <p className="text-[14px] font-mono text-white font-medium truncate">{ipAddressesStr}</p>
                </div>

                {/* SSL / TLS */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">SSL / TLS</p>
                  <div className={`flex items-center gap-2 text-[13.5px] font-medium ${recon.ssl?.valid ? 'text-[#10B981]' : 'text-[#FF5C5C]'}`}>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span className="truncate">{sslStatus}</span>
                  </div>
                </div>

                {/* RESPONSE TIME */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">RESPONSE TIME</p>
                  <p className="text-[14px] font-mono text-white font-medium">{responseTimeStr}</p>
                </div>

                {/* SERVER */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">SERVER</p>
                  <p className="text-[14px] font-mono text-[#F5A623] font-medium truncate">{serverHeaderStr}</p>
                </div>

                {/* TECH STACK */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">TECH STACK</p>
                  <div className="flex flex-wrap gap-1">
                    {techStackList.map((t, idx) => (
                      <span key={idx} className="px-2.5 py-0.5 rounded-md bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 font-mono text-[11px] font-bold">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* REDIRECTS */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">REDIRECTS</p>
                  <p className="text-[14px] font-mono text-[#10B981] font-medium">{redirectsStr}</p>
                </div>

                {/* SCAN STATUS */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">SCAN STATUS</p>
                  <p className="text-[14px] font-mono text-[#7C6FFF] font-bold uppercase">{currentScan?.status || 'COMPLETED'}</p>
                </div>

                {/* ENGINE */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">AI REMEDIATOR</p>
                  <p className="text-[14px] font-mono text-[#A78BFA] font-medium">Gemini 3.5 Flash</p>
                </div>
              </div>
            </div>

            {/* Vulnerability Findings Section */}
            <div className="p-8 rounded-3xl bg-[#121826]/80 border border-white/15 backdrop-blur-xl shadow-2xl flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-[#7C6FFF]/20 border border-[#7C6FFF] flex items-center justify-center text-[#7C6FFF]">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                    </svg>
                  </div>
                  <h2 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Vulnerability Findings
                  </h2>
                </div>

                {/* Severity Filter Tabs */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/5 border border-white/10">
                  {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSelectedSeverity(tab)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        selectedSeverity === tab
                          ? 'bg-[#7C6FFF] text-white shadow-md'
                          : 'text-[#8B98A9] hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detailed Vulnerability Findings List */}
              <div className="flex flex-col gap-4">
                {filteredFindings.length === 0 ? (
                  <div className="p-8 text-center text-[#8B98A9] text-[13.5px] bg-white/5 border border-white/10 rounded-2xl">
                    <p className="font-medium text-white/70">No vulnerability findings to display.</p>
                    <p className="text-[12px] text-[#8B98A9] mt-1">Enter a target URL above and click "Start Audit" to perform a real-time security scan.</p>
                  </div>
                ) : (
                  filteredFindings.map((item) => {
                  const isExpanded = expandedId === item.id;
                  const remediation = item.remediation;

                  return (
                    <BorderGlow
                      key={item.id}
                      edgeSensitivity={20}
                      glowColor={item.severity === 'CRITICAL' || item.severity === 'HIGH' ? '30 100 60' : '262 100 75'}
                      backgroundColor="#121826"
                      borderRadius={20}
                      glowRadius={35}
                      glowIntensity={1.0}
                      colors={item.severity === 'CRITICAL' || item.severity === 'HIGH' ? ['#F5A623', '#FF5C5C'] : ['#C084FC', '#7C6FFF']}
                      fillOpacity={0.4}
                    >
                      <div className="p-6">
                        {/* Header Row */}
                        <div
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-[11px] font-mono uppercase px-2.5 py-0.5 rounded-md font-bold ${
                                item.severity === 'CRITICAL'
                                  ? 'bg-[#FF5C5C]/20 text-[#FF5C5C] border border-[#FF5C5C]/40'
                                  : item.severity === 'HIGH'
                                  ? 'bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40'
                                  : item.severity === 'MEDIUM'
                                  ? 'bg-[#FACC15]/20 text-[#FACC15] border border-[#FACC15]/40'
                                  : 'bg-[#5EEAD4]/20 text-[#5EEAD4] border border-[#5EEAD4]/40'
                              }`}
                            >
                              {item.severity}
                            </span>

                            <h3 className="text-[17px] font-semibold text-white tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                              {item.title}
                            </h3>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[12px] font-mono text-[#8B98A9]">{item.cwe}</span>
                            {/* Passed/Failed Status Badge */}
                            {item.passed ? (
                              <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </div>
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400">
                                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="12" cy="12" r="10" />
                                </svg>
                              </div>
                            )}

                            {/* Chevron Toggle */}
                            <svg
                              className={`w-4 h-4 text-[#8B98A9] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </div>
                        </div>

                        {/* Expanded Content Details */}
                        {isExpanded && (
                          <div className="mt-5 pt-4 border-t border-white/10 flex flex-col gap-4 animate-fadeIn">
                            <p className="text-[14px] text-[#8B98A9] leading-relaxed">{item.desc}</p>

                            {/* Evidence Box */}
                            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[#FF5C5C] text-[13px] font-medium flex items-center gap-2.5">
                              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                              </svg>
                              <span>{item.evidence}</span>
                            </div>

                            {/* Security Badges */}
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 rounded-md bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-mono text-[11px] font-bold">
                                {item.owasp}
                              </span>
                              <span className="px-2.5 py-1 rounded-md bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-mono text-[11px] font-bold">
                                {item.cvss}
                              </span>
                              <span className="px-2.5 py-1 rounded-md bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 font-mono text-[11px] font-bold">
                                {item.cwe}
                              </span>
                            </div>

                            {/* AI Remediation */}
                            {remediation && (
                              <div className="mt-2 flex flex-col gap-3 p-5 rounded-2xl bg-[#0A0E14]/90 border border-[#7C6FFF]/30">
                                <div className="flex items-center justify-between">
                                  <span className="text-[12px] font-mono font-bold uppercase tracking-wider text-[#A78BFA] flex items-center gap-2">
                                    <svg className="w-4 h-4 text-[#7C6FFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                    </svg>
                                    AI Remediation Guidance
                                  </span>
                                  {remediation.ai_model && (
                                    <span className="text-[10px] font-mono text-[#8B98A9] bg-white/5 px-2 py-0.5 rounded">
                                      {remediation.ai_model}
                                    </span>
                                  )}
                                </div>

                                {remediation.explanation && (
                                  <p className="text-[13.5px] text-[#C084FC]/90 leading-relaxed font-normal">
                                    {remediation.explanation}
                                  </p>
                                )}

                                {Array.isArray(remediation.steps) && remediation.steps.length > 0 && (
                                  <div className="flex flex-col gap-1.5 my-1">
                                    <p className="text-[11px] font-mono font-semibold text-white/50 uppercase">Remediation Steps:</p>
                                    <ul className="list-disc list-inside text-[13px] text-[#8B98A9] space-y-1">
                                      {remediation.steps.map((st, sIdx) => (
                                        <li key={sIdx}><span className="text-white/80">{st}</span></li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {remediation.code_fix && (
                                  <div className="relative mt-2 p-4 rounded-xl bg-black/60 border border-white/10 font-mono text-[12.5px] text-[#A78BFA] overflow-x-auto">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[10.5px] font-mono text-white/40 uppercase">
                                        Code Fix ({remediation.code_language || 'javascript'}):
                                      </span>
                                      <button
                                        onClick={() => copyCode(remediation.code_fix, item.id)}
                                        className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer"
                                      >
                                        {copiedId === item.id ? 'Copied!' : 'Copy Code'}
                                      </button>
                                    </div>
                                    <pre className="text-emerald-300/90 whitespace-pre-wrap">{remediation.code_fix}</pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </BorderGlow>
                  );
                }))}
              </div>
            </div>

            {/* Recent Scans History Section */}
            <div ref={historyRef} id="history-section" className="p-8 rounded-3xl bg-[#121826]/80 border border-white/15 backdrop-blur-xl shadow-2xl flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-[#7C6FFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  <h2 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    Recent Scans
                  </h2>
                </div>

                <button
                  onClick={loadHistory}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[12.5px] font-medium text-[#8B98A9] hover:text-white transition-all cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Refresh
                </button>
              </div>

              {/* Recent Scans Table List */}
              <div className="flex flex-col gap-3">
                {recentScans.length === 0 ? (
                  <p className="text-center text-[13px] text-[#8B98A9] py-8">No recent scans recorded yet. Enter a URL above to begin.</p>
                ) : (
                  recentScans.map((scan) => (
                    <div
                      key={scan.id}
                      onClick={() => !scan.id.startsWith('temp-') && loadScanDetails(scan.id)}
                      className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-white/20 transition-all cursor-pointer group"
                    >
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="font-mono text-[14.5px] font-semibold text-white truncate">{scan.url}</span>
                        <span className="text-[12px] font-mono text-[#8B98A9]">{scan.timestamp}</span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {scan.score !== null && scan.score !== undefined ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-[#8B98A9] font-medium">{scan.grade}</span>
                            <span className="text-[16px] font-bold text-[#F5A623] font-mono">{scan.score}</span>
                          </div>
                        ) : (
                          <span className="text-[12px] text-[#8B98A9] font-mono">-- --</span>
                        )}

                        <span
                          className={`text-[11px] font-mono font-bold uppercase px-3 py-1 rounded-full ${
                            scan.status === 'RUNNING' || scan.status === 'PENDING'
                              ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40 animate-pulse'
                              : 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
                          }`}
                        >
                          {scan.status}
                        </span>

                        {/* Download report button (completed scans only) */}
                        {scan.status === 'COMPLETED' && !scan.id.startsWith('temp-') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); window.open(getReportUrl(scan.id), '_blank'); }}
                            title="Download report"
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-[#7C6FFF]/20 hover:bg-[#7C6FFF]/40 border border-[#7C6FFF]/30 text-[#A78BFA] transition-all cursor-pointer"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="12" y1="18" x2="12" y2="12" />
                              <polyline points="9 15 12 18 15 15" />
                            </svg>
                          </button>
                        )}

                        {/* Delete button */}
                        {!scan.id.startsWith('temp-') && (
                          <button
                            onClick={(e) => handleDeleteScan(e, scan.id)}
                            disabled={deletingId === scan.id}
                            title="Delete scan"
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 text-red-400 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {deletingId === scan.id ? (
                              <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                <path d="M12 2a10 10 0 0 1 10 10" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6" />
                                <path d="M14 11v6" />
                                <path d="M9 6V4h6v2" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── AI Security Chat ───────────────────────────────── */}
            {currentScan && currentScan.status === 'completed' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#7C6FFF] to-[#C084FC] flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      Ask AI About This Scan
                    </h2>
                    <p className="text-[13px] text-[#8B98A9] mt-0.5">
                      Vulnora AI has full context of your security report — ask anything.
                    </p>
                  </div>
                </div>
                <ScanChat
                  key={currentScan.scanId}
                  scanId={currentScan.scanId}
                  targetUrl={currentScan.targetUrl}
                  score={currentScan.score?.score}
                  initialMessages={chatHistories[currentScan.scanId] || null}
                  onMessagesChange={(msgs) => saveChatHistory(currentScan.scanId, msgs)}
                />
              </div>
            )}

            {/* Legal Disclaimer Footer */}
            <div className="pt-8 pb-4 text-center text-[#8B98A9] text-[12.5px] flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-[#F5A623] font-semibold">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>Legal Disclaimer: This tool is for authorized security testing only.</span>
              </div>
              <p className="max-w-xl text-white/50 text-[11.5px]">
                Unauthorized scanning of systems you do not own is illegal and unethical. Vulnora v1.0 • Built for authorized security assessment
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
