// FILE: runtime-options.test.js
// Purpose: Tests runtime options parsing, validation, and normalization.
// Layer: Unit test
// Exports: node:test suite
// Depends on: node:test, node:assert/strict, ../src/runtime-options

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseRuntimeOptions,
  validateRuntimeOptions,
  normalizeRuntimeOptions,
  VALID_TRANSPORT_TYPES,
  VALID_PERMISSION_MODES,
  VALID_REASONING_EFFORTS,
} = require("../src/runtime-options");

test("parseRuntimeOptions merges CLI args and env vars with CLI precedence", () => {
  const options = parseRuntimeOptions({
    args: { model: "gpt-4", thinking: "high" },
    env: {
      REMODEX_MODEL: "gpt-3.5",
      REMODEX_THINKING: "low",
      REMODEX_PERMISSION: "full",
      REMODEX_BRANCH: "main",
    },
  });

  assert.equal(options.model, "gpt-4"); // CLI wins
  assert.equal(options.thinking, "high"); // CLI wins
  assert.equal(options.permission, "full"); // from env
  assert.equal(options.branch, "main"); // from env
});

test("parseRuntimeOptions handles empty inputs", () => {
  const options = parseRuntimeOptions({ args: {}, env: {} });

  assert.equal(options.model, null);
  assert.equal(options.thinking, null);
  assert.equal(options.permission, null);
  assert.equal(options.branch, null);
  assert.equal(options.type, null);
});

test("parseRuntimeOptions normalizes reasoning effort to lowercase", () => {
  const options = parseRuntimeOptions({
    args: { thinking: "HIGH" },
    env: {},
  });

  assert.equal(options.thinking, "high");
});

test("parseRuntimeOptions normalizes permission mode to lowercase", () => {
  const options = parseRuntimeOptions({
    args: { permission: "ON-REQUEST" },
    env: {},
  });

  assert.equal(options.permission, "on-request");
});

test("parseRuntimeOptions normalizes transport type to lowercase", () => {
  const options = parseRuntimeOptions({
    args: { type: "LOCAL" },
    env: {},
  });

  assert.equal(options.type, "local");
});

test("validateRuntimeOptions throws when type=cloud without endpoint", () => {
  assert.throws(
    () => validateRuntimeOptions({ type: "cloud" }, { codexEndpoint: "" }),
    /type=cloud requires REMODEX_CODEX_ENDPOINT/,
  );
});

test("validateRuntimeOptions passes when type=cloud with endpoint", () => {
  assert.doesNotThrow(() =>
    validateRuntimeOptions(
      { type: "cloud" },
      { codexEndpoint: "ws://localhost:8080" },
    ),
  );
});

test("validateRuntimeOptions passes when type=local", () => {
  assert.doesNotThrow(() => validateRuntimeOptions({ type: "local" }, {}));
});

test("validateRuntimeOptions throws on invalid thinking value", () => {
  assert.throws(
    () => validateRuntimeOptions({ thinking: "super-high" }, {}),
    /Invalid thinking\/reasoning effort/,
  );
});

test("validateRuntimeOptions throws on invalid permission value", () => {
  assert.throws(
    () => validateRuntimeOptions({ permission: "always" }, {}),
    /Invalid permission mode/,
  );
});

test("validateRuntimeOptions throws on invalid type value", () => {
  assert.throws(
    () => validateRuntimeOptions({ type: "hybrid" }, {}),
    /Invalid transport type/,
  );
});

test("validateRuntimeOptions accepts valid thinking values", () => {
  for (const effort of VALID_REASONING_EFFORTS) {
    assert.doesNotThrow(() => validateRuntimeOptions({ thinking: effort }, {}));
  }
});

test("validateRuntimeOptions accepts valid permission values", () => {
  for (const mode of VALID_PERMISSION_MODES) {
    assert.doesNotThrow(() => validateRuntimeOptions({ permission: mode }, {}));
  }
});

test("validateRuntimeOptions accepts valid type values", () => {
  // local doesn't need endpoint
  assert.doesNotThrow(() => validateRuntimeOptions({ type: "local" }, {}));

  // cloud needs endpoint
  assert.doesNotThrow(() =>
    validateRuntimeOptions(
      { type: "cloud" },
      { codexEndpoint: "ws://localhost:8080" },
    ),
  );
});

test("normalizeRuntimeOptions returns normalized object", () => {
  const normalized = normalizeRuntimeOptions({
    model: " gpt-4 ",
    thinking: "HIGH",
    permission: "FULL",
    branch: " feature/test ",
    type: "LOCAL",
  });

  assert.equal(normalized.model, "gpt-4");
  assert.equal(normalized.thinking, "high");
  assert.equal(normalized.permission, "full");
  assert.equal(normalized.branch, "feature/test");
  assert.equal(normalized.type, "local");
});

test("normalizeRuntimeOptions handles nulls and empties", () => {
  const normalized = normalizeRuntimeOptions({
    model: "",
    thinking: null,
    permission: "  ",
  });

  assert.equal(normalized.model, null);
  assert.equal(normalized.thinking, null);
  assert.equal(normalized.permission, null);
  assert.equal(normalized.branch, null);
  assert.equal(normalized.type, null);
});

test("parseRuntimeOptions supports onrequest variant for permission", () => {
  const options1 = parseRuntimeOptions({
    args: { permission: "onrequest" },
    env: {},
  });
  const options2 = parseRuntimeOptions({
    args: { permission: "on-request" },
    env: {},
  });

  assert.equal(options1.permission, "on-request");
  assert.equal(options2.permission, "on-request");
});

test("injectRuntimeDefaults applies defaults for message/send when params are missing", () => {
  const { __test } = require("../src/bridge");
  const injectRuntimeDefaults = __test.injectRuntimeDefaults;
  const runtimeOptions = {
    model: "gpt-5.4",
    thinking: "medium",
    permission: "on-request",
  };

  const raw = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "message/send",
    params: {
      content: "hello",
    },
  });

  const parsed = JSON.parse(injectRuntimeDefaults(raw, runtimeOptions));
  assert.equal(parsed.params.model, "gpt-5.4");
  assert.equal(parsed.params.effort, "medium");
  assert.deepEqual(parsed.params.collaborationMode, { mode: "on-request" });
});

test("injectRuntimeDefaults does not overwrite message/send explicit values", () => {
  const { __test } = require("../src/bridge");
  const injectRuntimeDefaults = __test.injectRuntimeDefaults;
  const runtimeOptions = {
    model: "gpt-5.4",
    thinking: "medium",
    permission: "full",
  };

  const raw = JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "message/send",
    params: {
      content: "hello",
      model: "gpt-4o",
      effort: "high",
      collaborationMode: { mode: "on-request" },
    },
  });

  const parsed = JSON.parse(injectRuntimeDefaults(raw, runtimeOptions));
  assert.equal(parsed.params.model, "gpt-4o");
  assert.equal(parsed.params.effort, "high");
  assert.deepEqual(parsed.params.collaborationMode, { mode: "on-request" });
});

test("extractThreadId treats thread/resume as a remembered thread update", () => {
  const { __test } = require("../src/bridge");

  assert.equal(
    __test.extractThreadId("thread/resume", {
      threadId: "019d9d06-88d3-7442-9356-336e37b2b1c9",
    }),
    "019d9d06-88d3-7442-9356-336e37b2b1c9",
  );
});
