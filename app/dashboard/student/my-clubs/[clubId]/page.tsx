"use client"

import { useState } from "react"
import { ArrowLeft, Users, Calendar, Star, MapPin, Clock, Trophy, ExternalLink, Plus, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useClub, joinClubInstant, leaveClubInstant } from "@/hooks/useClubs"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

export default function ClubProfilePage() {
  const params = useParams()
  const router = useRouter()
  const clubId = params.clubId as string
  const { club, events, loading, error, refetch } = useClub(clubId)
  const [activeTab, setActiveTab] = useState("overview")
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  }

  const getEventTypeColor = (type: string) => {
    const colors = {
      workshop: "bg-primary/10 text-primary border-primary/20",
      competition: "bg-destructive/10 text-destructive border-destructive/20",
      seminar: "bg-success/10 text-success border-success/20",
      cultural: "bg-primary/10 text-primary border-primary/20",
      sports: "bg-primary/10 text-primary border-primary/20",
      technical: "bg-primary/10 text-primary border-primary/20",
    }
    return colors[type as keyof typeof colors] || "bg-muted text-foreground border-border"
  }

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "online":
        return "🌐"
      case "offline":
        return "📍"
      case "hybrid":
        return "🔄"
      default:
        return "📅"
    }
  }

  // Separate upcoming and past events
  const now = new Date()
  const upcomingEvents = events.filter((event) => new Date(event.starts_at) > now)
  const pastEvents = events.filter((event) => new Date(event.starts_at) <= now)

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !club) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-destructive text-lg font-semibold mb-2">Error loading club</div>
          <div className="text-muted-foreground mb-4">{error || "Club not found"}</div>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Back Button */}
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="icon" onClick={() => router.back()} className="rounded-xl hover:bg-accent">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm text-muted-foreground font-medium">Back to My Clubs</div>
      </div>

      {/* Club Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border">
        {/* Banner Background */}
        {club.banner_url ? (
          <>
            <div className="absolute inset-0">
              <img 
                src={club.banner_url} 
                alt={club.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute inset-0 bg-foreground/60"></div>
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-background"></div>

          </>
        )}
        <div className="relative p-8 md:p-12">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
            {/* Club Logo */}
            <div className="relative">
              <div className="w-24 h-24 bg-primary rounded-3xl flex items-center justify-center text-primary-foreground font-black text-4xl shadow-soft-lg">
                {club.name.charAt(0)}
              </div>
              {club.is_verified && (
                <div className="absolute -top-2 -right-2">
                  <Badge className="bg-success text-primary-foreground border-success font-bold px-2 py-1">✓</Badge>
                </div>
              )}
            </div>

            {/* Club Info */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <h1 className="text-4xl font-black text-primary-foreground drop-shadow-lg">{club.name}</h1>
                  <Badge variant="secondary" className="bg-card/90 text-foreground font-semibold">
                    {club.category}
                  </Badge>
                </div>
                <p className="text-lg text-primary-foreground drop-shadow-md max-w-2xl leading-relaxed">{club.description}</p>
              </div>

              {/* Club Stats */}
              <div className="flex flex-wrap items-center gap-6 text-primary-foreground drop-shadow-md">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5" />
                  <span className="font-semibold">{club.members_count} members</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span className="font-semibold">{club.events_hosted_count} events hosted</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Star className="h-5 w-5 text-warning fill-current" />
                  <span className="font-semibold">{club.credibility_score?.toFixed?.(1) ?? "0.0"} rating</span>
                </div>
                <div className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span className="font-semibold">{club.college}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col space-y-3">
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8"
                disabled={joining}
                onClick={async () => {
                  try {
                    setJoining(true)
                    // TODO: replace with real current user id from auth
                    const CURRENT_USER_ID = "550e8400-e29b-41d4-a716-446655440001"
                    await joinClubInstant(CURRENT_USER_ID, clubId)
                  } finally {
                    setJoining(false)
                    await refetch()
                  }
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {joining ? "Joining..." : "Join Club"}
              </Button>
              <Button
                variant="outline"
                disabled={leaving}
                onClick={async () => {
                  try {
                    setLeaving(true)
                    const CURRENT_USER_ID = "550e8400-e29b-41d4-a716-446655440001"
                    await leaveClubInstant(CURRENT_USER_ID, clubId)
                  } finally {
                    setLeaving(false)
                    await refetch()
                  }
                }}
              >
                {leaving ? "Removing..." : "Remove"}
              </Button>
              <Button variant="outline" className="bg-card/90 hover:bg-accent">
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-background border-primary/20">
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-black text-primary mb-1">{upcomingEvents.length}</div>
            <div className="text-sm font-semibold text-primary">Upcoming Events</div>
          </CardContent>
        </Card>
        <Card className="bg-background border-success/20">
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-black text-success mb-1">{pastEvents.length}</div>
            <div className="text-sm font-semibold text-success">Past Events</div>
          </CardContent>
        </Card>
        <Card className="bg-background border-primary/20">
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-black text-primary mb-1">
              {events.filter((e) => e.prize_pool && e.prize_pool > 0).length}
            </div>
            <div className="text-sm font-semibold text-primary">Prize Events</div>
          </CardContent>
        </Card>
        <Card className="bg-background border-primary/20">
          <CardContent className="p-6 text-center">
            <div className="text-2xl font-black text-primary mb-1">
              ₹{events.reduce((sum, e) => sum + (e.prize_pool || 0), 0).toLocaleString()}
            </div>
            <div className="text-sm font-semibold text-primary">Total Prizes</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="overview" className="font-semibold">
            Overview
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="font-semibold">
            Upcoming ({upcomingEvents.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="font-semibold">
            Past ({pastEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* About Section */}
            <Card>
              <CardHeader>
                <h3 className="text-xl font-bold text-foreground">About {club.name}</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">{club.description}</p>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Founded</span>
                    <span className="font-semibold">{formatDate(club.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <Badge variant="secondary">{club.category}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">College</span>
                    <span className="font-semibold">{club.college}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      className={club.is_verified ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}
                    >
                      {club.is_verified ? "Verified" : "Pending"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <h3 className="text-xl font-bold text-foreground">Recent Events</h3>
              </CardHeader>
              <CardContent>
                {events.slice(0, 3).length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-2">📅</div>
                    <p className="text-muted-foreground">No events yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {events.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center space-x-4 p-3 rounded-xl hover:bg-accent transition-colors"
                      >
                        <div className="w-12 h-12 bg-background rounded-xl flex items-center justify-center">
                          <span className="text-lg">
                            {event.type === "competition"
                              ? "🏆"
                              : event.type === "workshop"
                                ? "🛠️"
                                : event.type === "seminar"
                                  ? "🎓"
                                  : event.type === "cultural"
                                    ? "🎭"
                                    : event.type === "sports"
                                      ? "⚽"
                                      : "💻"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-foreground truncate">{event.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(event.starts_at)} • {event.current_participants} registered
                          </div>
                        </div>
                        <Badge className={getEventTypeColor(event.type ?? 'event')}>{event.type ?? 'event'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-6">
          {upcomingEvents.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-2xl font-bold text-foreground mb-2">No upcoming events</h3>
              <p className="text-muted-foreground">Check back later for new events from this club.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingEvents.map((event) => (
                <Card
                  key={event.id}
                  className="group overflow-hidden hover:shadow-soft-lg transition-all duration-300 border-border hover:border-primary/20 hover:-translate-y-1"
                >
                  <CardHeader className="p-0 relative overflow-hidden">
                    <div className="h-40 bg-background flex items-center justify-center relative overflow-hidden">
                      {event.image_url && (
                        <img src={event.image_url} alt={event.title} className="absolute inset-0 w-full h-full object-cover opacity-80" />
                      )}
                      <div className="text-5xl opacity-20">
                        {event.type === "competition"
                          ? "🏆"
                          : event.type === "workshop"
                            ? "🛠️"
                            : event.type === "seminar"
                              ? "🎓"
                              : event.type === "cultural"
                                ? "🎭"
                                : event.type === "sports"
                                  ? "⚽"
                                  : "💻"}
                      </div>
                      <div className="absolute top-3 left-3">
                        <Badge className={getEventTypeColor(event.type ?? 'event')}>
                          {(event.type ?? 'event').charAt(0).toUpperCase() + (event.type ?? 'event').slice(1)}
                        </Badge>
                      </div>
                      <div className="absolute top-3 right-3">
                        <Badge variant="secondary" className="bg-card/90 text-foreground">
                          {getModeIcon(event.mode)} {event.mode}
                        </Badge>
                      </div>
                      {event.prize_pool && (
                        <div className="absolute bottom-3 left-3">
                          <Badge className="bg-warning/10 text-warning border-warning/20 font-bold">
                            <Trophy className="h-3 w-3 mr-1" />₹{event.prize_pool.toLocaleString()}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-6 space-y-4">
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {event.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                    </div>

                    <div className="space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {formatDate(event.starts_at)} at {formatTime(event.starts_at)}
                        </span>
                      </div>
                      {event.venue && (
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4" />
                          <span className="truncate">{event.venue}</span>
                        </div>
                      )}
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span>
                          {event.current_participants}
                          {event.capacity && `/${event.capacity}`} registered
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>Register by {formatDate(event.registration_deadline ?? event.starts_at)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <div className="text-lg font-bold text-foreground">
                        {event.fee > 0 ? `₹${event.fee}` : "Free"}
                      </div>
                      <Button asChild
                          size="sm"
                          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold group"
                        >
                        <Link href={`/dashboard/student/events/${event.id}`}>
                          View Details
                          <ExternalLink className="ml-2 h-3 w-3 group-hover:translate-x-1 transition-transform" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-6">
          {pastEvents.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-2xl font-bold text-foreground mb-2">No past events</h3>
              <p className="text-muted-foreground">This club hasn&apos;t hosted any events yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pastEvents.map((event) => (
                <Card key={event.id} className="hover:shadow-soft transition-all duration-300">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-6">
                      <div className="w-16 h-16 bg-background rounded-2xl flex items-center justify-center">
                        <span className="text-2xl opacity-60">
                          {event.type === "competition"
                            ? "🏆"
                            : event.type === "workshop"
                              ? "🛠️"
                              : event.type === "seminar"
                                ? "🎓"
                                : event.type === "cultural"
                                  ? "🎭"
                                  : event.type === "sports"
                                    ? "⚽"
                                    : "💻"}
                        </span>
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-bold text-foreground">{event.title}</h3>
                          <Badge className={getEventTypeColor(event.type ?? 'event')}>{event.type ?? 'event'}</Badge>
                          <Badge variant="outline" className="text-muted-foreground">
                            Completed
                          </Badge>
                        </div>
                        <p className="text-muted-foreground line-clamp-1">{event.description}</p>
                        <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(event.starts_at)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Users className="h-4 w-4" />
                            <span>{event.current_participants} participants</span>
                          </div>
                          {event.prize_pool && (
                            <div className="flex items-center space-x-1">
                              <Trophy className="h-4 w-4" />
                              <span>₹{event.prize_pool.toLocaleString()} prizes</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/student/events/${event.id}`}>
                          View Details
                          <ExternalLink className="ml-2 h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
