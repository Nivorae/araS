import { Stack } from "expo-router";
import { PremiumProvider } from "@/hooks/useIsPremium";

export default function AppLayout() {
  return (
    <PremiumProvider>
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
    </PremiumProvider>
  );
}
