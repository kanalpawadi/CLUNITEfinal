'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Users,
  Calendar,
  Star,
  ExternalLink,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  ArrowUpRight,
  Info,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useClubs, useUserClubs, joinClubInstant, leaveClubInstant } from '@/hooks/useClubs';
import { useEventsForClubIds } from '@/hooks/useEvents';
import { useAuth } from '@/lib/auth-context';
import type { Club, Event } from '@/lib/supabase';
import { redirectToLogin } from '@/lib/auth/client';

export default function App() {
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  
  // Get user ID from auth
  const userId = authUser?.id;

  // Fetch all clubs and user's clubs from database
  const { clubs: allClubs, loading: allClubsLoading, refetch: refetchAllClubs } = useClubs();
  const { clubs: userClubs, loading: userClubsLoading, refetch: refetchUserClubs } = useUserClubs(userId || '');

  const [searchTerm, setSearchTerm] = useState('');
  const [tabValue, setTabValue] = useState<'joined' | 'discover'>('joined');
  const [joiningClubId, setJoiningClubId] = useState<string | null>(null);

  const joinedClubIds = useMemo(() => userClubs.map((c) => c.id), [userClubs]);

  // Fetch events for joined clubs
  const { events: joinedClubsEvents } = useEventsForClubIds(joinedClubIds);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !authUser) {
      redirectToLogin(router);
    }
  }, [authUser, authLoading, router]);

  const filteredUserClubs = useMemo(
    () =>
      userClubs.filter(
        (club) =>
          club.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (club.description?.toLowerCase() ?? '').includes(
            searchTerm.toLowerCase()
          ) ||
          (club.category ?? '').toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [userClubs, searchTerm]
  );

  const filteredAvailableClubs = useMemo(
    () =>
      allClubs.filter((club) => {
        const isNotMember = !userClubs.some((c) => c.id === club.id);
        const matchesSearch =
          club.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (club.description?.toLowerCase() ?? '').includes(
            searchTerm.toLowerCase()
          ) ||
          (club.category ?? '').toLowerCase().includes(searchTerm.toLowerCase());
        return isNotMember && matchesSearch;
      }),
    [allClubs, userClubs, searchTerm]
  );

  // --- ACTIONS (Real API calls) ---
  const handleJoin = async (id: string) => {
    if (!userId) {
      redirectToLogin(router);
      return;
    }

    try {
      setJoiningClubId(id);
      await joinClubInstant(userId, id);
      // Refetch user clubs to get updated list
      await refetchUserClubs();
      setTabValue('joined');
    } catch (error) {
      console.error('Error joining club:', error);
      alert('Failed to join club. Please try again.');
    } finally {
      setJoiningClubId(null);
    }
  };

  const handleLeave = async (id: string) => {
    if (!userId) {
      redirectToLogin(router);
      return;
    }

    try {
      await leaveClubInstant(userId, id);
      // Refetch user clubs to get updated list
      await refetchUserClubs();
    } catch (error) {
      console.error('Error leaving club:', error);
      alert('Failed to leave club. Please try again.');
    }
  };

  // Show loading state while auth is loading or data is being fetched
  if (authLoading || (allClubsLoading && userClubs.length === 0 && allClubs.length === 0) || userClubsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium">Loading your community...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!authUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/10">
      {/* Subtle Background Accent */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] left-[-2%] w-[30%] h-[30%] bg-primary/60 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-6 pb-12 lg:pt-8 lg:pb-16 space-y-10">
        {/* HEADER SECTION */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-muted border border-border text-muted-foreground text-[11px] font-semibold uppercase tracking-tight">
              <Sparkles className="w-3 h-3" />
              Student Portal
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              My Clubs
            </h1>
            <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
              Manage your memberships and explore new communities on campus.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/student/my-clubs/discover">
              <button className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-primary-foreground rounded-xl font-medium hover:bg-foreground transition-all active:scale-[0.98] shadow-soft">
                <Plus className="w-4 h-4" />
                Discover Clubs
              </button>
            </Link>
          </div>
        </header>

        {/* CONTROLS (Sticky) */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between sticky top-4 z-30 p-1.5 bg-card/90 backdrop-blur-md border border-border shadow-soft rounded-2xl">
          <div className="flex bg-muted p-1 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setTabValue('joined')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                tabValue === 'joined'
                  ? 'bg-card text-foreground shadow-soft border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Joined ({userClubs.length})
            </button>
            <button
              onClick={() => setTabValue('discover')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                tabValue === 'discover'
                  ? 'bg-card text-foreground shadow-soft border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Explore ({filteredAvailableClubs.length})
            </button>
          </div>

          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search by name or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-background border border-border focus:bg-card focus:ring-4 focus:ring-ring/5 focus:border-primary/20 rounded-xl text-sm transition-all outline-none"
            />
          </div>
        </div>

        {/* CLUB LISTINGS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tabValue === 'joined' ? (
            filteredUserClubs.length > 0 ? (
              filteredUserClubs.map((club) => (
                <ClubCard
                  key={club.id}
                  club={club}
                  isMember
                  onAction={() => handleLeave(club.id)}
                />
              ))
            ) : (
              <EmptyState
                icon={<Info className="w-7 h-7" />}
                message={
                  searchTerm
                    ? 'No matches found.'
                    : "You haven't joined any clubs yet."
                }
              />
            )
          ) : filteredAvailableClubs.length > 0 ? (
            filteredAvailableClubs.map((club) => (
              <ClubCard
                key={club.id}
                club={club}
                loading={joiningClubId === club.id}
                onAction={() => handleJoin(club.id)}
              />
            ))
          ) : (
            <EmptyState
              icon={<Search className="w-7 h-7" />}
              message="No new clubs found to join."
            />
          )}
        </div>

        {/* EVENTS SECTION */}
        {tabValue === 'joined' && userClubs.length > 0 && (
          <section className="pt-16 border-t border-border space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-primary" />
                Active Events
              </h2>
              <Link
                href="/dashboard/student/events"
                className="text-sm font-semibold text-primary hover:text-primary flex items-center gap-1"
              >
                All Events <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {joinedClubsEvents.length > 0 ? (
                joinedClubsEvents.map((e) => (
                  <EventListItem key={e.id} event={e} />
                ))
              ) : (
                <div className="col-span-full p-10 bg-card border border-dashed border-border rounded-2xl text-center">
                  <p className="text-muted-foreground text-sm">
                    No upcoming events scheduled right now.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function ClubCard({
  club,
  isMember,
  loading,
  onAction,
}: {
  club: Club
  isMember?: boolean
  loading?: boolean
  onAction: () => void
}) {
  return (
    <div className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-soft-lg transition-all duration-300 hover:-translate-y-1 flex flex-col">
      <div className="h-40 relative overflow-hidden">
        {club.banner_url ? (
          <img
            src={club.banner_url}
            alt={club.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center text-primary-foreground font-bold text-xl">
              {club.name.charAt(0)}
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-foreground/50" />

        <div className="absolute top-3.5 left-3.5 flex gap-2">
          <span className="px-2.5 py-0.5 bg-card/95 backdrop-blur-sm rounded-md text-[10px] font-bold uppercase tracking-wide text-foreground border border-border">
            {club.category}
          </span>
          {club.is_verified && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-primary rounded-md text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
              <ShieldCheck className="w-3 h-3" />
              Verified
            </span>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors truncate">
            {club.name}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
            {club.description ||
              `Explore opportunities within the ${club.category} community.`}
          </p>
        </div>

        <div className="flex items-center justify-between py-3 border-y border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {club.members_count}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {club.events_hosted_count}
            </span>
          </div>
          <div className="flex items-center gap-1 text-foreground">
            <Star className="w-3.5 h-3.5 text-warning fill-warning" />
            {club.credibility_score?.toFixed(1) || '0.0'}
          </div>
        </div>

        <div className="flex gap-2.5 pt-1">
          <Link
            href={`/dashboard/student/my-clubs/${club.id}`}
            className="flex-1"
          >
            <button className="w-full px-4 py-2 bg-background text-foreground rounded-xl text-xs font-bold border border-border hover:bg-accent transition-colors">
              Details
            </button>
          </Link>

          <button
            onClick={onAction}
            disabled={loading}
            className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.97] ${
              isMember
                ? 'bg-destructive/5 text-destructive border border-destructive/20 hover:bg-destructive/10'
                : 'bg-foreground text-primary-foreground hover:bg-foreground shadow-soft'
            }`}
          >
            {loading ? 'Processing...' : isMember ? 'Leave' : 'Join Club'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EventListItem({ event }: { event: Event }) {
  return (
    <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/20 hover:shadow-soft transition-all group">
      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 relative">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <Calendar className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-bold text-primary uppercase tracking-widest mb-1 truncate">
          {event.club?.name || 'Club Event'}
        </div>
        <h4 className="font-bold text-foreground truncate text-sm mb-1">
          {event.title}
        </h4>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-medium">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {event.starts_at ? new Date(event.starts_at).toLocaleDateString() : 'TBD'}
          </span>
          <span className="w-0.5 h-0.5 rounded-full bg-muted" />
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {event.current_participants || 0}/{event.capacity || '∞'}
          </span>
        </div>
      </div>

      <Link href={`/dashboard/student/events/${event.id}`}>
        <button className="p-2.5 bg-background text-muted-foreground rounded-lg hover:text-primary hover:bg-primary/5 transition-all">
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </Link>
    </div>
  );
}

function EmptyState({
  icon,
  message,
}: {
  icon: React.ReactNode;
  message: string;
}) {
  return (
    <div className="col-span-full py-20 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="w-12 h-12 bg-card border border-border rounded-xl flex items-center justify-center text-muted-foreground shadow-soft">
        {icon}
      </div>
      <p className="text-muted-foreground text-sm font-medium">{message}</p>
    </div>
  );
}
