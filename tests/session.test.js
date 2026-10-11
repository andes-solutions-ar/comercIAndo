import test from "node:test";
import assert from "node:assert/strict";
import { canEnter } from "../src/auth/guard.js";
test("session guard requires matching active administrative profile", () => {
  const session = { user: { id: "a" } };
  assert.equal(canEnter(null, null), false);
  assert.equal(
    canEnter(session, { id: "b", active: true, access_level: "admin" }),
    false,
  );
  assert.equal(
    canEnter(session, { id: "a", active: false, access_level: "admin" }),
    false,
  );
  assert.equal(
    canEnter(session, { id: "a", active: true, access_level: "admin" }),
    true,
  );
});
