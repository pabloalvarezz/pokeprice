import { fmtDate, fmtEur, type Offer } from '../data.ts';

/** Mejor precio disponible del grupo a lo largo del tiempo (línea escalonada). */
export function PriceChart({ offers }: { offers: Offer[] }) {
  const dates = new Set<string>();
  for (const o of offers) {
    dates.add(o.fs);
    for (const [d] of o.h ?? []) dates.add(d);
  }
  const today = new Date().toISOString().slice(0, 10);
  dates.add(today);
  const days = [...dates].sort();
  const points: { d: string; p: number }[] = [];
  for (const d of days) {
    let best: number | null = null;
    for (const o of offers) {
      const hist = o.h ?? [[o.fs, o.p, o.a]];
      let state: [string, number | null, number] | null = null;
      for (const h of hist) if (h[0] <= d) state = h;
      if (state && state[2] && state[1] != null) best = best == null ? state[1] : Math.min(best, state[1]);
    }
    if (best != null) points.push({ d, p: best });
  }
  if (points.length < 2 || points.every((p) => p.p === points[0].p)) {
    return (
      <p className="muted small" style={{ margin: 0 }}>
        {points.length ? `Precio estable en ${fmtEur(points[0].p)} desde ${fmtDate(points[0].d)}. ` : ''}La gráfica se irá dibujando con cada actualización diaria.
      </p>
    );
  }
  const W = 800, H = 180, P = { l: 8, r: 64, t: 14, b: 26 };
  const t0 = new Date(points[0].d).getTime();
  const t1 = new Date(points[points.length - 1].d).getTime() || t0 + 1;
  const ps = points.map((p) => p.p);
  const lo = Math.min(...ps), hi = Math.max(...ps);
  const pad = (hi - lo) * 0.15 || hi * 0.05;
  const y = (v: number) => P.t + (1 - (v - (lo - pad)) / (hi + pad - (lo - pad))) * (H - P.t - P.b);
  const x = (d: string) => P.l + ((new Date(d).getTime() - t0) / (t1 - t0 || 1)) * (W - P.l - P.r);
  let path = '';
  points.forEach((pt, i) => {
    path += i === 0 ? `M${x(pt.d)},${y(pt.p)}` : `H${x(pt.d)}V${y(pt.p)}`;
  });
  const last = points[points.length - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Evolución del mejor precio">
      {[hi, lo].map((v) => (
        <g key={v}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="var(--line-soft)" strokeDasharray="3 4" />
          <text x={W - P.r + 8} y={y(v) + 4}>{fmtEur(v)}</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.25" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={x(last.d)} cy={y(last.p)} r="4" fill="var(--accent)" />
      <text x={P.l} y={H - 6}>{fmtDate(points[0].d, { day: 'numeric', month: 'short' })}</text>
      <text x={W - P.r} y={H - 6} textAnchor="end">{fmtDate(last.d, { day: 'numeric', month: 'short' })}</text>
    </svg>
  );
}
