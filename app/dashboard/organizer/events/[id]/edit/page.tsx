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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard/organizer/host/analytics">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Analytics
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Event</h1>
            <p className="text-gray-600 mt-1">Update your event details</p>
          </div>
        </div>

        <EventEditForm event={event} />
      </div>
    </div>
  )
}
