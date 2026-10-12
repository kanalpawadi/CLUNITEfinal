import { z } from "zod"
import type { Json } from "@/types/database"

const optionalText = z.string().trim().max(500).optional().nullable()

export const participantDetailsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: optionalText,
  college: optionalText,
  year: optionalText,
  branch: optionalText,
  gender: optionalText,
  skills: optionalText,
  experience: optionalText,
})

export const registrationDataSchema = z.object({
  registration_type: z.string().max(40).optional().nullable(),
  participant_details: participantDetailsSchema.optional().nullable(),
  team_members: z.array(participantDetailsSchema).max(50).optional().nullable(),
  answers: z.record(z.string().max(40), z.union([z.string().max(2000), z.boolean()])).optional().nullable(),
  additional_info: z
    .object({
      dietaryRestrictions: optionalText,
      specialRequirements: optionalText,
      branch: optionalText,
    })
    .optional()
    .nullable(),
})

export type ParticipantDetails = z.infer<typeof participantDetailsSchema>
export type RegistrationData = z.infer<typeof registrationDataSchema>

const EMPTY: RegistrationData = {}

/** Lenient parse of the stored JSON: unknown/invalid shapes become an empty object. */
export function parseRegistrationData(value: Json | null | undefined): RegistrationData {
  if (value === null || value === undefined) return EMPTY
  const result = registrationDataSchema.safeParse(value)
  return result.success ? result.data : EMPTY
}

/** Number of people covered by one registration. */
export function participantCount(data: RegistrationData): number {
  return data.team_members && data.team_members.length > 0 ? data.team_members.length : 1
}
