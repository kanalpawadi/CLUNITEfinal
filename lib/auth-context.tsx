"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { AuthError, Session, User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import { supabase } from "./supabase"
import { isProtectedPath } from "./auth/redirect"
import { redirectToLogin } from "./auth/client"

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signUp: (
    email: string,
    password: string,
    fullName: string,
    college: string,
    branch?: string,
    gender?: string,
  ) => Promise<{ error: AuthError | null; needsConfirmation: boolean }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const signingOut = useRef(false)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
      // Session ended without the user asking (expired/revoked refresh token) on a protected page
      if (event === "SIGNED_OUT" && !signingOut.current && isProtectedPath(window.location.pathname)) {
        redirectToLogin(router, "session_expired")
      }
      signingOut.current = false
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [router])

  // The public.users profile row is created by a database trigger from this metadata.
  const signUp = useCallback<AuthContextType["signUp"]>(async (email, password, fullName, college, branch, gender) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: fullName, college, branch: branch || null, gender: gender || null },
      },
    })
    return { error, needsConfirmation: !error && !data.session }
  }, [])

  const signIn = useCallback<AuthContextType["signIn"]>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }, [])

  const signOut = useCallback(async () => {
    signingOut.current = true
    await supabase.auth.signOut()
    setSession(null)
    router.push("/")
    router.refresh()
  }, [router])

  const value = useMemo<AuthContextType>(
    () => ({ user: session?.user ?? null, session, loading, signUp, signIn, signOut }),
    [session, loading, signUp, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
