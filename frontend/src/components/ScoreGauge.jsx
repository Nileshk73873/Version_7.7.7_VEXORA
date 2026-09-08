import { useEffect, useRef } from 'react';

const SCORE_ARC_LENGTH = 251.2;

function scoreColor(score) {
  if (score >= 90) return '#00ff88';
  if (score >= 70) return '#7ed321';
  if (score >= 50) return '#f5a623';
  if (score >= 30) return '#ff6b35';
  return '#ff3b3b';
}

export default function ScoreGauge({ score, grade, targetUrl, durationMs }) {
  const arcRef = useRef(null);

  useEffect(() => {
    if (!arcRef.current || score == null) return;
    const offset = SCORE_ARC_LENGTH * (1 - score / 100);
    arcRef.current.style.strokeDashoffset = offset;
    arcRef.current.style.stroke = scoreColor(score);
  }, [score]);

  const color = scoreColor(score ?? 0);

  return (
    <div className="score-card card">
      <h3 className="card-subtitle">Security Health Score</h3>
      <div className="gauge-wrapper">
        <svg className="gauge-svg" viewBox="0 0 200 120">
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#1e2a3a" strokeWidth="16" strokeLinecap="round"/>
          <path
            ref={arcRef}
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={SCORE_ARC_LENGTH}
            strokeDashoffset={SCORE_ARC_LENGTH}
            style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s ease' }}
          />
        </svg>
        <div className="gauge-center">
          <span className="gauge-score" style={{ color }}>{score ?? '--'}</span>
          <span className="gauge-label">{grade ?? 'Pending'}</span>
        </div>
      </div>
      <div className="score-meta">
        <span className="score-target">{targetUrl}</span>
        {durationMs && <span className="score-duration">Duration: {(durationMs / 1000).toFixed(1)}s</span>}
      </div>
    </div>
  );
}
