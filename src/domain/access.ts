import type { Profile, Role } from "./school";

export type AccessArea = "student" | "admin" | "teacher";

export function accessAreaForPath(path: string): AccessArea {
  return /^\/admin(?:\/|$)/.test(path)
    ? "admin"
    : /^\/professor(?:\/|$)/.test(path)
      ? "teacher"
      : "student";
}

// Route selection never substitutes for the server's authorization policies.
export function canEnterArea(profile: Profile, area: AccessArea) {
  return area === "admin"
    ? profile.role === "admin" || profile.role === "super_admin"
    : area === "teacher"
      ? profile.role === "teacher"
      : profile.role === "student";
}

export function shouldShowLanding(profile: Profile | null, area: AccessArea) {
  return (
    area === "student" &&
    (!profile || ["admin", "super_admin", "teacher"].includes(profile.role))
  );
}
export function entryPathForRole(role: Role) {
  return role === "teacher"
    ? "/professor"
    : role === "student"
      ? "/#entrar"
      : "/admin";
}
