import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

type PairingState = {
  relayUrl: string;
  sessionId: string;
  bridgeIdentityPublicKey: string;
  expiryMs: number;
};

type SessionStore = {
  pairing: PairingState | null;
  mobileIdentityPrivateKeyHex: string | null;
  mobileIdentityPublicKeyHex: string | null;
  setPairing: (pairing: PairingState) => Promise<void>;
  clearPairing: () => Promise<void>;
  setMobileIdentity: (privateKeyHex: string, publicKeyHex: string) => Promise<void>;
  load: () => Promise<void>;
};

const PAIRING_KEY = "relay.pairing";
const IDENTITY_PRIVATE_KEY = "relay.identity.private";
const IDENTITY_PUBLIC_KEY = "relay.identity.public";

export const useSessionStore = create<SessionStore>((set) => ({
  pairing: null,
  mobileIdentityPrivateKeyHex: null,
  mobileIdentityPublicKeyHex: null,
  async setPairing(pairing) {
    await SecureStore.setItemAsync(PAIRING_KEY, JSON.stringify(pairing));
    set({ pairing });
  },
  async clearPairing() {
    await SecureStore.deleteItemAsync(PAIRING_KEY);
    set({ pairing: null });
  },
  async setMobileIdentity(privateKeyHex, publicKeyHex) {
    await SecureStore.setItemAsync(IDENTITY_PRIVATE_KEY, privateKeyHex);
    await SecureStore.setItemAsync(IDENTITY_PUBLIC_KEY, publicKeyHex);
    set({
      mobileIdentityPrivateKeyHex: privateKeyHex,
      mobileIdentityPublicKeyHex: publicKeyHex,
    });
  },
  async load() {
    const [pairingRaw, privateKeyHex, publicKeyHex] = await Promise.all([
      SecureStore.getItemAsync(PAIRING_KEY),
      SecureStore.getItemAsync(IDENTITY_PRIVATE_KEY),
      SecureStore.getItemAsync(IDENTITY_PUBLIC_KEY),
    ]);

    set({
      pairing: pairingRaw ? (JSON.parse(pairingRaw) as PairingState) : null,
      mobileIdentityPrivateKeyHex: privateKeyHex,
      mobileIdentityPublicKeyHex: publicKeyHex,
    });
  },
}));

export type { PairingState };
