export const SCHOOL_EMAIL_DOMAIN = "chomthong.ac.th";
export const NDLP_EMAIL_DOMAIN = "ndlp.go.th";
export const SCHOOL_EMAIL_PATTERN = "^[^\\s@]+@chomthong\\.ac\\.th$";
export const NDLP_EMAIL_PATTERN = "^[^\\s@]+@ndlp\\.go\\.th$";

function hasDomain(value: string, domain: string) {
  const normalized = value.trim().toLowerCase();
  const parts = normalized.split("@");
  if (parts.length !== 2 || parts[1] !== domain) return false;
  const local = parts[0];
  return local.length > 0 && local.length <= 64 &&
    !local.startsWith(".") && !local.endsWith(".") && !local.includes("..") &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local);
}

export function isSchoolEmail(value: string) {
  return hasDomain(value, SCHOOL_EMAIL_DOMAIN);
}

export function isNdlpEmail(value: string) {
  return hasDomain(value, NDLP_EMAIL_DOMAIN);
}
