import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { SiteHeader } from "@/components/site/SiteHeader"
import { IdCardSection } from "@/components/idcard/IdCardSection"

export const metadata: Metadata = { title: "ID card · Clunite" }

export default function IdCardPage() {
  return (
    <>
      <div className="print:hidden">
        <SiteHeader />
      </div>
      <main id="main" className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/profile" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Profile
        </Link>
        <h1 className="mt-4 text-2xl font-semibold text-foreground print:hidden">Your ID card</h1>
        <p className="mt-1 text-sm text-muted-foreground print:hidden">
          Show this at event entrances. Staff scan the QR to check you in.
        </p>
        <div className="mt-8">
          <IdCardSection returnPath="/profile/id-card" />
        </div>
      </main>
    </>
  )
}
