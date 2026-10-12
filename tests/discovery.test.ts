import { test } from "node:test"
import assert from "node:assert/strict"
import { hasActiveFilters, likeEscape, parseFilters } from "../lib/discovery.ts"

test("valid filters are kept", () => {
  const f = parseFilters({ type: "hackathon", mode: "online", price: "free", prize: "1", closing: "7", sort: "prize", q: " ai " })
  assert.deepEqual(f, { type: "hackathon", mode: "online", price: "free", prize: "1", closing: "7", sort: "prize", q: "ai" })
  assert.equal(hasActiveFilters(f), true)
})

test("invalid or hostile values fall back to defaults", () => {
  const f = parseFilters({ type: "drop table", mode: ["online", "x"], price: "cheap", closing: "999", sort: "random", prize: "yes" })
  assert.equal(f.type, undefined)
  assert.equal(f.mode, "online")
  assert.equal(f.price, undefined)
  assert.equal(f.closing, undefined)
  assert.equal(f.sort, "soonest")
  assert.equal(f.prize, undefined)
  assert.equal(hasActiveFilters(parseFilters({})), false)
})

test("LIKE wildcards are escaped", () => {
  const backslash = String.fromCharCode(92)
  assert.equal(likeEscape(`100%_off${backslash}`), `100${backslash}%${backslash}_off${backslash}${backslash}`)
})
