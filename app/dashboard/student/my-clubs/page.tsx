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
      router.push('/login');
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
      router.push('/login');
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
      router.push('/login');
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
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-zinc-500 font-medium">Loading your community...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!authUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 font-sans selection:bg-indigo-100">
      {/* Subtle Background Accent */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] left-[-2%] w-[30%] h-[30%] bg-indigo-50/60 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-6 pb-12 lg:pt-8 lg:pb-16 space-y-10">
        {/* HEADER SECTION */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 text-[11px] font-semibold uppercase tracking-tight">
              <Sparkles className="w-3 h-3" />
              Student Portal
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-zinc-950">
              My Clubs
            </h1>
            <p className="text-lg text-zinc-500 max-w-md leading-relaxed">
              Manage your memberships and explore new communities on campus.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/dashboard/student/my-clubs/discover">
              <button className="flex items-center gap-2 px-5 py-2.5 bg-zinc-950 text-white rounded-xl font-medium hover:bg-zinc-800 transition-all active:scale-[0.98] shadow-sm shadow-zinc-200">
                <Plus className="w-4 h-4" />
                Discover Clubs
              </button>
            </Link>
          </div>
        </header>

        {/* CONTROLS (Sticky) */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between sticky top-4 z-30 p-1.5 bg-white/90 backdrop-blur-md border border-zinc-200 shadow-sm rounded-2xl">
          <div className="flex bg-zinc-100 p-1 rounded-xl w-full md:w-auto">
            <button
              onClick={() => setTabValue('joined')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                tabValue === 'joined'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Joined ({userClubs.length})
            </button>
            <button
              onClick={() => setTabValue('discover')}
              className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                tabValue === 'discover'
                  ? 'bg-white text-zinc-950 shadow-sm border border-zinc-200'
                  : 'text-zinc-500 hover:text-zinc-700'
              }`}
            >
              Explore ({filteredAvailableClubs.length})
            </button>
          </div>

          <div className="relative w-full md:w-80 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-indigo-600 transition-colors" />
            <input
              type="text"
              placeholder="Search by name or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 rounded-xl text-sm transition-all outline-none"
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
          <section className="pt-16 border-t border-zinc-200 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-indigo-600" />
                Active Events
              </h2>
              <Link
                href="/dashboard/student/events"
                className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
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
                <div className="col-span-full p-10 bg-white border border-dashed border-zinc-200 rounded-2xl text-center">
                  <p className="text-zinc-400 text-sm">
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
    <div className="group bg-white border border-zinc-200 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-zinc-200/50 transition-all duration-300 hover:-translate-y-1 flex flex-col">
      <div className="h-40 relative overflow-hidden">
        {club.banner_url ? (
          <img
            src={club.banner_url}
            alt={club.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
            <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
              {club.name.charAt(0)}
            </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

        <div className="absolute top-3.5 left-3.5 flex gap-2">
          <span className="px-2.5 py-0.5 bg-white/95 backdrop-blur-sm rounded-md text-[10px] font-bold uppercase tracking-wide text-zinc-800 border border-white">
            {club.category}
          </span>
          {club.is_verified && (
            <span className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-600 rounded-md text-[10px] font-bold uppercase tracking-wide text-white">
              <ShieldCheck className="w-3 h-3" />
              Verified
            </span>
          )}
        </div>
      </div>

      <div className="p-6 space-y-5 flex-1 flex flex-col justify-between">
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors truncate">
            {club.name}
          </h3>
          <p className="text-sm text-zinc-500 leading-relaxed line-clamp-2">
            {club.description ||
              `Explore opportunities within the ${club.category} community.`}
          </p>
        </div>

        <div className="flex items-center justify-between py-3 border-y border-zinc-50 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
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
          <div className="flex items-center gap-1 text-zinc-900">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            {club.credibility_score?.toFixed(1) || '0.0'}
          </div>
        </div>

        <div className="flex gap-2.5 pt-1">
          <Link
            href={`/dashboard/student/my-clubs/${club.id}`}
            className="flex-1"
          >
            <button className="w-full px-4 py-2 bg-zinc-50 text-zinc-900 rounded-xl text-xs font-bold border border-zinc-200 hover:bg-zinc-100 transition-colors">
              Details
            </button>
          </Link>

          <button
            onClick={onAction}
            disabled={loading}
            className={`flex-1 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.97] ${
              isMember
                ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'
                : 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm'
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
    <div className="flex items-center gap-4 p-4 bg-white border border-zinc-200 rounded-xl hover:border-indigo-200 hover:shadow-md transition-all group">
      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 relative">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-zinc-400" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest mb-1 truncate">
          {event.club?.name || 'Club Event'}
        </div>
        <h4 className="font-bold text-zinc-900 truncate text-sm mb-1">
          {event.title}
        </h4>
        <div className="flex items-center gap-3 text-[11px] text-zinc-400 font-medium">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {event.starts_at ? new Date(event.starts_at).toLocaleDateString() : 'TBD'}
          </span>
          <span className="w-0.5 h-0.5 rounded-full bg-zinc-300" />
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {event.current_participants || 0}/{event.capacity || '∞'}
          </span>
        </div>
      </div>

      <Link href={`/dashboard/student/events/${event.id}`}>
        <button className="p-2.5 bg-zinc-50 text-zinc-400 rounded-lg hover:text-indigo-600 hover:bg-indigo-50 transition-all">
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
      <div className="w-12 h-12 bg-white border border-zinc-200 rounded-xl flex items-center justify-center text-zinc-300 shadow-sm">
        {icon}
      </div>
      <p className="text-zinc-400 text-sm font-medium">{message}</p>
    </div>
  );
}
