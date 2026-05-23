import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTintColor: "#1f8f58" }}>
        <Stack.Screen name="index" options={{ title: "TourPilot" }} />
        <Stack.Screen name="login" options={{ title: "Login" }} />
        <Stack.Screen name="agencies" options={{ title: "Agencies" }} />
      </Stack>
    </>
  );
}
