import { useEffect, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { isOnboardingComplete } from "@/utils/onboarding";

export function useOnboardingRedirect() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  const checkAndRedirect = useCallback(async () => {
    try {
      const complete = await isOnboardingComplete();
      if (!complete) {
        router.replace("/onboarding" as any);
      }
    } finally {
      setIsReady(true);
    }
  }, [router]);

  useEffect(() => {
    checkAndRedirect();
  }, [checkAndRedirect]);

  return { isReady };
}