import { signToken, verifyToken } from "@/lib/security/crypto";

export const TRAINING_TOKEN_TTL_SECONDS = 4 * 60 * 60;
export const TRAINING_PASS_SCORE = 10;
export const TRAINING_QUESTION_COUNT = 10;
export const TRAINING_VIDEO_COMPLETION_RATIO = 0.7;

type TrainingToken = {
  studentId: string;
  purpose: "guardian-training";
};

export function youtubeVideoId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0];
    if (url.hostname.includes("youtube.com")) {
      if (url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2];
      return url.searchParams.get("v") ?? "";
    }
  } catch {
    return "";
  }
  return "";
}

export async function createTrainingToken(studentId: string) {
  return signToken(
    { studentId, purpose: "guardian-training" },
    TRAINING_TOKEN_TTL_SECONDS,
  );
}

export async function studentIdFromTrainingToken(token: string) {
  const payload = await verifyToken<TrainingToken>(token);
  return payload?.purpose === "guardian-training" && payload.studentId
    ? payload.studentId
    : null;
}

export function trainingCanTakeQuiz(status: string) {
  return status === "VIDEO_COMPLETED" || status === "QUIZ_FAILED";
}

export function trainingCanSubmitIdentity(status: string) {
  return status === "QUIZ_PASSED" || status === "REJECTED";
}
