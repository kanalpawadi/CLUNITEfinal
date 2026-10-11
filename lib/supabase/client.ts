import { createBrowserClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { publicEnv } from "@/lib/env"

export type TypedSupabaseClient = SupabaseClient<Database>

let browserClient: TypedSupabaseClient | undefined

/** Browser Supabase client (cookie-based session shared with the server). */
export function createClient(): TypedSupabaseClient {
  if (typeof window === "undefined") {
    return createBrowserClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  }
  browserClient ??= createBrowserClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  )
  return browserClient
}
