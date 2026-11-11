import test from "node:test";
import assert from "node:assert/strict";
import {
  accessAreaForPath,
  canEnterArea,
  shouldShowLanding,
} from "../src/domain/access.ts";

test("Administrative URLs have a distinct entry, including trailing slash and subpaths", () => {
  for (const path of ["/admin", "/admin/", "/admin/alunos"]) {
    assert.equal(accessAreaForPath(path), "admin");
  }
  for (const path of ["/", "/administrator", "/administracao"]) {
    assert.equal(accessAreaForPath(path), "student");
  }
});

test("Logged-in administrators can return to the public landing without entering student space", () => {
  assert.equal(shouldShowLanding(null, "student"), true);
  for (const role of ["admin", "super_admin"]) {
    for (const active of [true, false]) {
      const profile = { role, active, must_change_password: true };
      assert.equal(shouldShowLanding(profile, "student"), true);
      assert.equal(shouldShowLanding(profile, "admin"), false);
      assert.equal(canEnterArea(profile, "student"), false);
    }
  }
  assert.equal(shouldShowLanding({ role: "student" }, "student"), false);
  assert.equal(shouldShowLanding(null, "admin"), false);
});

test("Student and administrative entries never authorize each other's profiles", () => {
  for (const role of ["student", "admin", "super_admin"]) {
    const profile = { role };
    assert.equal(canEnterArea(profile, "admin"), role !== "student");
    assert.equal(canEnterArea(profile, "student"), role === "student");
  }
  assert.equal(canEnterArea({ role: "unknown" }, "admin"), false);
});
