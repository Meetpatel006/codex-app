// FILE: runtime-options-handler.js
// Purpose: Handles runtime options requests from the mobile app
// Layer: RPC handler
// Exports: handleRuntimeOptionsRequest
// Depends on: none

/**
 * Handles bridge/runtimeOptions/get RPC requests from the mobile app.
 * Returns the current runtime options configured for the bridge.
 *
 * @param {string} rawMessage - Incoming JSON-RPC message from phone
 * @param {function(string): void} sendResponse - Callback to send response
 * @param {{ runtimeOptions: object }} context - Runtime options context
 * @returns {boolean} - True if this handler consumed the message
 */
function handleRuntimeOptionsRequest(rawMessage, sendResponse, context) {
  let parsed = null;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    return false;
  }

  const method = typeof parsed?.method === "string" ? parsed.method.trim() : "";
  if (method !== "bridge/runtimeOptions/get") {
    return false;
  }

  const { runtimeOptions } = context;

  sendResponse(
    JSON.stringify({
      jsonrpc: "2.0",
      id: parsed.id,
      result: {
        model: runtimeOptions.model || null,
        thinking: runtimeOptions.thinking || null,
        permission: runtimeOptions.permission || null,
        branch: runtimeOptions.branch || null,
        type: runtimeOptions.type || null,
      },
    }),
  );

  return true;
}

module.exports = {
  handleRuntimeOptionsRequest,
};
