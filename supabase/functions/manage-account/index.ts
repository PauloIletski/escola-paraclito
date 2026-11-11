import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import { normalizeWhatsapp, validNewPassword } from "../_shared/input.ts";
import { mayManageAccount } from "../_shared/permissions.ts";

const origin = Deno.env.get("APP_ORIGIN") || "http://localhost:5173";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const uuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
function temporaryPassword() {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
  return Array.from(
    crypto.getRandomValues(new Uint8Array(24)),
    (b) => alphabet[b % alphabet.length],
  ).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST")
    return reply({ error: "Método não permitido." }, 405);
  const token = req.headers.get("Authorization")?.replace(/^Bearer /i, "");
  if (!token) return reply({ error: "Entre na plataforma." }, 401);
  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  try {
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser(token);
    if (authError || !user) return reply({ error: "Sessão inválida." }, 401);
    const { data: caller, error: profileError } = await db
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (profileError || !caller?.active)
      return reply({ error: "Acesso negado." }, 403);
    const input = await req.json();
    if (typeof input.whatsapp === "string")
      input.whatsapp = normalizeWhatsapp(input.whatsapp);
    if (input.action === "change-password") {
      if (!caller.must_change_password || !validNewPassword(input.password))
        return reply(
          { error: "Use uma nova senha de 8 a 128 caracteres." },
          400,
        );
      const { error } = await db.auth.admin.updateUserById(user.id, {
        password: input.password,
      });
      if (error)
        return reply({ error: "Não foi possível alterar a senha." }, 400);
      const { error: updateError } = await db
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", user.id);
      if (updateError)
        return reply(
          {
            error:
              "Senha alterada. Entre novamente para concluir o primeiro acesso.",
          },
          500,
        );
      return reply({ success: true });
    }
    if (
      caller.must_change_password ||
      !["admin", "super_admin"].includes(caller.role)
    )
      return reply({ error: "Acesso negado." }, 403);
    if (input.action === "create") {
      const role = input.role;
      if (!mayManageAccount(caller.role, role))
        return reply({ error: "Você não pode criar esse perfil." }, 403);
      if (
        !uuid(input.request_id) ||
        typeof input.name !== "string" ||
        !input.name.trim() ||
        input.name.length > 160 ||
        typeof input.email !== "string" ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
        typeof input.whatsapp !== "string" ||
        !/^[1-9]\d{7,14}$/.test(input.whatsapp)
      )
        return reply({ error: "Confira nome, e-mail e WhatsApp." }, 400);
      const courses = Array.isArray(input.courses)
        ? [...new Set(input.courses)]
        : [];
      if (courses.some((id) => !uuid(id)))
        return reply({ error: "Curso inválido." }, 400);
      if (courses.length) {
        const { data: found, error } = await db
          .from("courses")
          .select("id")
          .in("id", courses);
        if (error || found?.length !== courses.length)
          return reply({ error: "Confira os cursos selecionados." }, 400);
      }
      const email = input.email.trim().toLowerCase();
      const password = temporaryPassword();
      const { data: existing } = await db
        .from("profiles")
        .select("*")
        .eq("provisioning_key", input.request_id)
        .maybeSingle();
      let id: string;
      if (existing) {
        if (
          existing.email !== email ||
          existing.role !== role ||
          !existing.must_change_password
        )
          return reply(
            { error: "Este cadastro já foi concluído. Use gerar novo acesso." },
            409,
          );
        id = existing.id;
        const { error } = await db.auth.admin.updateUserById(id, { password });
        if (error) throw error;
      } else {
        const { data: created, error } = await db.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: {
            school_profile: {
              name: input.name.trim(),
              whatsapp: input.whatsapp,
              role,
              choir: role === "student" && input.choir === true,
              request_id: input.request_id,
            },
          },
        });
        if (error || !created.user)
          return reply(
            {
              error:
                "Não foi possível criar a conta. Verifique se o e-mail já está cadastrado e tente novamente.",
            },
            409,
          );
        id = created.user.id;
      }
      if (["student", "teacher"].includes(role) && courses.length) {
        const teacher = role === "teacher";
        const { error } = await db
          .from(teacher ? "course_teachers" : "course_enrollments")
          .upsert(
            courses.map((course_id) => ({
              [teacher ? "teacher_id" : "student_id"]: id,
              course_id,
              active: true,
            })),
            {
              onConflict: teacher
                ? "teacher_id,course_id"
                : "student_id,course_id",
            },
          );
        if (error) throw error;
      }
      const { error } = await db
        .from("profiles")
        .update({ active: true })
        .eq("id", id);
      if (error) throw error;
      return reply({ id, temporary_password: password });
    }
    if (!uuid(input.id)) return reply({ error: "Cadastro inválido." }, 400);
    const { data: target } = await db
      .from("profiles")
      .select("*")
      .eq("id", input.id)
      .single();
    if (!target || !mayManageAccount(caller.role, target.role))
      return reply({ error: "Acesso negado." }, 403);
    if (input.action === "update") {
      const fields: {
        active?: boolean;
        choir?: boolean;
        name?: string;
        whatsapp?: string;
      } = {};
      if ("name" in input) {
        if (
          typeof input.name !== "string" ||
          !input.name.trim() ||
          input.name.length > 160
        )
          return reply({ error: "Informe um nome válido." }, 400);
        fields.name = input.name.trim();
      }
      if ("whatsapp" in input) {
        if (
          typeof input.whatsapp !== "string" ||
          !/^[1-9]\d{7,14}$/.test(input.whatsapp)
        )
          return reply(
            { error: "Informe WhatsApp em formato internacional." },
            400,
          );
        fields.whatsapp = input.whatsapp;
      }
      if (typeof input.active === "boolean") fields.active = input.active;
      if (
        caller.role === "admin" &&
        target.role === "student" &&
        typeof input.choir === "boolean"
      )
        fields.choir = input.choir;
      const { error } = await db
        .from("profiles")
        .update(fields)
        .eq("id", input.id);
      if (error) throw error;
      return reply({ success: true });
    }
    if (input.action === "reset") {
      // Lock protected data before changing the Auth credential.
      const { error: lockError } = await db
        .from("profiles")
        .update({ must_change_password: true })
        .eq("id", input.id);
      if (lockError) throw lockError;
      const password = temporaryPassword();
      const { error } = await db.auth.admin.updateUserById(input.id, {
        password,
      });
      if (error) throw error;
      return reply({ temporary_password: password });
    }
    return reply({ error: "Operação inválida." }, 400);
  } catch {
    // Never log request bodies or credentials.
    return reply(
      {
        error:
          "Não foi possível concluir. Tente novamente com os mesmos dados.",
      },
      500,
    );
  }
});
