import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { ArrowLeft, LogOut, Trash2 } from "lucide-react-native";
import { ApiError, useApi } from "@/lib/api";

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
          {/* Account */}
          <Text style={s.sectionLabel}>帳號</Text>
          <View style={s.card}>
            {name ? <Text style={s.name}>{name}</Text> : null}
            <Text style={s.email}>{email}</Text>
          </View>

          {/* Sign out */}
          <Pressable
            onPress={() => signOut()}
            style={({ pressed }) => [s.row, { opacity: pressed ? 0.6 : 1 }]}
          >
            <LogOut size={20} color="#374254" />
            <Text style={s.rowText}>登出</Text>
          </Pressable>

          {/* Danger zone */}
          <Text style={[s.sectionLabel, s.sectionLabelSpaced]}>危險操作</Text>
          <Pressable
            onPress={confirmDelete}
            disabled={deleting}
            style={({ pressed }) => [
              s.row,
              s.dangerRow,
              { opacity: deleting ? 0.6 : pressed ? 0.6 : 1 },
            ]}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#ff3b30" />
            ) : (
              <Trash2 size={20} color="#ff3b30" />
            )}
            <Text style={[s.rowText, s.dangerText]}>{deleting ? "刪除中…" : "刪除帳號"}</Text>
          </Pressable>
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

  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#8e8e93",
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionLabelSpaced: { marginTop: 28 },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    gap: 4,
  },
  name: { fontSize: 16, fontWeight: "600", color: "#1c1c1e" },
  email: { fontSize: 15, color: "#3c3c43" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  rowText: { fontSize: 16, fontWeight: "500", color: "#1c1c1e" },
  dangerRow: {},
  dangerText: { color: "#ff3b30" },
  dangerHint: { fontSize: 13, color: "#8e8e93", marginTop: 8, marginLeft: 4 },
});
