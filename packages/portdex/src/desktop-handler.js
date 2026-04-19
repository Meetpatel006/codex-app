// FILE: desktop-handler.js
// Purpose: Handles explicit desktop-handoff bridge actions for Codex.app.
// Layer: Bridge handler
// Exports: handleDesktopRequest
// Depends on: none

function handleDesktopRequest(rawMessage, sendResponse, options = {}) {
  let parsed;
  try {
    parsed = JSON.parse(rawMessage);
  } catch {
    return false;
  }

  const method = typeof parsed?.method === "string" ? parsed.method.trim() : "";
  if (!method.startsWith("desktop/")) {
    return false;
  }

  const id = parsed.id;
  const params = parsed.params || {};

  handleDesktopMethod(method, params, options)
    .then((result) => {
      sendResponse(JSON.stringify({ id, result }));
    })
    .catch((err) => {
      const errorCode = err.errorCode || "desktop_error";
      const message = err.userMessage || err.message || "Unknown desktop handoff error";
      sendResponse(JSON.stringify({
        id,
        error: {
          code: -32000,
          message,
          data: { errorCode },
        },
      }));
    });

  return true;
}

async function handleDesktopMethod(method) {
  if (method === "desktop/continueOnMac") {
    throw desktopError(
      "unsupported_method",
      "Desktop deep-link handoff has been removed from Portdex.",
    );
  }

  throw desktopError("unknown_method", `Unknown desktop method: ${method}`);
}

function desktopError(errorCode, userMessage, cause = null) {
  const error = new Error(userMessage);
  error.errorCode = errorCode;
  error.userMessage = userMessage;
  if (cause) {
    error.cause = cause;
  }
  return error;
}

module.exports = {
  handleDesktopRequest,
};
