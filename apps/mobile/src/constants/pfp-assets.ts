import * as SecureStore from "expo-secure-store";

const PFP_STORAGE_KEY = "user_pfp_index";

export const PFP_ASSETS = [
  require("../../assets/pfp/1.jpeg"),
  require("../../assets/pfp/2.jpeg"),
  require("../../assets/pfp/3.jpeg"),
  require("../../assets/pfp/4.jpeg"),
  require("../../assets/pfp/5.jpeg"),
  require("../../assets/pfp/6.jpeg"),
  require("../../assets/pfp/7.jpeg"),
  require("../../assets/pfp/8.jpeg"),
  require("../../assets/pfp/9.jpeg"),
  require("../../assets/pfp/10.jpeg"),
  require("../../assets/pfp/11.jpeg"),
  require("../../assets/pfp/12.jpeg"),
  require("../../assets/pfp/13.jpeg"),
  require("../../assets/pfp/14.jpeg"),
  require("../../assets/pfp/15.jpeg"),
  require("../../assets/pfp/16.jpeg"),
  require("../../assets/pfp/17.jpeg"),
  require("../../assets/pfp/18.jpeg"),
  require("../../assets/pfp/19.jpeg"),
  require("../../assets/pfp/20.jpeg"),
  require("../../assets/pfp/21.jpeg"),
] as const;

export async function getStoredPfpAsset(): Promise<typeof PFP_ASSETS[number]> {
  try {
    const storedIndex = await SecureStore.getItemAsync(PFP_STORAGE_KEY);
    if (storedIndex !== null) {
      const index = parseInt(storedIndex, 10);
      if (!isNaN(index) && index >= 0 && index < PFP_ASSETS.length) {
        return PFP_ASSETS[index];
      }
    }
    const newIndex = Math.floor(Math.random() * PFP_ASSETS.length);
    await SecureStore.setItemAsync(PFP_STORAGE_KEY, newIndex.toString());
    return PFP_ASSETS[newIndex];
  } catch (error) {
    console.warn("Failed to get stored PFP:", error);
    return getRandomPfpAsset();
  }
}

export async function savePfpIndex(index: number) {
  try {
    await SecureStore.setItemAsync(PFP_STORAGE_KEY, index.toString());
  } catch (error) {
    console.warn("Failed to save PFP index:", error);
  }
}

export function getRandomPfpAsset() {
  return PFP_ASSETS[Math.floor(Math.random() * PFP_ASSETS.length)];
}