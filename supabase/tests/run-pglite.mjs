// Runs schema.sql (x3), seed.sql (x2) and tests/rls_test.sql against an in-memory Postgres 17 (PGlite).
// Usage: pnpm test:db
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('..', import.meta.url))
const db = new PGlite()
const exec = async (label, sql) => {
  try {
    await db.exec(sql)
    console.log(`OK   ${label}`)
  } catch (e) {
    console.log(`FAIL ${label}: ${e.message}`)
    if (e.where) console.log('     where:', e.where)
    process.exitCode = 1
    process.exit(1)
  }
}

await exec('supabase stub', readFileSync(new URL('./supabase-stub.sql', import.meta.url), 'utf8'))
const schema = readFileSync(join(dir, 'schema.sql'), 'utf8')
await exec('schema.sql (1st run)', schema)
await exec('schema.sql (2nd run, idempotency)', schema)
if (existsSync(join(dir, 'seed.sql'))) {
  await exec('seed user', "insert into auth.users (email) values ('seed-owner@demo.local')")
  const seed = readFileSync(join(dir, 'seed.sql'), 'utf8')
  await exec('seed.sql (1st run)', seed)
  await exec('seed.sql (2nd run)', seed)
}
const testFile = join(dir, 'tests', 'rls_test.sql')
if (existsSync(testFile)) {
  await exec('tests/rls_test.sql', readFileSync(testFile, 'utf8'))
}
await exec('schema.sql (3rd run after data)', schema)
const counts = await db.query(`select (select count(*) from public.clubs) clubs, (select count(*) from public.membership_plans) plans,
  (select count(*) from pg_policies where schemaname='public') policies,
  (select count(*) from pg_tables where schemaname='public' and not rowsecurity) tables_without_rls`)
console.log(counts.rows[0])
