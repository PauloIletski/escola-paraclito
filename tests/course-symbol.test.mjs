import test from "node:test";
import assert from "node:assert/strict";
import { courseSymbolName } from "../src/domain/course-symbol.ts";
import { initialCourses } from "../src/domain/school.ts";

test("Course symbols stay associated when the catalogue is sorted or filtered", () => {
  for (const courses of [
    initialCourses,
    [...initialCourses].sort((a, b) => a.title.localeCompare(b.title)),
    initialCourses.filter((c) => c.title === "Canto" || c.title === "Violão"),
  ]) {
    for (const c of courses) {
      const expected = {
        Violão: "guitar",
        Órgão: "organ",
        Canto: "voice",
        "Teoria musical": "theory",
        Solfejo: "solfege",
      }[c.title];
      assert.equal(courseSymbolName(c), expected);
    }
  }
  assert.equal(
    courseSymbolName({
      id: "10000000-0000-4000-8000-000000000003",
      title: "Canto litúrgico",
    }),
    "voice",
  );
  assert.equal(
    courseSymbolName({
      id: "10000000-0000-4000-8000-000000000001",
      title: "Violão litúrgico",
    }),
    "guitar",
  );
  assert.equal(courseSymbolName({ id: "custom", title: "Violão" }), "guitar");
  assert.equal(
    courseSymbolName({ id: "custom", title: "Novo curso" }),
    "music",
  );
});
