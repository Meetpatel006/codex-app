import { ed25519, x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";

import { bytesToHex, hexToBytes, importAesKey } from "./crypto";

export type HandshakeHello = {
  type: "secure-control";
  action: "hello";
  ephemeralPub: string;
  identityPub: string;
  signature: string;
};

export type HandshakeState = {
  identityPrivateKey: Uint8Array;
  identityPublicKey: Uint8Array;
  ephemeralPrivateKey: Uint8Array;
  ephemeralPublicKey: Uint8Array;
};

export function createHandshakeState(identityPrivateKeyHex: string): HandshakeState {
  const identityPrivateKey = hexToBytes(identityPrivateKeyHex);
  const identityPublicKey = ed25519.getPublicKey(identityPrivateKey);
  const ephemeralPrivateKey = x25519.utils.randomPrivateKey();
  const ephemeralPublicKey = x25519.getPublicKey(ephemeralPrivateKey);

  return {
    identityPrivateKey,
    identityPublicKey,
    ephemeralPrivateKey,
    ephemeralPublicKey,
  };
}

export function buildHello(state: HandshakeState): HandshakeHello {
  const signature = ed25519.sign(state.ephemeralPublicKey, state.identityPrivateKey);
  return {
    type: "secure-control",
    action: "hello",
    ephemeralPub: bytesToHex(state.ephemeralPublicKey),
    identityPub: bytesToHex(state.identityPublicKey),
    signature: bytesToHex(signature),
  };
}

export function verifyHello(hello: HandshakeHello): boolean {
  try {
    const signature = hexToBytes(hello.signature);
    const identityPub = hexToBytes(hello.identityPub);
    const ephemeralPub = hexToBytes(hello.ephemeralPub);
    return ed25519.verify(signature, ephemeralPub, identityPub);
  } catch {
    return false;
  }
}

export async function deriveSessionKey(params: {
  localEphemeralPriv: Uint8Array;
  localEphemeralPub: Uint8Array;
  remoteEphemeralPubHex: string;
  localRole: "iphone" | "mac";
}): Promise<CryptoKey> {
  const remoteEphemeralPub = hexToBytes(params.remoteEphemeralPubHex);
  const sharedSecret = x25519.getSharedSecret(params.localEphemeralPriv, remoteEphemeralPub);

  const left = params.localRole === "iphone" ? params.localEphemeralPub : remoteEphemeralPub;
  const right = params.localRole === "iphone" ? remoteEphemeralPub : params.localEphemeralPub;
  const salt = new Uint8Array(left.length + right.length);
  salt.set(left, 0);
  salt.set(right, left.length);

  const rawKey = hkdf(sha256, sharedSecret, salt, "remodex-session-v1", 32);
  return importAesKey(rawKey);
}
