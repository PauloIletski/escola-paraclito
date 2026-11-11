import { createClient } from "@supabase/supabase-js";
import type {
  Profile,
  SchoolData,
  Course,
  Lesson,
  Score,
  Settings,
  SchoolImage,
} from "../domain/school";
import { defaultSettings, initialCourses } from "../domain/school";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export const emptyData: SchoolData = {
  courses: initialCourses,
  lessons: [],
  scores: [],
  images: [],
  settings: defaultSettings,
  profiles: [],
  enrollments: [],
  progress: [],
  teachingAssignments: [],
};
function client() {
  if (!supabase)
    throw new Error(
      "O acesso estará disponível após a configuração da plataforma pela escola.",
    );
  return supabase;
}
export async function loadProfile(): Promise<Profile | null> {
  const db = client();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) return null;
  const result = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (result.error)
    throw new Error(
      "Não foi possível consultar seu cadastro. Entre em contato com a escola.",
    );
  return result.data;
}
export async function loadSchool(profile: Profile | null): Promise<SchoolData> {
  const db = client();
  const restricted = profile?.active && !profile.must_change_password;
  const staff = restricted && ["admin", "super_admin"].includes(profile.role);
  const results = await Promise.all([
    db.from("courses").select("*").order("title"),
    restricted
      ? db.from("lessons").select("*").order("position")
      : Promise.resolve({ data: [], error: null }),
    restricted
      ? db.from("scores").select("*").order("title")
      : Promise.resolve({ data: [], error: null }),
    db.from("institutional_images").select("*").order("position"),
    db.from("site_settings").select("*").eq("id", 1).maybeSingle(),
    staff
      ? db.from("profiles").select("*").order("name")
      : Promise.resolve({ data: [], error: null }),
    restricted
      ? db.from("course_enrollments").select("*")
      : Promise.resolve({ data: [], error: null }),
    restricted
      ? db
          .from("lesson_progress")
          .select("lesson_id")
          .eq("student_id", profile.id)
          .eq("completed", true)
      : Promise.resolve({ data: [], error: null }),
    restricted && profile.role !== "student"
      ? db.from("course_teachers").select("*")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (results.some((r) => r.error))
    throw new Error("Não foi possível carregar o conteúdo. Tente novamente.");
  return {
    courses: results[0].data || [],
    lessons: results[1].data || [],
    scores: results[2].data || [],
    images: results[3].data || [],
    settings: results[4].data || defaultSettings,
    profiles: results[5].data || [],
    enrollments: results[6].data || [],
    progress: (results[7].data || []).map(
      (r: { lesson_id: string }) => r.lesson_id,
    ),
    teachingAssignments: results[8].data || [],
  };
}
export async function signIn(email: string, password: string) {
  const { error } = await client().auth.signInWithPassword({ email, password });
  if (error)
    throw new Error(
      "E-mail ou senha inválidos. Confira os dados recebidos da escola.",
    );
}
export async function signOut() {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}
export async function setProgress(
  student: string,
  lesson: string,
  completed: boolean,
) {
  const { error } = await client()
    .from("lesson_progress")
    .upsert(
      { student_id: student, lesson_id: lesson, completed },
      { onConflict: "student_id,lesson_id" },
    );
  if (error)
    throw new Error(
      "Não foi possível salvar o progresso. Verifique seu acesso e tente novamente.",
    );
}
export async function saveRecord(
  table:
    "courses" | "lessons" | "scores" | "site_settings" | "institutional_images",
  value: Partial<Course | Lesson | Score | Settings | SchoolImage>,
) {
  const row: Record<string, unknown> = { ...value };
  const { error } = await client().from(table).upsert(row);
  if (error)
    throw new Error(
      "Não foi possível salvar. Verifique sua permissão e tente novamente.",
    );
}
export async function updateStudent(
  id: string,
  value: { active?: boolean; choir?: boolean },
) {
  const { error } = await client().functions.invoke("manage-account", {
    body: { action: "update", id, ...value },
  });
  if (error) throw new Error("Não foi possível atualizar o cadastro.");
}
export async function enroll(
  student_id: string,
  course_id: string,
  active: boolean,
) {
  const { error } = await client()
    .from("course_enrollments")
    .upsert(
      { student_id, course_id, active },
      { onConflict: "student_id,course_id" },
    );
  if (error) throw new Error("Não foi possível alterar o acesso ao curso.");
}
export async function accountAction(body: Record<string, unknown>) {
  const { data, error } = await client().functions.invoke("manage-account", {
    body,
  });
  if (error || data?.error)
    throw new Error(
      data?.error ||
        "Não foi possível concluir a operação. Confira o cadastro e tente novamente.",
    );
  return data as { temporary_password?: string; id?: string };
}
export async function upload(
  bucket: "scores" | "institutional",
  file: File,
  courseId?: string | null,
) {
  if (bucket === "scores" && file.type !== "application/pdf")
    throw new Error("Escolha um arquivo PDF.");
  if (
    bucket === "institutional" &&
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw new Error("Escolha uma imagem JPG, PNG ou WebP.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("O arquivo deve ter até 10 MB.");
  const filename = `${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase()}`;
  const path =
    bucket === "scores" && courseId ? `${courseId}/${filename}` : filename;
  const { error } = await client()
    .storage.from(bucket)
    .upload(
      path,
      file,
      bucket === "scores" ? { cacheControl: "0" } : undefined,
    );
  if (error) throw new Error("Não foi possível enviar o arquivo.");
  return path;
}
export async function assignTeacher(
  teacher_id: string,
  course_id: string,
  active: boolean,
) {
  const { error } = await client()
    .from("course_teachers")
    .upsert(
      { teacher_id, course_id, active },
      { onConflict: "teacher_id,course_id" },
    );
  if (error)
    throw new Error("Não foi possível alterar os cursos do professor.");
}
export const imageUrl = (path: string) =>
  supabase?.storage.from("institutional").getPublicUrl(path).data.publicUrl ||
  "";
export async function downloadScore(path: string) {
  const { data, error } = await client()
    .storage.from("scores")
    .download(path, { cacheNonce: crypto.randomUUID() }, { cache: "no-store" });
  if (error)
    throw new Error(
      "A partitura não está disponível ou seu acesso foi revogado.",
    );
  return URL.createObjectURL(data);
}
