"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar } from "lucide-react"

export default function MyHostedEventsPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to main organizer dashboard since this page is no longer needed
    router.push("/dashboard/organizer")
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="border-0 shadow-soft-lg bg-card max-w-md">
        <CardContent className="p-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Redirecting to dashboard...</p>
        </CardContent>
      </Card>
    </div>
  )
}
