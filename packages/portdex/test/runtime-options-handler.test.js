// FILE: runtime-options-handler.test.js
// Purpose: Tests for runtime options RPC handler
// Layer: Test
// Exports: none
// Depends on: node:test, ../src/runtime-options-handler

const test = require("node:test");
const assert = require("node:assert");
const {
  handleRuntimeOptionsRequest,
} = require("../src/runtime-options-handler");

test("handleRuntimeOptionsRequest returns runtime options", () => {
  const mockRuntimeOptions = {
    model: "claude-sonnet-4",
    thinking: "medium",
    permission: "on-request",
    branch: "main",
    type: "local",
  };

  let responsePayload = null;
  const sendResponse = (response) => {
    responsePayload = response;
  };

  const request = JSON.stringify({
    jsonrpc: "2.0",
    id: 123,
    method: "bridge/runtimeOptions/get",
    params: {},
  });

  const handled = handleRuntimeOptionsRequest(request, sendResponse, {
    runtimeOptions: mockRuntimeOptions,
  });

  assert.strictEqual(handled, true);
  assert.ok(responsePayload);

  const parsed = JSON.parse(responsePayload);
  assert.strictEqual(parsed.jsonrpc, "2.0");
  assert.strictEqual(parsed.id, 123);
  assert.deepStrictEqual(parsed.result, mockRuntimeOptions);
});

test("handleRuntimeOptionsRequest handles null values", () => {
  const mockRuntimeOptions = {
    model: null,
    thinking: "high",
    permission: null,
    branch: null,
    type: "local",
  };

  let responsePayload = null;
  const sendResponse = (response) => {
    responsePayload = response;
  };

  const request = JSON.stringify({
    jsonrpc: "2.0",
    id: 456,
    method: "bridge/runtimeOptions/get",
  });

  const handled = handleRuntimeOptionsRequest(request, sendResponse, {
    runtimeOptions: mockRuntimeOptions,
  });

  assert.strictEqual(handled, true);
  const parsed = JSON.parse(responsePayload);
  assert.strictEqual(parsed.result.model, null);
  assert.strictEqual(parsed.result.thinking, "high");
  assert.strictEqual(parsed.result.permission, null);
});

test("handleRuntimeOptionsRequest ignores non-matching methods", () => {
  let responsePayload = null;
  const sendResponse = (response) => {
    responsePayload = response;
  };

  const request = JSON.stringify({
    jsonrpc: "2.0",
    id: 789,
    method: "some/other/method",
    params: {},
  });

  const handled = handleRuntimeOptionsRequest(request, sendResponse, {
    runtimeOptions: {},
  });

  assert.strictEqual(handled, false);
  assert.strictEqual(responsePayload, null);
});

test("handleRuntimeOptionsRequest handles malformed JSON", () => {
  let responsePayload = null;
  const sendResponse = (response) => {
    responsePayload = response;
  };

  const request = "not valid json{";

  const handled = handleRuntimeOptionsRequest(request, sendResponse, {
    runtimeOptions: {},
  });

  assert.strictEqual(handled, false);
  assert.strictEqual(responsePayload, null);
});
