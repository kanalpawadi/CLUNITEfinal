import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/types/database"
import { requireServerEnv } from "@/lib/env.server"
import { QR_TTL_SECONDS, signQrToken, verifyQrToken, type QrVerifyResult } from "./token.ts"

type Admin = SupabaseClient<Database>
export type Credential = Tables<"id_credentials">

/** The user's member credential (one per user; club-specific checks happen at scan time). */
export async function ensureCredential(admin: Admin, userId: string): Promise<Credential> {
  const find = () =>
    admin
      .from("id_credentials")
      .select("*")
      .eq("user_id", userId)
      .is("club_id", null)
      .eq("credential_type", "member_id")
      .maybeSingle()

  const { data: existing } = await find()
  if (existing) return existing

  const { data: created, error } = await admin
    .from("id_credentials")
    .insert({ user_id: userId, credential_type: "member_id" })
    .select("*")
    .single()
  if (created) return created
  // Concurrent first request created it: read it back
  if (error?.code === "23505") {
    const { data } = await find()
    if (data) return data
  }
  throw new Error("Could not create credential")
}

export function issueQrToken(credential: Credential, eventId?: string) {
  const exp = Math.floor(Date.now() / 1000) + QR_TTL_SECONDS
  const token = signQrToken(
    { uid: credential.user_id, cid: credential.id, v: credential.token_version, ...(eventId ? { eid: eventId } : {}), exp },
    requireServerEnv("QR_SIGNING_SECRET"),
  )
  return { token, exp, version: credential.token_version }
}

export function verifyScannedToken(token: string): QrVerifyResult {
  return verifyQrToken(token, requireServerEnv("QR_SIGNING_SECRET"))
}
