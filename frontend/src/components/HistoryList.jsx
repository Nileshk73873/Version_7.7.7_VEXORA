import { useState, useEffect } from 'react';
import { listScans, deleteScan } from '../api/client';

function scoreColor(score) {
  if (score >= 90) return '#00ff88';
  if (score >= 70) return '#7ed321';
  if (score >= 50) return '#f5a623';
  if (score >= 30) return '#ff6b35';
  return '#ff3b3b';
}

export default function HistoryList({ onLoadScan, refreshTrigger }) {
  const [scans, setScans]     = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setScans(await listScans()); }
    catch { setScans([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [refreshTrigger]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this scan?')) return;
    await deleteScan(id);
    load();
  };

  return (
    <div className="card">
      <div className="findings-header">
        <h3 className="card-title">📋 Recent Scans</h3>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}>
          {loading ? '…' : '↻ Refresh'}
        </button>
      </div>

      <div className="history-list">
        {scans.length === 0 && (
          <p className="empty-state">No scans yet. Run your first scan above.</p>
        )}
        {scans.map(s => (
          <div
            key={s.id}
            className="history-item"
            onClick={() => s.status === 'completed' && onLoadScan(s.id)}
            title={s.status === 'completed' ? 'Click to load results' : s.status}
          >
            <span className="history-url">{s.target_url}</span>
            <span className="history-grade">{s.grade || '--'}</span>
            <span className="history-score" style={{ color: scoreColor(s.health_score || 0) }}>
              {s.health_score ?? '--'}
            </span>
            <span className={`status-pill ${s.status}`}>{s.status}</span>
            <span className="history-date">
              {s.started_at ? new Date(s.started_at).toLocaleString() : ''}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 8px', fontSize: '0.7rem' }}
              onClick={(e) => handleDelete(e, s.id)}
            >🗑</button>
          </div>
        ))}
      </div>
    </div>
  );
}
