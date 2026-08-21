import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { useAuth, useUser } from "@clerk/clerk-expo";
import {
  ArrowLeft,
  Bell,
  Check,
  CreditCard,
  LogOut,
  Loader,
  Trash2,
  type LucideIcon,
} from "lucide-react-native";
import { ApiError, useApi } from "@/lib/api";
import { useIsPremium } from "@/hooks/useIsPremium";
import { useResponsive } from "@/hooks/useResponsive";
import { parseWhatsNew } from "@/lib/whatsNew";

// Borrowed from CategoryCardStack: same radius, same soft upward shadow, same
// brand colours. The deck geometry (width taper, overlap, expand-on-tap) is not
// copied — these are three equal-weight settings actions, so they read as a
// plain list of full-width cards.
const CARD_RADIUS = 26;

const SPRING_PRESS = { stiffness: 220, damping: 25, mass: 1, useNativeDriver: true } as const;

const AVATAR_SIZE = 40;

/**
 * The soft blue blobs behind the page.
 *
 * `expo-blur` is not a dependency, and a BlurView over a solid colour would be
 * an expensive way to fake this anyway — a radial gradient that fades to fully
 * transparent already *is* a blurred circle, and it renders on the GPU with no
 * per-frame cost. Three of them (top-left, upper-right, bottom) give the same
 * off-centre glow as the reference without any of them showing a hard edge.
 */
function BlueBlobs({ width, height }: { width: number; height: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height} pointerEvents="none">
      <Defs>
        <RadialGradient id="blobA" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#4C7DF0" stopOpacity="0.34" />
          <Stop offset="0.55" stopColor="#4C7DF0" stopOpacity="0.14" />
          <Stop offset="1" stopColor="#4C7DF0" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="blobB" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#7EA6F5" stopOpacity="0.30" />
          <Stop offset="0.55" stopColor="#7EA6F5" stopOpacity="0.12" />
          <Stop offset="1" stopColor="#7EA6F5" stopOpacity="0" />
        </RadialGradient>
        <RadialGradient id="blobC" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#374254" stopOpacity="0.18" />
          <Stop offset="0.6" stopColor="#374254" stopOpacity="0.07" />
          <Stop offset="1" stopColor="#374254" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx={width * 0.1} cy={height * 0.12} r={width * 0.62} fill="url(#blobA)" />
      <Circle cx={width * 0.95} cy={height * 0.3} r={width * 0.5} fill="url(#blobB)" />
      <Circle cx={width * 0.3} cy={height * 0.92} r={width * 0.66} fill="url(#blobC)" />
    </Svg>
  );
}

/**
 * Build lines for the version footer.
 *
 * Two independent numbers, deliberately kept separate:
 *  - `version` (app.json) — the marketing version, bumped ONLY on a native
 *    rebuild. It doubles as `runtimeVersion` (policy: "appVersion"), so bumping
 *    it for an OTA would make that update undeliverable to installed binaries.
 *  - `Updates.createdAt` — when the running OTA bundle was published. Changes on
 *    every `eas update` with no manual bookkeeping, which is what actually tells
 *    you which JS a user is running.
 *
 * `createdAt` is null when the app is running its embedded (App Store) bundle
 * with no OTA applied yet. `isEnabled` is false in Expo Go / dev.
 *
 * The third line is the update state, and it is the direct answer to "has the
 * new version finished downloading yet?" — the question the background download
 * gives the user no way to answer. Values come from `Updates.useUpdates()`,
 * read by the caller (a pure function can't call a hook).
 */
function versionLines(status: {
  isDownloading: boolean;
  downloadProgress?: number | undefined;
  isUpdatePending: boolean;
}): string[] {
  const version = Constants.expoConfig?.version ?? "—";
  if (!Updates.isEnabled) return [`版本 ${version} · 開發模式`];

  const lines = [`版本 ${version}`];
  const createdAt = Updates.createdAt;
  if (createdAt) {
    const p = (n: number) => String(n).padStart(2, "0");
    lines.push(
      `更新於 ${createdAt.getFullYear()}/${p(createdAt.getMonth() + 1)}/${p(createdAt.getDate())} ` +
        `${p(createdAt.getHours())}:${p(createdAt.getMinutes())}`
    );
  }

  if (status.isDownloading) {
    // `downloadProgress` is only continuous when the server sends
    // Content-Length; without it the value stays coarse, so show a bare
    // "下載中…" rather than a percentage that looks stuck at 0%.
    const pct = status.downloadProgress;
    lines.push(
      typeof pct === "number" && pct > 0 ? `更新下載中… ${Math.round(pct * 100)}%` : "更新下載中…"
    );
  } else if (status.isUpdatePending) {
    lines.push("已下載，重啟後生效");
  } else {
    lines.push("已是最新版本");
  }
  return lines;
}

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
  const { isTablet, contentWidth, width, height } = useResponsive();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
  const { user } = useUser();
  const api = useApi();
  const { isPremium, loading: premiumLoading, refresh } = useIsPremium();
  const [deleting, setDeleting] = useState(false);
  const [devToggling, setDevToggling] = useState(false);
  // The avatar is now the only entry point to 登出, so the menu it opens is
  // what makes that action reachable at all — hence a real Modal (it captures
  // the outside tap to dismiss) rather than an absolutely positioned view.
  const [menuOpen, setMenuOpen] = useState(false);
  // Update-notes modal, opened from the bell button. Content is app.json's
  // `extra.whatsNew`, not fetched — it ships with the bundle already.
  const [notesOpen, setNotesOpen] = useState(false);
  const whatsNew = parseWhatsNew(Constants.expoConfig?.extra?.whatsNew);
  // Live OTA state for the version footer — 「下載完成了沒」 answered in place.
  const { isDownloading, downloadProgress, isUpdatePending } = Updates.useUpdates();
  const updateStatus = { isDownloading, downloadProgress, isUpdatePending };

  async function simulatePremium(action: "activate" | "deactivate") {
    if (devToggling) return;
    setDevToggling(true);
    try {
      await api.post("/api/dev/subscription", { action });
      await refresh();
    } catch (e) {
      const msg = e instanceof ApiError || e instanceof Error ? e.message : "請稍後再試";
      Alert.alert("模擬失敗", msg);
    } finally {
      setDevToggling(false);
    }
  }

  const email =
    user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "—";
  const name = user?.fullName ?? "";
  const greetingName = user?.firstName ?? name;
  const initial = (name || email).charAt(0).toUpperCase();

  // Apple's canonical deep link for subscription management. Cancelling is
  // handled entirely by the App Store — we never see or control it — so this
  // link is the only route we can offer, and the paywall's required disclosure
  // ("你可隨時於 App Store 帳戶設定管理或取消訂閱") should be reachable in one
  // tap rather than only readable as text.
  async function openSubscriptionManagement() {
    try {
      await Linking.openURL("https://apps.apple.com/account/subscriptions");
    } catch {
      Alert.alert("無法開啟訂閱設定", "請至 iOS「設定」→ 你的 Apple ID →「訂閱」進行管理。");
    }
  }

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

  // Rendered twice (header button + menu header), so it is built once here.
  function avatar() {
    return user?.imageUrl ? (
      <Image source={{ uri: user.imageUrl }} style={s.avatar} />
    ) : (
      <View style={[s.avatar, s.avatarFallback]}>
        <Text style={s.avatarInitial}>{initial}</Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <BlueBlobs width={width} height={height} />
      <SafeAreaView edges={["top", "bottom"]} style={s.safe}>
        {/* Header: back on the left, bell + account avatar on the right. */}
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={s.backBtn}>
            <ArrowLeft size={24} color="#1c1c1e" />
          </Pressable>
          <View style={s.headerRight}>
            <Pressable
              onPress={() => setNotesOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="更新內容"
              style={({ pressed }) => [s.bellBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Bell size={20} color="#1c1c1e" />
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen(true)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="帳號選單"
              style={({ pressed }) => [s.avatarBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              {avatar()}
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            s.content,
            isTablet && { width: contentWidth, alignSelf: "center" },
          ]}
        >
          {/* Greeting — the page's title block, replacing the centred profile
              card now that the identity lives in the avatar. */}
          <View style={s.greeting}>
            <Text style={s.greetingHello}>{greetingName ? `Hi, ${greetingName}` : "Hi"}</Text>
            <Text style={s.greetingSub}>今天離你的目標又更進一步囉</Text>
          </View>

          {/* Actions */}
          <View style={s.stack}>
            {/* One card in three states: reading (spinner), already-premium, and
                free. All three route into the paywall on tap — a premium user can
                still open it to review what their plan includes. The cached
                premium status means later visits skip the spinner entirely. */}
            <SettingCard
              icon={isPremium ? Check : Loader}
              label={premiumLoading ? "讀取中…" : isPremium ? "已升級 Premium" : "升級 Premium"}
              color="#374254"
              textColor="#ffffff"
              loading={premiumLoading}
              onPress={() => router.push("/paywall")}
            />
            {/* Only for subscribers — there is nothing to manage otherwise. A
                user who has cancelled but is still inside the paid period is
                still premium, so they keep seeing it until the term ends. */}
            {isPremium ? (
              <SettingCard
                icon={CreditCard}
                label="管理訂閱"
                color="#C7C7D4"
                textColor="#1c1c1e"
                onPress={openSubscriptionManagement}
              />
            ) : null}
            {__DEV__ ? (
              <>
                <SettingCard
                  icon={Check}
                  label="模擬升級（僅開發模式）"
                  color="#34C759"
                  textColor="#ffffff"
                  loading={devToggling}
                  disabled={devToggling}
                  onPress={() => simulatePremium("activate")}
                />
                <SettingCard
                  icon={Trash2}
                  label="模擬取消（僅開發模式）"
                  color="#FF9500"
                  textColor="#ffffff"
                  loading={devToggling}
                  disabled={devToggling}
                  onPress={() => simulatePremium("deactivate")}
                />
              </>
            ) : null}
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

          <View style={s.versionBlock}>
            {versionLines(updateStatus).map((line) => (
              <Text key={line} style={s.versionText}>
                {line}
              </Text>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Avatar menu: identity + 登出, anchored just under the avatar — hence
          the same safe-area inset the header sits on. */}
      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={s.backdrop} onPress={() => setMenuOpen(false)}>
          {/* Swallows the tap so pressing inside the menu does not close it. */}
          <Pressable
            style={[s.menu, { marginTop: insets.top + AVATAR_SIZE + 20 }]}
            onPress={() => {}}
          >
            <View style={s.menuHeader}>
              {avatar()}
              <View style={s.menuIdentity}>
                {name ? (
                  <Text style={s.menuName} numberOfLines={1}>
                    {name}
                  </Text>
                ) : null}
                <Text style={s.menuEmail} numberOfLines={1}>
                  {email}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => {
                setMenuOpen(false);
                signOut();
              }}
              style={({ pressed }) => [s.menuAction, { opacity: pressed ? 0.6 : 1 }]}
            >
              <LogOut size={18} color="#1c1c1e" />
              <Text style={s.menuActionLabel}>登出</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Update-notes modal: read-only display of app.json's whatsNew. */}
      <Modal
        visible={notesOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNotesOpen(false)}
      >
        <Pressable style={s.backdrop} onPress={() => setNotesOpen(false)}>
          <Pressable
            style={[s.notesCard, { marginTop: insets.top + AVATAR_SIZE + 20 }]}
            onPress={() => {}}
          >
            <Text style={s.notesTitle}>更新內容</Text>
            <ScrollView style={s.notesScroll}>
              {whatsNew ? (
                whatsNew.sections.map((section) => (
                  <View key={section.title} style={s.notesSection}>
                    <Text style={s.notesSectionTitle}>{section.title}</Text>
                    {section.items.map((item) => (
                      <Text key={item} style={s.notesItem}>
                        ・{item}
                      </Text>
                    ))}
                  </View>
                ))
              ) : (
                <Text style={s.notesItem}>目前沒有更新內容</Text>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f4f6fb" },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  bellBtn: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBtn: {
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    shadowColor: "#1c1c1e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },

  greeting: { paddingTop: 20, paddingBottom: 36 },
  greetingHello: { fontSize: 32, fontWeight: "700", color: "#1c1c1e", letterSpacing: -0.5 },
  greetingSub: {
    fontSize: 26,
    fontWeight: "700",
    color: "#8e8e93",
    letterSpacing: -0.5,
    marginTop: 4,
  },

  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarFallback: { backgroundColor: "#C7C7D4", alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 17, fontWeight: "700", color: "#1c1c1e" },

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

  versionBlock: { alignItems: "center", marginTop: 32, gap: 2 },
  versionText: { fontSize: 12, color: "#8e8e93" },

  backdrop: { flex: 1, alignItems: "flex-end", paddingHorizontal: 16 },
  menu: {
    minWidth: 220,
    maxWidth: 300,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 12,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e5ea",
  },
  menuIdentity: { flexShrink: 1 },
  menuName: { fontSize: 15, fontWeight: "700", color: "#1c1c1e" },
  menuEmail: { fontSize: 13, color: "#8e8e93" },
  menuAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuActionLabel: { fontSize: 15, fontWeight: "600", color: "#1c1c1e" },

  notesCard: {
    width: 280,
    maxHeight: "70%",
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 12,
  },
  notesTitle: { fontSize: 17, fontWeight: "700", color: "#1c1c1e", marginBottom: 10 },
  notesScroll: { flexGrow: 0 },
  notesSection: { marginBottom: 14 },
  notesSectionTitle: { fontSize: 14, fontWeight: "700", color: "#374254", marginBottom: 6 },
  notesItem: { fontSize: 14, color: "#3c3c43", lineHeight: 20 },
});
