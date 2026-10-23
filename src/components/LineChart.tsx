import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import "./LineChart.css";

export interface ChartSeries {
  name: string;
  color: string;
  values: number[];
}

interface Props {
  title: string;
  times: number[]; // her kaydın simülasyon zamanı (sn)
  series: ChartSeries[];
  yMax: number;
  unit: string;
  band?: boolean; // true ise ilk iki serinin arası boyanır (tasarruf alanı)
}

const W = 480;
const H = 220;
const PL = 40; // sol boşluk (eksen etiketleri)
const PR = 12;
const PT = 12;
const PB = 26; // alt boşluk (zaman etiketleri)
const PW = W - PL - PR;
const PH = H - PT - PB;

export function LineChart({ title, times, series, yMax, unit, band = false }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const t0 = times[0] ?? 0;
  const t1 = times[times.length - 1] ?? 0;
  const span = Math.max(t1 - t0, 1e-6);
  const xOf = (t: number) => PL + ((t - t0) / span) * PW;
  const yOf = (v: number) => PT + PH - (Math.min(v, yMax) / yMax) * PH;
  const pointsOf = (values: number[]) =>
    values.map((v, i) => `${xOf(times[i]).toFixed(1)},${yOf(v).toFixed(1)}`);

  const hasData = times.length >= 2;

  // Fareye en yakın kaydı bul
  let hoverIdx: number | null = null;
  if (hoverX !== null && hasData) {
    const t = t0 + ((hoverX - PL) / PW) * span;
    hoverIdx = 0;
    for (let i = 1; i < times.length; i++) {
      if (Math.abs(times[i] - t) < Math.abs(times[hoverIdx] - t)) hoverIdx = i;
    }
  }

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    setHoverX(Math.min(Math.max(x, PL), W - PR));
  };

  const tipW = 112;
  const tipH = 22 + series.length * 15;

  return (
    <div className="chart">
      <div className="chart-head">
        <h3>{title}</h3>
        <div className="legend">
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      </div>

      <svg
        ref={svgRef}
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={title}
        onPointerMove={onMove}
        onPointerLeave={() => setHoverX(null)}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((k) => {
          const y = yOf(yMax * k);
          return (
            <g key={k}>
              <line x1={PL} x2={W - PR} y1={y} y2={y} className="grid" />
              <text x={PL - 6} y={y + 4} className="axis-label end">
                {Math.round(yMax * k)}
              </text>
            </g>
          );
        })}

        {!hasData && (
          <text x={PL + PW / 2} y={PT + PH / 2} className="empty">
            Veri bekleniyor…
          </text>
        )}

        {hasData && (
          <>
            <text x={PL} y={H - 8} className="axis-label">
              −{span.toFixed(0)} sn
            </text>
            <text x={W - PR} y={H - 8} className="axis-label end">
              şimdi
            </text>

            {band && series.length >= 2 && (
              <polygon
                points={[...pointsOf(series[0].values), ...pointsOf(series[1].values).reverse()].join(" ")}
                className="band"
              />
            )}

            {series.map((s) => (
              <polyline key={s.name} points={pointsOf(s.values).join(" ")} stroke={s.color} className="series" />
            ))}
          </>
        )}

        {hoverIdx !== null && (
          <g>
            <line
              x1={xOf(times[hoverIdx])}
              x2={xOf(times[hoverIdx])}
              y1={PT}
              y2={PT + PH}
              className="cursor"
            />
            {(() => {
              const cx = xOf(times[hoverIdx]);
              const bx = cx > W - PR - tipW - 12 ? cx - tipW - 8 : cx + 8;
              return (
                <g transform={`translate(${bx}, ${PT + 4})`}>
                  <rect width={tipW} height={tipH} rx={6} className="tip-bg" />
                  <text x={8} y={15} className="tip-text muted">
                    {(times[hoverIdx] - t1).toFixed(1)} sn
                  </text>
                  {series.map((s, i) => (
                    <g key={s.name} transform={`translate(8, ${30 + i * 15})`}>
                      <rect y={-7} width={8} height={3} rx={1} fill={s.color} />
                      <text x={14} className="tip-text">
                        {s.name}: {Math.round(s.values[hoverIdx])} {unit}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })()}
          </g>
        )}
      </svg>
    </div>
  );
}
