import { useAnimatedNumber } from './useAnimatedNumber.js';

export function riskLevel(score) {
  if (score <= 25) return 'green';
  if (score <= 50) return 'yellow';
  if (score <= 75) return 'orange';
  return 'red';
}

const ZONES = [
  [0, 25, '#1f9d3f'],
  [25, 50, '#e0a800'],
  [50, 75, '#e87511'],
  [75, 100, '#d81e1e'],
];

// Semicircle speedometer: score 0 → needle hard left, 100 → hard right.
const polar = (deg, r) => {
  const rad = (deg * Math.PI) / 180;
  return [50 + r * Math.cos(rad), 50 - r * Math.sin(rad)];
};
const zoneArc = (s0, s1, r = 38) => {
  const [x0, y0] = polar(180 - s0 * 1.8, r);
  const [x1, y1] = polar(180 - s1 * 1.8, r);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

export default function RiskMeter({ score, recentlyExposed }) {
  const shown = useAnimatedNumber(score);
  const level = riskLevel(score);
  const needleDeg = -90 + score * 1.8;
  return (
    <div className="risk-wrap">
      {recentlyExposed && <span className="risk-tag">Recently exposed</span>}
      <div className={`risk-pill risk-${level}`} title={`Risk score: ${score}`}>
        <svg className="gauge-svg" viewBox="0 0 100 62">
          {ZONES.map(([s0, s1, color]) => (
            <path
              key={color}
              d={zoneArc(s0, s1)}
              stroke={color}
              strokeWidth="9"
              fill="none"
              className="gauge-zone"
              opacity={level === riskLevel((s0 + s1) / 2) ? 1 : 0.3}
            />
          ))}
          {[0, 25, 50, 75, 100].map((s) => {
            const [x0, y0] = polar(180 - s * 1.8, 30);
            const [x1, y1] = polar(180 - s * 1.8, 26);
            return (
              <line
                key={s}
                x1={x0.toFixed(2)} y1={y0.toFixed(2)} x2={x1.toFixed(2)} y2={y1.toFixed(2)}
                stroke="currentColor" strokeWidth="1.6" opacity="0.35"
              />
            );
          })}
          <g className="gauge-needle" style={{ transform: `rotate(${needleDeg}deg)` }}>
            <path d="M 47.6 50 L 50 15 L 52.4 50 Z" fill="currentColor" />
          </g>
          <circle cx="50" cy="50" r="5.4" fill="currentColor" />
          <circle cx="50" cy="50" r="2.4" fill="#fff" />
        </svg>
        <span className="risk-readout">
          <span className="risk-num">{shown}</span>
          <span className="risk-label">RISK</span>
        </span>
      </div>
    </div>
  );
}
