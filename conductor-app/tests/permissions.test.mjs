import test from "node:test";
import assert from "node:assert/strict";

import { roleHasPermission, rolePermissions } from "../lib/permissions.js";

test("administrators retain read access when skill APIs require skills:use", () => {
  assert.equal(roleHasPermission("ADMIN", "skills:use"), true);
  assert.equal(roleHasPermission("USER", "skills:use"), true);
  assert.equal(roleHasPermission("USER", "skills:manage"), false);
  assert.equal(roleHasPermission("UNKNOWN", "skills:use"), false);
  assert.equal(new Set(rolePermissions.ADMIN).size, rolePermissions.ADMIN.length);
});
