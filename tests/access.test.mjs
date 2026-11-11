import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import test from "node:test";

const ids = {
  admin: "20000000-0000-4000-8000-000000000001",
  student: "20000000-0000-4000-8000-000000000002",
  other: "20000000-0000-4000-8000-000000000003",
  super: "20000000-0000-4000-8000-000000000004",
  course: "10000000-0000-4000-8000-000000000001",
  lesson: "30000000-0000-4000-8000-000000000001",
};
test("Authorization respects current account, course and choir permissions", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      grant usage on schema auth, storage to anon, authenticated;
      create table auth.users(id uuid primary key, email text, raw_app_meta_data jsonb);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant select,insert,update,delete on storage.objects to authenticated;
      grant select on storage.objects to anon;
    `);
    await db.exec(
      await readFile(
        new URL("../supabase/schemas/001_school.sql", import.meta.url),
        "utf8",
      ),
    );
    await db.exec(
      await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8"),
    );
    await db.exec(
      await readFile(
        new URL("../supabase/schemas/002_teachers.sql", import.meta.url),
        "utf8",
      ),
    );
    for (const [name, role] of [
      ["admin", "admin"],
      ["student", "student"],
      ["other", "student"],
      ["super", "super_admin"],
    ]) {
      await db.query("insert into auth.users(id,email) values($1,$2)", [
        ids[name],
        `${name}@test.local`,
      ]);
      await db.query(
        "insert into public.profiles(id,name,email,whatsapp,role,active,choir,must_change_password) values($1,$2,$3,$4,$5,true,true,false)",
        [ids[name], name, `${name}@test.local`, "5517999999999", role],
      );
    }
    await db.query(
      "insert into public.lessons(id,course_id,title,position,video_id,published) values($1,$2,$3,1,$4,true)",
      [ids.lesson, ids.course, "Aula publicada", "dQw4w9WgXcQ"],
    );
    await db.query(
      "insert into public.course_enrollments(student_id,course_id) values($1,$2)",
      [ids.student, ids.course],
    );
    await db.exec(
      "insert into public.scores(title,path,published) values('Canto','score.pdf',true); insert into storage.objects(bucket_id,name) values('scores','score.pdf'),('scores','draft.pdf');",
    );
    async function as(role, id, action) {
      await db.exec(`begin; set local role ${role};`);
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
        id || "",
      ]);
      try {
        const result = await action();
        await db.exec("commit");
        return result;
      } catch (error) {
        await db.exec("rollback");
        throw error;
      }
    }
    const count = async (table) =>
      Number((await db.query(`select count(*) as n from ${table}`)).rows[0].n);
    assert.equal(await as("anon", "", () => count("public.courses")), 5);
    assert.equal(
      (
        await db.query(
          "select hero_image_path from public.site_settings where id=1",
        )
      ).rows[0].hero_image_path,
      null,
    );
    await as("authenticated", ids.admin, () =>
      db.query(
        "update public.site_settings set hero_image_path=$1,hero_image_alt=$2 where id=1",
        ["hero-test.webp", "Alunos em formação musical"],
      ),
    );
    assert.deepEqual(
      (
        await as("anon", "", () =>
          db.query(
            "select hero_image_path,hero_image_alt from public.site_settings where id=1",
          ),
        )
      ).rows[0],
      {
        hero_image_path: "hero-test.webp",
        hero_image_alt: "Alunos em formação musical",
      },
    );
    assert.equal(
      (
        await as("authenticated", ids.student, () =>
          db.query(
            "update public.site_settings set hero_image_path=null where id=1 returning id",
          ),
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      as("authenticated", ids.admin, () =>
        db.query(
          "update public.site_settings set hero_image_alt='' where id=1",
        ),
      ),
    );
    await as("authenticated", ids.admin, () =>
      db.query(
        "update public.site_settings set hero_image_path=null,hero_image_alt='' where id=1",
      ),
    );
    assert.equal(
      (
        await db.query(
          "select hero_image_path from public.site_settings where id=1",
        )
      ).rows[0].hero_image_path,
      null,
    );
    await assert.rejects(as("anon", "", () => count("public.lessons")));
    assert.equal(
      await as("authenticated", ids.student, () => count("public.lessons")),
      1,
    );
    assert.equal(
      await as("authenticated", ids.other, () => count("public.lessons")),
      0,
    );
    assert.equal(
      await as("authenticated", ids.student, () => count("storage.objects")),
      1,
    );
    await as("authenticated", ids.student, () =>
      db.query(
        "insert into public.lesson_progress(student_id,lesson_id,completed) values($1,$2,true)",
        [ids.student, ids.lesson],
      ),
    );
    await assert.rejects(
      as("authenticated", ids.student, () =>
        db.query(
          "insert into public.lesson_progress(student_id,lesson_id) values($1,$2)",
          [ids.other, ids.lesson],
        ),
      ),
    );
    await assert.rejects(
      as("authenticated", ids.student, () =>
        db.exec("update public.profiles set role='admin'"),
      ),
    );
    await assert.rejects(
      as("authenticated", ids.admin, () =>
        db.query(
          "insert into public.profiles(id,name,email,whatsapp,role) values(gen_random_uuid(),'intruder','intruder@test.local','5517999999999','admin')",
        ),
      ),
    );
    assert.equal(
      await as("authenticated", ids.admin, () => count("public.profiles")),
      3,
    );
    assert.equal(
      await as("authenticated", ids.super, () => count("public.profiles")),
      2,
    );
    await db.query(
      "update public.course_enrollments set active=false where student_id=$1",
      [ids.student],
    );
    assert.equal(
      await as("authenticated", ids.student, () => count("public.lessons")),
      0,
    );
    assert.equal(
      await as("authenticated", ids.student, () =>
        count("public.lesson_progress"),
      ),
      0,
    );
    await db.query(
      "update public.course_enrollments set active=true where student_id=$1",
      [ids.student],
    );
    assert.equal(
      await as("authenticated", ids.student, () =>
        count("public.lesson_progress"),
      ),
      1,
    );
    await db.query("update public.profiles set choir=false where id=$1", [
      ids.student,
    ]);
    assert.equal(
      await as("authenticated", ids.student, () => count("storage.objects")),
      0,
    );
    await db.query(
      "update public.profiles set choir=true,must_change_password=true where id=$1",
      [ids.student],
    );
    assert.equal(
      await as("authenticated", ids.student, () => count("public.lessons")),
      0,
    );
    assert.equal(
      await as("authenticated", ids.student, () => count("storage.objects")),
      0,
    );
    await db.query(
      "update public.profiles set must_change_password=false,active=false where id=$1",
      [ids.student],
    );
    assert.equal(
      await as("authenticated", ids.student, () => count("public.lessons")),
      0,
    );
    assert.equal(
      await as("authenticated", ids.student, () => count("storage.objects")),
      0,
    );
    await db.query("update public.profiles set active=false where id=$1", [
      ids.admin,
    ]);
    await assert.rejects(
      as("authenticated", ids.admin, () =>
        db.exec("insert into public.courses(title) values('Negado')"),
      ),
    );
    // The Auth trigger keeps an incomplete provision inactive and retryable.
    const created = "40000000-0000-4000-8000-000000000001";
    await db.query(
      "insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)",
      [
        created,
        "new@test.local",
        {
          school_profile: {
            name: "Novo",
            whatsapp: "5517999999999",
            role: "student",
            request_id: "50000000-0000-4000-8000-000000000001",
          },
        },
      ],
    );
    const p = (
      await db.query(
        "select active,must_change_password from public.profiles where id=$1",
        [created],
      )
    ).rows[0];
    assert.deepEqual(p, { active: false, must_change_password: true });
    const deferred = "40000000-0000-4000-8000-000000000002";
    await db.query("insert into auth.users(id,email) values($1,$2)", [
      deferred,
      "deferred@test.local",
    ]);
    const metadata = {
      school_profile: {
        name: "Metadata posterior",
        whatsapp: "5517999999999",
        role: "student",
        request_id: "50000000-0000-4000-8000-000000000002",
      },
    };
    await db.query("update auth.users set raw_app_meta_data=$1 where id=$2", [
      metadata,
      deferred,
    ]);
    assert.equal(
      (
        await db.query(
          "select count(*)::integer as n from public.profiles where id=$1",
          [deferred],
        )
      ).rows[0].n,
      1,
    );
    await db.query(
      "update public.profiles set active=true,must_change_password=false where id=$1",
      [deferred],
    );
    await db.query("update auth.users set raw_app_meta_data=$1 where id=$2", [
      metadata,
      deferred,
    ]);
    assert.deepEqual(
      (
        await db.query(
          "select active,must_change_password from public.profiles where id=$1",
          [deferred],
        )
      ).rows[0],
      { active: true, must_change_password: false },
    );
  } finally {
    await db.close();
  }
});
