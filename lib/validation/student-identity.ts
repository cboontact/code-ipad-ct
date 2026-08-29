export function normalizeStudentIdentityId(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\s-]/g, "")
    .toUpperCase();
}

export function isValidThaiCitizenId(value: string): boolean {
  if (!/^[1-8]\d{12}$/.test(value) || /^(\d)\1{12}$/.test(value)) return false;

  const digits = [...value].map(Number);
  const sum = digits
    .slice(0, 12)
    .reduce((total, digit, index) => total + digit * (13 - index), 0);

  return (11 - (sum % 11)) % 10 === digits[12];
}

/**
 * Student identity numbers supported by the Ministry of Education records:
 * - Thai citizens: 13 digits with the official checksum.
 * - Persons without Thai nationality: a 13-digit registry number beginning with 0.
 * - G-code students: G followed by 12 digits (13 characters in total).
 */
export function isValidStudentIdentityId(value: string): boolean {
  const normalized = normalizeStudentIdentityId(value);

  if (/^G\d{12}$/.test(normalized)) return !/^G0{12}$/.test(normalized);
  if (/^0\d{12}$/.test(normalized)) return !/^0{13}$/.test(normalized);
  return isValidThaiCitizenId(normalized);
}
