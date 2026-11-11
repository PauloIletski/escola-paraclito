export const MIN_PASSWORD_LENGTH = 8;
export function validNewPassword(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= MIN_PASSWORD_LENGTH &&
    value.length <= 128
  );
}
export function normalizeWhatsapp(value: string): string | null {
  const phone = value.trim();
  if (!phone || /^\+?55\s*$/.test(phone)) return "";
  if (!/^\+?[\d\s()-]+$/.test(phone)) return null;
  let digits = phone.replace(/[\s()+-]/g, "");
  const explicitCountry = phone.startsWith("+");
  if (!explicitCountry && (digits.length === 10 || digits.length === 11))
    digits = `55${digits}`;
  else if (!explicitCountry && digits.length < 12) return null;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}
