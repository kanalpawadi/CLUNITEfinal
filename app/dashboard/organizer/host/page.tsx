'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Calendar,
  BarChart3,
  Plus,
  Sparkles,
  Users,
  TrendingUp,
  Award,
  ArrowRight,
  Clock,
  Target,
  ChevronDown,
  Building2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Club } from '@/lib/supabase';

export default function HostEventPage() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [selectedClubName, setSelectedClubName] = useState<string | null>(null);
  const [userClubs, setUserClubs] = useState<Pick<Club, 'id' | 'name'>[]>([]);
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalRegistrations: 0,
    attendanceRate: 0,
    engagementRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get selected club from session
    const clubId = sessionStorage.getItem('selectedClubId');
    const clubName = sessionStorage.getItem('selectedClubName');

    if (!clubId || !clubName) {
      // No club selected, redirect to club selection
      router.push('/dashboard/organizer/select-club');
      return;
    }

    setSelectedClubId(clubId);
    setSelectedClubName(clubName);
    fetchClubStats(clubId);
  }, []);

  useEffect(() => {
    if (authUser) {
      loadUserClubs();
    }
  }, [authUser]);

  const loadUserClubs = async () => {
    try {
      if (!authUser) return;

      const { data: memberships, error: membershipsError } = await supabase
        .from('club_memberships')
        .select(`
          club:clubs(id, name)
        `)
        .eq('user_id', authUser.id)
        .in('role', ['owner', 'admin', 'organizer']);

      const { data: createdClubs, error: createdClubsError } = await supabase
        .from('clubs')
        .select('id, name')
        .eq('created_by', authUser.id);

      if (!membershipsError || !createdClubsError) {
        const clubsFromMemberships = (memberships || [])
          .map((m) => m.club)
          .filter((club): club is Pick<Club, 'id' | 'name'> => !!club && !!club.id);
        const clubsFromCreated = createdClubs || [];

        // Combine and deduplicate
        const allClubs = [...clubsFromMemberships, ...clubsFromCreated];
        const uniqueClubs = Array.from(
          new Map(allClubs.map((club) => [club.id, club])).values()
        );

        setUserClubs(uniqueClubs);
      }
    } catch (err) {
      console.error('Error loading clubs:', err);
    }
  };

  const switchClub = (clubId: string, clubName: string) => {
    sessionStorage.setItem('selectedClubId', clubId);
    sessionStorage.setItem('selectedClubName', clubName);
    setSelectedClubId(clubId);
    setSelectedClubName(clubName);
    setLoading(true);
    fetchClubStats(clubId);
  };

  const fetchClubStats = async (clubId: string) => {
    try {
      setLoading(true);

      // Fetch events for this club
      const { data: events, error: eventsError } = await supabase
        .from('events')
        .select('id, current_participants')
        .eq('club_id', clubId);

      if (eventsError) throw eventsError;

      const eventIds = events?.map((e) => e.id) || [];

      // Fetch registrations for these events
      let registrations: { id: string; status: string }[] = [];
      let attendedCount = 0;

      if (eventIds.length > 0) {
        const { data: regs, error: regsError } = await supabase
          .from('event_registrations')
          .select('id, status')
          .in('event_id', eventIds);

        if (!regsError && regs) {
          registrations = regs;
        }
        const { count } = await supabase
          .from('attendance')
          .select('id', { count: 'exact', head: true })
          .in('event_id', eventIds);
        attendedCount = count ?? 0;
      }

      const totalEvents = events?.length || 0;
      const totalRegistrations = registrations.length;
      const attendanceRate =
        totalRegistrations > 0
          ? Math.round((attendedCount / totalRegistrations) * 100)
          : 0;
      const engagementRate =
        totalEvents > 0 && totalRegistrations > 0
          ? Math.round((totalRegistrations / totalEvents) * 10)
          : 0;

      setStats({
        totalEvents,
        totalRegistrations,
        attendanceRate,
        engagementRate: Math.min(engagementRate, 100),
      });
    } catch (error) {
      console.error('Error fetching club stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Modern Header with Club Switcher */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-6 w-6 text-primary" />
              {userClubs.length > 1 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                    >
                      <Building2 className="h-4 w-4 mr-2" />
                      {selectedClubName}
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {userClubs.map((club) => (
                      <DropdownMenuItem
                        key={club.id}
                        onClick={() => switchClub(club.id, club.name)}
                        className={
                          selectedClubId === club.id ? 'bg-primary/10' : ''
                        }
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{club.name}</span>
                          {selectedClubId === club.id && (
                            <Badge className="ml-2 bg-primary">Current</Badge>
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                  <Building2 className="h-3 w-3 mr-1" />
                  {selectedClubName}
                </Badge>
              )}
            </div>
            <h1 className="text-4xl font-bold text-foreground">
              Event Management Hub
            </h1>
            <p className="text-muted-foreground mt-2">
              Create engaging events and track your success with powerful
              analytics
            </p>
          </div>
          <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
            <Link href="/dashboard/organizer/manage-admins">
              <Users className="h-5 w-5 mr-2" />
              Manage Admins
            </Link>
          </Button>
        </div>

        {/* Colorful Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Calendar,
              label: 'Total Events',
              value: loading ? '...' : stats.totalEvents.toString(),
              trend: '+18%',
              desc: 'Events hosted',
              gradient: ' ',
            },
            {
              icon: Users,
              label: 'Registrations',
              value: loading ? '...' : stats.totalRegistrations.toString(),
              trend: '+5%',
              desc: 'Sign-ups received',
              gradient: ' ',
            },
            {
              icon: TrendingUp,
              label: 'Attendance',
              value: loading ? '...' : `${stats.attendanceRate}%`,
              trend: '+8%',
              desc: 'Average rate',
              gradient: ' ',
            },
            {
              icon: Award,
              label: 'Engagement',
              value: loading ? '...' : `${stats.engagementRate}%`,
              trend: '-2%',
              desc: 'Interaction level',
              gradient: ' ',
            },
          ].map((stat, index) => (
            <Card
              key={index}
              className={`border-none shadow-soft  ${stat.gradient} text-primary-foreground`}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 bg-card/20 rounded-lg">
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded ${
                      stat.trend.startsWith('+') ? 'bg-card/30' : 'bg-card/20'
                    }`}
                  >
                    {stat.trend}
                  </span>
                </div>
                <div>
                  <h3 className="text-3xl font-bold mb-1">{stat.value}</h3>
                  <p className="text-sm font-medium text-primary-foreground/90">
                    {stat.label}
                  </p>
                  <p className="text-xs text-primary-foreground/70 mt-1">{stat.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Feature Cards - elevated, modern, with subtle animated accents */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Host New Event Card */}
          <Card className="relative overflow-hidden bg-card/90 backdrop-blur rounded-2xl border border-border hover:border-border hover:shadow-soft-lg transition-all duration-300 h-full group">
            {/* decorative gradient blob */}
            <div className="pointer-events-none absolute -top-24 -right-24 w-56 h-56 rounded-full bg-muted opacity-40 group-hover:opacity-60 blur-2xl transition-opacity" />
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between mb-8">
                <div className="w-14 h-14 bg-foreground rounded-2xl flex items-center justify-center shadow-soft">
                  <Plus className="h-7 w-7 text-primary-foreground" />
                </div>
                <Button asChild
                    size="sm"
                    variant="outline"
                    className="border-foreground text-foreground hover:bg-foreground hover:text-primary-foreground rounded-xl shadow-soft"
                  >
                  <Link href="/dashboard/organizer/host/create">
                    Quick Start
                  </Link>
                </Button>
              </div>

              <div className="mb-10">
                <div className="text-5xl mb-4 text-muted-foreground font-serif">&quot;</div>
                <h3 className="text-3xl font-light text-foreground leading-tight mb-6">
                  Host New Event
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed min-h-[72px]">
                  Create engaging events for your campus community. Set up
                  workshops, competitions, seminars, and more with our
                  comprehensive event creation tools.
                </p>
              </div>
            </CardHeader>

            <CardContent className="border-t border-border pt-8">
              <div className="grid grid-cols-2 gap-x-8 mb-10">
                <div>
                  <div className="text-5xl font-light text-primary mb-2">
                    5 min
                  </div>
                  <div className="text-sm text-muted-foreground">Quick setup time</div>
                </div>
                <div>
                  <div className="text-5xl font-light text-primary mb-2">
                    100%
                  </div>
                  <div className="text-sm text-muted-foreground">Digital workflow</div>
                </div>
              </div>

              <Link
                href="/dashboard/organizer/host/create"
                className="inline-flex items-center text-foreground hover:text-primary transition-colors group"
              >
                <div className="w-12 h-12 rounded-full border-2 border-foreground flex items-center justify-center mr-3 group-hover:border-primary group-hover:bg-primary/5 transition-all shadow-soft">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <span className="text-base font-normal">Create New Event</span>
              </Link>
            </CardContent>
          </Card>

          {/* Organizers Panel Card */}
          <Card className="relative overflow-hidden bg-card/90 backdrop-blur rounded-2xl border border-border hover:border-border hover:shadow-soft-lg transition-all duration-300 h-full group">
            <div className="pointer-events-none absolute -bottom-24 -left-24 w-56 h-56 rounded-full bg-muted opacity-40 group-hover:opacity-60 blur-2xl transition-opacity" />
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between mb-8">
                <div className="w-14 h-14 bg-foreground rounded-2xl flex items-center justify-center shadow-soft">
                  <BarChart3 className="h-7 w-7 text-primary-foreground" />
                </div>
                <Button asChild
                    size="sm"
                    variant="outline"
                    className="border-foreground text-foreground hover:bg-foreground hover:text-primary-foreground rounded-xl shadow-soft"
                  >
                  <Link href="/dashboard/organizer/host/analytics">
                    View Now
                  </Link>
                </Button>
              </div>

              <div className="mb-10">
                <div className="text-5xl mb-4 text-muted-foreground font-serif">&quot;</div>
                <h3 className="text-3xl font-light text-foreground leading-tight mb-6">
                  Organizers Panel
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed min-h-[72px]">
                  Comprehensive analytics dashboard for all your events. Track
                  performance, participant engagement, and success metrics with
                  detailed insights.
                </p>
              </div>
            </CardHeader>

            <CardContent className="border-t border-border pt-8">
              <div className="grid grid-cols-2 gap-x-8 mb-10">
                <div>
                  <div className="text-4xl font-light text-primary mb-2">
                    Real-time
                  </div>
                  <div className="text-sm text-muted-foreground">Event analytics</div>
                </div>
                <div>
                  <div className="text-5xl font-light text-primary mb-2">
                    AI
                  </div>
                  <div className="text-sm text-muted-foreground">Powered insights</div>
                </div>
              </div>

              <Link
                href="/dashboard/organizer/host/analytics"
                className="inline-flex items-center text-foreground hover:text-primary transition-colors group"
              >
                <div className="w-12 h-12 rounded-full border-2 border-foreground flex items-center justify-center mr-3 group-hover:border-primary group-hover:bg-primary/5 transition-all shadow-soft">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <span className="text-base font-normal">
                  View Analytics Dashboard
                </span>
              </Link>
            </CardContent>
          </Card>

          {/* Event Participants Dashboard Card - Third card aligned with first */}
          <Card className="relative overflow-hidden bg-card/90 backdrop-blur rounded-2xl border border-border hover:border-border hover:shadow-soft-lg transition-all duration-300 h-full group">
            <div className="pointer-events-none absolute -top-24 -right-24 w-56 h-56 rounded-full bg-muted opacity-40 group-hover:opacity-60 blur-2xl transition-opacity" />
            <CardHeader className="pb-6">
              <div className="flex items-center justify-between mb-8">
                <div className="w-14 h-14 bg-foreground rounded-2xl flex items-center justify-center shadow-soft">
                  <Users className="h-7 w-7 text-primary-foreground" />
                </div>
                <Button asChild
                    size="sm"
                    variant="outline"
                    className="border-foreground text-foreground hover:bg-foreground hover:text-primary-foreground rounded-xl shadow-soft"
                  >
                  <Link href="/dashboard/organizer">
                    View
                  </Link>
                </Button>
              </div>

              <div className="mb-10">
                <div className="text-5xl mb-4 text-muted-foreground font-serif">&quot;</div>
                <h3 className="text-3xl font-light text-foreground leading-tight mb-6">
                  Event Participants Dashboard
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed min-h-[72px]">
                  Access your event participation details in one place. Monitor
                  registrations, track attendance, and manage participant
                  interactions effectively.
                </p>
              </div>
            </CardHeader>

            <CardContent className="border-t border-border pt-8">
              <div className="grid grid-cols-2 gap-x-8 mb-10">
                <div>
                  <div className="text-5xl font-light text-primary mb-2">
                    Track
                  </div>
                  <div className="text-sm text-muted-foreground">All registrations</div>
                </div>
                <div>
                  <div className="text-5xl font-light text-primary mb-2">
                    Manage
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Attendance records
                  </div>
                </div>
              </div>

              <Link
                href="/dashboard/organizer"
                className="inline-flex items-center text-foreground hover:text-primary transition-colors group"
              >
                <div className="w-12 h-12 rounded-full border-2 border-foreground flex items-center justify-center mr-3 group-hover:border-primary group-hover:bg-primary/5 transition-all shadow-soft">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <span className="text-base font-normal">View Participants</span>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
