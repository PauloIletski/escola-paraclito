export function mayManageAccount(callerRole: string, targetRole: string) {
  return (
    (callerRole === "admin" && ["student", "teacher"].includes(targetRole)) ||
    (callerRole === "super_admin" && targetRole === "admin")
  );
}
