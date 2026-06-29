import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SvgUri } from "react-native-svg";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

interface Props {
  code: string;
  name: string;
  size?: number;
}

export function BankLogo({ code, name, size = 32 }: Props) {
  const [failed, setFailed] = useState(false);
  const r = Math.round(size * 0.25);

  if (failed || !BASE_URL) {
    return (
      <View style={[s.fallback, { width: size, height: size, borderRadius: r }]}>
        <Text style={[s.initial, { fontSize: Math.round(size * 0.4) }]}>{name[0]}</Text>
      </View>
    );
  }

  return (
    <SvgUri
      uri={`${BASE_URL}/banks/${code}.svg`}
      width={size}
      height={size}
      style={{ borderRadius: r, overflow: "hidden" }}
      onError={() => setFailed(true)}
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
});
