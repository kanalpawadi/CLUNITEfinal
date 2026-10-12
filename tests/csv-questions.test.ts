import { test } from "node:test"
import assert from "node:assert/strict"
import { csvCell } from "../lib/csv.ts"
import { parseQuestions, validateAnswers, type Question } from "../lib/questions.ts"

test("CSV cells neutralise formulas and escape quotes", () => {
  assert.equal(csvCell('=HYPERLINK("http://evil")'), `"'=HYPERLINK(""http://evil"")"`)
  assert.equal(csvCell("+91 98765"), `"'+91 98765"`)
  assert.equal(csvCell("-1"), `"'-1"`)
  assert.equal(csvCell("@SUM(A1)"), `"'@SUM(A1)"`)
  assert.equal(csvCell("Asha, CSE"), `"Asha, CSE"`)
  assert.equal(csvCell(null), `""`)
  assert.equal(csvCell(42), `"42"`)
})

const questions: Question[] = [
  { id: "gh", label: "GitHub", type: "url", required: true },
  { id: "size", label: "T-shirt", type: "select", required: false, options: ["S", "M"] },
  { id: "rules", label: "I accept the rules", type: "checkbox", required: true },
]

test("required answers, links, options and checkboxes are validated", () => {
  assert.deepEqual(Object.keys(validateAnswers(questions, {})).sort(), ["gh", "rules"])
  assert.ok(validateAnswers(questions, { gh: "github.com/x", rules: true }).gh)
  assert.ok(validateAnswers(questions, { gh: "https://github.com/x", rules: true, size: "XXL" }).size)
  assert.deepEqual(validateAnswers(questions, { gh: "https://github.com/x", rules: true, size: "M" }), {})
})

test("invalid stored question JSON is ignored, not thrown", () => {
  assert.deepEqual(parseQuestions([{ id: "BAD ID", label: "x", type: "text", required: true }]), [])
  assert.deepEqual(parseQuestions(null), [])
  assert.equal(parseQuestions(questions).length, 3)
})
