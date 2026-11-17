import assert from "node:assert/strict";
import test from "node:test";
import {
  DomainError,
  requireExpectedRevision,
  requireString,
  requireUuid
} from "../src/shared/application/command.js";

test("requireString trims input and enforces bounds", () => {
  assert.equal(requireString("  Setlist  ", "name", 80), "Setlist");
  assert.throws(() => requireString(" ", "name", 80), DomainError);
  assert.throws(() => requireString("x".repeat(81), "name", 80), DomainError);
});

test("requireUuid accepts UUIDs and rejects malformed values", () => {
  assert.equal(requireUuid("00000000-0000-4000-8000-00000000000a", "id"), "00000000-0000-4000-8000-00000000000a");
  assert.throws(() => requireUuid("test-track-a", "id"), DomainError);
});

test("expected revisions must be positive safe integers", () => {
  assert.equal(requireExpectedRevision(4), 4);
  for (const invalid of [0, -1, 1.5, "1", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => requireExpectedRevision(invalid), DomainError);
  }
});
