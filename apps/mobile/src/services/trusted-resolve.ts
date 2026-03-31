import "react-native-get-random-values";
import { ed25519 } from "@noble/curves/ed25519.js";

import { base64ToBytes, bytesToBase64, bytesToHex, hexToBytes } from "./crypto";

const TRUSTED_SESSION_RESOLVE_TAG = "remodex-trusted-session-resolve-v1";

type TrustedResolveRequest = {
  relayBaseUrl: string;
  macDeviceId: string;
  phoneDeviceId: string;
  phoneIdentityPublicKey: string;
  phoneIdentityPrivateKeyHex: string;
};

type TrustedResolveResponse = {
  ok: boolean;
  sessionId?: string;
  error?: string;
  code?: string;
};

function randomHex(bytes: number): string {
  const data = globalThis.crypto.getRandomValues(new Uint8Array(bytes));
  return bytesToHex(data);
}

export async function resolveTrustedSession(
  request: TrustedResolveRequest,
): Promise<TrustedResolveResponse> {
  const nonce = randomHex(16);
  const timestamp = Date.now();
  const transcript = buildTrustedResolveTranscript({
    macDeviceId: request.macDeviceId,
    phoneDeviceId: request.phoneDeviceId,
    phoneIdentityPublicKey: request.phoneIdentityPublicKey,
    nonce,
    timestamp,
  });

  const signatureBytes = ed25519.sign(
    transcript,
    hexToBytes(request.phoneIdentityPrivateKeyHex),
  );

  const response = await fetch(
    `${request.relayBaseUrl.replace(/\/+$/, "")}/v1/trusted/session/resolve`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        macDeviceId: request.macDeviceId,
        phoneDeviceId: request.phoneDeviceId,
        phoneIdentityPublicKey: request.phoneIdentityPublicKey,
        nonce,
        timestamp,
        signature: bytesToBase64(signatureBytes),
      }),
    },
  );

  const body = (await response.json()) as TrustedResolveResponse;
  return body;
}

function buildTrustedResolveTranscript(params: {
  macDeviceId: string;
  phoneDeviceId: string;
  phoneIdentityPublicKey: string;
  nonce: string;
  timestamp: number;
}) {
  return concatBytes(
    encodeLengthPrefixedUtf8(TRUSTED_SESSION_RESOLVE_TAG),
    encodeLengthPrefixedUtf8(params.macDeviceId),
    encodeLengthPrefixedUtf8(params.phoneDeviceId),
    encodeLengthPrefixedBytes(base64ToBytes(params.phoneIdentityPublicKey)),
    encodeLengthPrefixedUtf8(params.nonce),
    encodeLengthPrefixedUtf8(String(params.timestamp)),
  );
}

function encodeLengthPrefixedUtf8(value: string) {
  return encodeLengthPrefixedBytes(new TextEncoder().encode(value));
}

function encodeLengthPrefixedBytes(value: Uint8Array) {
  const output = new Uint8Array(4 + value.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, value.length, false);
  output.set(value, 4);
  return output;
}

function concatBytes(...parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}
