import "react-native-get-random-values";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import {
  Stack,
  useNavigationContainerRef,
  usePathname,
} from "expo-router";
import * as Sentry from "@sentry/react-native";
import React, { useEffect } from "react";
import { useColorScheme, View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { PostHogProvider } from "posthog-react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { preloadPfpAssets } from "@/constants/pfp-assets-preload";
import { useLoadFonts } from "@/hooks/use-fonts";
import {
  getPostHogClient,
  getSentryNavigationIntegration,
  initTelemetry,
  trackScreen,
} from "@/services/telemetry";

import { GestureHandlerRootView } from "react-native-gesture-handler";

const navigationIntegration = getSentryNavigationIntegration();
initTelemetry();

function TelemetryRouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const screenName = pathname === "/" ? "home" : pathname.replace(/^\//, "");
    trackScreen(screenName, {
      pathname,
    });
  }, [pathname]);

  return null;
}

function TelemetryProviders({ children }: { children: React.ReactNode }) {
  const posthogClient = getPostHogClient();

  if (!posthogClient) {
    return <>{children}</>;
  }

  return (
    <PostHogProvider
      client={posthogClient}
      autocapture={{
        captureScreens: false,
      }}
    >
      {children}
    </PostHogProvider>
  );
}

export default Sentry.wrap(function RootLayout() {
  const ref = useNavigationContainerRef();

  useEffect(() => {
    if (ref) {
      navigationIntegration.registerNavigationContainer(ref);
    }
  }, [ref]);
  const colorScheme = useColorScheme();
  const fontsLoaded = useLoadFonts();

  useEffect(() => {
    void preloadPfpAssets();
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AnimatedSplashOverlay />
      </GestureHandlerRootView>
    );
  }

  return (
    <TelemetryProviders>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <TelemetryRouteTracker />
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="pairing-scan" />
          </Stack>
        </ThemeProvider>
      </GestureHandlerRootView>
    </TelemetryProviders>
  );
});
