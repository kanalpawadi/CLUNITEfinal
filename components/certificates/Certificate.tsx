"use client"

import { useRef, useState } from "react"
import { Download, FileText, Loader2, Printer } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { getErrorMessage } from "@/lib/utils"
import type { CertificateData } from "@/lib/certificates/server"

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })

function Signature({ name, title }: { name: string | null; title: string }) {
  return (
    <div className="min-w-0 text-center">
      <p className="truncate font-semibold text-foreground" style={{ fontSize: "14px" }}>
        {name ?? "—"}
      </p>
      <div className="mx-auto my-1 h-px w-full max-w-[180px] bg-foreground/60" />
      <p className="uppercase tracking-wider text-muted-foreground" style={{ fontSize: "11px" }}>
        {title}
      </p>
    </div>
  )
}

/** One participation certificate with a QR that links to the public verification page. */
export function Certificate({ data }: { data: CertificateData }) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState<"png" | "pdf" | null>(null)
  const fileBase = `certificate-${data.certificateNo}`

  const snapshot = async () => {
    if (!ref.current) throw new Error("Certificate not ready")
    const { toPng } = await import("html-to-image")
    return toPng(ref.current, { pixelRatio: 3, cacheBust: true, backgroundColor: "#FFFFFF" })
  }

  const downloadPng = async () => {
    setBusy("png")
    try {
      const a = document.createElement("a")
      a.href = await snapshot()
      a.download = `${fileBase}.png`
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
      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" })
      const margin = 12
      const w = 297 - margin * 2
      const h = (w * (ref.current?.offsetHeight ?? 707)) / (ref.current?.offsetWidth ?? 1000)
      doc.addImage(png, "PNG", margin, (210 - h) / 2, w, h)
      doc.save(`${fileBase}.pdf`)
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not create the PDF"))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      {/* Keeps the printed proportions; scrolls inside this frame on narrow screens */}
      <div className="certificate-print overflow-x-auto rounded-xl print:overflow-visible">
        <div
          ref={ref}
          role="img"
          aria-label={`Certificate of participation for ${data.studentName}, ${data.eventName}, organised by ${data.clubName}`}
          className="relative aspect-[1.414/1] w-full min-w-[680px] overflow-hidden rounded-xl border border-border bg-card shadow-soft-lg print:rounded-none print:shadow-none"
        >
          {/* inner frame */}
          <div className="absolute inset-[3%] rounded-lg border-2 border-primary/40" aria-hidden />
          <div className="absolute inset-[4%] rounded-md border border-border" aria-hidden />

          <div className="absolute inset-[7%] flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <p className="font-semibold text-foreground" style={{ fontSize: "15px" }}>
                <span className="text-primary">›_</span> clunite
              </p>
              <p className="font-mono text-muted-foreground" style={{ fontSize: "11px" }}>
                No. {data.certificateNo}
              </p>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <p className="uppercase tracking-[0.3em] text-primary" style={{ fontSize: "13px" }}>
                Certificate of Participation
              </p>
              <p className="mt-[2%] text-muted-foreground" style={{ fontSize: "13px" }}>
                This is to certify that
              </p>
              <p className="mt-[1%] max-w-full truncate font-semibold text-foreground" style={{ fontSize: "36px" }}>
                {data.studentName}
              </p>
              <div className="mx-auto mt-[1%] h-px w-1/2 bg-border" aria-hidden />
              <p className="mt-[2%] max-w-[85%] text-muted-foreground" style={{ fontSize: "14px", lineHeight: 1.6 }}>
                participated in <span className="font-semibold text-foreground">{data.eventName}</span>, organised by{" "}
                <span className="font-semibold text-foreground">{data.clubName}</span>, held on{" "}
                <span className="text-foreground">{dateFmt.format(new Date(data.eventDate))}</span>.
              </p>
            </div>

            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-[4%]">
              <Signature name={data.facultyCoordinator} title="Faculty Coordinator" />
              <Signature name={data.hodName} title="Head of Department" />
              <div className="flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.qrDataUrl} alt="QR code to verify this certificate" className="aspect-square w-[104px] rounded border border-border" />
                <p className="mt-1 text-muted-foreground" style={{ fontSize: "10px" }}>
                  Scan to verify
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={downloadPng} disabled={busy !== null}>
          {busy === "png" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Download className="mr-2 h-4 w-4" aria-hidden />}
          PNG
        </Button>
        <Button variant="outline" size="sm" onClick={downloadPdf} disabled={busy !== null}>
          {busy === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <FileText className="mr-2 h-4 w-4" aria-hidden />}
          PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" aria-hidden /> Print
        </Button>
        <a href={data.verifyUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">
          Open verification page
        </a>
      </div>
    </div>
  )
}
