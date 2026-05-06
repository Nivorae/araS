"use client";

interface TreemapItem {
  name: string;
  value: number;
}

interface Props {
  items: TreemapItem[];
}

const COLORS = [
  "#0e1424", // green — 流動資金
  "#66788E", // indigo — 投資
  "#374254", // blue — 固定資產
  "#af52de", // purple
  "#ff9500", // orange
  "#ff3b30", // red — 負債
  "#8e8e93", // gray — other
];

interface Rect {
  name: string;
  value: number;
  pct: number;
  color: string;
}

function buildRows(rects: Rect[]): Rect[][] {
  const rows: Rect[][] = [];
  let i = 0;
  while (i < rects.length) {
    const pct = rects[i]!.pct;
    if (pct >= 40 || i === rects.length - 1) {
      rows.push([rects[i]!]);
      i++;
    } else {
      rows.push(rects.slice(i, Math.min(i + 2, rects.length)));
      i += 2;
    }
  }
  return rows;
}

export function AssetTreemap({ items }: Props) {
  if (items.length === 0) return null;

  const total = items.reduce((s, i) => s + Math.abs(i.value), 0);
  if (total === 0) return null;

  const sorted = [...items]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .map((item, idx) => ({
      name: item.name,
      value: Math.abs(item.value),
      pct: Math.round((Math.abs(item.value) / total) * 100),
      color: COLORS[idx % COLORS.length]!,
    }));

  const rows = buildRows(sorted);

  return (
    <div className="flex h-[420px] flex-col gap-1.5 overflow-hidden rounded-3xl">
      {rows.map((row, ri) => {
        const rowPct = row.reduce((s, r) => s + r.pct, 0);
        return (
          <div key={ri} className="flex min-h-0 gap-1.5" style={{ flex: `${rowPct} 0 0` }}>
            {row.map((item) => (
              <div
                key={item.name}
                className="flex min-w-0 flex-col justify-end rounded-2xl p-4"
                style={{
                  flex: `${item.pct} 0 0`,
                  backgroundColor: item.color,
                }}
              >
                <p className="text-[32px] leading-none font-bold text-white">{item.pct}%</p>
                <p className="mt-1 text-[13px] text-white/80">{item.name}</p>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
