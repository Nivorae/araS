import { useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Svg, {
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { fmtY } from "@/lib/retirement";

export interface ProjRow {
  age: number;
  base: number;
  opt: number;
  cons: number;
}

const Y_AXIS_W = 44;
const X_AXIS_H = 20;
const TOP_PAD = 20;
const RIGHT_PAD = 16;

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

export function ProjectionChart({
  data,
  target,
  retirementAge,
  height = 220,
}: {
  data: ProjRow[];
  target: number;
  retirementAge: number;
  height?: number;
}) {
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  const plotW = Math.max(0, w - Y_AXIS_W - RIGHT_PAD);
  const plotH = Math.max(0, height - X_AXIS_H - TOP_PAD);

  if (data.length === 0 || w === 0) {
    return <View style={{ height }} onLayout={onLayout} />;
  }

  const ageMin = data[0]!.age;
  const ageMax = data[data.length - 1]!.age;
  const ageSpan = Math.max(1, ageMax - ageMin);

  const rawMax = data.reduce((m, d) => Math.max(m, d.base, d.opt, d.cons), target);
  const yMax = niceCeil(rawMax);

  const xFor = (age: number) => Y_AXIS_W + ((age - ageMin) / ageSpan) * plotW;
  const yFor = (v: number) => TOP_PAD + plotH * (1 - v / yMax);

  const linePath = (key: "base" | "opt" | "cons") =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"}${xFor(d.age).toFixed(1)},${yFor(d[key]).toFixed(1)}`)
      .join(" ");

  const areaPath = (key: "base" | "opt" | "cons") => {
    const top = data
      .map((d, i) => `${i === 0 ? "M" : "L"}${xFor(d.age).toFixed(1)},${yFor(d[key]).toFixed(1)}`)
      .join(" ");
    const bottomY = TOP_PAD + plotH;
    const lastX = xFor(data[data.length - 1]!.age);
    const firstX = xFor(data[0]!.age);
    return `${top} L${lastX.toFixed(1)},${bottomY} L${firstX.toFixed(1)},${bottomY} Z`;
  };

  const yTicks = Array.from({ length: 5 }, (_, i) => (yMax / 4) * i);
  const xTicks = data.filter((r) => r.age % 5 === 0).map((r) => r.age);

  return (
    <View onLayout={onLayout}>
      <Svg width={w} height={height}>
        <Defs>
          <SvgLinearGradient id="rGradBase" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#374254" stopOpacity={0.18} />
            <Stop offset="1" stopColor="#374254" stopOpacity={0} />
          </SvgLinearGradient>
          <SvgLinearGradient id="rGradOpt" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0e1424" stopOpacity={0.1} />
            <Stop offset="1" stopColor="#0e1424" stopOpacity={0} />
          </SvgLinearGradient>
          <SvgLinearGradient id="rGradCons" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#ff9500" stopOpacity={0.1} />
            <Stop offset="1" stopColor="#ff9500" stopOpacity={0} />
          </SvgLinearGradient>
        </Defs>

        {/* Y grid + labels */}
        {yTicks.map((v, i) => (
          <Line
            key={`g${i}`}
            x1={Y_AXIS_W}
            y1={yFor(v)}
            x2={w - RIGHT_PAD}
            y2={yFor(v)}
            stroke="#f2f2f7"
            strokeWidth={1}
          />
        ))}
        {yTicks.map((v, i) => (
          <SvgText
            key={`yl${i}`}
            x={Y_AXIS_W - 6}
            y={yFor(v) + 4}
            fontSize={11}
            fill="#8e8e93"
            textAnchor="end"
          >
            {fmtY(v)}
          </SvgText>
        ))}

        {/* X labels */}
        {xTicks.map((age) => (
          <SvgText
            key={`xl${age}`}
            x={xFor(age)}
            y={height - 4}
            fontSize={11}
            fill="#8e8e93"
            textAnchor="middle"
          >
            {age}
          </SvgText>
        ))}

        {/* Areas (cons, opt, base order — base on top) */}
        <Path d={areaPath("cons")} fill="url(#rGradCons)" />
        <Path d={areaPath("opt")} fill="url(#rGradOpt)" />
        <Path d={areaPath("base")} fill="url(#rGradBase)" />

        {/* Lines */}
        <Path d={linePath("cons")} stroke="#ff9500" strokeWidth={1} fill="none" />
        <Path d={linePath("opt")} stroke="#0e1424" strokeWidth={1} fill="none" />
        <Path d={linePath("base")} stroke="#374254" strokeWidth={2} fill="none" />

        {/* Target reference line (horizontal, dashed) */}
        {target > 0 && target <= yMax && (
          <>
            <Line
              x1={Y_AXIS_W}
              y1={yFor(target)}
              x2={w - RIGHT_PAD}
              y2={yFor(target)}
              stroke="#0e1424"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <SvgText
              x={w - RIGHT_PAD}
              y={yFor(target) - 4}
              fontSize={10}
              fill="#0e1424"
              textAnchor="end"
            >
              目標
            </SvgText>
          </>
        )}

        {/* Retirement reference line (vertical, dashed) */}
        {retirementAge >= ageMin && retirementAge <= ageMax && (
          <>
            <Line
              x1={xFor(retirementAge)}
              y1={TOP_PAD}
              x2={xFor(retirementAge)}
              y2={TOP_PAD + plotH}
              stroke="#ff9500"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <SvgText
              x={xFor(retirementAge)}
              y={TOP_PAD - 6}
              fontSize={10}
              fill="#ff9500"
              textAnchor="middle"
            >
              退休
            </SvgText>
          </>
        )}
      </Svg>

      {/* Legend */}
      <View style={s.legend}>
        {[
          { color: "#0e1424", label: "樂觀 (+2%)" },
          { color: "#374254", label: "基準" },
          { color: "#ff9500", label: "保守 (-2%)" },
        ].map(({ color, label }) => (
          <View key={label} style={s.legendItem}>
            <View style={[s.legendDash, { backgroundColor: color }]} />
            <Text style={s.legendLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 8,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDash: { width: 16, height: 2, borderRadius: 1 },
  legendLabel: { fontSize: 11, color: "#8e8e93" },
});
