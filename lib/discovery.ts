import { z } from "zod"

export const EVENT_TYPES = ["workshop", "competition", "seminar", "cultural", "sports", "hackathon", "conference", "networking"] as const
export const EVENT_MODES = ["online", "offline", "hybrid"] as const
export const SORTS = { soonest: "Starting soon", closing: "Closing soon", trending: "Trending", prize: "Biggest prize" } as const

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v)
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(one, z.enum(values).optional().catch(undefined))

/** Event discovery filters from the URL. Invalid values fall back to "no filter". */
export const filtersSchema = z.object({
  q: z.preprocess(one, z.string().trim().max(100).optional().catch(undefined)),
  type: optionalEnum(EVENT_TYPES),
  mode: optionalEnum(EVENT_MODES),
  category: z.preprocess(one, z.string().trim().max(60).optional().catch(undefined)),
  price: optionalEnum(["free", "paid"] as const),
  prize: z.preprocess(one, z.enum(["1"]).optional().catch(undefined)),
  closing: optionalEnum(["3", "7"] as const),
  sort: z.preprocess(one, z.enum(["soonest", "closing", "trending", "prize"]).catch("soonest")),
})

export type EventFilters = z.infer<typeof filtersSchema>

export function parseFilters(searchParams: Record<string, string | string[] | undefined>): EventFilters {
  return filtersSchema.parse(searchParams)
}

export const hasActiveFilters = (f: EventFilters) =>
  Boolean(f.q || f.type || f.mode || f.category || f.price || f.prize || f.closing)

/** Escapes LIKE wildcards in user input. */
export const likeEscape = (s: string) => s.replace(/[%_\\]/g, (c) => `\\${c}`)
