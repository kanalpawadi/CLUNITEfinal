"use client"

import { useState, useEffect } from "react"
import type { User as DbUser } from '@/lib/supabase';
import { useAuth } from "@/lib/auth-context"
import { getUserFromDatabase } from "@/lib/sync-user"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Calendar,
  Users,
  Search,
  Plus,
  MapPin,
  Clock,
  UserCheck,
  UserX,
  Eye,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import { useOrganizerEvents } from "@/hooks/useEventParticipants"

export default function OrganizerDashboardPage() {
  const { user: authUser, loading: authLoading } = useAuth()
  const [userData, setUserData] = useState<DbUser | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null)
  const { events, userClubs, loading, error } = useOrganizerEvents(authUser?.id)

  useEffect(() => {
    async function loadUserData() {
      if (authUser) {
        const dbUser = await getUserFromDatabase(authUser.id)
        setUserData(dbUser)
      }
    }
    
    if (!authLoading) {
      loadUserData()
    }
  }, [authUser, authLoading])

  // Auto-select first club when clubs load - but don't auto-select if no clubs
  useEffect(() => {
    if (userClubs && userClubs.length > 0 && !selectedClubId) {
      // Don't auto-select, let user see all events by default
      // setSelectedClubId(userClubs[0].id)
    }
  }, [userClubs])

  // Filter by selected club and search term
  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    // If no club is selected, show all events
    // If a club is selected, only show events from that club
    const matchesClub = !selectedClubId || event.club_id === selectedClubId
    
    return matchesSearch && matchesClub
  })
  
  console.log('Filtered events:', filteredEvents.length, 'out of', events.length)
  console.log('Selected club ID:', selectedClubId)
  console.log('User clubs:', userClubs)

  // Calculate stats ONLY for filtered events (selected club)
  const totalParticipants = filteredEvents.reduce((sum, event) => sum + event.participantStats.total, 0)
  const totalRegistered = filteredEvents.reduce((sum, event) => sum + event.participantStats.registered, 0)
  const totalAttended = filteredEvents.reduce((sum, event) => sum + event.participantStats.attended, 0)

  const getStatusColor = (status: string) => {
    switch (status) {
      case "upcoming":
        return "bg-primary/10 text-primary border-primary/20"
      case "ongoing":
        return "bg-success/10 text-success border-success/20"
      case "completed":
        return "bg-muted text-foreground border-border"
      default:
        return "bg-muted text-foreground border-border"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading events...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">Error loading events: {error}</p>
          <Button className="bg-primary hover:bg-primary" onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Enhanced Header */}
        <div className="bg-primary rounded-2xl p-8 text-primary-foreground relative overflow-hidden shadow-soft-lg">
          <div className="absolute top-0 right-0 w-32 h-32 bg-card/10 rounded-full -translate-y-16 translate-x-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-card/5 rounded-full translate-y-12 -translate-x-12"></div>
          <div className="relative">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Event Participants Dashboard</h1>
                <p className="text-primary-foreground/90 text-lg">View and manage participants for all events</p>
              </div>
              <div className="flex items-center space-x-3">
                <Button asChild className="bg-card/20 hover:bg-accent/30 text-primary-foreground border border-border/30 font-semibold px-6 py-3 rounded-lg hover:scale-105 transition-all duration-300">
                  <Link href="/dashboard/organizer/host">
                    <Plus className="h-5 w-5 mr-2" />
                    Event Management Hub
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* No Clubs Message */}
        {userClubs && userClubs.length === 0 && (
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-6 text-center">
              <p className="text-primary font-medium mb-2">You are not an admin of any clubs yet</p>
              <p className="text-primary text-sm mb-4">Create a club or verify with a PIN to get started</p>
              <Button asChild className="bg-primary hover:bg-primary">
                <Link href="/dashboard/organizer/create-club">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Club
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border border-border shadow-soft hover:shadow-soft hover:border-primary transition-all duration-300 bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-primary text-primary-foreground">
                  <Calendar className="h-6 w-6" />
                </div>
                <Badge className="bg-primary/5 text-primary border-primary/20">Total</Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Total Events</p>
                <p className="text-3xl font-bold text-foreground">{filteredEvents.length}</p>
                <p className="text-xs text-muted-foreground">{selectedClubId ? 'For selected club' : 'All your clubs'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-soft hover:shadow-soft hover:border-primary transition-all duration-300 bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-primary text-primary-foreground">
                  <Users className="h-6 w-6" />
                </div>
                <Badge className="bg-primary/5 text-primary border-primary/20">Club Stats</Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Total Participants</p>
                <p className="text-3xl font-bold text-foreground">{totalParticipants}</p>
                <p className="text-xs text-muted-foreground">{selectedClubId ? 'For selected club' : 'All your clubs'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border shadow-soft hover:shadow-soft hover:border-primary transition-all duration-300 bg-card">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 rounded-lg bg-success text-primary-foreground">
                  <UserCheck className="h-6 w-6" />
                </div>
                <Badge className="bg-success/5 text-success border-success/20">Active</Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Registered</p>
                <p className="text-3xl font-bold text-foreground">{totalRegistered}</p>
                <p className="text-xs text-muted-foreground">Currently registered</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Events List */}
        <Card className="border border-border shadow-soft bg-card">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-xl font-bold text-foreground">All Events</CardTitle>
                <CardDescription className="text-muted-foreground">View participants for each event</CardDescription>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredEvents.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">No events found</p>
                <p className="text-muted-foreground text-sm">Try adjusting your search or create a new event</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center justify-between p-6 border border-border rounded-xl hover:shadow-soft hover:border-primary transition-all duration-300"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">
                        {event.title.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-foreground text-lg">{event.title}</div>
                        <div className="flex items-center space-x-3 text-sm text-muted-foreground">
                          <div className="flex items-center">
                            <MapPin className="h-4 w-4 mr-1" />
                            <span>{event.venue || 'Location TBD'}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            <span>{formatDate(event.starts_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <div className="text-lg font-bold text-foreground">{event.participantStats.total}</div>
                        <div className="text-sm text-muted-foreground">Total Participants</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1 text-xs">
                          <UserCheck className="h-3 w-3 text-success" />
                          <span className="text-success font-medium">{event.participantStats.registered}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-xs">
                          <UserX className="h-3 w-3 text-destructive" />
                          <span className="text-destructive font-medium">{event.participantStats.cancelled}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-xs">
                          <Users className="h-3 w-3 text-primary" />
                          <span className="text-primary font-medium">{event.participantStats.attended}</span>
                        </div>
                      </div>
                      <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                        <Link href={`/dashboard/organizer/events/${event.id}/participants`}>
                          <Eye className="h-4 w-4 mr-2" />
                          View Participants
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
