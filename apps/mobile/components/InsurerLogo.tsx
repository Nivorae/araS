import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { SvgUri } from "react-native-svg";
import { getInsurerCode } from "@repo/shared";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

interface Props {
  name: string;
  size?: number;
}

/**
 * Unlike BankLogo, the caller only ever has the insurer's display *name* —
 * insurer isn't a coded column on Insurance, just a free-typed string — so
 * this looks up the asset code itself and, unlike banks (SVG-only), also
 * cascades through raster fallbacks before giving up: not every insurer's
 * official logo was available as clean vector art, and of the ones that
 * weren't, some were only ever published as JPEG (see apps/web/public/insurance).
 */
const RASTER_EXTS = ["png", "jpg"] as const;

export function InsurerLogo({ name, size = 32 }: Props) {
  const code = getInsurerCode(name);
  const [stage, setStage] = useState<number>(code ? 0 : -1); // 0 = svg, 1.. = RASTER_EXTS index + 1, -1 = failed
  const r = Math.round(size * 0.25);

  if (stage === -1 || !code || !BASE_URL) {
    return (
      <View style={[s.fallback, { width: size, height: size, borderRadius: r }]}>
        <Text style={[s.initial, { fontSize: Math.round(size * 0.4) }]}>{name[0]}</Text>
      </View>
    );
  }

  if (stage > 0) {
    const ext = RASTER_EXTS[stage - 1];
    return (
      // The raster fallbacks are wide wordmark banners scraped from official
      // sites, not square icon marks like the bank/SVG logos — resizeMode
      // "cover" (Image's default) would crop them down to an illegible sliver
      // at these small sizes, so this contains them on a white badge instead.
      <View style={[s.rasterBadge, { width: size, height: size, borderRadius: r }]}>
        <Image
          source={{ uri: `${BASE_URL}/insurance/${code}.${ext}` }}
          style={{ width: size * 0.86, height: size * 0.86 }}
          resizeMode="contain"
          onError={() => setStage(stage < RASTER_EXTS.length ? stage + 1 : -1)}
        />
      </View>
    );
  }

  return (
    <SvgUri
      uri={`${BASE_URL}/insurance/${code}.svg`}
      width={size}
      height={size}
      style={{ borderRadius: r, overflow: "hidden" }}
      onError={() => setStage(1)}
    />
  );
}

const s = StyleSheet.create({
  fallback: {
    backgroundColor: "#e5e5ea",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { fontWeight: "700", color: "#636366" },
  rasterBadge: {
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
});
