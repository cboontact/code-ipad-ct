export type RegistrationAudience = "teacher" | "student" | "student_lower" | "student_upper";

const BANGKOK_OFFSET = "+07:00";

function settingDate(value: string | undefined): Date | null {
  const text = value?.trim();
  if (!text) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
  const normalized = hasZone ? text : `${text.length === 16 ? text : text.slice(0, 16)}:00${BANGKOK_OFFSET}`;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

export function registrationWindow(
  settings: Record<string, string>,
  audience: RegistrationAudience,
  currentDate = new Date(),
) {
  const studentTier = audience === "student_lower" || audience === "student_upper";
  const status = settings[`${audience}_survey_status`]
    ?? (studentTier ? settings.student_survey_status : undefined)
    ?? settings.survey_status
    ?? "OPEN";
  const opensAt = settingDate(
    settings[`${audience}_registration_opens_at`]
      || (studentTier ? settings.student_registration_opens_at : undefined),
  );
  const closesAt = settingDate(
    settings[`${audience}_registration_closes_at`]
      || (studentTier ? settings.student_registration_closes_at : undefined),
  );
  const now = currentDate.getTime();
  const phase = status !== "OPEN"
    ? "CLOSED"
    : opensAt && now < opensAt.getTime()
      ? "SCHEDULED"
      : closesAt && now > closesAt.getTime()
        ? "ENDED"
        : "OPEN";

  return { isOpen: phase === "OPEN", phase, opensAt, closesAt } as const;
}
