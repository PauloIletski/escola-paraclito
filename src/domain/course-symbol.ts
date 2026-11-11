import type { Course } from "./school.ts";

type SymbolName = "guitar" | "organ" | "voice" | "theory" | "solfege" | "music";
const initialSymbols: Record<string, SymbolName> = {
  guitar: "guitar",
  organ: "organ",
  voice: "voice",
  theory: "theory",
  solfege: "solfege",
  "10000000-0000-4000-8000-000000000001": "guitar",
  "10000000-0000-4000-8000-000000000002": "organ",
  "10000000-0000-4000-8000-000000000003": "voice",
  "10000000-0000-4000-8000-000000000004": "theory",
  "10000000-0000-4000-8000-000000000005": "solfege",
};
const namedSymbols: Record<string, SymbolName> = {
  violao: "guitar",
  orgao: "organ",
  canto: "voice",
  "teoria musical": "theory",
  solfejo: "solfege",
};
export function courseSymbolName(
  course: Pick<Course, "id" | "title">,
): SymbolName {
  const title = course.title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return initialSymbols[course.id] || namedSymbols[title] || "music";
}
