"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { FileText, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { supabase } from "@/lib/supabase"
import { RESUME_MAX_BYTES } from "@/lib/opportunities"
import { getErrorMessage } from "@/lib/utils"

const schema = z.object({
  cover_note: z.string().trim().max(3000),
  phone: z.union([z.literal(""), z.string().trim().regex(/^[+\d][\d\s-]{6,19}$/, "Enter a valid phone number")]),
  portfolio_url: z.union([z.literal(""), z.string().trim().regex(/^https?:\/\/\S+$/i, "Enter a link starting with https://").max(500)]),
})

export function ApplyForm({ opportunityId, userId, defaultPhone }: { opportunityId: string; userId: string; defaultPhone: string }) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [note, setNote] = useState("")
  const [phone, setPhone] = useState(defaultPhone)
  const [portfolio, setPortfolio] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = schema.safeParse({ cover_note: note, phone, portfolio_url: portfolio })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Check the form")
    if (!file) return setError("Attach your résumé (PDF)")
    if (file.type !== "application/pdf") return setError("Résumé must be a PDF")
    if (file.size > RESUME_MAX_BYTES) return setError("Résumé must be under 5MB")
    setError(null)
    setBusy(true)
    try {
      // Storage policy: users can only write to resumes/<their id>/
      const path = `${userId}/${crypto.randomUUID()}.pdf`
      const { error: upErr } = await supabase.storage.from("resumes").upload(path, file, { contentType: "application/pdf", upsert: false })
      if (upErr) throw upErr
      const v = parsed.data
      const { error: insErr } = await supabase.from("opportunity_applications").insert({
        opportunity_id: opportunityId,
        user_id: userId,
        resume_path: path,
        cover_note: v.cover_note || null,
        phone: v.phone || null,
        portfolio_url: v.portfolio_url || null,
      })
      if (insErr) {
        await supabase.storage.from("resumes").remove([path])
        throw insErr.code === "23505" ? new Error("You've already applied") : insErr
      }
      toast.success("Application sent!")
      router.refresh()
    } catch (err) {
      setError(getErrorMessage(err, "Could not submit your application"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      <div className="space-y-1.5">
        <Label htmlFor="resume">Résumé (PDF, max 5MB) *</Label>
        <Input
          id="resume"
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-sm"
        />
        {file && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="h-3.5 w-3.5" aria-hidden /> {file.name}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="portfolio">Portfolio / GitHub / LinkedIn</Label>
          <Input id="portfolio" type="url" value={portfolio} onChange={(e) => setPortfolio(e.target.value)} placeholder="https://" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">Why you? (optional)</Label>
        <Textarea id="note" rows={5} maxLength={3000} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button type="submit" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
        Submit application
      </Button>
    </form>
  )
}

export function WithdrawButton({ applicationId, resumePath }: { applicationId: string; resumePath: string | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const withdraw = async () => {
    if (!window.confirm("Withdraw your application?")) return
    setBusy(true)
    const { error } = await supabase.from("opportunity_applications").delete().eq("id", applicationId)
    if (!error && resumePath) await supabase.storage.from("resumes").remove([resumePath])
    setBusy(false)
    if (error) toast.error(getErrorMessage(error, "Could not withdraw"))
    else {
      toast.success("Application withdrawn")
      router.refresh()
    }
  }
  return (
    <Button variant="outline" onClick={withdraw} disabled={busy}>
      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
      Withdraw application
    </Button>
  )
}
