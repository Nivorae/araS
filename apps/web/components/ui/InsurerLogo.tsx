"use client";

import { useState } from "react";
import { getInsurerCode } from "@repo/shared";

// Web port of apps/mobile/components/InsurerLogo.tsx. Callers only have the
// insurer's display name, so this looks up the asset code itself.
//
// Mobile cascades svg → png → jpg → letter tile because it can't list the
// server's files. The web serves those files itself, so it knows each code's
// format up front and never requests one that doesn't exist (a cascade here
// meant ~10 404s every time the insurer list rendered). Keep this map in step
// with apps/web/public/insurance — tests/lib/insurerLogoAssets.test.ts checks it.
export const INSURER_LOGO_EXT: Record<string, "svg" | "png" | "jpg"> = {
  aia: "svg",
  allianz: "svg",
  "bot-life": "svg",
  "cardif-life": "jpg",
  "cathay-century": "svg",
  "cathay-life": "svg",
  "chubb-life": "png",
  "chubb-property": "svg",
  "chunghwa-post": "svg",
  "ctbc-property": "jpg",
  "farglory-life": "svg",
  "first-insurance": "png",
  "first-life": "svg",
  "fubon-life": "svg",
  "fubon-property": "svg",
  "global-life": "svg",
  "hontai-life": "svg",
  "hotai-property": "svg",
  "kgi-life": "svg",
  "mercuries-life": "svg",
  mingtai: "svg",
  "nan-shan-life": "svg",
  "nan-shan-property": "svg",
  prudential: "jpg",
  "shin-kong-life": "svg",
  "shin-kong-property": "svg",
  sompo: "svg",
  "tai-an": "svg",
  "taiwan-life": "png",
  "tcb-life": "png",
  "want-want-union": "png",
  "yuanta-life": "svg",
};

export function InsurerLogo({ name, size = 32 }: { name: string; size?: number }) {
  const code = getInsurerCode(name);
  const ext = code ? INSURER_LOGO_EXT[code] : undefined;
  const [failed, setFailed] = useState(false);
  const r = Math.round(size * 0.25);

  if (!code || !ext || failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center bg-[#e5e5ea] font-bold text-[#636366]"
        style={{ width: size, height: size, borderRadius: r, fontSize: Math.round(size * 0.4) }}
        data-testid="insurer-logo-fallback"
      >
        {name[0]}
      </span>
    );
  }

  if (ext === "svg") {
    return (
      <img
        src={`/insurance/${code}.svg`}
        alt=""
        className="shrink-0 object-contain"
        style={{ width: size, height: size, borderRadius: r }}
        onError={() => setFailed(true)}
      />
    );
  }

  // Raster logos are wide wordmarks — contain them on a white badge rather
  // than cropping them to an illegible sliver.
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center overflow-hidden bg-white"
      style={{ width: size, height: size, borderRadius: r }}
    >
      <img
        src={`/insurance/${code}.${ext}`}
        alt=""
        className="object-contain"
        style={{ width: size * 0.86, height: size * 0.86 }}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
