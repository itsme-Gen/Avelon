import "@/polyfills/wallet-compat";
import { ToastProvider } from "@/components/toast";
import { WalletProvider } from "@/providers/WalletProvider";
import { getNotifications, setupAndroidChannel } from "@/services/notification.service";
import {
    Syne_400Regular,
    Syne_500Medium,
    Syne_600SemiBold,
    Syne_700Bold,
    Syne_800ExtraBold,
} from "@expo-google-fonts/syne";
import { useFonts } from "expo-font";
import { Stack, router } from "expo-router";
import type { Href } from "expo-router";
import * as NativeSplashScreen from "expo-splash-screen";
import { cloneElement, useEffect, useRef } from "react";
import { LogBox, StyleSheet, Text, TextInput } from "react-native";
import { useAuthStore } from "@/stores/auth.store";
import "../styles/global.css";

const syneFontMap: Record<string, string> = {
  "100": "Syne_400Regular",
  "200": "Syne_400Regular",
  "300": "Syne_400Regular",
  "400": "Syne_400Regular",
  "500": "Syne_500Medium",
  "600": "Syne_600SemiBold",
  "700": "Syne_700Bold",
  "800": "Syne_800ExtraBold",
  "900": "Syne_800ExtraBold",
  normal: "Syne_400Regular",
  bold: "Syne_700Bold",
};

const notificationsRoute = "/notifications" as Href;

// Keep native splash visible until we manually hide it
NativeSplashScreen.preventAutoHideAsync();

// Suppress deprecation warning from dependencies
LogBox.ignoreLogs(["SafeAreaView has been deprecated"]);

export default function RootLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const checkSession = useAuthStore((state) => state.checkSession);
  const [fontsLoaded, fontError] = useFonts({
    Syne_400Regular,
    Syne_500Medium,
    Syne_600SemiBold,
    Syne_700Bold,
    Syne_800ExtraBold,
  });
  // Structural type so this file never imports expo-notifications, which throws
  // on load in Expo Go.
  const notificationListener = useRef<{ remove: () => void } | null>(null);
  const responseListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    checkSession().catch(() => undefined);
  }, [checkSession]);

  useEffect(() => {
    if (!fontsLoaded && !fontError) return;

    // Ensure every Text/TextInput gets Syne by default before we start
    const injectDefaultFont = (component: typeof Text | typeof TextInput) => {
      const base = { fontFamily: "Syne_400Regular" };
      (component as any).defaultProps = (component as any).defaultProps ?? {};
      const existing = (component as any).defaultProps.style;
      (component as any).defaultProps.style = [base, existing].filter(Boolean);
    };

    injectDefaultFont(Text);
    injectDefaultFont(TextInput);

    const applySyneFont = (component: typeof Text | typeof TextInput) => {
      if ((component as any).defaultProps == null) {
        (component as any).defaultProps = {};
      }
      const existing = (component as any).defaultProps.style;
      (component as any).defaultProps.style = [
        { fontFamily: "Syne_400Regular" },
        existing,
      ].filter(Boolean);

      const originalRender = (component as any).render;
      if (!originalRender) return () => {};

      (component as any).render = function (...args: any[]) {
        const element = originalRender.apply(this, args);
        const incomingStyle = element.props?.style;
        const flattened = StyleSheet.flatten(incomingStyle) || {};
        const weightKey = `${flattened.fontWeight ?? "400"}`;
        const fontFamily = syneFontMap[weightKey] ?? syneFontMap["400"];

        return cloneElement(element, {
          style: [{ fontFamily }, incomingStyle],
        });
      };

      return () => {
        (component as any).render = originalRender;
      };
    };

    const cleanupText = applySyneFont(Text);
    const cleanupTextInput = applySyneFont(TextInput);

    NativeSplashScreen.hideAsync();

    return () => {
      cleanupText?.();
      cleanupTextInput?.();
    };
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Set up Android notification channel
    setupAndroidChannel();

    // null in Expo Go, where push notifications are unavailable
    const Notifications = getNotifications();
    if (!Notifications) return;

    // Listener: notification received while app is in foreground
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log(
          "[Notification received]",
          notification.request.content.title,
        );
      });

    // Listener: user taps on a notification
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        if (data?.loanId && typeof data.loanId === "string") {
          router.push({ pathname: "/loan-repayment", params: { loanId: data.loanId } });
          return;
        }
        router.push(notificationsRoute);
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <WalletProvider>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Protected guard={isAuthenticated}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(verification)" />
            <Stack.Screen name="(settings)" />
            <Stack.Screen name="loan-application" />
            <Stack.Screen name="collateral-deposit" />
            <Stack.Screen name="loan-repayment" />
            <Stack.Screen name="notifications" />
          </Stack.Protected>
        </Stack>
      </ToastProvider>
    </WalletProvider>
  );
}
