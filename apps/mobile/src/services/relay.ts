import { ed25519 } from "@noble/curves/ed25519";

import {
  base64ToBytes,
  bytesToHex,
  bytesToBase64,
  bytesToUtf8,
  decryptAesGcm,
  encryptAesGcm,
  utf8ToBytes,
} from "./crypto";
import { buildHello, createHandshakeState, deriveSessionKey, verifyHello } from "./handshake";
import { parseJsonRpc } from "./jsonrpc";

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
};

export class RelayService {
  private socket: WebSocket | null = null;

  private socketGeneration = 0;

  private listeners: Record<RelayEventName, Array<(...args: unknown[]) => void>> = {
    ready: [],
    message: [],
    presence: [],
    error: [],
  };

  private aesKey: CryptoKey | null = null;

  private handshakeDone = false;

  private reconnectAttempts = 0;

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private activeOptions: ConnectOptions | null = null;

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

    const handshakeState = createHandshakeState(options.identityPrivateKeyHex);

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit("presence", "online");
      socket.send(JSON.stringify(buildHello(handshakeState)));
    };

    socket.onmessage = async (event) => {
      try {
        const raw = typeof event.data === "string" ? event.data : String(event.data);
        const maybeJson = parseJsonRpc(raw);
        if (maybeJson?.jsonrpc === "2.0") {
          this.emit("message", maybeJson);
          return;
        }

        const control = JSON.parse(raw) as Record<string, unknown>;
        if (
          control.type === "secure-control"
          && control.action === "hello"
          && typeof control.ephemeralPub === "string"
          && typeof control.identityPub === "string"
          && typeof control.signature === "string"
        ) {
          const isValid = verifyHello(control as never);
          if (!isValid) {
            throw new Error("Invalid relay handshake signature.");
          }

          this.aesKey = await deriveSessionKey({
            localEphemeralPriv: handshakeState.ephemeralPrivateKey,
            localEphemeralPub: handshakeState.ephemeralPublicKey,
            remoteEphemeralPubHex: control.ephemeralPub,
            localRole: "iphone",
          });

          this.handshakeDone = true;
          this.emit("ready");
          return;
        }

        if (control.type === "secure-envelope" && typeof control.payload === "string" && this.aesKey) {
          const decrypted = await decryptAesGcm(this.aesKey, base64ToBytes(control.payload));
          const parsed = parseJsonRpc(bytesToUtf8(decrypted));
          if (parsed) {
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
      this.scheduleReconnect();
    };
  }

  async sendJson(message: unknown) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Relay socket is not connected.");
    }

    if (!this.handshakeDone || !this.aesKey) {
      throw new Error("Secure channel is not ready yet.");
    }

    const plaintext = utf8ToBytes(JSON.stringify(message));
    const encrypted = await encryptAesGcm(this.aesKey, plaintext);
    this.socket.send(
      JSON.stringify({
        type: "secure-envelope",
        payload: bytesToBase64(encrypted),
      }),
    );
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
    this.socketGeneration += 1;
    this.socket?.close();
    this.socket = null;
    this.handshakeDone = false;
    this.aesKey = null;
    this.emit("presence", "offline");
  }

  private emit<K extends RelayEventName>(event: K, ...args: unknown[]) {
    for (const listener of this.listeners[event]) {
      listener(...args);
    }
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

export const relayService = new RelayService();
