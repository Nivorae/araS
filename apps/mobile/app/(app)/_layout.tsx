import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="entry/new" />
      <Stack.Screen name="entry/form" />
      <Stack.Screen name="entry/[id]" />
      <Stack.Screen name="entry/[id]/edit" />
      <Stack.Screen name="settings" />
    </Stack>
  );
}
