import * as SecureStore from "expo-secure-store";

const ONBOARDING_COMPLETE_KEY = "onboarding_complete";
const USERNAME_KEY = "username";

export const isOnboardingComplete = async (): Promise<boolean> => {
  const value = await SecureStore.getItemAsync(ONBOARDING_COMPLETE_KEY);
  return value === "true";
};

export const markOnboardingComplete = async (): Promise<void> => {
  await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, "true");
};

export const getUsername = async (): Promise<string | null> => {
  return SecureStore.getItemAsync(USERNAME_KEY);
};

export const setUsername = async (username: string): Promise<void> => {
  await SecureStore.setItemAsync(USERNAME_KEY, username);
};

export const resetOnboarding = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(ONBOARDING_COMPLETE_KEY);
  await SecureStore.deleteItemAsync(USERNAME_KEY);
};
