"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { getErrorMessage } from "@/lib/utils"

const schema = z.object({
  faculty: z.string().trim().max(200),
  hod: z.string().trim().max(200),
})

/** Names printed on participation certificates (owner/admin can edit; RLS enforces it). */
export function ClubSignatories({
  club,
  canEdit,
}: {
  club: { id: string; faculty_in_charge: string | null; hod_name: string | null }
  canEdit: boolean
}) {
  const router = useRouter()
  const [faculty, setFaculty] = useState(club.faculty_in_charge ?? "")
  const [hod, setHod] = useState(club.hod_name ?? "")
  const [saving, setSaving] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const v = schema.parse({ faculty, hod })
    setSaving(true)
    const { error } = await supabase
      .from("clubs")
      .update({ faculty_in_charge: v.faculty || null, hod_name: v.hod || null })
      .eq("id", club.id)
    setSaving(false)
    if (error) toast.error(getErrorMessage(error, "Could not save"))
    else {
      toast.success("Certificate signatories saved")
      router.refresh()
    }
  }

  return (
    <form onSubmit={save} className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="faculty">Faculty coordinator</Label>
        <Input id="faculty" value={faculty} onChange={(e) => setFaculty(e.target.value)} disabled={!canEdit} maxLength={200} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="hod">Head of department (HOD)</Label>
        <Input id="hod" value={hod} onChange={(e) => setHod(e.target.value)} disabled={!canEdit} maxLength={200} />
      </div>
      {canEdit && (
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          Save
        </Button>
      )}
    </form>
  )
}
