import { useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { useLocale } from "@/i18n";
import { formatAxisK, formatTaka, niceMax } from "@/lib/format";

export type SalesChartPoint = {
  date: string;
  label: string;
  sales: number;
  netProfit: number;
};

type Props = {
  points: SalesChartPoint[];
  subtitle: string;
  rangePill: string;
};

const VB_W = 800;
const VB_H = 260;
const PAD = { l: 44, r: 8, t: 10, b: 28 };

function catmullRomPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return "";
  const first = pts[0];
  if (!first) return "";
  if (pts.length === 1) return `M ${first.x} ${first.y}`;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function yAt(value: number, max: number): number {
  const innerH = VB_H - PAD.t - PAD.b;
  return PAD.t + innerH - (value / max) * innerH;
}

function areaFrom(path: string, pts: Array<{ x: number; y: number }>): string {
  if (!path || pts.length === 0) return "";
  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  return `${path} L ${last.x} ${VB_H - PAD.b} L ${first.x} ${VB_H - PAD.b} Z`;
}

/** Dual-line Sales Overview. SVG scales to the card width (no side letterbox). */
export function SalesOverviewChart({ points, subtitle, rangePill }: Props) {
  const { t } = useLocale();
  const svgRef = useRef<SVGSVGElement>(null);
  const gradId = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const maxY = useMemo(() => {
    const peak = Math.max(
      0,
      ...points.map((p) => Math.max(p.sales, p.netProfit)),
    );
    return niceMax(peak);
  }, [points]);

  const innerW = VB_W - PAD.l - PAD.r;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY);

  const salesPts = points.map((p, i) => ({
    x:
      PAD.l +
      (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW),
    y: yAt(p.sales, maxY),
  }));
  const profitPts = points.map((p, i) => ({
    x:
      PAD.l +
      (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW),
    y: yAt(p.netProfit, maxY),
  }));

  const salesPath = catmullRomPath(salesPts);
  const profitPath = catmullRomPath(profitPts);
  const salesArea = areaFrom(salesPath, salesPts);
  const profitArea = areaFrom(profitPath, profitPts);

  function indexFromEvent(e: MouseEvent<SVGSVGElement>): number {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return 0;
    const ctm = svg.getScreenCTM();
    if (!ctm) return 0;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const loc = pt.matrixTransform(ctm.inverse());
    const tNorm = points.length <= 1 ? 0 : (loc.x - PAD.l) / innerW;
    return Math.max(
      0,
      Math.min(points.length - 1, Math.round(tNorm * (points.length - 1))),
    );
  }

  const hi = hover != null ? points[hover] : null;
  const hiSales = hover != null ? salesPts[hover] : null;
  const hiProfit = hover != null ? profitPts[hover] : null;
  const tooltipLeft =
    hiSales && hiSales.x > VB_W * 0.62
      ? hiSales.x - 168
      : (hiSales?.x ?? 0) + 12;

  const labelEvery = points.length <= 7 ? 1 : Math.ceil(points.length / 7);

  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">
            {t("dashboard.salesOverview")}
          </h2>
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          {rangePill}
        </span>
      </div>

      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="block w-full"
          role="img"
          aria-label={t("dashboard.salesOverview")}
          onMouseMove={(e) => setHover(indexFromEvent(e))}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id={`${gradId}-sales`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0D9488" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#0D9488" stopOpacity="0.02" />
            </linearGradient>
            <linearGradient id={`${gradId}-profit`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {ticks.map((tick) => {
            const y = yAt(tick, maxY);
            return (
              <g key={tick}>
                <line
                  x1={PAD.l}
                  x2={VB_W - PAD.r}
                  y1={y}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />
                <text
                  x={PAD.l - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted"
                  fontSize="11"
                >
                  {formatAxisK(tick)}
                </text>
              </g>
            );
          })}

          {salesArea ? (
            <path d={salesArea} fill={`url(#${gradId}-sales)`} />
          ) : null}
          {profitArea ? (
            <path d={profitArea} fill={`url(#${gradId}-profit)`} />
          ) : null}
          {salesPath ? (
            <path
              d={salesPath}
              fill="none"
              stroke="#0D9488"
              strokeWidth="2.25"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {profitPath ? (
            <path
              d={profitPath}
              fill="none"
              stroke="#4F46E5"
              strokeWidth="2.25"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}

          {points.map((p, i) =>
            i % labelEvery === 0 || i === points.length - 1 ? (
              <text
                key={p.date}
                x={salesPts[i]?.x ?? 0}
                y={VB_H - 8}
                textAnchor="middle"
                className="fill-muted"
                fontSize="11"
              >
                {p.label}
              </text>
            ) : null,
          )}

          {hover != null && hiSales && hiProfit ? (
            <>
              <line
                x1={hiSales.x}
                x2={hiSales.x}
                y1={PAD.t}
                y2={VB_H - PAD.b}
                stroke="#CBD5E1"
                strokeWidth="1.25"
              />
              <circle cx={hiSales.x} cy={hiSales.y} r="4.5" fill="#0D9488" />
              <circle cx={hiProfit.x} cy={hiProfit.y} r="4.5" fill="#4F46E5" />
            </>
          ) : null}
        </svg>

        {hi && hiSales ? (
          <div
            className="pointer-events-none absolute rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-sm"
            style={{
              left: `${(tooltipLeft / VB_W) * 100}%`,
              top: "10%",
            }}
          >
            <p className="font-semibold text-foreground">{hi.label}</p>
            <p className="mt-1">
              <span className="font-medium text-primary">
                {t("dashboard.chart.sales")}:{" "}
              </span>
              <span className="text-foreground">{formatTaka(hi.sales)}</span>
            </p>
            <p>
              <span className="font-medium text-accent">
                {t("dashboard.chart.profit")}:{" "}
              </span>
              <span className="text-foreground">
                {formatTaka(hi.netProfit)}
              </span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
