import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useSessionStore } from "@/store/session";

function parsePairingPayload(raw: string) {
  const [relayUrl, sessionId, bridgeIdentityPublicKey, expiryRaw] = raw.split("|").map((item) => item.trim());
  const expiryMs = Number(expiryRaw);

  if (!relayUrl || !sessionId || !bridgeIdentityPublicKey || !Number.isFinite(expiryMs)) {
    throw new Error("Invalid pairing payload format.");
  }

  if (expiryMs < Date.now()) {
    throw new Error("Pairing QR has expired. Please generate a new one.");
  }

  return {
    relayUrl,
    sessionId,
    bridgeIdentityPublicKey,
    expiryMs,
  };
}

export default function PairScreen() {
  const router = useRouter();
  const setPairing = useSessionStore((state) => state.setPairing);
  const [payload, setPayload] = useState("");

  async function onPair() {
    try {
      const parsed = parsePairingPayload(payload);
      await setPairing(parsed);
      router.replace("/");
    } catch (error) {
      Alert.alert("Pairing failed", error instanceof Error ? error.message : "Invalid payload");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pair Device</Text>
      <Text style={styles.copy}>
        Paste QR payload as relayUrl|sessionId|bridgePublicKey|expiryMs
      </Text>
      <TextInput
        value={payload}
        onChangeText={setPayload}
        style={styles.input}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="wss://relay.example.com/relay|abcd1234|...|1735000000000"
        placeholderTextColor="#777"
      />
      <Pressable style={styles.button} onPress={() => void onPair()}>
        <Text style={styles.buttonText}>Save Pairing</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0b0b",
    padding: 16,
    gap: 12,
  },
  title: {
    color: "#f0f0f0",
    fontSize: 24,
    fontWeight: "700",
  },
  copy: {
    color: "#c8c8c8",
  },
  input: {
    minHeight: 140,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
    color: "#f0f0f0",
    padding: 10,
    backgroundColor: "#161616",
  },
  button: {
    borderRadius: 10,
    backgroundColor: "#2f5f2f",
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
