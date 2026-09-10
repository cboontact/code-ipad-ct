export type DocumentLanguage = "th" | "en";

export function documentLanguage(value?: string, fallback?: string): DocumentLanguage {
  if (value === "en" || value === "th") return value;
  return fallback === "en" ? "en" : "th";
}
