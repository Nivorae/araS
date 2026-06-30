import { Tabs } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useRef } from "react";
import { useFinanceActions } from "@/hooks/useFinanceActions";
import { TopGlassNav } from "@/components/TopGlassNav";

function DataLoader() {
  const { isSignedIn } = useAuth();
  const { fetchAll } = useFinanceActions();
  const fetched = useRef(false);

  useEffect(() => {
    if (isSignedIn && !fetched.current) {
      fetched.current = true;
      fetchAll();
    }
  }, [isSignedIn, fetchAll]);

  return null;
}

export default function TabsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#f2f2f7" }}>
      <DataLoader />
      <Tabs
        screenOptions={{
          headerShown: false,
          // Bottom tab bar hidden — navigation lives in the floating TopGlassNav.
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="transactions" />
        <Tabs.Screen name="retirement" />
      </Tabs>
      <TopGlassNav />
    </View>
  );
}
