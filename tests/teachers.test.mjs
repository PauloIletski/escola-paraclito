import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";
import { mayManageAccount } from "../supabase/functions/_shared/permissions.ts";
import {
  accessAreaForPath,
  canEnterArea,
  shouldShowLanding,
  entryPathForRole,
} from "../src/domain/access.ts";

test("Teacher entry and account management stay separate from administration", () => {
  for (const path of ["/professor", "/professor/", "/professor/cursos"])
    assert.equal(accessAreaForPath(path), "teacher");
  assert.equal(accessAreaForPath("/professores"), "student");
  assert.equal(entryPathForRole("teacher"), "/professor");
  assert.equal(shouldShowLanding({ role: "teacher" }, "student"), true);
  for (const role of ["student", "teacher", "admin", "super_admin"]) {
    assert.equal(canEnterArea({ role }, "teacher"), role === "teacher");
    assert.equal(mayManageAccount("teacher", role), false);
    assert.equal(
      mayManageAccount("admin", role),
      ["student", "teacher"].includes(role),
    );
    assert.equal(mayManageAccount("super_admin", role), role === "admin");
  }
  assert.equal(canEnterArea({ role: "teacher" }, "admin"), false);
  assert.equal(canEnterArea({ role: "teacher" }, "student"), false);
});

test("Teacher lesson, score and file access is scoped to current course assignment", async () => {
  const db = new PGlite();
  const teacher = "60000000-0000-4000-8000-000000000001";
  const other = "60000000-0000-4000-8000-000000000002";
  const admin = "60000000-0000-4000-8000-000000000003";
  const student = "60000000-0000-4000-8000-000000000004";
  const course = "10000000-0000-4000-8000-000000000001";
  const anotherCourse = "10000000-0000-4000-8000-000000000002";
  const lesson = "70000000-0000-4000-8000-000000000001";
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      grant usage on schema auth,storage to anon,authenticated;
      create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to authenticated;
      grant select on storage.objects to anon;
    `);
    for (const path of [
      "../supabase/schemas/001_school.sql",
      "../supabase/schemas/002_teachers.sql",
      "../supabase/seed.sql",
    ])
      await db.exec(await readFile(new URL(path, import.meta.url), "utf8"));
    for (const [id, role] of [
      [teacher, "teacher"],
      [other, "teacher"],
      [admin, "admin"],
      [student, "student"],
    ]) {
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        id,
        `${id}@test.local`,
      ]);
      await db.query(
        "insert into public.profiles(id,name,email,whatsapp,role,active,choir,must_change_password) values($1,$2,$3,'5517999999999',$4,true,true,false)",
        [id, role, `${id}@test.local`, role],
      );
    }
    await db.query(
      "insert into public.course_teachers(teacher_id,course_id) values($1,$2),($3,$4)",
      [teacher, course, other, anotherCourse],
    );
    await db.query("update public.courses set published=false where id=$1", [
      anotherCourse,
    ]);
    async function as(id, action) {
      await db.exec("begin; set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        id,
      ]);
      try {
        const value = await action();
        await db.exec("commit");
        return value;
      } catch (error) {
        await db.exec("rollback");
        throw error;
      }
    }
    const count = async (table) =>
      Number((await db.query(`select count(*) as n from ${table}`)).rows[0].n);
    const insertLesson = (id, target) =>
      db.query(
        "insert into public.lessons(id,course_id,title,position,video_id,published) values($1,$2,'Aula',1,'dQw4w9WgXcQ',false)",
        [id, target],
      );
    assert.equal(await as(teacher, () => count("public.profiles")), 1);
    assert.equal(await as(teacher, () => count("public.course_teachers")), 1);
    assert.equal(
      (
        await as(teacher, () =>
          db.query("select id from public.courses where id=$1", [
            anotherCourse,
          ]),
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await as(other, () =>
          db.query("select id from public.courses where id=$1", [
            anotherCourse,
          ]),
        )
      ).rows.length,
      1,
    );
    await as(teacher, () => insertLesson(lesson, course));
    assert.equal(await as(teacher, () => count("public.lessons")), 1);
    assert.equal(await as(other, () => count("public.lessons")), 0);
    await assert.rejects(
      as(teacher, () => insertLesson(crypto.randomUUID(), anotherCourse)),
    );
    await assert.rejects(
      as(teacher, () =>
        db.query("update public.lessons set course_id=$1 where id=$2", [
          anotherCourse,
          lesson,
        ]),
      ),
    );
    await as(teacher, () =>
      db.query("update public.lessons set title='Aula editada' where id=$1", [
        lesson,
      ]),
    );
    assert.equal(
      (
        await as(teacher, () =>
          db.query("delete from public.lessons where id=$1 returning id", [
            lesson,
          ]),
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      as(teacher, () =>
        db.query("insert into public.courses(title) values('Curso indevido')"),
      ),
    );
    await assert.rejects(
      as(teacher, () =>
        db.query(
          "insert into public.course_teachers(teacher_id,course_id) values($1,$2)",
          [teacher, anotherCourse],
        ),
      ),
    );
    assert.equal(
      (
        await as(teacher, () =>
          db.query(
            "update public.site_settings set about='Indevido' returning id",
          ),
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await as(teacher, () =>
          db.query(
            "update public.profiles set role='admin' where id=$1 returning id",
            [teacher],
          ),
        ).catch(() => ({ rows: [] }))
      ).rows.length,
      0,
    );
    const path = `${course}/teacher.pdf`;
    const insertScore = (target, path) =>
      db.query(
        "insert into public.scores(title,path,course_id,published) values('Partitura',$1,$2,false)",
        [path, target],
      );
    await as(teacher, () =>
      db.query(
        "insert into storage.objects(bucket_id,name) values('scores',$1)",
        [path],
      ),
    );
    await as(teacher, () => insertScore(course, path));
    assert.equal(await as(teacher, () => count("public.scores")), 1);
    assert.equal(await as(other, () => count("public.scores")), 0);
    assert.equal(await as(teacher, () => count("storage.objects")), 1);
    assert.equal(await as(other, () => count("storage.objects")), 0);
    await assert.rejects(
      as(teacher, () =>
        insertScore(anotherCourse, `${anotherCourse}/forbidden.pdf`),
      ),
    );
    await assert.rejects(
      as(teacher, () => insertScore(course, `${anotherCourse}/forged.pdf`)),
    );
    await assert.rejects(
      as(teacher, () =>
        db.query(
          "insert into storage.objects(bucket_id,name) values('scores',$1)",
          [`${anotherCourse}/forbidden.pdf`],
        ),
      ),
    );
    await assert.rejects(
      as(teacher, () =>
        db.query(
          "insert into storage.objects(bucket_id,name) values('scores','not-a-uuid/file.pdf')",
        ),
      ),
    );
    await assert.rejects(
      as(teacher, () =>
        db.query(
          "insert into storage.objects(bucket_id,name) values('institutional','forbidden.jpg')",
        ),
      ),
    );
    await as(teacher, () =>
      db.query("update public.scores set published=true where path=$1", [path]),
    );
    assert.equal(await as(student, () => count("public.scores")), 1);
    await as(admin, () =>
      db.query(
        "insert into public.scores(title,path,published) values('Acervo geral','legacy.pdf',true)",
      ),
    );
    assert.equal(await as(teacher, () => count("public.scores")), 1);
    assert.equal(await as(student, () => count("public.scores")), 2);
    await as(admin, () =>
      db.query(
        "update public.course_teachers set active=false where teacher_id=$1",
        [teacher],
      ),
    );
    assert.equal(await as(teacher, () => count("public.lessons")), 0);
    assert.equal(await as(teacher, () => count("public.scores")), 0);
    assert.equal(await as(teacher, () => count("storage.objects")), 0);
    await assert.rejects(
      as(teacher, () => insertLesson(crypto.randomUUID(), course)),
    );
    await as(admin, () =>
      db.query(
        "update public.course_teachers set active=true where teacher_id=$1",
        [teacher],
      ),
    );
    assert.equal(await as(teacher, () => count("public.lessons")), 1);
    for (const restriction of [
      "active=false",
      "active=true,must_change_password=true",
    ]) {
      await db.query(`update public.profiles set ${restriction} where id=$1`, [
        teacher,
      ]);
      assert.equal(await as(teacher, () => count("public.lessons")), 0);
      assert.equal(await as(teacher, () => count("public.scores")), 0);
      assert.equal(await as(teacher, () => count("storage.objects")), 0);
    }
  } finally {
    await db.close();
  }
});
