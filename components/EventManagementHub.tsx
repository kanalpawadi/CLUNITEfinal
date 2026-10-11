"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Users, 
  Calendar, 
  IndianRupee, 
  MapPin, 
  Search, 
  Plus, 
  XCircle, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Eye, 
  Edit, 
  Trash2,
  UserCheck
} from "lucide-react"
import { EventImage } from "./EventImage"
import Link from "next/link"
import { supabase, type Tables } from "@/lib/supabase"

type Event = Tables<"events"> 

export default function EventManagementHub() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOrganizerEvents()
  }, [])

  const fetchOrganizerEvents = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError("Please log in to view your events")
        return
      }

      // Fetch events created by this organizer
      const { data, error: fetchError } = await supabase
        .from("events")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false })

      if (fetchError) throw fetchError

      setEvents(data || [])
    } catch (err) {
      console.error("Error fetching organizer events:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-success/10 text-success border-success/20"
      case "draft":
        return "bg-muted text-foreground border-border"
      case "completed":
        return "bg-primary/10 text-primary border-primary/20"
      case "cancelled":
        return "bg-destructive/10 text-destructive border-destructive/20"
      default:
        return "bg-muted text-foreground border-border"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "published":
        return <CheckCircle className="h-4 w-4" />
      case "draft":
        return <Clock className="h-4 w-4" />
      case "completed":
        return <CheckCircle className="h-4 w-4" />
      case "cancelled":
        return <XCircle className="h-4 w-4" />
      default:
        return <Clock className="h-4 w-4" />
    }
  }

  const filteredEvents = events.filter(event =>
    event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (event.type ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <Card className="border-0 shadow-soft-lg bg-card">
        <CardContent className="p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your events...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-0 shadow-soft-lg bg-card">
        <CardContent className="p-12 text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={fetchOrganizerEvents}>Try Again</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Modern Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Events</h1>
          <p className="text-muted-foreground mt-1">Manage and track all your events</p>
        </div>
        <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
          <Link href="/dashboard/organizer/host">
            <Plus className="h-5 w-5 mr-2" />
            Create New Event
          </Link>
        </Button>
      </div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-soft bg-primary text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary-foreground/80">Total Events</p>
                <p className="text-3xl font-bold mt-2">{events.length}</p>
              </div>
              <div className="p-3 bg-card/20 rounded-lg">
                <Calendar className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-soft bg-success text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary-foreground/80">Published</p>
                <p className="text-3xl font-bold mt-2">{events.filter(e => e.status === 'published').length}</p>
              </div>
              <div className="p-3 bg-card/20 rounded-lg">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-soft bg-primary text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary-foreground/80">Participants</p>
                <p className="text-3xl font-bold mt-2">{events.reduce((sum, e) => sum + e.current_participants, 0)}</p>
              </div>
              <div className="p-3 bg-card/20 rounded-lg">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-none shadow-soft bg-primary text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary-foreground/80">Drafts</p>
                <p className="text-3xl font-bold mt-2">{events.filter(e => e.status === 'draft').length}</p>
              </div>
              <div className="p-3 bg-card/20 rounded-lg">
                <Clock className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
        <Input 
          placeholder="Search events..." 
          className="pl-10 h-11"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No events found</h3>
            <p className="text-muted-foreground mb-6 text-center max-w-sm">
              {searchQuery ? "Try adjusting your search terms" : "Get started by creating your first event"}
            </p>
            {!searchQuery && (
              <Button asChild>
                <Link href="/dashboard/organizer/host">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Event
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <Card key={event.id} className="overflow-hidden hover:shadow-soft-lg transition-shadow duration-300">
              {/* Event Image */}
              <div className="relative h-48 overflow-hidden">
                <EventImage
                  src={event.image_url}
                  alt={event.title}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  fallbackClassName="w-full h-full flex items-center justify-center bg-background"
                />
                <div className="absolute top-3 right-3">
                  <Badge className={`${getStatusColor(event.status)} shadow-soft-lg`}>
                    <div className="flex items-center gap-1">
                      {getStatusIcon(event.status)}
                      <span className="capitalize">{event.status}</span>
                    </div>
                  </Badge>
                </div>
              </div>

              {/* Event Content */}
              <CardContent className="p-5">
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-foreground mb-2 line-clamp-1">{event.title}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {event.description}
                  </p>
                </div>

                {/* Event Meta */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>{new Date(event.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 text-success" />
                    <span className="truncate">{event.venue || `${event.mode} event`}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <IndianRupee className="h-4 w-4 text-warning" />
                      <span>{event.fee === 0 ? "Free" : `₹${event.fee}`}</span>
                    </div>
                    <Badge variant="outline" className="capitalize">{event.type}</Badge>
                  </div>
                </div>

                {/* Participants */}
                <div className="flex items-center justify-between p-3 bg-background rounded-lg mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">Participants</p>
                      <p className="text-lg font-bold text-foreground">
                        {event.current_participants}{event.capacity && `/${event.capacity}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button asChild variant="outline" className="w-full" size="sm">
                    <Link href={`/dashboard/organizer/events/${event.id}/participants`} className="flex-1">
                      <UserCheck className="h-4 w-4 mr-2" />
                      View Participants
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
