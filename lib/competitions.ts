import type { Tables } from "@/types/database"

export type Round = Tables<"event_rounds">
export type Submission = Tables<"round_submissions">
export type RoundState = "upcoming" | "open" | "closed"

export function roundState(round: Pick<Round, "starts_at" | "ends_at">, now = new Date()): RoundState {
  if (now < new Date(round.starts_at)) return "upcoming"
  if (now > new Date(round.ends_at)) return "closed"
  return "open"
}

export const submissionTypeLabel: Record<Round["submission_type"], string> = {
  none: "Offline round (no online submission)",
  link: "Submit a link (GitHub, Drive, Figma…)",
  file: "Upload a file (PDF, ZIP, PPTX, image · max 20MB)",
  text: "Write your answer",
}

/**
 * Whether a registration may submit to `round`: round 1 is open to every registrant;
 * later rounds only to those shortlisted in the latest earlier round (mirrors submit_round_entry()).
 */
export function isEligible(round: Round, rounds: Round[], submissions: Pick<Submission, "round_id" | "status">[]): boolean {
  const earlier = rounds.filter((r) => r.round_no < round.round_no).sort((a, b) => b.round_no - a.round_no)
  const previous = earlier[0]
  if (!previous) return true
  return submissions.some((s) => s.round_id === previous.id && s.status === "shortlisted")
}

export const SUBMISSION_FILE_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
}
export const SUBMISSION_MAX_BYTES = 20 * 1024 * 1024
