// Creates isolated temporary identities and draft content in the configured project;
// removes those exact identities, rows and objects in finally. No credentials are logged.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const ref = "bxnlawrzadhjkhceobpx";
const url = `https://${ref}.supabase.co`;
const command = `npx supabase projects api-keys --remote=${ref} --reveal --output json`;
const raw =
  process.platform === "win32"
    ? execFileSync("cmd.exe", ["/d", "/s", "/c", command], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30000,
      })
    : execFileSync(
        "npx",
        [
          "supabase",
          "projects",
          "api-keys",
          `--remote=${ref}`,
          "--reveal",
          "--output",
          "json",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30000 },
      );
const keys = JSON.parse(raw);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(
  url,
  keys.find((k) => k.name === "service_role").api_key,
  options,
);
const client = () =>
  createClient(
    url,
    keys.find((k) => k.type === "publishable").api_key,
    options,
  );
const admin = client(),
  teacher = client();
const suffix = crypto.randomUUID();
const password = `Qa!${crypto.randomUUID()}`;
const teacherEmail = `qa-teacher-${suffix}@example.invalid`;
const users = [];
const forbiddenLessonId = crypto.randomUUID();
const lessonId = crypto.randomUUID(),
  scoreId = crypto.randomUUID();
const paths = [];
const checks = [];
function ok(result, label) {
  assert.equal(result.error, null, `${label}: ${result.error?.message}`);
  return result.data;
}
function forbidden(result, label) {
  assert.ok(result.error, label);
}
try {
  const courses = ok(
    await service.from("courses").select("id").order("id").limit(2),
    "catalogue",
  );
  assert.equal(courses.length, 2);
  const [own, other] = courses.map((c) => c.id);
  const publicSettings = ok(
    await service.from("site_settings").select("about").eq("id", 1).single(),
    "read unchanged site content",
  );
  const adminEmail = `qa-admin-${suffix}@example.invalid`;
  const createdAdmin = ok(
    await service.auth.admin.createUser({
      email: adminEmail,
      password,
      email_confirm: true,
      app_metadata: {
        school_profile: {
          name: "Verificação temporária",
          whatsapp: "5517999999999",
          role: "admin",
          choir: false,
          request_id: crypto.randomUUID(),
        },
      },
    }),
    "temporary administrator",
  );
  users.push(createdAdmin.user.id);
  ok(
    await service
      .from("profiles")
      .update({ active: true, must_change_password: false })
      .eq("id", createdAdmin.user.id),
    "activate fixture administrator",
  );
  ok(
    await admin.auth.signInWithPassword({ email: adminEmail, password }),
    "administrator login",
  );
  const created = ok(
    await admin.functions.invoke("manage-account", {
      body: {
        action: "create",
        request_id: crypto.randomUUID(),
        role: "teacher",
        name: "Professor de verificação temporária",
        email: teacherEmail,
        whatsapp: "17999999999",
        courses: [own],
      },
    }),
    "provision teacher",
  );
  users.push(created.id);
  const profile = ok(
    await service
      .from("profiles")
      .select("role,active,must_change_password,whatsapp")
      .eq("id", created.id)
      .single(),
    "teacher profile",
  );
  assert.deepEqual(profile, {
    role: "teacher",
    active: true,
    must_change_password: true,
    whatsapp: "5517999999999",
  });
  ok(
    await teacher.auth.signInWithPassword({
      email: teacherEmail,
      password: created.temporary_password,
    }),
    "teacher login",
  );
  assert.equal(
    ok(await teacher.from("lessons").select("id"), "first access restriction")
      .length,
    0,
  );
  ok(
    await teacher.functions.invoke("manage-account", {
      body: { action: "change-password", password },
    }),
    "teacher first access",
  );
  checks.push("provisioning, course assignment, first access");
  ok(
    await teacher.auth.signInWithPassword({ email: teacherEmail, password }),
    "renew teacher session after password change",
  );
  const accountAttempt = await teacher.functions.invoke("manage-account", {
    body: { action: "create", role: "student" },
  });
  assert.equal(accountAttempt.error?.context?.status, 403);
  const escalationAttempt = await admin.functions.invoke("manage-account", {
    body: { action: "create", role: "admin" },
  });
  assert.equal(escalationAttempt.error?.context?.status, 403);
  assert.equal(
    ok(await teacher.from("profiles").select("id"), "profile isolation").length,
    1,
  );
  assert.equal(
    ok(
      await teacher
        .from("site_settings")
        .update({ about: publicSettings.about })
        .eq("id", 1)
        .select("id"),
      "site write restriction",
    ).length,
    0,
  );
  checks.push("account and site isolation");
  ok(
    await teacher
      .from("lessons")
      .insert({
        id: lessonId,
        course_id: own,
        title: `Verificação temporária ${suffix}`,
        position: 99999,
        video_id: "dQw4w9WgXcQ",
        published: false,
      })
      .select("id")
      .single(),
    "assigned lesson insert",
  );
  forbidden(
    await teacher.from("lessons").insert({
      id: forbiddenLessonId,
      course_id: other,
      title: "Forbidden",
      position: 99999,
      video_id: "dQw4w9WgXcQ",
    }),
    "unassigned lesson insert",
  );
  forbidden(
    await teacher
      .from("lessons")
      .update({ course_id: other })
      .eq("id", lessonId),
    "cross-course lesson move",
  );
  checks.push("assigned lessons only");
  const ownPath = `${own}/qa-${suffix}.pdf`,
    otherPath = `${other}/qa-${suffix}.pdf`;
  paths.push(ownPath, otherPath);
  const pdf = new Blob(["%PDF-1.4\n%Temporary authorization test\n%%EOF"], {
    type: "application/pdf",
  });
  ok(
    await teacher.storage.from("scores").upload(ownPath, pdf),
    "assigned PDF upload",
  );
  ok(
    await teacher
      .from("scores")
      .insert({
        id: scoreId,
        title: `Verificação temporária ${suffix}`,
        course_id: own,
        path: ownPath,
        published: false,
      })
      .select("id")
      .single(),
    "assigned score insert",
  );
  ok(
    await teacher.storage
      .from("scores")
      .download(
        ownPath,
        { cacheNonce: crypto.randomUUID() },
        { cache: "no-store" },
      ),
    "assigned PDF download",
  );
  forbidden(
    await teacher.storage.from("scores").upload(otherPath, pdf),
    "unassigned PDF upload",
  );
  ok(
    await service.storage.from("scores").upload(otherPath, pdf),
    "other-course fixture",
  );
  forbidden(
    await teacher.storage
      .from("scores")
      .download(
        otherPath,
        { cacheNonce: crypto.randomUUID() },
        { cache: "no-store" },
      ),
    "direct other-course PDF access",
  );
  checks.push("score metadata and direct PDF isolation");
  ok(
    await admin
      .from("course_teachers")
      .update({ active: false })
      .eq("teacher_id", created.id)
      .eq("course_id", own),
    "revoke assignment",
  );
  assert.equal(
    ok(
      await teacher.from("lessons").select("id").eq("id", lessonId),
      "revoked lesson",
    ).length,
    0,
  );
  forbidden(
    await teacher.storage
      .from("scores")
      .download(
        ownPath,
        { cacheNonce: crypto.randomUUID() },
        { cache: "no-store" },
      ),
    "revoked PDF",
  );
  ok(
    await admin
      .from("course_teachers")
      .update({ active: true })
      .eq("teacher_id", created.id)
      .eq("course_id", own),
    "restore assignment",
  );
  assert.equal(
    ok(
      await teacher.from("lessons").select("id").eq("id", lessonId),
      "restored lesson",
    ).length,
    1,
  );
  ok(
    await admin.functions.invoke("manage-account", {
      body: { action: "update", id: created.id, active: false },
    }),
    "suspend teacher",
  );
  assert.equal(
    ok(
      await teacher.from("lessons").select("id").eq("id", lessonId),
      "suspended teacher",
    ).length,
    0,
  );
  forbidden(
    await teacher.storage
      .from("scores")
      .download(
        ownPath,
        { cacheNonce: crypto.randomUUID() },
        { cache: "no-store" },
      ),
    "suspended PDF",
  );
  checks.push("revocation and suspension with an existing session");
} finally {
  // Only exact identifiers generated by this run are removed.
  ok(await service.from("scores").delete().eq("id", scoreId), "cleanup score");
  ok(
    await service
      .from("lessons")
      .delete()
      .in("id", [lessonId, forbiddenLessonId]),
    "cleanup lesson",
  );
  if (paths.length)
    ok(await service.storage.from("scores").remove(paths), "cleanup PDFs");
  const pending = await service
    .from("profiles")
    .select("id")
    .eq("email", teacherEmail)
    .maybeSingle();
  if (pending.data && !users.includes(pending.data.id))
    users.push(pending.data.id);
  await Promise.allSettled([admin.auth.signOut(), teacher.auth.signOut()]);
  for (const id of users.reverse())
    ok(await service.auth.admin.deleteUser(id), "cleanup identity");
}
console.log(JSON.stringify({ project: ref, checks, cleanup: "completed" }));
