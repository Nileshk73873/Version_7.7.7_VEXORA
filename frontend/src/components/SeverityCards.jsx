export default function SeverityCards({ summary = {} }) {
  const cards = [
    { label: 'Critical', key: 'critical', cls: 'sev-critical' },
    { label: 'High',     key: 'high',     cls: 'sev-high'     },
    { label: 'Medium',   key: 'medium',   cls: 'sev-medium'   },
    { label: 'Low',      key: 'low',      cls: 'sev-low'      },
    { label: 'Total',    key: 'total',    cls: 'sev-info'     },
  ];

  return (
    <div className="severity-grid">
      {cards.map(({ label, key, cls }) => (
        <div key={key} className={`sev-card ${cls}`}>
          <span className="sev-count">{summary[key] ?? 0}</span>
          <span className="sev-label">{label}</span>
        </div>
      ))}
    </div>
  );
}
