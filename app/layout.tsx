import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { AuthProvider } from "@/lib/auth-context"
import { Toaster } from "sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "Clunite · Campus clubs and events",
  description: "Join clubs, register for events and check in with a QR member ID.",
}

export const viewport: Viewport = {
  themeColor: "hsl(var(--border))",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
  <html lang="en" className={GeistMono.variable}>
  <body>
  <a
  href="#main"
  className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:text-sm focus:shadow-soft-lg"
  >
  Skip to content
  </a>
  <AuthProvider>
  <Suspense fallback={null}>{children}</Suspense>
  <Toaster
  position="top-center"
  visibleToasts={3}
  toastOptions={{
  classNames: {
  toast: "!bg-card !text-foreground !border !border-border !shadow-soft-lg !font-sans",
  description: "!text-muted-foreground",
  error: "!text-destructive",
  success: "!text-success",
  },
  }}
  />
  </AuthProvider>
  <Analytics />
  </body>
  </html>
  )
}
