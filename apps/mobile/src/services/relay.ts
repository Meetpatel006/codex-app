import { ed25519 } from "@noble/curves/ed25519";
import { x25519 } from "@noble/curves/ed25519";
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";

import {
  base64ToBytes,
  bytesToHex,
  bytesToBase64,
  bytesToUtf8,
  hexToBytes,
  utf8ToBytes,
} from "./crypto";
import { buildRequest, parseJsonRpc } from "./jsonrpc";

type RelayEventName = "ready" | "message" | "presence" | "error";

type RelayEventMap = {
  ready: () => void;
  message: (payload: unknown) => void;
  presence: (presence: "online" | "offline" | "connecting") => void;
  error: (error: Error) => void;
};

type ConnectOptions = {
  relayUrl: string;
  sessionId: string;
  identityPrivateKeyHex: string;
  bridgeIdentityPublicKey?: string;
};

const SECURE_PROTOCOL_VERSION = 1;
const HANDSHAKE_MODE_QR_BOOTSTRAP = "qr_bootstrap";
const SECURE_SENDER_MAC = "mac";
const SECURE_SENDER_IPHONE = "iphone";
const HANDSHAKE_TAG = "remodex-e2ee-v1";

type AesKeyHandle =
  | { kind: "web"; key: CryptoKey }
  | { kind: "raw"; key: Uint8Array };

export class RelayService {
  private socket: WebSocket | null = null;

  private socketGeneration = 0;

  private listeners: Record<RelayEventName, Array<(...args: unknown[]) => void>> = {
    ready: [],
    message: [],
    presence: [],
    error: [],
  };

  private phoneToMacKey: AesKeyHandle | null = null;

  private macToPhoneKey: AesKeyHandle | null = null;

  private handshakeDone = false;

  private reconnectAttempts = 0;

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private activeOptions: ConnectOptions | null = null;

  private keyEpoch: number | null = null;

  private nextOutboundCounter = 0;

  private lastInboundCounter = -1;

  private lastAppliedBridgeOutboundSeq = 0;

  private nextRequestId = 1;

  private pendingRequests = new Map<
    string,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  on<K extends RelayEventName>(event: K, listener: RelayEventMap[K]) {
    this.listeners[event].push(listener as (...args: unknown[]) => void);
    return () => {
      this.listeners[event] = this.listeners[event].filter((item) => item !== listener);
    };
  }

  async connect(options: ConnectOptions) {
    this.activeOptions = options;
    this.emit("presence", "connecting");

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Ensure there is only one active iPhone socket at a time.
    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      const previousSocket = this.socket;
      previousSocket.onclose = null;
      previousSocket.onerror = null;
      try {
        previousSocket.close(1000, "Replaced by newer connection");
      } catch {
        // Ignore close errors from stale sockets.
      }
    }

    const baseUrl = `${options.relayUrl.replace(/\/+$/, "")}/${options.sessionId}`;
    const socketUrl = baseUrl.includes("?")
      ? `${baseUrl}&role=iphone`
      : `${baseUrl}?role=iphone`;
    // React Native WebSocket does not support custom headers in a typed-compatible way.
    // The relay role currently falls back to server-side behavior for mobile clients.
    const socket = new WebSocket(socketUrl);
    const generation = ++this.socketGeneration;

    this.socket = socket;
    this.handshakeDone = false;

    this.handshakeDone = false;
    this.phoneToMacKey = null;
    this.macToPhoneKey = null;
    this.keyEpoch = null;
    this.nextOutboundCounter = 0;
    this.lastInboundCounter = -1;

    const identityPrivateKey = hexToBytes(options.identityPrivateKeyHex);
    const identityPublicKey = ed25519.getPublicKey(identityPrivateKey);
    const phoneIdentityPublicKey = bytesToBase64(identityPublicKey);
    const phoneDeviceId = `phone-${bytesToHex(identityPublicKey).slice(0, 16)}`;
    const phoneEphemeralPrivateKey = x25519.utils.randomPrivateKey();
    const phoneEphemeralPublicKey = x25519.getPublicKey(phoneEphemeralPrivateKey);
    const clientNonce = randomBytes(32);
    const phoneEphemeralPublicKeyBase64 = bytesToBase64(phoneEphemeralPublicKey);

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit("presence", "connecting");
      console.log(`[mobile][relay] socket open session=${options.sessionId}`);
      socket.send(JSON.stringify({
        kind: "clientHello",
        protocolVersion: SECURE_PROTOCOL_VERSION,
        sessionId: options.sessionId,
        handshakeMode: HANDSHAKE_MODE_QR_BOOTSTRAP,
        phoneDeviceId,
        phoneIdentityPublicKey,
        phoneEphemeralPublicKey: phoneEphemeralPublicKeyBase64,
        clientNonce: bytesToBase64(clientNonce),
      }));
    };

    socket.onmessage = async (event) => {
      try {
        const raw = typeof event.data === "string" ? event.data : String(event.data);
        const maybeJson = parseJsonRpc(raw);
        if (maybeJson?.jsonrpc === "2.0") {
          console.log(
            `[mobile][relay] jsonrpc inbound id=${String(maybeJson.id ?? "none")} hasResult=${"result" in maybeJson} hasError=${"error" in maybeJson}`,
          );
          if (this.resolvePendingRequestIfResponse(maybeJson)) {
            return;
          }

          this.emit("message", maybeJson);
          return;
        }

        const control = JSON.parse(raw) as Record<string, unknown>;
        const kind = typeof control.kind === "string" ? control.kind : "";

        if (kind === "secureError") {
          const message = typeof control.message === "string" ? control.message : "Secure transport error.";
          console.warn(`[mobile][relay] secureError kind=${kind} message=${message}`);
          this.emit("error", new Error(message));
          return;
        }

        if (kind === "serverHello") {
          const protocolVersion = Number(control.protocolVersion);
          const sessionId = typeof control.sessionId === "string" ? control.sessionId : "";
          const keyEpoch = Number(control.keyEpoch);
          const macDeviceId = typeof control.macDeviceId === "string" ? control.macDeviceId : "";
          const macIdentityPublicKey =
            typeof control.macIdentityPublicKey === "string" ? control.macIdentityPublicKey : "";
          const macEphemeralPublicKey =
            typeof control.macEphemeralPublicKey === "string" ? control.macEphemeralPublicKey : "";
          const serverNonceBase64 = typeof control.serverNonce === "string" ? control.serverNonce : "";
          const expiresAtForTranscript = Number(control.expiresAtForTranscript || 0);
          const macSignature = typeof control.macSignature === "string" ? control.macSignature : "";

          if (protocolVersion !== SECURE_PROTOCOL_VERSION || sessionId !== options.sessionId || !macSignature) {
            throw new Error("Invalid serverHello payload.");
          }

          if (
            options.bridgeIdentityPublicKey
            && macIdentityPublicKey
            && options.bridgeIdentityPublicKey !== macIdentityPublicKey
          ) {
            throw new Error("Bridge identity does not match paired identity.");
          }

          const transcript = buildTranscriptBytes({
            sessionId,
            protocolVersion,
            handshakeMode: HANDSHAKE_MODE_QR_BOOTSTRAP,
            keyEpoch,
            macDeviceId,
            phoneDeviceId,
            macIdentityPublicKey,
            phoneIdentityPublicKey,
            macEphemeralPublicKey,
            phoneEphemeralPublicKey: phoneEphemeralPublicKeyBase64,
            clientNonce,
            serverNonce: base64ToBytes(serverNonceBase64),
            expiresAtForTranscript,
          });

          const validMacSignature = ed25519.verify(
            base64ToBytes(macSignature),
            transcript,
            base64ToBytes(macIdentityPublicKey),
          );
          if (!validMacSignature) {
            throw new Error("Invalid server signature.");
          }

          const clientAuthTranscript = concatBytes(transcript, encodeLengthPrefixedUtf8("client-auth"));
          const phoneSignature = bytesToBase64(ed25519.sign(clientAuthTranscript, identityPrivateKey));

          const sharedSecret = x25519.getSharedSecret(phoneEphemeralPrivateKey, base64ToBytes(macEphemeralPublicKey));
          const salt = sha256(transcript);
          const infoPrefix = [
            HANDSHAKE_TAG,
            sessionId,
            macDeviceId,
            phoneDeviceId,
            String(keyEpoch),
          ].join("|");

          this.phoneToMacKey = await importAesKey(
            hkdf(sha256, sharedSecret, salt, `${infoPrefix}|phoneToMac`, 32),
          );
          this.macToPhoneKey = await importAesKey(
            hkdf(sha256, sharedSecret, salt, `${infoPrefix}|macToPhone`, 32),
          );
          this.keyEpoch = keyEpoch;
          this.nextOutboundCounter = 0;
          this.lastInboundCounter = -1;
          console.log(`[mobile][relay] serverHello verified keyEpoch=${keyEpoch} sending clientAuth`);

          socket.send(JSON.stringify({
            kind: "clientAuth",
            sessionId,
            phoneDeviceId,
            keyEpoch,
            phoneSignature,
          }));
          return;
        }

        if (kind === "secureReady") {
          const sessionId = typeof control.sessionId === "string" ? control.sessionId : "";
          const keyEpoch = Number(control.keyEpoch);
          if (sessionId !== options.sessionId || keyEpoch !== this.keyEpoch) {
            throw new Error("secureReady does not match active session.");
          }

          this.handshakeDone = true;
          this.emit("presence", "online");
          console.log(`[mobile][relay] secureReady keyEpoch=${keyEpoch}`);
          socket.send(JSON.stringify({
            kind: "resumeState",
            sessionId,
            keyEpoch,
            lastAppliedBridgeOutboundSeq: this.lastAppliedBridgeOutboundSeq,
          }));
          this.emit("ready");
          return;
        }

        if (kind === "encryptedEnvelope") {
          const sender = typeof control.sender === "string" ? control.sender : "";
          const counter = Number(control.counter);
          const keyEpoch = Number(control.keyEpoch);
          const sessionId = typeof control.sessionId === "string" ? control.sessionId : "";
          if (
            sender !== SECURE_SENDER_MAC
            || !this.macToPhoneKey
            || !this.handshakeDone
            || !Number.isInteger(counter)
            || counter <= this.lastInboundCounter
            || keyEpoch !== this.keyEpoch
            || sessionId !== options.sessionId
          ) {
            return;
          }

          const ciphertext = typeof control.ciphertext === "string" ? control.ciphertext : "";
          const tag = typeof control.tag === "string" ? control.tag : "";
          const decrypted = await decryptEnvelopePayload(
            this.macToPhoneKey,
            base64ToBytes(ciphertext),
            base64ToBytes(tag),
            nonceForDirection(SECURE_SENDER_MAC, counter),
          );
          this.lastInboundCounter = counter;
          console.log(`[mobile][relay] encryptedEnvelope received counter=${counter}`);

          const parsedPayload = JSON.parse(bytesToUtf8(decrypted)) as {
            bridgeOutboundSeq?: number;
            payloadText?: string;
          };
          if (Number.isInteger(parsedPayload.bridgeOutboundSeq)) {
            this.lastAppliedBridgeOutboundSeq = Math.max(
              this.lastAppliedBridgeOutboundSeq,
              Number(parsedPayload.bridgeOutboundSeq),
            );
          }

          const payloadText = typeof parsedPayload.payloadText === "string" ? parsedPayload.payloadText : "";
          if (!payloadText) {
            return;
          }

          const parsed = parseJsonRpc(payloadText);
          if (parsed) {
            console.log(
              `[mobile][relay] decrypted jsonrpc id=${String(parsed.id ?? "none")} hasResult=${"result" in parsed} hasError=${"error" in parsed}`,
            );
            if (this.resolvePendingRequestIfResponse(parsed)) {
              return;
            }
            this.emit("message", parsed);
          }
        }
      } catch (error) {
        this.emit("error", error instanceof Error ? error : new Error(String(error)));
      }
    };

    socket.onclose = (event) => {
      // Ignore stale socket lifecycle events from replaced connections.
      if (this.socket !== socket || generation !== this.socketGeneration) {
        return;
      }

      this.emit("presence", "offline");
      console.log(`[mobile][relay] socket close code=${event.code} reason=${event.reason || "none"}`);

      // 4002 is expected when desktop is offline; keep retrying.
      if (event.code === 4002 || event.code === 4003 || event.code === 4001) {
        this.scheduleReconnect();
        return;
      }

      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    socket.onerror = () => {
      if (this.socket !== socket || generation !== this.socketGeneration) {
        return;
      }

      this.emit("presence", "offline");
      console.warn("[mobile][relay] socket error");
      this.scheduleReconnect();
    };
  }

  async sendJson(message: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Relay socket is not connected.");
    }

    if (!this.handshakeDone || !this.phoneToMacKey || !this.keyEpoch) {
      console.warn(
        `[mobile][relay] sendJson blocked secureReady=${this.handshakeDone} keyEpoch=${String(this.keyEpoch)} hasKey=${this.phoneToMacKey != null}`,
      );
      throw new Error("Secure channel is not ready yet.");
    }

    const counter = this.nextOutboundCounter;
    this.nextOutboundCounter += 1;
    const nonce = nonceForDirection(SECURE_SENDER_IPHONE, counter);
    const payloadBytes = utf8ToBytes(JSON.stringify({ payloadText: JSON.stringify(message) }));
    const encrypted = await encryptEnvelopePayload(this.phoneToMacKey, payloadBytes, nonce);

    this.socket.send(JSON.stringify({
      kind: "encryptedEnvelope",
      v: SECURE_PROTOCOL_VERSION,
      sessionId: this.activeOptions?.sessionId,
      keyEpoch: this.keyEpoch,
      sender: SECURE_SENDER_IPHONE,
      counter,
      ciphertext: bytesToBase64(encrypted.ciphertext),
      tag: bytesToBase64(encrypted.tag),
    }));
  }

  async requestJson<TResult = unknown>(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs = 10_000,
  ): Promise<TResult> {
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    const requestKey = String(requestId);
    console.log(`[mobile][relay] request start method=${method} id=${requestKey}`);

    return new Promise<TResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestKey);
        console.warn(
          `[mobile][relay] request timeout method=${method} id=${requestKey} pendingAfterDelete=${this.pendingRequests.size}`,
        );
        reject(new Error(`${method} timed out.`));
      }, timeoutMs);

      this.pendingRequests.set(requestKey, {
        resolve: (result) => resolve(result as TResult),
        reject,
        timer,
      });
      console.log(`[mobile][relay] pending add id=${requestKey} pendingCount=${this.pendingRequests.size}`);

      void this.sendJson(buildRequest(method, params, requestId)).catch((error) => {
        clearTimeout(timer);
        this.pendingRequests.delete(requestKey);
        console.warn(`[mobile][relay] request send failed method=${method} id=${requestKey}`, error);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  isSecureReady() {
    return this.handshakeDone
      && this.phoneToMacKey != null
      && this.macToPhoneKey != null
      && this.socket?.readyState === WebSocket.OPEN;
  }

  async ensureIdentityPair(): Promise<{ privateKeyHex: string; publicKeyHex: string }> {
    const privateKey = ed25519.utils.randomPrivateKey();
    const publicKey = ed25519.getPublicKey(privateKey);
    return {
      privateKeyHex: bytesToHex(privateKey),
      publicKeyHex: bytesToHex(publicKey),
    };
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.activeOptions = null;
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Relay disconnected."));
    }
    this.pendingRequests.clear();
    this.socketGeneration += 1;
    this.socket?.close();
    this.socket = null;
    this.handshakeDone = false;
    this.phoneToMacKey = null;
    this.macToPhoneKey = null;
    this.keyEpoch = null;
    this.nextOutboundCounter = 0;
    this.lastInboundCounter = -1;
    this.emit("presence", "offline");
  }

  private emit<K extends RelayEventName>(event: K, ...args: unknown[]) {
    for (const listener of this.listeners[event]) {
      listener(...args);
    }
  }

  private resolvePendingRequestIfResponse(
    message: { id?: string | number | null; result?: unknown; error?: { message?: string } | null },
  ) {
    const isResponse = ("result" in message || "error" in message) && message.id != null;
    if (!isResponse) {
      return false;
    }

    if (typeof message.id !== "number" && typeof message.id !== "string") {
      return false;
    }

    const responseId = String(message.id);
    const pending = this.pendingRequests.get(responseId);
    if (!pending) {
      console.warn(
        `[mobile][relay] response id=${responseId} had no pending entry pendingCount=${this.pendingRequests.size}`,
      );
      return false;
    }

    console.log(`[mobile][relay] matched pending request id=${responseId}`);
    clearTimeout(pending.timer);
    this.pendingRequests.delete(responseId);

    if (message.error) {
      pending.reject(new Error(message.error.message || "RPC request failed."));
    } else {
      pending.resolve(message.result);
    }

    return true;
  }

  private scheduleReconnect() {
    if (!this.activeOptions || this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts += 1;
    const delayMs = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 30_000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.activeOptions) {
        void this.connect(this.activeOptions);
      }
    }, delayMs);
  }
}

async function importAesKey(rawKey: Uint8Array): Promise<AesKeyHandle> {
  if (!globalThis.crypto?.subtle) {
    return { kind: "raw", key: rawKey };
  }

  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    rawKey as unknown as BufferSource,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  return { kind: "web", key };
}

async function encryptEnvelopePayload(
  key: AesKeyHandle,
  payload: Uint8Array,
  nonce: Uint8Array,
): Promise<{ ciphertext: Uint8Array; tag: Uint8Array }> {
  if (key.kind === "raw") {
    const encrypted = gcm(key.key, nonce).encrypt(payload);
    if (encrypted.length < 16) {
      throw new Error("Encrypted payload is too short.");
    }

    return {
      ciphertext: encrypted.slice(0, encrypted.length - 16),
      tag: encrypted.slice(encrypted.length - 16),
    };
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this runtime.");
  }

  const encrypted = new Uint8Array(await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce as unknown as BufferSource },
    key.key,
    payload as unknown as BufferSource,
  ));

  if (encrypted.length < 16) {
    throw new Error("Encrypted payload is too short.");
  }

  return {
    ciphertext: encrypted.slice(0, encrypted.length - 16),
    tag: encrypted.slice(encrypted.length - 16),
  };
}

async function decryptEnvelopePayload(
  key: AesKeyHandle,
  ciphertext: Uint8Array,
  tag: Uint8Array,
  nonce: Uint8Array,
): Promise<Uint8Array> {
  if (key.kind === "raw") {
    const combined = new Uint8Array(ciphertext.length + tag.length);
    combined.set(ciphertext, 0);
    combined.set(tag, ciphertext.length);
    return gcm(key.key, nonce).decrypt(combined);
  }

  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is unavailable in this runtime.");
  }

  const combined = new Uint8Array(ciphertext.length + tag.length);
  combined.set(ciphertext, 0);
  combined.set(tag, ciphertext.length);

  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: nonce as unknown as BufferSource },
    key.key,
    combined as unknown as BufferSource,
  );
  return new Uint8Array(plaintext);
}

function nonceForDirection(sender: "mac" | "iphone", counter: number): Uint8Array {
  const nonce = new Uint8Array(12);
  nonce[0] = sender === SECURE_SENDER_MAC ? 1 : 2;

  let value = BigInt(counter);
  for (let index = 11; index >= 1; index -= 1) {
    nonce[index] = Number(value & 0xffn);
    value >>= 8n;
  }

  return nonce;
}

function buildTranscriptBytes(params: {
  sessionId: string;
  protocolVersion: number;
  handshakeMode: string;
  keyEpoch: number;
  macDeviceId: string;
  phoneDeviceId: string;
  macIdentityPublicKey: string;
  phoneIdentityPublicKey: string;
  macEphemeralPublicKey: string;
  phoneEphemeralPublicKey: string;
  clientNonce: Uint8Array;
  serverNonce: Uint8Array;
  expiresAtForTranscript: number;
}): Uint8Array {
  return concatBytes(
    encodeLengthPrefixedUtf8(HANDSHAKE_TAG),
    encodeLengthPrefixedUtf8(params.sessionId),
    encodeLengthPrefixedUtf8(String(params.protocolVersion)),
    encodeLengthPrefixedUtf8(params.handshakeMode),
    encodeLengthPrefixedUtf8(String(params.keyEpoch)),
    encodeLengthPrefixedUtf8(params.macDeviceId),
    encodeLengthPrefixedUtf8(params.phoneDeviceId),
    encodeLengthPrefixedBytes(base64ToBytes(params.macIdentityPublicKey)),
    encodeLengthPrefixedBytes(base64ToBytes(params.phoneIdentityPublicKey)),
    encodeLengthPrefixedBytes(base64ToBytes(params.macEphemeralPublicKey)),
    encodeLengthPrefixedBytes(base64ToBytes(params.phoneEphemeralPublicKey)),
    encodeLengthPrefixedBytes(params.clientNonce),
    encodeLengthPrefixedBytes(params.serverNonce),
    encodeLengthPrefixedUtf8(String(params.expiresAtForTranscript)),
  );
}

function encodeLengthPrefixedUtf8(value: string): Uint8Array {
  return encodeLengthPrefixedBytes(utf8ToBytes(String(value)));
}

function encodeLengthPrefixedBytes(value: Uint8Array): Uint8Array {
  const output = new Uint8Array(4 + value.length);
  const view = new DataView(output.buffer);
  view.setUint32(0, value.length, false);
  output.set(value, 4);
  return output;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, item) => sum + item.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function randomBytes(length: number): Uint8Array {
  if (globalThis.crypto?.getRandomValues) {
    return globalThis.crypto.getRandomValues(new Uint8Array(length));
  }

  const output = new Uint8Array(length);
  let offset = 0;
  while (offset < length) {
    const chunk = ed25519.utils.randomPrivateKey();
    const next = Math.min(chunk.length, length - offset);
    output.set(chunk.slice(0, next), offset);
    offset += next;
  }
  return output;
}

export const relayService = new RelayService();
