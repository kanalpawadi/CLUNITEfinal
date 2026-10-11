import { z } from "zod"
import type { Json } from "@/types/database"

export const contactInfoSchema = z.object({
  email: z.string().email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  qr_enabled: z.boolean().optional(),
  certificates_enabled: z.boolean().optional(),
})

export type ContactInfo = z.infer<typeof contactInfoSchema>

/** Lenient parse of events.contact_info. */
export function parseContactInfo(value: Json | null | undefined): ContactInfo {
  const result = contactInfoSchema.safeParse(value ?? {})
  return result.success ? result.data : {}
}
