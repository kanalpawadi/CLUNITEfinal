import { test } from "node:test"
import assert from "node:assert/strict"
import { recommendClubs, type RecommendableClub } from "../lib/interests.ts"

const club = (id: string, name: string, category: string, extra: Partial<RecommendableClub> = {}): RecommendableClub => ({
  id,
  name,
  slug: id,
  tagline: null,
  description: null,
  category,
  college: "Demo Institute",
  logo_url: null,
  members_count: 5,
  events_hosted_count: 2,
  ...extra,
})

const clubs = [
  club("coding", "Coding Club", "Technical", { tagline: "Build software and win hackathons" }),
  club("robots", "Robotics Society", "Technical", { description: "Robots, drones and sensors" }),
  club("music", "Music Collective", "Music", { members_count: 500, events_hosted_count: 40 }),
  club("dance", "Dance Crew", "Dance"),
]

test("interest matches rank first and explain why", () => {
  const recs = recommendClubs(clubs, ["robotics"])
  assert.equal(recs[0]?.id, "robots")
  assert.ok(recs[0]?.reasons.includes("Robotics"))
  assert.ok(recs.every((r) => r.reasons.length > 0), "only matching clubs when there are matches")
})

test("popularity never beats an interest match", () => {
  const recs = recommendClubs(clubs, ["dance"])
  assert.equal(recs[0]?.id, "dance")
  assert.ok(!recs.some((r) => r.id === "music"))
})

test("already-joined clubs are excluded", () => {
  const recs = recommendClubs(clubs, ["coding"], { excludeClubIds: new Set(["coding"]) })
  assert.ok(!recs.some((r) => r.id === "coding"))
})

test("no interests falls back to popular clubs", () => {
  const recs = recommendClubs(clubs, [], { limit: 2 })
  assert.equal(recs.length, 2)
  assert.equal(recs[0]?.id, "music")
})

test("unknown interest ids are ignored safely", () => {
  assert.doesNotThrow(() => recommendClubs(clubs, ["not-a-real-interest"]))
})
