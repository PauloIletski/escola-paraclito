export { normalizeWhatsapp } from "../../supabase/functions/_shared/input.ts";
export type Role = "student" | "teacher" | "admin" | "super_admin";
export type Profile = {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  role: Role;
  active: boolean;
  choir: boolean;
  must_change_password: boolean;
};
export type Course = {
  id: string;
  title: string;
  description: string;
  published: boolean;
};
export type Lesson = {
  id: string;
  course_id: string;
  title: string;
  description: string;
  position: number;
  video_id: string;
  published: boolean;
};
export type Score = {
  id: string;
  title: string;
  path: string;
  published: boolean;
  course_id: string | null;
};
export type SchoolImage = {
  id: string;
  path: string;
  alt: string;
  position: number;
  published: boolean;
};
export type Settings = {
  id: number;
  about: string;
  whatsapp: string;
  hero_image_path: string | null;
  hero_image_alt: string;
};
export type Enrollment = {
  student_id: string;
  course_id: string;
  active: boolean;
};
export type TeachingAssignment = {
  teacher_id: string;
  course_id: string;
  active: boolean;
};
export type SchoolData = {
  courses: Course[];
  lessons: Lesson[];
  scores: Score[];
  images: SchoolImage[];
  settings: Settings;
  profiles: Profile[];
  enrollments: Enrollment[];
  progress: string[];
  teachingAssignments: TeachingAssignment[];
};
export const initialCourses: Course[] = [
  {
    id: "guitar",
    title: "Violão",
    description: "Acordes que acolhem e conduzem o canto da comunidade.",
    published: true,
  },
  {
    id: "organ",
    title: "Órgão",
    description: "A tradição e a beleza do instrumento na liturgia.",
    published: true,
  },
  {
    id: "voice",
    title: "Canto",
    description: "A voz como expressão de fé e instrumento de serviço.",
    published: true,
  },
  {
    id: "theory",
    title: "Teoria musical",
    description: "Os fundamentos para compreender a linguagem da música.",
    published: true,
  },
  {
    id: "solfege",
    title: "Solfejo",
    description: "Educar a escuta. Ler, perceber e cantar a música.",
    published: true,
  },
];
export const defaultSettings: Settings = {
  id: 1,
  about:
    "A Escola Paráclito é um espaço de formação musical a serviço da liturgia na Diocese de Barretos. Aqui, técnica e sensibilidade caminham com a fé, preparando músicos para servir à comunidade com beleza e propósito.",
  whatsapp: "",
  hero_image_path: null,
  hero_image_alt: "",
};
export function whatsappLink(phone: string, message = "") {
  const digits = phone.replace(/[\s()+-]/g, "");
  return /^[1-9]\d{7,14}$/.test(digits)
    ? `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`
    : null;
}
export function youtubeId(url: string) {
  try {
    const value = new URL(url);
    if (!["https:", "http:"].includes(value.protocol)) return null;
    const id =
      value.hostname === "youtu.be"
        ? value.pathname.slice(1)
        : ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
              value.hostname,
            )
          ? value.searchParams.get("v") ||
            value.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1]
          : null;
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function progressFor(lessons: Lesson[], completed: string[]) {
  const published = lessons.filter((l) => l.published);
  const done = published.filter((l) => completed.includes(l.id)).length;
  return {
    done,
    total: published.length,
    percent: published.length ? Math.round((done / published.length) * 100) : 0,
  };
}
export const isStaff = (profile: Profile | null) =>
  !!profile?.active &&
  !profile.must_change_password &&
  ["admin", "super_admin", "teacher"].includes(profile.role);
