import "server-only"
import { headers } from "next/headers"
import QRCode from "qrcode"
import { requireServerEnv } from "@/lib/env.server"
import { publicEnv } from "@/lib/env"
import { signCertificateToken } from "./token.ts"

export type CertificateData = {
  attendanceId: string
  certificateNo: string
  studentName: string
  eventName: string
  eventDate: string
  clubName: string
  facultyCoordinator: string | null
  hodName: string | null
  verifyUrl: string
  qrDataUrl: string
}

/** Public origin for verification links (works behind proxies and on preview deployments). */
export function requestOrigin(): string {
  const h = headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https")
  return host ? `${proto}://${host}` : (publicEnv.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001")
}

/** Human-friendly certificate number derived from the attendance id. */
export const certificateNumber = (attendanceId: string) => `CLU-${attendanceId.replace(/-/g, "").slice(0, 10).toUpperCase()}`

export async function buildCertificate(input: Omit<CertificateData, "certificateNo" | "verifyUrl" | "qrDataUrl">, origin: string) {
  const token = signCertificateToken(input.attendanceId, requireServerEnv("QR_SIGNING_SECRET"))
  const verifyUrl = `${origin}/verify/certificate/${token}`
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
    color: { dark: "#1F1E1D", light: "#FFFFFF" },
  })
  return { ...input, certificateNo: certificateNumber(input.attendanceId), verifyUrl, qrDataUrl } satisfies CertificateData
}
