// FILE: runtime-options.js
// Purpose: Runtime options schema, validation, and normalization for model, thinking, permission, branch, and type.
// Layer: Config helper
// Exports: parseRuntimeOptions, validateRuntimeOptions, normalizeRuntimeOptions
// Depends on: none

const VALID_TRANSPORT_TYPES = ["local", "cloud"];
const VALID_PERMISSION_MODES = ["on-request", "full"];
const VALID_REASONING_EFFORTS = ["low", "medium", "high"];

/**
 * Parse runtime options from CLI args and environment variables.
 * CLI args take precedence over env vars.
 * @param {object} params - { args, env }
 * @returns {object} Normalized runtime options
 */
function parseRuntimeOptions({ args = {}, env = process.env } = {}) {
  return {
    model: readFirstDefined([args.model, readEnv("PORTDEX_MODEL", env)]),
    thinking: normalizeReasoningEffort(
      readFirstDefined([args.thinking, readEnv("PORTDEX_THINKING", env)]),
    ),
    permission: normalizePermissionMode(
      readFirstDefined([args.permission, readEnv("PORTDEX_PERMISSION", env)]),
    ),
    branch: readFirstDefined([args.branch, readEnv("PORTDEX_BRANCH", env)]),
    type: normalizeTransportType(
      readFirstDefined([args.type, readEnv("PORTDEX_TYPE", env)]),
    ),
  };
}

/**
 * Validate runtime options and throw if invalid combinations are found.
 * @param {object} options - Runtime options to validate
 * @param {object} config - Bridge config (contains codexEndpoint)
 */
function validateRuntimeOptions(options, config = {}) {
  const errors = [];

  if (options.type === "cloud" && !config.codexEndpoint) {
    errors.push(
      "type=cloud requires PORTDEX_CODEX_ENDPOINT to be set. " +
        "Provide a WebSocket endpoint or switch to type=local.",
    );
  }

  if (options.type === "local" && config.codexEndpoint) {
    console.warn(
      "[portdex] Warning: type=local will spawn a new codex app-server process, " +
        "ignoring PORTDEX_CODEX_ENDPOINT.",
    );
  }

  if (options.thinking && !VALID_REASONING_EFFORTS.includes(options.thinking)) {
    errors.push(
      `Invalid thinking/reasoning effort: ${options.thinking}. ` +
        `Valid values: ${VALID_REASONING_EFFORTS.join(", ")}`,
    );
  }

  if (
    options.permission &&
    !VALID_PERMISSION_MODES.includes(options.permission)
  ) {
    errors.push(
      `Invalid permission mode: ${options.permission}. ` +
        `Valid values: ${VALID_PERMISSION_MODES.join(", ")}`,
    );
  }

  if (options.type && !VALID_TRANSPORT_TYPES.includes(options.type)) {
    errors.push(
      `Invalid transport type: ${options.type}. ` +
        `Valid values: ${VALID_TRANSPORT_TYPES.join(", ")}`,
    );
  }

  if (errors.length > 0) {
    throw new Error(`Runtime options validation failed:\n${errors.join("\n")}`);
  }
}

/**
 * Normalize runtime options to canonical values.
 * @param {object} options - Raw runtime options
 * @returns {object} Normalized options
 */
function normalizeRuntimeOptions(options = {}) {
  return {
    model: readString(options.model),
    thinking: normalizeReasoningEffort(options.thinking),
    permission: normalizePermissionMode(options.permission),
    branch: readString(options.branch),
    type: normalizeTransportType(options.type),
  };
}

function normalizeTransportType(value) {
  const normalized = readString(value);
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  if (VALID_TRANSPORT_TYPES.includes(lower)) {
    return lower;
  }

  return normalized;
}

function normalizePermissionMode(value) {
  const normalized = readString(value);
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  // Support both "on-request" and "onrequest" variants
  if (lower === "on-request" || lower === "onrequest") {
    return "on-request";
  }
  if (lower === "full") {
    return "full";
  }

  return normalized;
}

function normalizeReasoningEffort(value) {
  const normalized = readString(value);
  if (!normalized) {
    return null;
  }

  const lower = normalized.toLowerCase();
  if (VALID_REASONING_EFFORTS.includes(lower)) {
    return lower;
  }

  return normalized;
}

function readFirstDefined(candidates) {
  for (const candidate of candidates) {
    const normalized = readString(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function readEnv(key, env = process.env) {
  return readString(env[key]);
}

function readString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

module.exports = {
  parseRuntimeOptions,
  validateRuntimeOptions,
  normalizeRuntimeOptions,
  VALID_TRANSPORT_TYPES,
  VALID_PERMISSION_MODES,
  VALID_REASONING_EFFORTS,
};
