import { z } from "zod"
import type { Json } from "@/types/database"

export const QUESTION_TYPES = { text: "Short answer", textarea: "Paragraph", select: "Dropdown", checkbox: "Checkbox (must tick)", url: "Link" } as const
export type QuestionType = keyof typeof QUESTION_TYPES

export const questionSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{1,40}$/),
  label: z.string().trim().min(2).max(200),
  type: z.enum(["text", "textarea", "select", "checkbox", "url"]),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
})
export const questionsSchema = z.array(questionSchema).max(20)
export type Question = z.infer<typeof questionSchema>
export type Answers = Record<string, string | boolean>

/** Lenient parse of events.registration_questions. */
export function parseQuestions(value: Json | null | undefined): Question[] {
  const result = questionsSchema.safeParse(value ?? [])
  return result.success ? result.data : []
}

/** Client-side check mirroring validate_registration_answers() in the database. */
export function validateAnswers(questions: Question[], answers: Answers): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const q of questions) {
    const v = answers[q.id]
    if (q.required) {
      if (q.type === "checkbox" ? v !== true : typeof v !== "string" || v.trim() === "") errors[q.id] = "This question is required"
    }
    if (typeof v === "string" && v.trim()) {
      if (v.length > 2000) errors[q.id] = "Keep it under 2000 characters"
      if (q.type === "url" && !/^https?:\/\/\S+$/i.test(v.trim())) errors[q.id] = "Enter a link starting with https://"
      if (q.type === "select" && q.options && !q.options.includes(v)) errors[q.id] = "Pick one of the options"
    }
  }
  return errors
}

export const newQuestionId = () => `q_${Math.random().toString(36).slice(2, 8)}`
