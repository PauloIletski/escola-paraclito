import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeWhatsapp,
  validNewPassword,
} from "../supabase/functions/_shared/input.ts";
import {
  whatsappLink,
  youtubeId,
  progressFor,
  isStaff,
} from "../src/domain/school.ts";

test("WhatsApp validates destination and encodes message without credentials", () => {
  const url = whatsappLink(
    "+55 (17) 99999-9999",
    "Login: aluno@escola.br. Acesse: https://escola.br",
  );
  assert.equal(new URL(url).pathname, "/5517999999999");
  assert.equal(
    new URL(url).searchParams.get("text"),
    "Login: aluno@escola.br. Acesse: https://escola.br",
  );
  for (const phone of [
    "",
    "123",
    "05517999999999",
    "+55abc17999999999",
    "551799999999999999",
  ])
    assert.equal(whatsappLink(phone), null);
});

test("Brazil country code defaults without duplication and explicit countries are preserved", () => {
  for (const phone of [
    "17981048717",
    "(17) 98104-8717",
    "+55 (17) 98104-8717",
    "5517981048717",
  ])
    assert.equal(normalizeWhatsapp(phone), "5517981048717");
  assert.equal(normalizeWhatsapp("5532221111"), "555532221111");
  assert.equal(normalizeWhatsapp("+1 202 555 0123"), "12025550123");
  assert.equal(normalizeWhatsapp(""), "");
  assert.equal(normalizeWhatsapp("+55 "), "");
  assert.equal(normalizeWhatsapp("abc17981048717"), null);
  assert.equal(normalizeWhatsapp("981048717"), null);
});

test("New passwords accept eight characters and reject seven or more than 128", () => {
  assert.equal(validNewPassword("Abcd1234"), true);
  assert.equal(validNewPassword("Abcd123"), false);
  assert.equal(validNewPassword("x".repeat(128)), true);
  assert.equal(validNewPassword("x".repeat(129)), false);
  assert.equal(validNewPassword(null), false);
});

test("Video identifiers are extracted only from supported YouTube hosts", () => {
  const id = "dQw4w9WgXcQ";
  for (const url of [
    `https://youtu.be/${id}`,
    `https://www.youtube.com/watch?v=${id}&t=20`,
    `https://youtube.com/embed/${id}`,
    `https://youtube.com/shorts/${id}`,
  ])
    assert.equal(youtubeId(url), id);
  for (const url of [
    "javascript:alert(1)",
    "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/invalid",
    "nota musical",
  ])
    assert.equal(youtubeId(url), null);
});

test("Progress uses only currently published lessons and handles empty courses", () => {
  const published = { id: "a", published: true },
    draft = { id: "b", published: false };
  assert.deepEqual(progressFor([published, draft], ["a", "b"]), {
    done: 1,
    total: 1,
    percent: 100,
  });
  assert.deepEqual(progressFor([], ["a"]), { done: 0, total: 0, percent: 0 });
  assert.deepEqual(
    progressFor([published, { id: "c", published: true }], ["a"]),
    { done: 1, total: 2, percent: 50 },
  );
});

test("Staff navigation requires an active account and completed first access", () => {
  assert.equal(isStaff(null), false);
  assert.equal(
    isStaff({ active: true, must_change_password: false, role: "admin" }),
    true,
  );
  assert.equal(
    isStaff({ active: true, must_change_password: false, role: "student" }),
    false,
  );
  assert.equal(
    isStaff({
      active: false,
      must_change_password: false,
      role: "super_admin",
    }),
    false,
  );
  assert.equal(
    isStaff({ active: true, must_change_password: true, role: "admin" }),
    false,
  );
});
