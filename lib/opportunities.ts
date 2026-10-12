import { z } from "zod"
import type { Tables } from "@/types/database"

export type Opportunity = Tables<"opportunities">
export type Application = Tables<"opportunity_applications">

export const KIND_LABEL: Record<Opportunity["kind"], string> = { internship: "Internship", job: "Job" }
export const MODE_LABEL: Record<Opportunity["mode"], string> = { remote: "Remote", onsite: "On-site", hybrid: "Hybrid" }
export const APPLICATION_STATUS: Record<Application["status"], { label: string; tone: string }> = {
  applied: { label: "Applied", tone: "border-border bg-muted text-muted-foreground" },
  shortlisted: { label: "Shortlisted", tone: "border-primary/40 bg-primary/10 text-primary" },
  rejected: { label: "Not selected", tone: "border-destructive/40 bg-destructive/10 text-destructive" },
  hired: { label: "Selected", tone: "border-success/40 bg-success/10 text-success" },
}

export function isOpen(o: Pick<Opportunity, "status" | "apply_deadline">, now = new Date()): boolean {
  return o.status === "published" && (!o.apply_deadline || new Date(o.apply_deadline) > now)
}

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v)
export const opportunityFilters = z.object({
  q: z.preprocess(one, z.string().trim().max(100).optional().catch(undefined)),
  kind: z.preprocess(one, z.enum(["internship", "job"]).optional().catch(undefined)),
  mode: z.preprocess(one, z.enum(["remote", "onsite", "hybrid"]).optional().catch(undefined)),
})

export const RESUME_MAX_BYTES = 5 * 1024 * 1024
