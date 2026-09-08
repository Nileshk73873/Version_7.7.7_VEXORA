/**
 * scorer.js
 * Computes the Security Health Score (0–100) from a list of findings.
 *
 * Scoring model:
 *   Start at 100.
 *   Deduct points per found vulnerability based on severity.
 *   Bonus: SSL valid, all critical headers present.
 *   Floor: 0 (cannot go negative).
 */

const SEVERITY_WEIGHTS = {
  CRITICAL: 25,
  HIGH:     15,
  MEDIUM:   8,
  LOW:      3,
  INFO:     1,
};

const GRADE_BANDS = [
  { min: 90, label: 'Excellent', color: '#00ff88' },
  { min: 70, label: 'Good',      color: '#7ed321' },
  { min: 50, label: 'Fair',      color: '#f5a623' },
  { min: 30, label: 'Poor',      color: '#ff6b35' },
  { min: 0,  label: 'Critical',  color: '#ff3b3b' },
];

/**
 * Computes score and grade from findings.
 * @param {object[]} findings  - Array of finding objects (with .found and .severity)
 * @param {object}   reconData - Recon data for bonus checks
 * @returns {{ score: number, grade: string, color: string, breakdown: object }}
 */
function computeScore(findings, reconData = {}) {
  let score = 100;
  const breakdown = {
    CRITICAL: 0,
    HIGH:     0,
    MEDIUM:   0,
    LOW:      0,
    INFO:     0,
  };

  for (const finding of findings) {
    if (!finding.found) continue;
    const weight = SEVERITY_WEIGHTS[finding.severity] || 0;
    score -= weight;
    breakdown[finding.severity] = (breakdown[finding.severity] || 0) + 1;
  }

  // ── Bonuses ───────────────────────────────────────────────
  // +2 if SSL is valid with >30 days left
  if (reconData?.ssl?.valid && (reconData?.ssl?.daysLeft || 0) > 30) {
    score += 2;
  }

  // Floor at 0
  score = Math.max(0, Math.round(score));

  const grade = GRADE_BANDS.find(b => score >= b.min) || GRADE_BANDS[GRADE_BANDS.length - 1];

  return {
    score,
    grade: grade.label,
    color: grade.color,
    breakdown,
    totalFindings: findings.filter(f => f.found).length,
  };
}

module.exports = { computeScore, SEVERITY_WEIGHTS, GRADE_BANDS };
