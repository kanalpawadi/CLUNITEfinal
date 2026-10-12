/** Interest tags a student can pick, with the club categories and keywords each one matches. */
export const INTERESTS = [
  { id: "coding", label: "Coding", categories: ["technical"], keywords: ["coding", "code", "programming", "developer", "software", "hackathon", "web", "app", "open source"] },
  { id: "ai-data", label: "AI & Data", categories: ["technical"], keywords: ["ai", "machine learning", "ml", "data", "analytics", "deep learning"] },
  { id: "robotics", label: "Robotics", categories: ["technical"], keywords: ["robot", "robotics", "drone", "electronics", "iot", "embedded", "sensor"] },
  { id: "music", label: "Music", categories: ["music", "cultural"], keywords: ["music", "band", "singing", "choir", "instrument", "genre"] },
  { id: "dance", label: "Dance", categories: ["dance", "cultural"], keywords: ["dance", "choreography", "crew", "move"] },
  { id: "drama", label: "Drama & Theatre", categories: ["drama", "cultural"], keywords: ["drama", "theatre", "theater", "acting", "stage", "play"] },
  { id: "photography", label: "Photography & Film", categories: ["photography", "arts"], keywords: ["photo", "photography", "camera", "film", "video", "cinema"] },
  { id: "art", label: "Art & Design", categories: ["arts"], keywords: ["art", "design", "painting", "sketch", "illustration", "ui", "ux"] },
  { id: "writing", label: "Writing & Literature", categories: ["literary"], keywords: ["literary", "writing", "poetry", "books", "read", "write", "debate", "quiz"] },
  { id: "entrepreneurship", label: "Startups & Business", categories: ["entrepreneurship"], keywords: ["startup", "entrepreneur", "e-cell", "business", "idea", "pitch", "founder"] },
  { id: "social", label: "Social Impact", categories: ["social service"], keywords: ["social", "volunteer", "ngo", "community", "impact", "change", "environment"] },
  { id: "sports", label: "Sports & Fitness", categories: ["sports"], keywords: ["sport", "sports", "fitness", "football", "cricket", "athletics", "yoga"] },
] as const

export type InterestId = (typeof INTERESTS)[number]["id"]
export const INTEREST_IDS: readonly InterestId[] = INTERESTS.map((i) => i.id)
const byId = new Map<string, (typeof INTERESTS)[number]>(INTERESTS.map((i) => [i.id, i]))

export const isInterestId = (v: string): v is InterestId => byId.has(v)
export const interestLabel = (id: string) => byId.get(id)?.label ?? id

export type RecommendableClub = {
  id: string
  name: string
  slug: string
  tagline: string | null
  description: string | null
  category: string | null
  college: string | null
  logo_url: string | null
  members_count: number
  events_hosted_count: number
}

export type Recommendation = RecommendableClub & { score: number; reasons: string[] }

const words = (text: string) => ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `

/**
 * Ranks clubs for a student. Category match is the strongest signal, then keywords in the club's
 * name/tagline/description, same college, and a small popularity/activity boost.
 * Clubs the student already belongs to are excluded.
 */
export function recommendClubs(
  clubs: readonly RecommendableClub[],
  interests: readonly string[],
  options: { college?: string | null; excludeClubIds?: ReadonlySet<string>; limit?: number } = {},
): Recommendation[] {
  const picked = interests.map((i) => byId.get(i)).filter((i): i is (typeof INTERESTS)[number] => !!i)
  const college = options.college?.trim().toLowerCase()

  const scored = clubs
    .filter((c) => !options.excludeClubIds?.has(c.id))
    .map((club) => {
      const category = (club.category ?? "").toLowerCase()
      const text = words(`${club.name} ${club.tagline ?? ""} ${club.description ?? ""}`)
      let score = 0
      const reasons: string[] = []

      let categoryOnly = false
      for (const interest of picked) {
        const categoryMatch = (interest.categories as readonly string[]).includes(category)
        const hits = interest.keywords.filter((k) => text.includes(` ${k} `)).length
        // A keyword in the club's own words is the strong, explainable signal;
        // a shared category alone is weaker and is explained by the category name.
        if (hits > 0) {
          score += 30 + Math.min(hits - 1, 2) * 10 + (categoryMatch ? 10 : 0)
          reasons.push(interest.label)
        } else if (categoryMatch) {
          score += 15
          categoryOnly = true
        }
      }
      if (reasons.length === 0 && categoryOnly && club.category) reasons.push(club.category)
      if (college && club.college?.trim().toLowerCase() === college) {
        score += 10
        reasons.push("Your college")
      }
      // Gentle popularity + activity boost (never outweighs an interest match)
      score += Math.min(8, Math.log2(1 + club.members_count) * 2) + Math.min(6, club.events_hosted_count)
      return { ...club, score: Math.round(score), reasons }
    })

  const withMatch = scored.filter((c) => c.reasons.some((r) => r !== "Your college"))
  const pool = picked.length > 0 && withMatch.length > 0 ? withMatch : scored
  return pool.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, options.limit ?? 6)
}
