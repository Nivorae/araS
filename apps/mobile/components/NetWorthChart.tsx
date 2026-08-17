import { useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import type { NetWorthPoint } from "@repo/shared";

const COLOR_LINE = "#374254";
const COLOR_ASSETS = "#66788E";
const COLOR_LIABILITIES = "#C7C7D4";
const Y_AXIS_W = 36;
const X_AXIS_H = 20;
const TOP_PAD = 10;
const TOOLTIP_W = 168;
const MAX_X_LABELS = 6;

function formatY(value: number): string {
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
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tooltip, setTooltip] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  };

  // A single non-finite coordinate hard-crashes react-native-svg on iOS, so
  // anything that isn't a real number is dropped before it can reach a Path.
  const points = data.filter((p) => Number.isFinite(p.netWorth));

  if (points.length === 0) {
    return (
      <View style={s.wrap}>
        <View style={s.empty}>
          <Text style={s.emptyText}>尚無足夠的歷史資料</Text>
          <Text style={s.emptyHint}>新增或更新資產後，這裡會畫出淨資產的變化</Text>
        </View>
      </View>
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

  // Hit bands are half a step wider than the gap between points so the first
  // and last point stay tappable at the very edge of the plot.
  const bandW = points.length > 1 ? stepX : plotW;

  const tooltipLeft =
    tooltip !== null
      ? Math.min(
          Math.max(Y_AXIS_W, xFor(tooltip) - TOOLTIP_W / 2),
          Math.max(Y_AXIS_W, size.w - TOOLTIP_W - 2)
        )
      : 0;

  // Long ranges (12 months, or a year per point) would overlap their labels, so
  // only every nth one is drawn — the tooltip carries the exact period anyway.
  const labelEvery = Math.ceil(points.length / MAX_X_LABELS);

  return (
    <View style={s.wrap} onLayout={onLayout}>
      {size.w > 0 && (
        <Svg width={size.w} height={size.h}>
          <Defs>
            <LinearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={COLOR_LINE} stopOpacity={0.28} />
              <Stop offset="1" stopColor={COLOR_LINE} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>

          {/* Dismiss the tooltip when tapping away from a point */}
          <Rect
            x={0}
            y={0}
            width={size.w}
            height={size.h}
            fill="transparent"
            onPress={() => setTooltip(null)}
          />

          {tickValues.map((v, i) => (
            <Line
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
            <Line
              x1={Y_AXIS_W}
              y1={yFor(0)}
              x2={size.w}
              y2={yFor(0)}
              stroke="#c7c7cc"
              strokeWidth={1}
            />
          )}

          {areaPath !== "" && <Path d={areaPath} fill="url(#netWorthFill)" />}

          <Path
            d={linePath}
            stroke={COLOR_LINE}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill="none"
          />

          {coords.map((c, i) => (
            <G key={`pt-${i}`} onPress={() => setTooltip(tooltip === i ? null : i)}>
              <Rect
                x={c.x - bandW / 2}
                y={TOP_PAD}
                width={bandW}
                height={plotH}
                fill="transparent"
              />
              <Circle
                cx={c.x}
                cy={c.y}
                r={tooltip === i ? 5 : 3}
                fill="#ffffff"
                stroke={COLOR_LINE}
                strokeWidth={2}
              />
            </G>
          ))}
        </Svg>
      )}

      {size.w > 0 &&
        tickValues.map((v, i) => (
          <Text
            key={`ylabel-${i}`}
            numberOfLines={1}
            style={[s.yLabel, { top: yFor(v) - 7, width: Y_AXIS_W - 4 }]}
          >
            {formatY(v)}
          </Text>
        ))}

      {size.w > 0 && (
        <View style={[s.xRow, { left: Y_AXIS_W, height: X_AXIS_H }]}>
          {points.map((p, i) => (
            <Text key={`xlabel-${i}`} style={s.xLabel} numberOfLines={1}>
              {i % labelEvery === 0 ? p.period : ""}
            </Text>
          ))}
        </View>
      )}

      {tooltip !== null && points[tooltip] !== undefined && (
        <View style={[s.tooltip, { left: tooltipLeft, top: TOP_PAD + 6 }]} pointerEvents="none">
          <Text style={s.tooltipPeriod}>{points[tooltip]!.period}</Text>
          <View style={s.tooltipRow}>
            <View style={[s.tooltipDot, { backgroundColor: COLOR_LINE }]} />
            <Text style={s.tooltipText}>
              {"淨資產  "}
              {formatFull(points[tooltip]!.netWorth)}
            </Text>
          </View>
          <View style={s.tooltipRow}>
            <View style={[s.tooltipDot, { backgroundColor: COLOR_ASSETS }]} />
            <Text style={s.tooltipText}>
              {"總資產  "}
              {formatFull(points[tooltip]!.totalAssets)}
            </Text>
          </View>
          <View style={s.tooltipRow}>
            <View style={[s.tooltipDot, { backgroundColor: COLOR_LIABILITIES }]} />
            <Text style={s.tooltipText}>
              {"總負債  "}
              {formatFull(points[tooltip]!.totalLiabilities)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 0,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#1c1c1e",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 24,
  },
  emptyText: { fontSize: 14, fontWeight: "600", color: "#8e8e93" },
  emptyHint: { fontSize: 11, color: "#c7c7cc", textAlign: "center" },
  yLabel: {
    position: "absolute",
    left: 0,
    textAlign: "right",
    fontSize: 11,
    color: "#8e8e93",
  },
  xRow: {
    position: "absolute",
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  xLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    color: "#8e8e93",
  },
  tooltip: {
    position: "absolute",
    width: TOOLTIP_W,
    backgroundColor: "rgba(28,28,30,0.92)",
    borderRadius: 10,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 20,
  },
  tooltipPeriod: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 6,
  },
  tooltipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  tooltipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tooltipText: {
    fontSize: 11,
    color: "#e5e5ea",
    fontWeight: "500",
  },
});
