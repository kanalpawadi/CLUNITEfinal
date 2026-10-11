import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { EventEditForm } from "@/components/events/EventEditForm"
import Link from "next/link"

async function getEvent(eventId: string) {
  const supabase = createClient()

  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single()

  return event
}

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const event = await getEvent(params.id)

  if (!event) {
    return <div>Event not found</div>
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/organizer/host/analytics">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Analytics
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Edit Event</h1>
            <p className="text-muted-foreground mt-1">Update your event details</p>
          </div>
        </div>

        <EventEditForm event={event} />
      </div>
    </div>
  )
}
