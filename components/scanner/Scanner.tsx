"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { Camera, CameraOff, CheckCircle2, Clock, Keyboard, Loader2, ShieldX, TriangleAlert, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { postJson } from "@/lib/api-client"
import { getErrorMessage } from "@/lib/utils"
import type { ScanOutcome, ScanResponse } from "@/lib/qr/scan-types"

export type ScannableEvent = { id: string; title: string; clubName: string; startsAt: string; attendance: number }

type CameraState = "idle" | "starting" | "running" | "denied" | "unavailable" | "error"

type Html5QrcodeLike = { start: (...args: unknown[]) => Promise<unknown>; stop: () => Promise<void>; clear: () => void; isScanning: boolean }

const tone: Record<ScanOutcome, "ok" | "warn" | "bad"> = {
  checked_in: "ok",
  already_checked_in: "warn",
  invalid: "bad",
  expired: "bad",
  revoked: "bad",
  wrong_event: "bad",
  not_registered: "bad",
  unpaid: "bad",
  membership_inactive: "bad",
}

/** Short beep + vibration so staff don't have to look at the screen. */
function feedback(kind: "ok" | "warn" | "bad") {
  try {
    const AudioCtx = window.AudioContext
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = kind === "ok" ? 880 : kind === "warn" ? 520 : 220
    gain.gain.value = 0.08
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (kind === "ok" ? 0.12 : 0.3))
    osc.onended = () => void ctx.close()
  } catch {
    // audio not available: ignore
  }
  navigator.vibrate?.(kind === "ok" ? 60 : kind === "warn" ? [60, 60, 60] : [200, 80, 200])
}

export function Scanner({ events, initialEventId }: { events: ScannableEvent[]; initialEventId?: string }) {
  const regionId = useId().replace(/:/g, "")
  const scannerRef = useRef<Html5QrcodeLike | null>(null)
  const lastToken = useRef<{ token: string; at: number } | null>(null)
  const busyRef = useRef(false)

  const [eventId, setEventId] = useState(initialEventId && events.some((e) => e.id === initialEventId) ? initialEventId : (events[0]?.id ?? ""))
  const [camera, setCamera] = useState<CameraState>("idle")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [manual, setManual] = useState("")
  const [result, setResult] = useState<ScanResponse | null>(null)
  const [checking, setChecking] = useState(false)
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(events.map((e) => [e.id, e.attendance])))
  const event = events.find((e) => e.id === eventId)

  const submit = useCallback(
    async (token: string) => {
      const trimmed = token.trim()
      if (!trimmed || !eventId || busyRef.current) return
      // Ignore the same code read repeatedly by the camera within 4 seconds
      const now = Date.now()
      if (lastToken.current && lastToken.current.token === trimmed && now - lastToken.current.at < 4000) return
      lastToken.current = { token: trimmed, at: now }

      busyRef.current = true
      setChecking(true)
      try {
        const res = await postJson<ScanResponse>("/api/attendance/scan", { token: trimmed, eventId })
        setResult(res)
        feedback(tone[res.outcome])
        if (res.attendanceCount !== undefined) setCounts((c) => ({ ...c, [eventId]: res.attendanceCount ?? c[eventId] ?? 0 }))
      } catch (err) {
        setResult({ outcome: "invalid", message: getErrorMessage(err, "Scan failed. Check your connection.") })
        feedback("bad")
      } finally {
        busyRef.current = false
        setChecking(false)
      }
    },
    [eventId],
  )

  const stopCamera = useCallback(async () => {
    const s = scannerRef.current
    scannerRef.current = null
    if (s) {
      try {
        if (s.isScanning) await s.stop()
        s.clear()
      } catch {
        // already stopped
      }
    }
    setCamera("idle")
  }, [])

  const startCamera = async () => {
    setCameraError(null)
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCamera("unavailable")
      setCameraError("Camera access needs HTTPS (or localhost). Use manual entry below.")
      return
    }
    setCamera("starting")
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode")
      const scanner = new Html5Qrcode(regionId, { formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], verbose: false })
      scannerRef.current = scanner as unknown as Html5QrcodeLike
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: (w: number, h: number) => ({ width: Math.min(w, h, 280) * 0.85, height: Math.min(w, h, 280) * 0.85 }) },
        (decoded: string) => void submit(decoded),
        () => undefined, // per-frame "no QR found" callbacks are expected; ignore
      )
      setCamera("running")
    } catch (err) {
      scannerRef.current = null
      const message = getErrorMessage(err, String(err))
      if (/NotAllowed|Permission|denied/i.test(message)) {
        setCamera("denied")
        setCameraError("Camera permission was denied. Allow camera access in your browser's site settings, then try again, or type the code below.")
      } else if (/NotFound|no camera|Requested device not found/i.test(message)) {
        setCamera("unavailable")
        setCameraError("No camera found on this device. Use manual entry below.")
      } else if (/NotReadable|in use/i.test(message)) {
        setCamera("error")
        setCameraError("The camera is being used by another app. Close it and try again.")
      } else {
        setCamera("error")
        setCameraError("Couldn't start the camera. Try again or use manual entry.")
      }
    }
  }

  useEffect(() => () => void stopCamera(), [stopCamera])

  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
        No upcoming or ongoing events you can scan for. Events appear here from 2 days before until 1 day after they start.
      </p>
    )
  }

  const t = result ? tone[result.outcome] : null
  const panel = {
    ok: "border-success/40 bg-success/10 text-success",
    warn: "border-warning/40 bg-warning/10 text-warning",
    bad: "border-destructive/40 bg-destructive/10 text-destructive",
  } as const
  const Icon = t === "ok" ? CheckCircle2 : t === "warn" ? Clock : result?.outcome === "invalid" ? ShieldX : TriangleAlert

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <div>
          <Label htmlFor="scan-event">Event</Label>
          <select
            id="scan-event"
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value)
              setResult(null)
              lastToken.current = null
            }}
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} · {e.clubName}
              </option>
            ))}
          </select>
        </div>

        <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-border bg-foreground">
          <div id={regionId} className="absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
          {camera !== "running" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted p-6 text-center">
              {camera === "starting" ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Starting camera" />
              ) : (
                <>
                  {camera === "idle" ? <Camera className="h-8 w-8 text-muted-foreground" aria-hidden /> : <CameraOff className="h-8 w-8 text-destructive" aria-hidden />}
                  {cameraError && <p className="max-w-xs text-sm text-foreground">{cameraError}</p>}
                  <Button onClick={startCamera}>{camera === "idle" ? "Start camera" : "Try again"}</Button>
                </>
              )}
            </div>
          )}
        </div>
        {camera === "running" && (
          <Button variant="outline" onClick={() => void stopCamera()}>
            <CameraOff className="mr-2 h-4 w-4" aria-hidden /> Stop camera
          </Button>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            lastToken.current = null
            void submit(manual)
          }}
          className="space-y-2 rounded-xl border border-border bg-card p-4"
        >
          <Label htmlFor="manual-token" className="flex items-center gap-2">
            <Keyboard className="h-4 w-4" aria-hidden /> Manual entry
          </Label>
          <Textarea
            id="manual-token"
            rows={2}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Paste the code (starts with CLU1.)"
            className="font-mono text-xs"
          />
          <Button type="submit" disabled={checking || !manual.trim()}>
            {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Check in
          </Button>
        </form>
      </div>

      <aside className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4" aria-hidden /> Checked in
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-foreground">{counts[eventId] ?? 0}</p>
          {event && (
            <Link href={`/admin/events/${event.id}/attendance`} className="mt-2 inline-block text-sm text-primary underline-offset-4 hover:underline">
              View attendance list
            </Link>
          )}
        </div>

        <div aria-live="assertive" aria-atomic="true">
          {checking && !result && (
            <p className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking…
            </p>
          )}
          {result && t && (
            <div className={`rounded-xl border p-4 ${panel[t]}`}>
              <p className="flex items-center gap-2 text-base font-semibold">
                <Icon className="h-5 w-5 shrink-0" aria-hidden /> {result.message}
              </p>
              {result.attendee && (
                <div className="mt-3 flex items-center gap-3 text-foreground">
                  {result.attendee.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.attendee.avatarUrl} alt="" className="h-12 w-12 rounded-lg border border-border object-cover" />
                  ) : (
                    <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-lg bg-card font-semibold text-primary">
                      {result.attendee.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{result.attendee.name}</p>
                    <p className="text-muted-foreground">
                      {[result.attendee.memberCode, result.attendee.plan].filter(Boolean).join(" · ") || "Not a club member"}
                    </p>
                    {result.checkedInAt && result.outcome === "already_checked_in" && (
                      <p className="text-muted-foreground">at {new Date(result.checkedInAt).toLocaleTimeString()}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
