import React, { useState, useRef } from 'react';
import Aurora from './Aurora';
import BorderGlow from './BorderGlow';
import SpecularButton from './SpecularButton';

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

export default function ScanWorkspace({ onBack }) {
  const [targetUrl, setTargetUrl] = useState('https://mycollegemart-webapp.onrender.com/');
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'history'
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [expandedId, setExpandedId] = useState('CHK-01');

  const historyRef = useRef(null);

  // Mock findings data matching the user's screenshots
  const [recentScans, setRecentScans] = useState([
    {
      id: 'scan-1',
      url: 'https://mycollegemart-webapp.onrender.com/',
      timestamp: '9/8/2026, 12:51:36 PM',
      status: 'RUNNING',
      score: null,
      grade: '--',
    },
    {
      id: 'scan-2',
      url: 'https://mycollegemart-webapp.onrender.com/',
      timestamp: '9/8/2026, 12:48:55 PM',
      status: 'COMPLETED',
      score: 65,
      grade: 'Fair',
    },
    {
      id: 'scan-3',
      url: 'https://mysocietyhub.app/',
      timestamp: '9/8/2026, 12:42:41 PM',
      status: 'COMPLETED',
      score: 50,
      grade: 'Fair',
    },
    {
      id: 'scan-4',
      url: 'https://mysocietyhub.app/',
      timestamp: '9/8/2026, 12:27:11 PM',
      status: 'COMPLETED',
      score: 50,
      grade: 'Fair',
    },
  ]);

  const findingsList = [
    {
      id: 'CHK-01',
      severity: 'HIGH',
      cwe: 'CWE-693',
      owasp: 'OWASP A05:2021',
      cvss: 'CVSS 7.5',
      title: 'Content-Security-Policy (CSP)',
      desc: 'Content-Security-Policy header is missing. This allows attackers to inject malicious scripts (XSS) that the browser will execute without restriction.',
      evidence: 'Evidence: Header completely absent',
      passed: false,
      remediation: `// Recommended Express.js Helmet CSP header configuration:\napp.use(helmet.contentSecurityPolicy({\n  directives: {\n    defaultSrc: ["'self'"],\n    scriptSrc: ["'self'", "'unsafe-inline'"],\n  }\n}));`,
    },
    {
      id: 'CHK-02',
      severity: 'MEDIUM',
      cwe: 'CWE-1021',
      owasp: 'OWASP A05:2021',
      cvss: 'CVSS 5.4',
      title: 'X-Frame-Options',
      desc: 'X-Frame-Options header is missing or misconfigured. This allows the page to be rendered within an iframe on external malicious websites, exposing users to clickjacking.',
      evidence: 'Evidence: X-Frame-Options header not set',
      passed: false,
      remediation: `// Add X-Frame-Options header to response:\nres.setHeader('X-Frame-Options', 'SAMEORIGIN');`,
    },
    {
      id: 'CHK-03',
      severity: 'MEDIUM',
      cwe: 'CWE-1021',
      owasp: 'OWASP A05:2021',
      cvss: 'CVSS 5.0',
      title: 'Clickjacking Vulnerability',
      desc: 'No frame-ancestors CSP directive present. Malicious sites can wrap this web page inside transparent frames to hijack user clicks.',
      evidence: 'Evidence: Frame ancestors directive absent',
      passed: false,
      remediation: `// Configure CSP frame-ancestors directive:\nContent-Security-Policy: frame-ancestors 'self';`,
    },
    {
      id: 'CHK-04',
      severity: 'LOW',
      cwe: 'CWE-284',
      owasp: 'OWASP A01:2021',
      cvss: 'CVSS 3.1',
      title: 'Permissions-Policy',
      desc: 'Permissions-Policy header is missing. Hardware browser APIs (camera, microphone, geolocation) remain enabled by default.',
      evidence: 'Evidence: Permissions-Policy header missing',
      passed: false,
      remediation: `// Restrict browser features:\nres.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');`,
    },
    {
      id: 'CHK-05',
      severity: 'LOW',
      cwe: 'CWE-288',
      owasp: 'OWASP A05:2021',
      cvss: 'CVSS 3.0',
      title: 'Referrer-Policy',
      desc: 'Referrer-Policy header is not explicitly defined. Full origin and URL path information may leak to external domains during navigation.',
      evidence: 'Evidence: Default browser referrer fallback active',
      passed: false,
      remediation: `// Enforce strict origin referrer policy:\nres.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');`,
    },
    {
      id: 'CHK-06',
      severity: 'HIGH',
      cwe: 'CWE-319',
      owasp: 'OWASP A02:2021',
      cvss: 'CVSS 7.1',
      title: 'HTTP Strict Transport Security (HSTS)',
      desc: 'HTTP Strict Transport Security header correctly configured with long max-age and subdomains protection.',
      evidence: 'Evidence: HSTS active (max-age=31536000)',
      passed: true,
      remediation: `// HSTS is currently compliant and active.`,
    },
    {
      id: 'CHK-07',
      severity: 'HIGH',
      cwe: 'CWE-942',
      owasp: 'OWASP A05:2021',
      cvss: 'CVSS 7.4',
      title: 'CORS Misconfiguration',
      desc: 'Cross-Origin Resource Sharing rules restrict cross-domain requests safely to trusted origins.',
      evidence: 'Evidence: Access-Control-Allow-Origin restricted',
      passed: true,
      remediation: `// CORS configuration compliant.`,
    },
  ];

  const filteredFindings = findingsList.filter((item) => {
    if (selectedSeverity === 'ALL') return true;
    return item.severity === selectedSeverity;
  });

  const handleStartScan = (e) => {
    e.preventDefault();
    if (!targetUrl) return;
    setIsScanning(true);

    // Add running scan to top of list
    const newEntry = {
      id: `scan-${Date.now()}`,
      url: targetUrl,
      timestamp: new Date().toLocaleString(),
      status: 'RUNNING',
      score: null,
      grade: '--',
    };
    setRecentScans((prev) => [newEntry, ...prev]);

    setTimeout(() => {
      setIsScanning(false);
      setRecentScans((prev) =>
        prev.map((item) =>
          item.id === newEntry.id
            ? { ...item, status: 'COMPLETED', score: 63, grade: 'Fair' }
            : item
        )
      );
    }, 2200);
  };

  const scrollToHistory = () => {
    setActiveTab('history');
    if (historyRef.current) {
      historyRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const downloadReport = () => {
    const reportData = {
      targetUrl,
      timestamp: new Date().toISOString(),
      securityScore: 63,
      grade: 'Fair',
      reconnaissance: {
        ipAddresses: ['216.24.57.15', '216.24.57.7'],
        sslStatus: 'Invalid or HTTPS not used',
        responseTime: '43ms',
        server: 'cloudflare',
        techStack: ['Cloudflare'],
      },
      findings: findingsList,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Vulnora_Audit_Report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        {/* Top Navigation */}
        <header className="sticky top-5 z-50 max-w-6xl mx-auto px-6 w-full">
          <div
            className="px-6 h-14 flex items-center justify-between rounded-full backdrop-blur-xl shadow-2xl"
            style={{
              background: 'rgba(18, 24, 38, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 0 35px rgba(124, 111, 255, 0.25), 0 12px 40px rgba(0,0,0,0.6)',
            }}
          >
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#7C6FFF]/20 border border-[#7C6FFF]/50 flex items-center justify-center text-[#7C6FFF]">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8s0 0 0 0z" />
                </svg>
              </div>
              <span className="font-bold text-[20px] tracking-wide" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Vulnora
              </span>
            </div>

            {/* Nav Action Links */}
            <div className="flex items-center gap-6 text-[14px]">
              <button
                onClick={() => setActiveTab('scan')}
                className={`font-medium transition-colors cursor-pointer ${
                  activeTab === 'scan' ? 'text-white border-b-2 border-[#7C6FFF] pb-0.5' : 'text-[#8B98A9] hover:text-white'
                }`}
              >
                New Scan
              </button>
              <button
                onClick={scrollToHistory}
                className={`font-medium transition-colors cursor-pointer ${
                  activeTab === 'history' ? 'text-white border-b-2 border-[#7C6FFF] pb-0.5' : 'text-[#8B98A9] hover:text-white'
                }`}
              >
                History
              </button>
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-[13px] font-medium px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-all border border-white/15 cursor-pointer ml-2"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Back to Home
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-6xl mx-auto px-6 w-full flex-grow flex flex-col items-center">
          {/* Target Scanner Hero MVP — Perfectly Centered in 1st Viewport Fold */}
          <div className="w-full max-w-4xl text-center flex flex-col items-center justify-center min-h-[calc(100vh-140px)] my-auto py-12">
            <h1
              className="text-[44px] sm:text-[62px] md:text-[76px] lg:text-[84px] font-extrabold tracking-tight leading-[1.06] mb-6 text-center text-white"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
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
                  className="flex-1 bg-transparent px-3 py-3 text-white placeholder-white/40 focus:outline-none font-mono text-[14.5px]"
                />

                <SpecularButton
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
                  className="px-6 py-2 shadow-lg font-bold"
                >
                  {isScanning ? 'Scanning...' : 'Start Audit'}
                </SpecularButton>
              </div>
            </form>
          </div>

          {/* Audit Dashboard Workspace — Positioned Below First View Fold (Scroll Required) */}
          <div className="w-full flex flex-col gap-10 pt-16 pb-20 mt-8 border-t border-white/10">
            {/* Top Stats Dashboard Section */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">
              {/* Security Health Score Arc Dial Box */}
              <div className="lg:col-span-4 p-7 rounded-3xl bg-[#121826]/80 border border-white/15 backdrop-blur-xl flex flex-col items-center justify-between text-center shadow-2xl relative overflow-hidden">
                <p className="text-[11px] font-mono font-bold tracking-widest text-[#8B98A9] uppercase mb-2">
                  SECURITY HEALTH SCORE
                </p>

                {/* SVG Semi-Circle Radial Gauge */}
                <div className="relative w-48 h-28 flex items-center justify-center my-2">
                  <svg className="w-44 h-44 -rotate-90 transform" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#1F293D" strokeWidth="10" strokeDasharray="314.15" strokeDashoffset="157" strokeLinecap="round" />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="#F5A623"
                      strokeWidth="10"
                      strokeDasharray="314.15"
                      strokeDashoffset={157 + (157 * (100 - 63)) / 100}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute bottom-2 flex flex-col items-center">
                    <span className="text-[40px] font-black tracking-tight leading-none" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                      63
                    </span>
                    <span className="text-[12px] font-bold text-[#F5A623] tracking-widest uppercase mt-1">FAIR</span>
                  </div>
                </div>

                <div className="mt-3 text-[12px] text-[#8B98A9]">
                  <p className="font-mono text-white/80 truncate max-w-[220px] mx-auto">{targetUrl}</p>
                  <p className="mt-0.5">Duration: 2.9s</p>
                </div>
              </div>

              {/* Severity Breakdown Counter Cards */}
              <div className="lg:col-span-5 grid grid-cols-5 gap-3 p-6 rounded-3xl bg-[#121826]/80 border border-white/15 backdrop-blur-xl items-center shadow-2xl">
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 h-full">
                  <span className="text-[26px] font-bold text-[#FF5C5C]">0</span>
                  <span className="text-[9.5px] font-mono font-bold uppercase text-[#FF5C5C] tracking-wider mt-1">CRITICAL</span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 h-full">
                  <span className="text-[26px] font-bold text-[#F5A623]">1</span>
                  <span className="text-[9.5px] font-mono font-bold uppercase text-[#F5A623] tracking-wider mt-1">HIGH</span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 h-full">
                  <span className="text-[26px] font-bold text-[#FACC15]">2</span>
                  <span className="text-[9.5px] font-mono font-bold uppercase text-[#FACC15] tracking-wider mt-1">MEDIUM</span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 h-full">
                  <span className="text-[26px] font-bold text-[#5EEAD4]">2</span>
                  <span className="text-[9.5px] font-mono font-bold uppercase text-[#5EEAD4] tracking-wider mt-1">LOW</span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 h-full">
                  <span className="text-[26px] font-bold text-[#7C6FFF]">5</span>
                  <span className="text-[9.5px] font-mono font-bold uppercase text-[#7C6FFF] tracking-wider mt-1">TOTAL</span>
                </div>
              </div>

              {/* Actions Quick Access Card */}
              <div className="lg:col-span-3 p-6 rounded-3xl bg-[#121826]/80 border border-white/15 backdrop-blur-xl flex flex-col justify-between shadow-2xl">
                <p className="text-[11px] font-mono font-bold tracking-widest text-[#8B98A9] uppercase mb-3">ACTIONS</p>
                <div className="flex flex-col gap-3">
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
                <h2 className="text-[20px] font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  Reconnaissance
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* IP ADDRESSES */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">IP ADDRESSES</p>
                  <p className="text-[14px] font-mono text-white font-medium">216.24.57.15, 216.24.57.7</p>
                </div>

                {/* SSL / TLS (With SVG warning icon - NO emojis) */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">SSL / TLS</p>
                  <div className="flex items-center gap-2 text-[#FF5C5C] text-[13.5px] font-medium">
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    <span>Invalid or HTTPS not used</span>
                  </div>
                </div>

                {/* RESPONSE TIME */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">RESPONSE TIME</p>
                  <p className="text-[14px] font-mono text-white font-medium">43ms</p>
                </div>

                {/* SERVER */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">SERVER</p>
                  <p className="text-[14px] font-mono text-[#F5A623] font-medium">cloudflare</p>
                </div>

                {/* TECH STACK */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">TECH STACK</p>
                  <div>
                    <span className="px-2.5 py-1 rounded-md bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 font-mono text-[12px] font-bold">
                      Cloudflare
                    </span>
                  </div>
                </div>

                {/* NS RECORDS */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">NS RECORDS</p>
                  <p className="text-[14px] font-mono text-[#8B98A9] font-medium">N/A</p>
                </div>

                {/* MX RECORDS */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">MX RECORDS</p>
                  <p className="text-[14px] font-mono text-[#8B98A9] font-medium">N/A</p>
                </div>

                {/* REDIRECTS */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <p className="text-[11px] font-mono uppercase text-[#8B98A9] font-semibold mb-2">REDIRECTS</p>
                  <p className="text-[14px] font-mono text-[#10B981] font-medium">None</p>
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
                  <h2 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
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
                {filteredFindings.map((item) => {
                  const isExpanded = expandedId === item.id;
                  return (
                    <BorderGlow
                      key={item.id}
                      edgeSensitivity={20}
                      glowColor={item.severity === 'HIGH' ? '30 100 60' : '262 100 75'}
                      backgroundColor="#121826"
                      borderRadius={20}
                      glowRadius={35}
                      glowIntensity={1.0}
                      colors={item.severity === 'HIGH' ? ['#F5A623', '#FF5C5C'] : ['#C084FC', '#7C6FFF']}
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
                                item.severity === 'HIGH'
                                  ? 'bg-[#F5A623]/20 text-[#F5A623] border border-[#F5A623]/40'
                                  : item.severity === 'MEDIUM'
                                  ? 'bg-[#FACC15]/20 text-[#FACC15] border border-[#FACC15]/40'
                                  : 'bg-[#5EEAD4]/20 text-[#5EEAD4] border border-[#5EEAD4]/40'
                              }`}
                            >
                              {item.severity}
                            </span>

                            <h3 className="text-[17px] font-bold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                              {item.title}
                            </h3>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[12px] font-mono text-[#8B98A9]">{item.cwe}</span>
                            {/* Passed/Failed Status Badge (SVG icon - NO emojis) */}
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

                            {/* AI Remediation Code Block */}
                            <div className="p-4 rounded-xl bg-black/40 border border-white/10 font-mono text-[12.5px] text-[#A78BFA] overflow-x-auto">
                              <p className="text-[11px] text-white/40 mb-2 font-sans font-semibold">AI Recommended Remediation:</p>
                              <pre>{item.remediation}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </BorderGlow>
                  );
                })}
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
                  <h2 className="text-[22px] font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    Recent Scans
                  </h2>
                </div>

                <button
                  onClick={() => setIsScanning(false)}
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
                {recentScans.map((scan) => (
                  <div
                    key={scan.id}
                    className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-white/20 transition-all"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-[14.5px] font-semibold text-white">{scan.url}</span>
                      <span className="text-[12px] font-mono text-[#8B98A9]">{scan.timestamp}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      {scan.score !== null ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-[#8B98A9] font-medium">{scan.grade}</span>
                          <span className="text-[16px] font-bold text-[#F5A623] font-mono">{scan.score}</span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-[#8B98A9] font-mono">-- --</span>
                      )}

                      <span
                        className={`text-[11px] font-mono font-bold uppercase px-3 py-1 rounded-full ${
                          scan.status === 'RUNNING'
                            ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40 animate-pulse'
                            : 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40'
                        }`}
                      >
                        {scan.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

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
