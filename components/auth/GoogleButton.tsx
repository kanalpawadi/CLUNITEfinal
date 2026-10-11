"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { authCallbackUrl } from "@/lib/env"

export function GoogleButton({ redirectTo, onError }: { redirectTo: string; onError: (message: string) => void }) {
  const [loading, setLoading] = useState(false)

  const signIn = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authCallbackUrl(redirectTo) },
    })
    // On success the browser navigates away; only errors return here.
    if (error) {
      setLoading(false)
      onError(error.message || "Google sign-in is not available right now.")
    }
  }

  return (
    <Button type="button" variant="outline" className="w-full" onClick={signIn} disabled={loading}>
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <svg aria-hidden viewBox="0 0 24 24" className="mr-2 h-4 w-4">
          <path
            fill="currentColor"
            d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.95S8.78 6.28 12 6.28c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.74 14.55 2.8 12 2.8 6.93 2.8 2.83 6.9 2.83 12S6.93 21.2 12 21.2c6.92 0 9.18-4.86 9.18-7.36 0-.5-.05-.87-.12-1.24z"
          />
        </svg>
      )}
      Continue with Google
    </Button>
  )
}
