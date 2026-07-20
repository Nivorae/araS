import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { ArrowLeft, LogOut, Sparkles, Trash2, type LucideIcon } from "lucide-react-native";
import { ApiError, useApi } from "@/lib/api";

// Borrowed from CategoryCardStack: same radius, same soft upward shadow, same
// brand colours. The deck geometry (width taper, overlap, expand-on-tap) is not
// copied — these are three equal-weight settings actions, so they read as a
// plain list of full-width cards.
const CARD_RADIUS = 26;

const SPRING_PRESS = { stiffness: 220, damping: 25, mass: 1, useNativeDriver: true } as const;

interface SettingCardProps {
  icon: LucideIcon;
  label: string;
  color: string;
  textColor: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

function SettingCard({
  icon: Icon,
  label,
  color,
  textColor,
  loading,
  disabled,
  onPress,
}: SettingCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const springTo = (to: number) => Animated.spring(scale, { toValue: to, ...SPRING_PRESS }).start();

  return (
    <Animated.View style={[s.card, { backgroundColor: color, transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => springTo(0.97)}
        onPressOut={() => springTo(1)}
        disabled={disabled}
        // Padding lives on the Pressable so the whole card is a tap target.
        style={({ pressed }) => [s.cardPress, { opacity: disabled ? 0.6 : pressed ? 0.85 : 1 }]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={textColor} />
        ) : (
          <Icon size={20} color={textColor} />
        )}
        <Text style={[s.cardLabel, { color: textColor }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();
  const api = useApi();
  const [deleting, setDeleting] = useState(false);

  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "—";
  const name = user?.fullName ?? "";

  function confirmDelete() {
    Alert.alert(
      "刪除帳號",
      "此動作會永久刪除你的帳號與所有資料（資產、負債、交易、投資組合），且無法復原。確定要繼續嗎？",
      [
        { text: "取消", style: "cancel" },
        { text: "刪除帳號", style: "destructive", onPress: runDelete },
      ]
    );
  }

  async function runDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.delete("/api/account");
      // Data + Clerk user are gone; signing out clears the local session and the
      // root layout redirects to the welcome screen.
      await signOut();
    } catch (e) {
      setDeleting(false);
      const msg = e instanceof ApiError || e instanceof Error ? e.message : "請稍後再試";
      Alert.alert("刪除失敗", msg);
    }
  }

  return (
    <View style={s.root}>
      <SafeAreaView edges={["top", "bottom"]} style={s.safe}>
        {/* Header */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
            <ArrowLeft size={24} color="#1c1c1e" />
          </Pressable>
          <Text style={s.headerTitle}>設定</Text>
          <View style={s.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={s.content}>
          {/* Profile — the page's title block, deliberately outside the deck so
              the cards read as the one piece of content. */}
          <View style={s.profile}>
            {user?.imageUrl ? (
              <Image source={{ uri: user.imageUrl }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarInitial}>{(name || email).charAt(0).toUpperCase()}</Text>
              </View>
            )}
            {name ? <Text style={s.name}>{name}</Text> : null}
            <Text style={s.email}>{email}</Text>
          </View>

          {/* Actions */}
          <View style={s.stack}>
            <SettingCard
              icon={Sparkles}
              label="升級 Premium"
              color="#374254"
              textColor="#ffffff"
              onPress={() => router.push("/paywall")}
            />
            <SettingCard
              icon={LogOut}
              label="登出"
              color="#C7C7D4"
              textColor="#1c1c1e"
              onPress={() => signOut()}
            />
            <SettingCard
              icon={Trash2}
              label={deleting ? "刪除中…" : "刪除帳號"}
              color="#FFFFFF"
              textColor="#ff3b30"
              loading={deleting}
              disabled={deleting}
              onPress={confirmDelete}
            />
          </View>

          <Text style={s.dangerHint}>永久刪除帳號與所有資料，無法復原。</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f2f2f7" },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#1c1c1e" },
  headerSpacer: { width: 32 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },

  profile: { alignItems: "center", paddingTop: 12, paddingBottom: 32, gap: 4 },
  avatar: { width: 64, height: 64, borderRadius: 32, marginBottom: 8 },
  avatarFallback: { backgroundColor: "#C7C7D4", alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 26, fontWeight: "700", color: "#1c1c1e" },
  name: { fontSize: 17, fontWeight: "700", color: "#1c1c1e" },
  email: { fontSize: 14, color: "#8e8e93" },

  stack: { gap: 12 },
  card: {
    borderRadius: CARD_RADIUS,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  cardPress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  cardLabel: { fontSize: 16, fontWeight: "700" },

  dangerHint: { fontSize: 13, color: "#8e8e93", marginTop: 16, textAlign: "center" },
});
