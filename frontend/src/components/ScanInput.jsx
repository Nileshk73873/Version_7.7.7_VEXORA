import { useState } from 'react';

export default function ScanInput({ onScan, isScanning }) {
  const [url, setUrl]         = useState('');
  const [authorized, setAuth] = useState(false);
  const [urlError, setUrlError] = useState('');

  const validate = (val) => {
    try { new URL(val); return true; } catch { return false; }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate(url)) {
      setUrlError('Please enter a valid URL including https://');
      return;
    }
    setUrlError('');
    onScan(url);
  };

  return (
    <div className="scan-card card">
      <h2 className="card-title">Start Security Scan</h2>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label className="input-label" htmlFor="target-url">Target URL</label>
          <div className="input-wrapper">
            <span className="input-icon">🔗</span>
            <input
              id="target-url"
              type="url"
              className="input"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(''); }}
              autoComplete="off"
              spellCheck="false"
            />
          </div>
          {urlError && <p className="input-hint">{urlError}</p>}
        </div>

        <div className="auth-check">
          <label className="checkbox-label" htmlFor="auth-check">
            <input
              type="checkbox"
              id="auth-check"
              className="checkbox"
              checked={authorized}
              onChange={(e) => setAuth(e.target.checked)}
            />
            <span className="checkbox-custom"></span>
            <span className="checkbox-text">
              I confirm that I am the owner or have explicit written authorization to scan this target.
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!authorized || !url.trim() || isScanning}
        >
          <span className="btn-icon">⚡</span>
          <span>{isScanning ? 'Scanning…' : 'Start Scan'}</span>
        </button>
      </form>
    </div>
  );
}
