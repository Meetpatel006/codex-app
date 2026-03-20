import { ed25519 } from "@noble/curves/ed25519";

import { bytesToHex, hexToBytes, utf8ToBytes } from "./crypto";

type TrustedResolveRequest = {
  relayBaseUrl: string;
  macDeviceId: string;
  phoneDeviceId: string;
  phoneIdentityPublicKey: string;
  phoneIdentityPrivateKey: string;
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

export async function resolveTrustedSession(request: TrustedResolveRequest): Promise<TrustedResolveResponse> {
  const nonce = randomHex(16);
  const timestamp = Date.now();
  const transcript = utf8ToBytes(
    `${request.macDeviceId}|${request.phoneDeviceId}|${request.phoneIdentityPublicKey}|${nonce}|${timestamp}`,
  );

  const signatureBytes = ed25519.sign(transcript, hexToBytes(request.phoneIdentityPrivateKey));

  const response = await fetch(`${request.relayBaseUrl.replace(/\/+$/, "")}/v1/trusted/session/resolve`, {
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
      signature: bytesToHex(signatureBytes),
    }),
  });

  const body = (await response.json()) as TrustedResolveResponse;
  return body;
}
