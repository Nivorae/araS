import { Stack } from "expo-router";
import { PremiumProvider } from "@/hooks/useIsPremium";
import { AppLockGate } from "@/components/AppLockGate";

export default function AppLayout() {
  return (
    <PremiumProvider>
      <AppLockGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="entry/new" />
          <Stack.Screen name="entry/form" />
          <Stack.Screen name="entry/[id]" />
          <Stack.Screen name="entry/[id]/edit" />
          <Stack.Screen name="insurance/overview" />
          <Stack.Screen name="insurance/new" />
          <Stack.Screen name="settings" />
        </Stack>
      </AppLockGate>
    </PremiumProvider>
  );
}
