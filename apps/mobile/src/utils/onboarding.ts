import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_COMPLETE_KEY = "onboarding_complete";
const USERNAME_KEY = "username";

export const isOnboardingComplete = async (): Promise<boolean> => {
  const value = await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY);
  return value === "true";
};

export const markOnboardingComplete = async (): Promise<void> => {
  await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
};

export const getUsername = async (): Promise<string | null> => {
  return AsyncStorage.getItem(USERNAME_KEY);
};

export const setUsername = async (username: string): Promise<void> => {
  await AsyncStorage.setItem(USERNAME_KEY, username);
};

export const resetOnboarding = async (): Promise<void> => {
  await AsyncStorage.removeItem(ONBOARDING_COMPLETE_KEY);
  await AsyncStorage.removeItem(USERNAME_KEY);
};