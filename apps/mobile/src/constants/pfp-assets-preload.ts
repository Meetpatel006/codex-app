import { Asset } from "expo-asset";

import { PFP_ASSETS } from "@/constants/pfp-assets";

let preloadPromise: Promise<void> | null = null;

export function preloadPfpAssets() {
  if (!preloadPromise) {
    preloadPromise = Asset.loadAsync(PFP_ASSETS)
      .then(() => undefined)
      .catch(() => undefined);
  }

  return preloadPromise;
}
