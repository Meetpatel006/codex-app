export type JsonRpcId = string | number;

export type JsonRpcRequest<TParams = unknown> = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: TParams;
};

export type JsonRpcError = {
  code: number;
  message: string;
  data?: unknown;
};

export type JsonRpcResponse<TResult = unknown> = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: TResult;
  error?: JsonRpcError;
};

export function buildRequest<TParams = unknown>(
  method: string,
  params?: TParams,
  id?: JsonRpcId,
): JsonRpcRequest<TParams> {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };
}

export function parseJsonRpc(
  raw: string,
): JsonRpcRequest | JsonRpcResponse | null {
  try {
    const parsed = JSON.parse(raw) as
      | JsonRpcRequest
      | JsonRpcResponse
      | Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if ((parsed as JsonRpcRequest | JsonRpcResponse).jsonrpc === "2.0") {
      return parsed as JsonRpcRequest | JsonRpcResponse;
    }

    const hasMethod =
      typeof (parsed as { method?: unknown }).method === "string";
    const hasResponseEnvelope =
      ("result" in parsed || "error" in parsed) &&
      (typeof (parsed as { id?: unknown }).id === "string" ||
        typeof (parsed as { id?: unknown }).id === "number");

    if (hasMethod || hasResponseEnvelope) {
      return parsed as JsonRpcRequest | JsonRpcResponse;
    }

    return null;
  } catch {
    return null;
  }
}
