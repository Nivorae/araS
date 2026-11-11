"use client";

import { useState } from "react";

// Web port of apps/mobile/components/BankLogo.tsx — the bank's SVG from
// public/banks, falling back to the name's first character on a grey tile.
export function BankLogo({ code, name, size = 32 }: { code: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const r = Math.round(size * 0.25);

  if (failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center bg-[#e5e5ea] font-bold text-[#636366]"
        style={{ width: size, height: size, borderRadius: r, fontSize: Math.round(size * 0.4) }}
      >
        {name[0]}
      </span>
    );
  }

  return (
    <img
      src={`/banks/${code}.svg`}
      alt=""
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size, borderRadius: r }}
      onError={() => setFailed(true)}
    />
  );
}
