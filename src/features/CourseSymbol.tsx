import {
  Guitar,
  Piano,
  MicVocal,
  BookOpen,
  AudioLines,
  Music2,
} from "lucide-react";
import type { Course } from "../domain/school";
import { courseSymbolName } from "../domain/course-symbol";

const symbols = {
  guitar: Guitar,
  organ: Piano,
  voice: MicVocal,
  theory: BookOpen,
  solfege: AudioLines,
  music: Music2,
};
export function CourseSymbol({ course }: { course: Course }) {
  const Icon = symbols[courseSymbolName(course)];
  return <Icon strokeWidth={1.35} size={34} />;
}
