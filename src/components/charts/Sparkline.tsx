"use client";

/**
 * Sparkline mungil (tanpa sumbu) untuk kartu KPI. Memakai viewBox + non-scaling
 * stroke sehingga garis tetap tipis saat diregangkan mengikuti lebar container.
 */
export function Sparkline({
  data,
  color = "var(--brand)",
  height = 40,
  className,
}: {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
}) {
  const n = data.length;
  if (n < 2) return <div style={{ height }} className={className} />;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const W = 100;
  const H = 100;
  const pad = 6;
  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);

  const line = data.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  const gid = `spark-${Math.round(max)}-${n}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ height, width: "100%", display: "block" }}
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
