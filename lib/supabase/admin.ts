import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { publicEnv } from "@/lib/env"
import { requireServerEnv } from "@/lib/env.server"

let adminClient: SupabaseClient<Database> | undefined

/**
 * Service-role client: bypasses RLS. Use ONLY in server code after authorising the caller.
 * Throws ConfigError if SUPABASE_SECRET_KEY is not set.
 */
export function createAdminClient(): SupabaseClient<Database> {
  adminClient ??= createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, requireServerEnv("SUPABASE_SECRET_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return adminClient
}
