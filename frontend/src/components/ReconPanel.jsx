export default function ReconPanel({ recon }) {
  if (!recon) return null;

  const { ssl = {}, ipAddresses = [], techStack = [], serverHeader, responseTimeMs, dnsRecords = {}, redirectChain = [] } = recon;

  const items = [
    { key: 'IP Addresses',   val: ipAddresses.join(', ') || 'N/A' },
    {
      key: 'SSL / TLS',
      val: ssl.valid
        ? `✅ Valid · ${ssl.daysLeft}d remaining · ${ssl.issuer || 'Unknown CA'}`
        : '❌ Invalid or HTTPS not used',
      cls: ssl.valid && ssl.daysLeft > 30 ? 'good' : ssl.valid ? 'warn' : 'bad',
    },
    { key: 'Response Time',  val: responseTimeMs ? `${responseTimeMs}ms` : 'N/A' },
    {
      key: 'Server',
      val: serverHeader || 'Hidden',
      cls: serverHeader ? 'warn' : 'good',
    },
    {
      key: 'Tech Stack',
      val: techStack.length ? techStack : null,
      isTags: true,
    },
    { key: 'NS Records',     val: (dnsRecords.ns || []).slice(0, 3).join(', ') || 'N/A' },
    { key: 'MX Records',     val: (dnsRecords.mx || []).slice(0, 2).join(', ') || 'N/A' },
    {
      key: 'Redirects',
      val: redirectChain.length > 0 ? redirectChain.join(' → ') : 'None',
      cls: redirectChain.length === 0 ? 'good' : '',
    },
  ];

  return (
    <div className="card">
      <h3 className="card-title">🔍 Reconnaissance</h3>
      <div className="recon-grid">
        {items.map(({ key, val, cls, isTags }) => (
          <div key={key} className="recon-item">
            <div className="recon-key">{key}</div>
            {isTags ? (
              <div className="recon-val">
                {val && val.length > 0
                  ? val.map(t => <span key={t} className="tag">{t}</span>)
                  : <span className="recon-val">Not detected</span>}
              </div>
            ) : (
              <div className={`recon-val ${cls || ''}`}>{val}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
