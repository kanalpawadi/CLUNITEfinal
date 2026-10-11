"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import { Download, FileText, Loader2, Printer, RefreshCw, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { postJson } from "@/lib/api-client"
import { getErrorMessage } from "@/lib/utils"
import type { IdCardTokenResponse } from "@/lib/qr/scan-types"

export type CardMembership = {
  clubId: string
  clubName: string
  role: string
  plan: string | null
  tier: string | null
  memberCode: string | null
  expiresAt: string | null
}

const REFRESH_MARGIN_S = 45

export function IdCard({
  name,
  email,
  avatarUrl,
  memberships,
}: {
  name: string
  email: string
  avatarUrl: string | null
  memberships: CardMembership[]
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState(memberships[0]?.clubId ?? "")
  const [qr, setQr] = useState<{ dataUrl: string; exp: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const [busy, setBusy] = useState<"regen" | "png" | "pdf" | null>(null)
  const membership = memberships.find((m) => m.clubId === selected) ?? null

  const render = useCallback(async (res: IdCardTokenResponse) => {
    // Rendered locally: the token never leaves the browser to a QR service.
    const dataUrl = await QRCode.toDataURL(res.token, { errorCorrectionLevel: "M", margin: 1, width: 320, color: { dark: "#1F1E1D", light: "#FFFFFF" } })
    setQr({ dataUrl, exp: res.exp })
    setError(null)
  }, [])

  const refresh = useCallback(async () => {
    try {
      await render(await postJson<IdCardTokenResponse>("/api/id-card/token", {}))
    } catch (err) {
      setError(getErrorMessage(err, "Could not load your QR code"))
    }
  }, [render])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Countdown + auto-refresh shortly before expiry (and when the tab becomes visible again)
  useEffect(() => {
    const tick = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    const onVisible = () => document.visibilityState === "visible" && void refresh()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      clearInterval(tick)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [refresh])
  useEffect(() => {
    if (qr && qr.exp - now <= REFRESH_MARGIN_S) void refresh()
  }, [now, qr, refresh])

  const secondsLeft = qr ? Math.max(0, qr.exp - now) : 0

  const regenerate = async () => {
    if (!window.confirm("Generate a new QR code? Any screenshot or printout of your old code will stop working.")) return
    setBusy("regen")
    try {
      await render(await postJson<IdCardTokenResponse>("/api/id-card/regenerate", {}))
      toast.success("New QR code issued. Old codes are now invalid.")
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const snapshot = async () => {
    if (!cardRef.current) throw new Error("Card not ready")
    const { toPng } = await import("html-to-image")
    return toPng(cardRef.current, { pixelRatio: 3, cacheBust: true, backgroundColor: "#FFFFFF" })
  }

  const downloadPng = async () => {
    setBusy("png")
    try {
      const a = document.createElement("a")
      a.href = await snapshot()
      a.download = `clunite-id-${membership?.memberCode ?? "card"}.png`
      a.click()
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not create the image"))
    } finally {
      setBusy(null)
    }
  }

  const downloadPdf = async () => {
    setBusy("pdf")
    try {
      const png = await snapshot()
      const { jsPDF } = await import("jspdf")
      // ID-1 card size (85.6 x 54 mm) centred on A4 portrait, with a cut guide
      const doc = new jsPDF({ unit: "mm", format: "a4" })
      const w = 85.6
      const h = (w * (cardRef.current?.offsetHeight ?? 540)) / (cardRef.current?.offsetWidth ?? 856)
      const x = (210 - w) / 2
      doc.setDrawColor(232, 230, 225)
      doc.roundedRect(x - 1, 20 - 1, w + 2, h + 2, 3, 3)
      doc.addImage(png, "PNG", x, 20, w, h)
      doc.setFontSize(8)
      doc.setTextColor(107, 106, 102)
      doc.text("The QR code refreshes every few minutes. Use the live card in the app at check-in.", 105, 20 + h + 8, { align: "center" })
      doc.save(`clunite-id-${membership?.memberCode ?? "card"}.pdf`)
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not create the PDF"))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      {memberships.length > 1 && (
        <div className="print:hidden">
          <label htmlFor="club" className="mb-1.5 block text-sm font-medium text-foreground">
            Show card for
          </label>
          <select
            id="club"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="h-10 w-full max-w-xs rounded-md border border-input bg-card px-3 text-sm"
          >
            {memberships.map((m) => (
              <option key={m.clubId} value={m.clubId}>
                {m.clubName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* The card: also the print layout */}
      <div className="id-card-print mx-auto w-full max-w-md">
        <div
          ref={cardRef}
          className="overflow-hidden rounded-xl border border-border bg-card shadow-soft-lg print:shadow-none"
          aria-label={`Member ID card for ${name}`}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <span className="text-sm font-semibold text-foreground">
              <span aria-hidden className="text-primary">
                ›_
              </span>{" "}
              clunite
            </span>
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Member ID</span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-4 p-5">
            <div className="min-w-0 space-y-3">
              <div className="flex items-center gap-3">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" crossOrigin="anonymous" className="h-14 w-14 rounded-lg border border-border object-cover" />
                ) : (
                  <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted text-xl font-semibold text-primary">
                    {name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">{email}</p>
                </div>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Club</dt>
                <dd className="truncate text-foreground">{membership?.clubName ?? "—"}</dd>
                <dt className="text-muted-foreground">Role</dt>
                <dd className="capitalize text-foreground">{membership?.role ?? "member"}</dd>
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="capitalize text-foreground">{membership?.plan ?? membership?.tier ?? "—"}</dd>
                <dt className="text-muted-foreground">Code</dt>
                <dd className="font-mono tabular-nums text-foreground">{membership?.memberCode ?? "—"}</dd>
              </dl>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-border bg-card p-1 sm:h-36 sm:w-36">
                {qr ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qr.dataUrl} alt="Your check-in QR code" className="h-full w-full" />
                ) : error ? (
                  <ShieldAlert className="h-8 w-8 text-destructive" aria-hidden />
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading QR code" />
                )}
              </div>
              <p className="text-[10px] tabular-nums text-muted-foreground" aria-live="polite">
                {qr ? `refreshes in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : " "}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="mx-auto max-w-md rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive print:hidden">
          {error}{" "}
          <button type="button" onClick={() => void refresh()} className="font-medium underline underline-offset-4">
            Retry
          </button>
        </p>
      )}

      <div className="mx-auto flex max-w-md flex-wrap justify-center gap-2 print:hidden">
        <Button variant="outline" onClick={downloadPng} disabled={!qr || busy !== null}>
          {busy === "png" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-2 h-4 w-4" aria-hidden />}
          PNG
        </Button>
        <Button variant="outline" onClick={downloadPdf} disabled={!qr || busy !== null}>
          {busy === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <FileText className="mr-2 h-4 w-4" aria-hidden />}
          PDF
        </Button>
        <Button variant="outline" onClick={() => window.print()} disabled={!qr}>
          <Printer className="mr-2 h-4 w-4" aria-hidden /> Print
        </Button>
        <Button variant="ghost" onClick={regenerate} disabled={busy !== null}>
          {busy === "regen" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <RefreshCw className="mr-2 h-4 w-4" aria-hidden />}
          Regenerate
        </Button>
      </div>
      <p className="mx-auto max-w-md text-center text-xs text-muted-foreground print:hidden">
        Your QR changes every few minutes and contains no personal details. Downloads and printouts expire too, so
        show the live card at check-in. Regenerate if you think someone copied your code.
      </p>
    </div>
  )
}
