import { useAnimatedNumber } from './useAnimatedNumber.js';

export function riskLevel(score) {
  if (score <= 25) return 'green';
  if (score <= 50) return 'yellow';
  if (score <= 75) return 'orange';
  return 'red';
}

export default function RiskMeter({ score, recentlyExposed }) {
  const shown = useAnimatedNumber(score);
  const level = riskLevel(score);
  return (
    <div className="risk-wrap">
      {recentlyExposed && <span className="risk-tag">Recently exposed</span>}
      <div className={`risk-pill risk-${level}`} title={`Risk score: ${score}`}>
        <div className="risk-bar">
          <div className="risk-fill" style={{ width: `${Math.max(4, score)}%` }} />
        </div>
        <span className="risk-num">{shown}</span>
      </div>
    </div>
  );
}
