import { useState } from 'react';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={copy}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function Remediation({ rem }) {
  if (!rem) return null;
  return (
    <div className="remediation-panel">
      <div className="remediation-title">🤖 AI Remediation ({rem.ai_model || 'Gemini'})</div>
      {rem.explanation && <p className="ai-explanation">{rem.explanation}</p>}

      {rem.steps?.length > 0 && (
        <div className="ai-steps">
          <div className="ai-steps-title">📋 Fix Steps</div>
          <ol>{rem.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
      )}

      {rem.code_fix && (
        <>
          <div className="code-fix-title">💻 Code Fix ({rem.code_language || 'generic'})</div>
          <div className="code-fix-wrapper">
            <pre className="code-block">{rem.code_fix}</pre>
            <CopyButton text={rem.code_fix} />
          </div>
        </>
      )}

      {rem.prevention?.length > 0 && (
        <>
          <div className="prevention-title">🛡️ Prevention</div>
          <ul className="prevention-list">
            {rem.prevention.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}

export default function FindingCard({ finding }) {
  const [open, setOpen] = useState(finding.found); // auto-open if issue found

  return (
    <div className={`finding-item ${finding.found ? '' : 'not-found'}`}>
      <div className="finding-header" onClick={() => setOpen(o => !o)}>
        <span className={`sev-badge ${finding.severity}`}>{finding.severity}</span>
        <span className="finding-name">{finding.name}</span>
        <span className="finding-cwe">{finding.cwe}</span>
        <span className="finding-status">{finding.found ? '🔴' : '✅'}</span>
        <span className="finding-toggle">{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className="finding-body">
          <p className="finding-desc">{finding.description}</p>

          {finding.found && finding.evidence && (
            <div className="evidence-box">⚠️ Evidence: {finding.evidence}</div>
          )}

          {!finding.found && (
            <p style={{ color: 'var(--sev-low)', fontSize: '0.875rem' }}>✅ No issue detected for this check.</p>
          )}

          {finding.found && <Remediation rem={finding.remediation} />}

          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {finding.owasp && <span className="tag">OWASP {finding.owasp}</span>}
            {finding.cvss  && <span className="tag">CVSS {finding.cvss}</span>}
            {finding.cwe   && <span className="tag">{finding.cwe}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
