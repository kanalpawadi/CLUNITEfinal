import type { Metadata } from "next"
import { IdCardSection } from "@/components/idcard/IdCardSection"

export const metadata: Metadata = { title: "My QR · Clunite" }

export default function StudentQrPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-foreground print:hidden">My QR code</h1>
      <p className="mb-8 mt-1 text-sm text-muted-foreground print:hidden">
        Show this at event entrances. Organizers scan it to check you in, which also unlocks your certificate.
      </p>
      <IdCardSection returnPath="/dashboard/student/qr" />
    </div>
  )
}
