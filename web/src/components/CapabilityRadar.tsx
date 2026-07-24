import type { RadarAxis } from "../lib/capabilityRadar";

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 78;

function point(angleDeg: number, ratio: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const r = RADIUS * ratio;
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) };
}

function polygonPoints(count: number, ratio: number): string {
  return Array.from({ length: count }, (_, i) => {
    const angle = (360 / count) * i;
    const { x, y } = point(angle, ratio);
    return `${x},${y}`;
  }).join(" ");
}

export function CapabilityRadar({ axes, emptyHint }: { axes: RadarAxis[]; emptyHint?: string }) {
  const n = axes.length || 6;
  const hasData = axes.some((a) => a.score > 0);

  if (!hasData) {
    return (
      <div className="capability-radar capability-radar--empty">
        <p className="muted">{emptyHint || "完成 Lab 与测验后，能力雷达会自动填充"}</p>
      </div>
    );
  }

  const valuePoints = axes
    .map((axis, i) => {
      const { x, y } = point((360 / n) * i, axis.score / 100);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="capability-radar">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="能力雷达图">
        <defs>
          <linearGradient id="capabilityRadarFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(13, 148, 136, 0.35)" />
            <stop offset="100%" stopColor="rgba(45, 212, 191, 0.12)" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <polygon
            key={ratio}
            points={polygonPoints(n, ratio)}
            fill="none"
            stroke="var(--color-border, #e5e7eb)"
            strokeWidth="1"
          />
        ))}
        {axes.map((_, i) => {
          const { x, y } = point((360 / n) * i, 1);
          return (
            <line
              key={i}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              stroke="var(--color-border, #e5e7eb)"
              strokeWidth="1"
            />
          );
        })}
        <polygon
          points={valuePoints}
          fill="url(#capabilityRadarFill)"
          stroke="var(--color-accent, #0d9488)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {axes.map((axis, i) => {
          const { x, y } = point((360 / n) * i, 1.22);
          return (
            <text
              key={axis.key}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="capability-radar-label"
            >
              {axis.label}
            </text>
          );
        })}
      </svg>
      <ul className="capability-radar-legend">
        {axes.map((axis) => (
          <li key={axis.key}>
            <span>{axis.label}</span>
            <strong>{axis.score}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
