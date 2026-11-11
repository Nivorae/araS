"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { NetWorthPoint } from "@repo/shared";

// Web port of apps/mobile/components/NetWorthChart.tsx — line + gradient area
// of net worth, tap/click a point for the 淨資產 / 總資產 / 總負債 tooltip.

const COLOR_LINE = "#374254";
const COLOR_ASSETS = "#66788E";
const COLOR_LIABILITIES = "#C7C7D4";
const Y_AXIS_W = 36;
const X_AXIS_H = 20;
const TOP_PAD = 10;
const TOOLTIP_W = 168;
const MAX_X_LABELS = 6;

export function formatY(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${Math.round(abs / 1_000_000)}M`;
  if (abs >= 1000) return `${sign}${Math.round(abs / 1000)}k`;
  return `${Math.round(value)}`;
}

function formatFull(v: number): string {
  const sign = v < 0 ? "-" : "";
  return (
    `${sign}NT$` +
    Math.round(Math.abs(v))
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  );
}

function niceCeil(max: number): number {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  let step: number;
  if (n <= 1) step = 1;
  else if (n <= 2) step = 2;
  else if (n <= 2.5) step = 2.5;
  else if (n <= 5) step = 5;
  else step = 10;
  return step * pow;
}

export function NetWorthChart({ data }: { data: NetWorthPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tooltip, setTooltip] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = data.filter((p) => Number.isFinite(p.netWorth));

  if (points.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col border-r-2 border-b-2 border-[#1c1c1e]">
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-6">
          <p className="text-[14px] font-semibold text-[#8e8e93]">尚無足夠的歷史資料</p>
          <p className="text-center text-[11px] text-[#c7c7cc]">
            新增或更新資產後，這裡會畫出淨資產的變化
          </p>
        </div>
      </div>
    );
  }

  const plotW = Math.max(0, size.w - Y_AXIS_W);
  const plotH = Math.max(0, size.h - X_AXIS_H - TOP_PAD);

  // Net worth goes negative once liabilities exceed assets, so the axis is not
  // anchored at zero — it spans whatever the data needs, with a zero baseline
  // drawn in whenever the range crosses it.
  const values = points.map((p) => p.netWorth);
  const rawMax = Math.max(0, ...values);
  const rawMin = Math.min(0, ...values);
  const yMax = niceCeil(rawMax);
  const yMin = rawMin < 0 ? -niceCeil(-rawMin) : 0;
  const span = yMax - yMin || 1;

  const TICKS = 5;
  const tickValues = Array.from({ length: TICKS }, (_, i) => yMin + (span / (TICKS - 1)) * i);

  const stepX = points.length > 1 ? plotW / (points.length - 1) : 0;
  const xFor = (i: number) => (points.length > 1 ? Y_AXIS_W + stepX * i : Y_AXIS_W + plotW / 2);
  const yFor = (v: number) => TOP_PAD + plotH * (1 - (v - yMin) / span);

  const coords = points.map((p, i) => ({ x: xFor(i), y: yFor(p.netWorth) }));
  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x} ${c.y}`).join(" ");
  const baselineY = yFor(Math.max(yMin, 0));
  const areaPath =
    coords.length > 1
      ? `${linePath} L${coords[coords.length - 1]!.x} ${baselineY} L${coords[0]!.x} ${baselineY} Z`
      : "";

  const bandW = points.length > 1 ? stepX : plotW;

  const tooltipLeft =
    tooltip !== null
      ? Math.min(
          Math.max(Y_AXIS_W, xFor(tooltip) - TOOLTIP_W / 2),
          Math.max(Y_AXIS_W, size.w - TOOLTIP_W - 2)
        )
      : 0;

  const labelEvery = Math.ceil(points.length / MAX_X_LABELS);
  const tip = tooltip !== null ? points[tooltip] : undefined;

  return (
    <div
      ref={wrapRef}
      className="relative h-full min-h-0 flex-1 border-r-2 border-b-2 border-[#1c1c1e]"
    >
      {size.w > 0 && (
        <svg width={size.w} height={size.h} className="absolute inset-0">
          <defs>
            <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={COLOR_LINE} stopOpacity={0.28} />
              <stop offset="1" stopColor={COLOR_LINE} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Dismiss the tooltip when clicking away from a point */}
          <rect
            x={0}
            y={0}
            width={size.w}
            height={size.h}
            fill="transparent"
            onClick={() => setTooltip(null)}
          />

          {tickValues.map((v, i) => (
            <line
              key={`grid-${i}`}
              x1={Y_AXIS_W}
              y1={yFor(v)}
              x2={size.w}
              y2={yFor(v)}
              stroke="#e5e5ea"
              strokeWidth={1}
            />
          ))}

          {yMin < 0 && (
            <line
              x1={Y_AXIS_W}
              y1={yFor(0)}
              x2={size.w}
              y2={yFor(0)}
              stroke="#c7c7cc"
              strokeWidth={1}
            />
          )}

          {areaPath !== "" && <path d={areaPath} fill="url(#netWorthFill)" />}

          <path
            d={linePath}
            stroke={COLOR_LINE}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />

          {coords.map((c, i) => (
            <g
              key={`pt-${i}`}
              data-testid={`networth-point-${i}`}
              className="cursor-pointer"
              onClick={() => setTooltip(tooltip === i ? null : i)}
            >
              <rect
                x={c.x - bandW / 2}
                y={TOP_PAD}
                width={bandW}
                height={plotH}
                fill="transparent"
              />
              <circle
                cx={c.x}
                cy={c.y}
                r={tooltip === i ? 5 : 3}
                fill="#ffffff"
                stroke={COLOR_LINE}
                strokeWidth={2}
              />
            </g>
          ))}
        </svg>
      )}

      {size.w > 0 &&
        tickValues.map((v, i) => (
          <span
            key={`ylabel-${i}`}
            className="pointer-events-none absolute left-0 truncate text-right text-[11px] text-[#8e8e93]"
            style={{ top: yFor(v) - 7, width: Y_AXIS_W - 4 }}
          >
            {formatY(v)}
          </span>
        ))}

      {size.w > 0 && (
        <div
          className="pointer-events-none absolute right-0 bottom-0 flex items-center"
          style={{ left: Y_AXIS_W, height: X_AXIS_H }}
        >
          {points.map((p, i) => (
            <span
              key={`xlabel-${i}`}
              className="flex-1 truncate text-center text-[11px] text-[#8e8e93]"
            >
              {i % labelEvery === 0 ? p.period : ""}
            </span>
          ))}
        </div>
      )}

      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-20 rounded-[10px] p-2.5 shadow-[0_4px_8px_rgba(0,0,0,0.22)]"
          style={{
            left: tooltipLeft,
            top: TOP_PAD + 6,
            width: TOOLTIP_W,
            background: "rgba(28,28,30,0.92)",
          }}
        >
          <p className="mb-1.5 text-[12px] font-bold text-white">{tip.period}</p>
          {(
            [
              ["淨資產", tip.netWorth, COLOR_LINE],
              ["總資產", tip.totalAssets, COLOR_ASSETS],
              ["總負債", tip.totalLiabilities, COLOR_LIABILITIES],
            ] as const
          ).map(([label, v, color]) => (
            <div key={label} className="mt-[3px] flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: color }} />
              <span className="text-[11px] font-medium whitespace-pre text-[#e5e5ea]">
                {`${label}  ${formatFull(v)}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
