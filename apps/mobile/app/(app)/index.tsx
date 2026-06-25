import { useAuth } from "@clerk/clerk-expo";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Entry } from "@repo/shared";
import { ApiError, useApi } from "@/lib/api";

export default function HomeScreen() {
  const { signOut } = useAuth();
  const api = useApi();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // Hits the existing Next.js route handler GET /api/entries with the Clerk
      // session token in the Authorization header — Phase 1 acceptance check.
      const data = await api.get<Entry[]>("/api/entries");
      setEntries(data);
    } catch (e) {
      setError(e instanceof ApiError ? `${e.code}: ${e.message}` : "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Assets",
          headerRight: () => (
            <TouchableOpacity onPress={() => signOut()}>
              <Text style={styles.signOut}>Sign out</Text>
            </TouchableOpacity>
          ),
        }}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retry}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={<Text style={styles.empty}>No entries yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.cat}>
                  {item.topCategory} · {item.subCategory}
                </Text>
              </View>
              <Text style={styles.value}>{item.value.toLocaleString()}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  list: { padding: 16, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
  },
  name: { fontSize: 16, fontWeight: "600" },
  cat: { fontSize: 13, color: "#888", marginTop: 2 },
  value: { fontSize: 16, fontWeight: "700" },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
  error: { color: "#c00" },
  retry: { color: "#2563eb", fontWeight: "600" },
  signOut: { color: "#2563eb", fontWeight: "600" },
});
