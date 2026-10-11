"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  Mail, 
  Phone, 
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  UserCheck,
  ArrowLeft,
  MoreHorizontal,
  ChevronDown,
  ChevronRight
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"
import { useEventParticipants, type ParticipantStatus } from "@/hooks/useEventParticipants"

export default function EventParticipantsPage() {
  const params = useParams()
  const eventId = params.id as string
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set())
  
  const { 
    participants, 
    eventDetails,
    loading, 
    error, 
    getParticipantsByStatus, 
    getParticipantStats,
    updateParticipantStatus 
  } = useEventParticipants(eventId)

  const stats = getParticipantStats()
  const isTeamEvent = eventDetails?.team_size !== 'solo'

  // Group participants by team for team events
  const groupedParticipants = isTeamEvent 
    ? participants.reduce((groups, participant) => {
        const teamName = participant.team_name || 'No Team'
        if (!groups[teamName]) {
          groups[teamName] = []
        }
        groups[teamName].push(participant)
        return groups
      }, {} as Record<string, typeof participants>)
    : {}

  const toggleTeamExpansion = (teamName: string) => {
    const newExpanded = new Set(expandedTeams)
    if (newExpanded.has(teamName)) {
      newExpanded.delete(teamName)
    } else {
      newExpanded.add(teamName)
    }
    setExpandedTeams(newExpanded)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "registered":
        return "bg-success/10 text-success border-success/20"
      case "waitlisted":
        return "bg-warning/10 text-warning border-warning/20"
      case "cancelled":
        return "bg-destructive/10 text-destructive border-destructive/20"
      case "attended":
        return "bg-primary/10 text-primary border-primary/20"
      default:
        return "bg-muted text-foreground border-border"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "registered":
        return <CheckCircle className="h-4 w-4" />
      case "waitlisted":
        return <Clock className="h-4 w-4" />
      case "cancelled":
        return <XCircle className="h-4 w-4" />
      case "attended":
        return <UserCheck className="h-4 w-4" />
      default:
        return <Users className="h-4 w-4" />
    }
  }

  const filteredParticipants = participants.filter(participant => {
    const matchesSearch = participant.user?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         participant.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         participant.team_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         participant.user?.college?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === "all" || participant.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // For team events, filter and group the filtered participants
  const filteredGroupedParticipants = isTeamEvent 
    ? filteredParticipants.reduce((groups, participant) => {
        const teamName = participant.team_name || 'No Team'
        if (!groups[teamName]) {
          groups[teamName] = []
        }
        groups[teamName].push(participant)
        return groups
      }, {} as Record<string, typeof participants>)
    : {}

  const handleStatusUpdate = async (participantId: string, newStatus: ParticipantStatus) => {
    const result = await updateParticipantStatus(participantId, newStatus)
    if (!result.success) {
      // Handle error - you might want to show a toast notification here
      console.error("Failed to update participant status:", result.error)
    }
  }

  const exportParticipants = () => {
    if (isTeamEvent) {
      // Team Event CSV Export
      const teamData = Object.entries(filteredGroupedParticipants).map(([teamName, teamMembers]) => {
        const leader = teamMembers[0] // First member is leader
        const members = teamMembers.slice(1) // Rest are members
        
        const row = [
          `"${teamName}"`,
          `"${leader.user?.full_name || ""}"`,
          `"${leader.user?.email || ""}"`,
          `"${leader.user?.college || ""}"`,
          `"${leader.registration_data?.participant_details?.branch || leader.registration_data?.additional_info?.branch || ""}"`,
          `"${leader.user?.phone || ""}"`,
        ]
        
        // Add member details (up to 3 more members for max team size of 4)
        for (let i = 0; i < 3; i++) {
          if (members[i]) {
            row.push(
              `"${members[i].user?.full_name || ""}"`,
              `"${members[i].user?.email || ""}"`,
              `"${members[i].user?.college || ""}"`,
              `"${members[i].registration_data?.participant_details?.branch || members[i].registration_data?.additional_info?.branch || ""}"`,
              `"${members[i].user?.phone || ""}"`
            )
          } else {
            row.push('""', '""', '""', '""', '""') // Empty member slots
          }
        }
        
        row.push(`"${leader.status}"`) // Team status
        return row.join(",")
      })
      
      // Create headers for team CSV
      const teamHeaders = [
        "Team Name", "Leader Name", "Leader Email", "Leader College", "Leader Branch", "Leader Mobile"
      ]
      
      for (let i = 1; i <= 3; i++) {
        teamHeaders.push(`Member${i} Name`, `Member${i} Email`, `Member${i} College`, `Member${i} Branch`, `Member${i} Mobile`)
      }
      teamHeaders.push("Team Status")
      
      const csvContent = [teamHeaders.join(","), ...teamData].join("\n")
      
      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `event-teams-${eventId}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } else {
      // Individual Event CSV Export
      const headers = ["Name", "Email", "College", "Branch", "Mobile No", "Status"]
      
      const csvContent = [
        headers.join(","),
        ...filteredParticipants.map(p => [
          `"${p.user?.full_name || ""}"`,
          `"${p.user?.email || ""}"`,
          `"${p.user?.college || ""}"`,
          `"${p.registration_data?.participant_details?.branch || p.registration_data?.additional_info?.branch || ""}"`,
          `"${p.user?.phone || ""}"`,
          `"${p.status}"`
        ].join(","))
      ].join("\n")

      const blob = new Blob([csvContent], { type: "text/csv" })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `event-participants-${eventId}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    }
  }

  const sendBulkEmail = () => {
    const emails = filteredParticipants
      .filter(p => p.status === "registered" || p.status === "attended")
      .map(p => p.user?.email)
      .filter(Boolean)
      .join(";")
    
    if (emails) {
      window.location.href = `mailto:?bcc=${emails}&subject=Event Update - ${eventId}`
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading participants...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-destructive mb-4">Error loading participants: {error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Button - Top Left */}
      <div>
        <Button asChild variant="outline" className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 shadow-soft">
          <Link href="/dashboard/organizer/host">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Event Management Hub
          </Link>
        </Button>
      </div>

      {/* Header Card */}
      <Card className="border-2 border-primary/20 shadow-soft-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl font-bold text-foreground">Event Participants Dashboard</CardTitle>
              <CardDescription className="text-lg mt-2">View and manage participants for all events</CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button onClick={exportParticipants} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={sendBulkEmail}>
                <Mail className="h-4 w-4 mr-2" />
                Send Bulk Email
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Registered</p>
                <p className="text-2xl font-bold text-success">{stats.registered}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Waitlisted</p>
                <p className="text-2xl font-bold text-warning">{stats.waitlisted}</p>
              </div>
              <Clock className="h-8 w-8 text-warning" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Attended</p>
                <p className="text-2xl font-bold text-primary">{stats.attended}</p>
              </div>
              <UserCheck className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cancelled</p>
                <p className="text-2xl font-bold text-destructive">{stats.cancelled}</p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Participants List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Participants List</CardTitle>
              <CardDescription>View and manage all event participants</CardDescription>
            </div>
            <div className="flex space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input 
                  placeholder="Search participants..." 
                  className="pl-10 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="registered">Registered</SelectItem>
                  <SelectItem value="waitlisted">Waitlisted</SelectItem>
                  <SelectItem value="attended">Attended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="list" className="space-y-4">
            <TabsList>
              <TabsTrigger value="list">List View</TabsTrigger>
              <TabsTrigger value="grid">Grid View</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-4">
              {(isTeamEvent ? Object.keys(filteredGroupedParticipants).length === 0 : filteredParticipants.length === 0) ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {participants.length === 0 ? "No Participants Yet" : "No Participants Found"}
                  </h3>
                  <p className="text-muted-foreground">
                    {participants.length === 0 
                      ? "No one has registered for this event yet. Share your event to get participants!"
                      : "No participants match your current search and filter criteria."
                    }
                  </p>
                  {participants.length === 0 && (
                    <div className="mt-6 space-x-4">
                      <Button variant="outline">
                        <Mail className="h-4 w-4 mr-2" />
                        Share Event
                      </Button>
                      <Button variant="outline">
                        <Users className="h-4 w-4 mr-2" />
                        Invite Participants
                      </Button>
                    </div>
                  )}
                </div>
              ) : isTeamEvent ? (
                // Team Event View - Show teams with expandable members
                <div className="space-y-3">
                  {Object.entries(filteredGroupedParticipants).map(([teamName, teamMembers]) => (
                    <div key={teamName} className="border rounded-lg overflow-hidden">
                      {/* Team Header */}
                      <div 
                        className="bg-background p-4 cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => toggleTeamExpansion(teamName)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {expandedTeams.has(teamName) ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground" />
                            )}
                            <div className="flex items-center space-x-2">
                              <Users className="h-5 w-5 text-primary" />
                              <h3 className="font-semibold text-foreground text-lg">{teamName}</h3>
                            </div>
                            <Badge variant="secondary">
                              {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-2">
                            {teamMembers.map(member => (
                              <Badge key={member.id} className={getStatusColor(member.status)}>
                                {member.status}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Team Members - Expandable */}
                      {expandedTeams.has(teamName) && (
                        <div className="border-t bg-card">
                          {teamMembers.map((participant, index) => (
                            <div key={participant.id} className={`p-4 ${index < teamMembers.length - 1 ? 'border-b border-border' : ''}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-start space-x-4 flex-1">
                                  <Avatar>
                                    <AvatarImage src={participant.user?.avatar_url || ""} />
                                    <AvatarFallback>
                                      {participant.user?.full_name?.charAt(0) || "?"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                      <h4 className="font-semibold text-foreground">{participant.user?.full_name}</h4>
                                      <Badge className={getStatusColor(participant.status)}>
                                        <div className="flex items-center space-x-1">
                                          {getStatusIcon(participant.status)}
                                          <span>{participant.status.charAt(0).toUpperCase() + participant.status.slice(1)}</span>
                                        </div>
                                      </Badge>
                                    </div>
                                    
                                    {/* Basic Info */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
                                      <span className="flex items-center">
                                        <Mail className="h-3 w-3 mr-1" />
                                        {participant.user?.email}
                                      </span>
                                      <span>{participant.user?.college}</span>
                                      <span className="flex items-center">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {new Date(participant.registered_at).toLocaleDateString()}
                                      </span>
                                    </div>

                                    {/* Additional Registration Info - Only show relevant details */}
                                    <div className="bg-background rounded-lg p-3 mt-2">
                                      <h5 className="text-sm font-medium text-foreground mb-2">Additional Information:</h5>
                                      <div className="space-y-1 text-xs text-muted-foreground">
                                        {(participant.registration_data?.participant_details?.branch || participant.registration_data?.additional_info?.branch) && (
                                          <div>
                                            <span className="font-medium">Branch:</span>
                                            <span className="ml-1">{participant.registration_data?.participant_details?.branch || participant.registration_data?.additional_info?.branch}</span>
                                          </div>
                                        )}
                                        {participant.registration_data?.additional_info?.specialRequirements && (
                                          <div>
                                            <span className="font-medium">Special Requirements:</span>
                                            <span className="ml-1">{participant.registration_data.additional_info.specialRequirements}</span>
                                          </div>
                                        )}
                                        {participant.registration_data?.additional_info?.dietaryRestrictions && (
                                          <div>
                                            <span className="font-medium">Dietary Restrictions:</span>
                                            <span className="ml-1">{participant.registration_data.additional_info.dietaryRestrictions}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Select
                                    value={participant.status}
                                    onValueChange={(value) => handleStatusUpdate(participant.id, value as ParticipantStatus)}
                                  >
                                    <SelectTrigger className="w-32">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="registered">Registered</SelectItem>
                                      <SelectItem value="waitlisted">Waitlisted</SelectItem>
                                      <SelectItem value="attended">Attended</SelectItem>
                                      <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem>
                                        <Mail className="h-4 w-4 mr-2" />
                                        Send Email
                                      </DropdownMenuItem>
                                      <DropdownMenuItem>
                                        <Phone className="h-4 w-4 mr-2" />
                                        View Contact
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // Individual Event View - Show all participant details directly
                <div className="space-y-2">
                  {filteredParticipants.map((participant) => (
                    <div key={participant.id} className="border rounded-lg p-4 hover:shadow-soft transition-shadow">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start space-x-4 flex-1">
                          <Avatar>
                            <AvatarImage src={participant.user?.avatar_url || ""} />
                            <AvatarFallback>
                              {participant.user?.full_name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="font-semibold text-foreground">{participant.user?.full_name}</h3>
                              <Badge className={getStatusColor(participant.status)}>
                                <div className="flex items-center space-x-1">
                                  {getStatusIcon(participant.status)}
                                  <span>{participant.status.charAt(0).toUpperCase() + participant.status.slice(1)}</span>
                                </div>
                              </Badge>
                            </div>
                            
                            {/* Basic Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground mb-3">
                              <span className="flex items-center">
                                <Mail className="h-3 w-3 mr-1" />
                                {participant.user?.email}
                              </span>
                              <span>{participant.user?.college}</span>
                              <span className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(participant.registered_at).toLocaleDateString()}
                              </span>
                            </div>

                            {/* Additional Registration Info - Only show relevant details */}
                            <div className="bg-background rounded-lg p-3 mt-2">
                              <h4 className="text-sm font-medium text-foreground mb-2">Additional Information:</h4>
                              <div className="space-y-1 text-xs text-muted-foreground">
                                {(participant.registration_data?.participant_details?.branch || participant.registration_data?.additional_info?.branch) && (
                                  <div>
                                    <span className="font-medium">Branch:</span>
                                    <span className="ml-1">{participant.registration_data?.participant_details?.branch || participant.registration_data?.additional_info?.branch}</span>
                                  </div>
                                )}
                                {participant.registration_data?.additional_info?.specialRequirements && (
                                  <div>
                                    <span className="font-medium">Special Requirements:</span>
                                    <span className="ml-1">{participant.registration_data.additional_info.specialRequirements}</span>
                                  </div>
                                )}
                                {participant.registration_data?.additional_info?.dietaryRestrictions && (
                                  <div>
                                    <span className="font-medium">Dietary Restrictions:</span>
                                    <span className="ml-1">{participant.registration_data.additional_info.dietaryRestrictions}</span>
                                  </div>
                                )}
                                {participant.registration_data?.participant_details?.skills && (
                                  <div>
                                    <span className="font-medium">Skills:</span>
                                    <span className="ml-1">{participant.registration_data.participant_details.skills}</span>
                                  </div>
                                )}
                                {participant.registration_data?.participant_details?.experience && (
                                  <div>
                                    <span className="font-medium">Experience:</span>
                                    <span className="ml-1">{participant.registration_data.participant_details.experience}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Select
                            value={participant.status}
                            onValueChange={(value) => handleStatusUpdate(participant.id, value as ParticipantStatus)}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="registered">Registered</SelectItem>
                              <SelectItem value="waitlisted">Waitlisted</SelectItem>
                              <SelectItem value="attended">Attended</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Mail className="h-4 w-4 mr-2" />
                                Send Email
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Phone className="h-4 w-4 mr-2" />
                                View Contact
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="grid" className="space-y-4">
              {filteredParticipants.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {participants.length === 0 ? "No Participants Yet" : "No Participants Found"}
                  </h3>
                  <p className="text-muted-foreground">
                    {participants.length === 0 
                      ? "No one has registered for this event yet. Share your event to get participants!"
                      : "No participants match your current search and filter criteria."
                    }
                  </p>
                  {participants.length === 0 && (
                    <div className="mt-6 space-x-4">
                      <Button variant="outline">
                        <Mail className="h-4 w-4 mr-2" />
                        Share Event
                      </Button>
                      <Button variant="outline">
                        <Users className="h-4 w-4 mr-2" />
                        Invite Participants
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredParticipants.map((participant) => (
                    <Card key={participant.id} className="hover:shadow-soft transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center space-x-3 mb-3">
                          <Avatar>
                            <AvatarImage src={participant.user?.avatar_url || ""} />
                            <AvatarFallback>
                              {participant.user?.full_name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <h3 className="font-semibold text-foreground text-sm">{participant.user?.full_name}</h3>
                            <p className="text-xs text-muted-foreground">{participant.user?.college}</p>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Badge className={getStatusColor(participant.status)}>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(participant.status)}
                              <span>{participant.status.charAt(0).toUpperCase() + participant.status.slice(1)}</span>
                            </div>
                          </Badge>
                          <p className="text-xs text-muted-foreground">{participant.user?.email}</p>
                          {participant.team_name && (
                            <p className="text-xs text-muted-foreground">Team: {participant.team_name}</p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Registered: {new Date(participant.registered_at).toLocaleDateString()}
                          </p>
                          
                          {/* Additional Info for Grid View */}
                          <div className="bg-background rounded p-2 mt-2">
                            <h5 className="text-xs font-medium text-foreground mb-1">Additional Info:</h5>
                            <div className="space-y-1 text-xs text-muted-foreground max-h-32 overflow-y-auto">
                              {(participant.registration_data?.participant_details?.branch || participant.registration_data?.additional_info?.branch) && (
                                <div>
                                  <span className="font-medium">Branch:</span>
                                  <span className="ml-1">{participant.registration_data?.participant_details?.branch || participant.registration_data?.additional_info?.branch}</span>
                                </div>
                              )}
                              {participant.registration_data?.additional_info?.specialRequirements && (
                                <div>
                                  <span className="font-medium">Special Requirements:</span>
                                  <span className="ml-1">{participant.registration_data.additional_info.specialRequirements}</span>
                                </div>
                              )}
                              {participant.registration_data?.additional_info?.dietaryRestrictions && (
                                <div>
                                  <span className="font-medium">Dietary:</span>
                                  <span className="ml-1">{participant.registration_data.additional_info.dietaryRestrictions}</span>
                                </div>
                              )}
                              {participant.registration_data?.participant_details?.skills && (
                                <div>
                                  <span className="font-medium">Skills:</span>
                                  <span className="ml-1">{participant.registration_data.participant_details.skills}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
