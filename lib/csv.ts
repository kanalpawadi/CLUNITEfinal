/**
 * Spreadsheet-safe CSV cell: always quoted, inner quotes doubled, and values that a spreadsheet
 * would treat as a formula (=, +, -, @, tab, CR) are prefixed with an apostrophe (CSV injection).
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}
