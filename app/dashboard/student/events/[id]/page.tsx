'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EventImage } from '@/components/EventImage';
import {
  Calendar,
  Clock,
  ArrowLeft,
  Users,
  Eye,
  Heart,
  Share2,
  MapPin,
  Trophy,
  Star,
  Globe,
  Monitor,
  CheckCircle,
  AlertTriangle,
  Mail,
  Phone,
  Tag,
  Award,
  Target,
  BookOpen,
  Zap,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { supabase, type Event, type Club } from '@/lib/supabase';
import { parseContactInfo } from '@/lib/event-info';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface EventWithClub extends Event {
  club?: Club | null;
}

interface TeamMember {
  name: string;
  email: string;
  phone: string;
  college: string;
  year: string;
  gender: string;
  branch: string;
  academic_year: string;
}

export default function EventDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [event, setEvent] = useState<EventWithClub | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRegistrationDialog, setShowRegistrationDialog] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registrationStatus, setRegistrationStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isRegistered, setIsRegistered] = useState(false);

  const [registrationData, setRegistrationData] = useState({
    // Solo participant data
    participantName: '',
    participantEmail: '',
    participantPhone: '',
    participantCollege: '',
    participantYear: '',
    participantGender: '',
    participantAcademicYear: '',
    participantSkills: '',
    participantExperience: '',
    // Team data
    teamName: '',
    teamMembers: [] as TeamMember[],
    // Additional info
    specialRequirements: '',
    dietaryRestrictions: '',
    branch: '',
  });

  useEffect(() => {
    fetchEventDetails();
    if (user) {
      checkRegistrationStatus();
    }
  }, [params.id, user]);

  const fetchEventDetails = async () => {
    try {
      setLoading(true);
      const { data: eventData, error } = await supabase
        .from('events')
        .select(
          `
          *,
          club:clubs(*)
        `
        )
        .eq('id', params.id)
        .single();

      if (error) throw error;

      // Count the view (server-side RPC; failures are non-fatal)
      void supabase.rpc('increment_event_views', { p_event_id: params.id }).then(({ error: viewErr }) => {
        if (viewErr) console.warn('Failed to update views count:', viewErr.message);
      });

      // current_participants is maintained by a database trigger
      setEvent(eventData);
    } catch (error) {
      console.error('Error fetching event:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkRegistrationStatus = async () => {
    try {
      if (!user) {
        setIsRegistered(false);
        return;
      }

      // Check registration for THIS specific user
      const { data, error } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('event_id', params.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking registration:', error);
        return;
      }

      setIsRegistered(!!data);
    } catch (error) {
      console.error('Error checking registration status:', error);
    }
  };

  const initializeTeamMembers = () => {
    if (!event) return;

    const requiredMembers =
      event.team_size === '2_people'
        ? 2
        : event.team_size === 'group_4+'
          ? 4
          : 1;
    const members: TeamMember[] = [];

    for (let i = 0; i < requiredMembers; i++) {
      members.push({
        name: '',
        email: '',
        phone: '',
        college: '',
        year: '',
        gender: '',
        branch: '',
        academic_year: '',
      });
    }

    setRegistrationData((prev) => ({ ...prev, teamMembers: members }));
  };

  const updateTeamMember = (
    index: number,
    field: keyof TeamMember,
    value: string
  ) => {
    setRegistrationData((prev) => ({
      ...prev,
      teamMembers: prev.teamMembers.map((member, i) =>
        i === index ? { ...member, [field]: value } : member
      ),
    }));
  };

  const addTeamMember = () => {
    if (registrationData.teamMembers.length < 8) {
      // Max 8 members
      setRegistrationData((prev) => ({
        ...prev,
        teamMembers: [
          ...prev.teamMembers,
          {
            name: '',
            email: '',
            phone: '',
            college: '',
            year: '',
            gender: '',
            branch: '',
            academic_year: '',
          },
        ],
      }));
    }
  };

  const removeTeamMember = (index: number) => {
    const minMembers =
      event?.team_size === '2_people'
        ? 2
        : event?.team_size === 'group_4'
          ? 4
          : 1;
    if (registrationData.teamMembers.length > minMembers) {
      setRegistrationData((prev) => ({
        ...prev,
        teamMembers: prev.teamMembers.filter((_, i) => i !== index),
      }));
    }
  };

  const handleRegistration = async () => {
    if (!event) return;

    if (isRegistered) {
      setErrorMessage('You are already registered for this event!');
      setRegistrationStatus('error');
      return;
    }

    if (event.team_size === 'solo') {
      setRegistrationData((prev) => ({
        ...prev,
        teamMembers: [
          {
            name: '',
            email: '',
            phone: '',
            college: '',
            year: '',
            gender: '',
            branch: '',
            academic_year: '',
          },
        ],
      }));
    } else {
      initializeTeamMembers();
    }

    setShowRegistrationDialog(true);
  };

  const submitRegistration = async () => {
    if (!event) return;

    try {
      setRegistering(true);
      setRegistrationStatus('idle');
      setErrorMessage('');
      setSuccessMessage('');

      // Validate required fields
      if (event.team_size === 'solo') {
        const member = registrationData.teamMembers[0];
        if (!member.name || !member.email || !member.phone) {
          throw new Error('Please fill in all required fields');
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(member.email)) {
          throw new Error('Please enter a valid email address');
        }

        // Check if already registered with this email
        const { data: existingReg } = await supabase
          .from('event_registrations')
          .select('id')
          .eq('event_id', params.id)
          .eq(
            'registration_data->participant_details->email',
            member.email.toLowerCase()
          )
          .maybeSingle();

        if (existingReg) {
          throw new Error(
            'This email address has already been used to register for this event'
          );
        }
      } else {
        // Validate team data
        if (!registrationData.teamName) {
          throw new Error('Please provide a team name');
        }

        // Check team member emails
        const emails = new Set();
        for (let i = 0; i < registrationData.teamMembers.length; i++) {
          const member = registrationData.teamMembers[i];
          if (!member.name || !member.email) {
            throw new Error(
              `Please fill in name and email for team member ${i + 1}`
            );
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(member.email)) {
            throw new Error(
              `Please enter a valid email address for team member ${i + 1}`
            );
          }

          const email = member.email.toLowerCase();
          if (emails.has(email)) {
            throw new Error(
              'Each team member must have a unique email address'
            );
          }
          emails.add(email);

          // Check if email already registered
          const { data: existingReg } = await supabase
            .from('event_registrations')
            .select('id')
            .eq('event_id', params.id)
            .or(
              `participant_details->email.eq.${email},team_members->email.cs.{${email}}`
            )
            .maybeSingle();

          if (existingReg) {
            throw new Error(
              `The email address ${member.email} has already been used to register for this event`
            );
          }
        }
      }

      // Check if event is still open and has capacity
      const { data: currentEvent, error: eventError } = await supabase
        .from('events')
        .select('current_participants, capacity, registration_deadline')
        .eq('id', params.id)
        .single();

      if (eventError) throw eventError;

      if (currentEvent.registration_deadline && new Date() > new Date(currentEvent.registration_deadline)) {
        throw new Error('Registration deadline has passed');
      }

      if (
        currentEvent.capacity &&
        currentEvent.current_participants >= currentEvent.capacity
      ) {
        throw new Error('Event is full');
      }

      // Ensure user is logged in
      if (!user) {
        throw new Error('You must be logged in to register for events');
      }

      // Create registration record
      const registrationPayload = {
        event_id: params.id,
        user_id: user.id,
        team_name:
          event.team_size !== 'solo' ? registrationData.teamName : null,
        status: 'registered', // Using the correct enum value from database
        registration_data: {
          registration_type: event.team_size,
          participant_details:
            event.team_size === 'solo'
              ? {
                  name: registrationData.teamMembers[0].name.trim(),
                  email: registrationData.teamMembers[0].email
                    .trim()
                    .toLowerCase(),
                  phone: registrationData.teamMembers[0].phone.trim(),
                  college: registrationData.teamMembers[0].college.trim(),
                  year: registrationData.teamMembers[0].year.trim(),
                  gender: registrationData.teamMembers[0].gender.trim(),
                  skills: registrationData.participantSkills?.trim(),
                  experience: registrationData.participantExperience?.trim(),
                }
              : null,
          team_members:
            event.team_size !== 'solo'
              ? registrationData.teamMembers.map((member) => ({
                  name: member.name.trim(),
                  email: member.email.trim().toLowerCase(),
                  phone: member.phone?.trim(),
                  college: member.college?.trim(),
                  year: member.year?.trim(),
                  branch: member.branch?.trim(),
                  gender: member.gender?.trim(),
                }))
              : null,
          additional_info: {
            dietaryRestrictions: registrationData.dietaryRestrictions?.trim(),
            branch: registrationData.branch?.trim(),
          },
        },
      };

      const participantCount = event.team_size === 'solo'
        ? 1
        : registrationData.teamMembers.length;

      // Call database atomic function register_for_event via RPC
      const { data: newRegistration, error: registrationError } = await supabase
        .rpc('register_for_event', {
          p_event_id: params.id,
          p_team_name: event.team_size !== 'solo' ? registrationData.teamName : undefined,
          p_registration_data: registrationPayload.registration_data,
          p_participant_count: participantCount
        });

      if (registrationError) {
        console.error('Registration error:', registrationError);
        throw new Error(
          registrationError.message || 'Failed to save registration'
        );
      }

      if (!newRegistration) {
        throw new Error('Registration data not saved properly');
      }

      // Log successful registration
      console.log('Registration saved successfully');

      // Update UI state
      setRegistrationStatus('success');
      setSuccessMessage(
        'Registration completed successfully! You will receive a confirmation email shortly.'
      );
      setIsRegistered(true);
      setShowRegistrationDialog(false);

      // Refresh event data to show updated participant count
      await fetchEventDetails();
    } catch (error) {
      console.error('Registration error:', error);
      setRegistrationStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Registration failed'
      );
    } finally {
      setRegistering(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getDeadlineUrgency = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0)
      return {
        level: 'expired',
        color: 'text-destructive',
        text: 'Registration Closed',
      };
    if (diffDays <= 1)
      return {
        level: 'critical',
        color: 'text-destructive',
        text: 'Closes Today!',
      };
    if (diffDays <= 3)
      return {
        level: 'high',
        color: 'text-primary',
        text: `${diffDays} days left`,
      };
    if (diffDays <= 7)
      return {
        level: 'medium',
        color: 'text-warning',
        text: `${diffDays} days left`,
      };
    return {
      level: 'low',
      color: 'text-success',
      text: `${diffDays} days left`,
    };
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'online':
        return <Globe className="h-5 w-5" />;
      case 'offline':
        return <MapPin className="h-5 w-5" />;
      case 'hybrid':
        return <Monitor className="h-5 w-5" />;
      default:
        return <MapPin className="h-5 w-5" />;
    }
  };

  const getTeamSizeDisplay = (teamSize: string) => {
    switch (teamSize) {
      case 'solo':
        return 'Individual Participation';
      case '2_people':
        return 'Team of 2 People';
      case 'group_4':
        return 'Team of 4 People';
      default:
        return 'Individual Participation';
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'beginner':
        return 'bg-success/10 text-success border-success/20';
      case 'intermediate':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'advanced':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted text-foreground border-border';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background animate-pulse">
        <div className="bg-card border-b">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="h-6 bg-muted rounded w-32"></div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 space-y-8">
              <div className="bg-card rounded-2xl p-8">
                <div className="h-8 bg-muted rounded mb-4"></div>
                <div className="h-4 bg-muted rounded mb-2"></div>
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </div>
            </div>
            <div className="lg:col-span-1">
              <div className="bg-card rounded-2xl p-6">
                <div className="h-32 bg-muted rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Event Not Found
          </h2>
          <p className="text-muted-foreground mb-6">
            The event you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Button asChild>
            <Link href="/dashboard/student/browse">Back to Browse Events</Link>
          </Button>
        </div>
      </div>
    );
  }

  const urgency = getDeadlineUrgency(event.registration_deadline ?? event.starts_at);
  const contactInfo = parseContactInfo(event.contact_info);
  const eventType = event.type ?? 'event';
  const isRegistrationOpen = urgency.level !== 'expired';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <Link
            href="/dashboard/student/browse"
            className="inline-flex items-center text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Browse Events
          </Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Hero Section */}
            <div className="bg-card rounded-2xl overflow-hidden shadow-soft-lg border border-border">
              <div className="relative h-64 bg-background">
                <img
                  src={
                    event.image_url ||
                    `/placeholder.svg?height=300&width=800&query=${encodeURIComponent(event.title)}`
                  }
                  alt={event.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-foreground/50"></div>
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <Badge className="bg-card/90 text-foreground font-semibold">
                      {eventType.charAt(0).toUpperCase() + eventType.slice(1)}
                    </Badge>
                    <Badge className="bg-card/90 text-foreground font-semibold">
                      {getModeIcon(event.mode)}
                      <span className="ml-1">
                        {event.mode.charAt(0).toUpperCase() +
                          event.mode.slice(1)}
                      </span>
                    </Badge>
                    {event.prize_pool && (
                      <Badge className="bg-warning text-primary-foreground font-bold">
                        <Trophy className="h-3 w-3 mr-1" />₹
                        {event.prize_pool.toLocaleString()}
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-3xl font-bold text-primary-foreground mb-2">
                    {event.title}
                  </h1>
                  {event.club && (
                    <div className="flex items-center text-primary-foreground/90">
                      <div className="w-8 h-8 bg-card/20 rounded-lg flex items-center justify-center mr-3">
                        <span className="text-sm font-bold">
                          {event.club.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold">{event.club.name}</div>
                        <div className="flex items-center text-sm">
                          <Star className="h-3 w-3 mr-1 text-warning fill-current" />
                          <span>
                            {event.club.credibility_score?.toFixed(1) || '4.0'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Event Details Tabs */}
            <Tabs
              defaultValue="overview"
              className="bg-card rounded-2xl shadow-soft-lg border border-border"
            >
              <TabsList className="w-full justify-start border-b border-border bg-transparent rounded-none p-0">
                <TabsTrigger
                  value="overview"
                  className="px-6 py-4 font-semibold"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="details"
                  className="px-6 py-4 font-semibold"
                >
                  Details
                </TabsTrigger>
                <TabsTrigger
                  value="requirements"
                  className="px-6 py-4 font-semibold"
                >
                  Requirements
                </TabsTrigger>
                <TabsTrigger
                  value="organizer"
                  className="px-6 py-4 font-semibold"
                >
                  Organizer
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="p-8 space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-4">
                    About This Event
                  </h2>
                  <p className="text-foreground leading-relaxed text-lg">
                    {event.description}
                  </p>
                </div>

                {/* Key Information */}
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="border border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center text-lg">
                        <Calendar className="h-5 w-5 mr-2 text-primary" />
                        Event Schedule
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="font-semibold text-foreground">
                          Start Date & Time
                        </div>
                        <div className="text-muted-foreground">
                          {formatDate(event.starts_at)} at{' '}
                          {formatTime(event.starts_at)}
                        </div>
                      </div>
                      {event.ends_at && (
                        <div>
                          <div className="font-semibold text-foreground">
                            End Date & Time
                          </div>
                          <div className="text-muted-foreground">
                            {formatDate(event.ends_at)} at{' '}
                            {formatTime(event.ends_at)}
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-foreground">
                          Duration
                        </div>
                        <div className="text-muted-foreground">{event.duration}</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center text-lg">
                        <Users className="h-5 w-5 mr-2 text-success" />
                        Participation
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="font-semibold text-foreground">
                          Team Size
                        </div>
                        <div className="text-muted-foreground">
                          {getTeamSizeDisplay(event.team_size || 'solo')}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          Difficulty Level
                        </div>
                        <Badge
                          className={getLevelColor(event.level || 'beginner')}
                        >
                          {(event.level || 'beginner').charAt(0).toUpperCase() +
                            (event.level || 'beginner').slice(1)}
                        </Badge>
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">
                          Registered Participants
                        </div>
                        <div className="text-muted-foreground">
                          {event.current_participants}
                          {event.capacity &&
                            ` / ${event.capacity}`}{' '}
                          participants
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tags */}
                {event.tags && event.tags.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-3">
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {event.tags.map((tag, index) => (
                        <Badge
                          key={index}
                          variant="outline"
                          className="px-3 py-1"
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="details" className="p-8 space-y-6">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center">
                        <MapPin className="h-5 w-5 mr-2 text-destructive" />
                        Location & Venue
                      </h3>
                      <div className="bg-background rounded-lg p-4">
                        <div className="font-medium text-foreground">
                          {event.mode.charAt(0).toUpperCase() +
                            event.mode.slice(1)}{' '}
                          Event
                        </div>
                        {event.venue && (
                          <div className="text-muted-foreground mt-1">
                            {event.venue}
                          </div>
                        )}
                        <div className="text-muted-foreground mt-1">
                          {event.college}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center">
                        <Trophy className="h-5 w-5 mr-2 text-warning" />
                        Rewards & Recognition
                      </h3>
                      <div className="bg-background rounded-lg p-4">
                        {event.prize_pool ? (
                          <div>
                            <div className="font-medium text-foreground">
                              Prize Pool: ₹{event.prize_pool.toLocaleString()}
                            </div>
                            <div className="text-muted-foreground mt-1">
                              Exciting prizes for winners!
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-foreground">
                              Certificates & Recognition
                            </div>
                            <div className="text-muted-foreground mt-1">
                              All participants will receive certificates
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center">
                        <Clock className="h-5 w-5 mr-2 text-primary" />
                        Important Dates
                      </h3>
                      <div className="bg-background rounded-lg p-4 space-y-3">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Registration Deadline
                          </span>
                          <span className="font-medium text-foreground">
                            {formatDate(event.registration_deadline ?? event.starts_at)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Event Date</span>
                          <span className="font-medium text-foreground">
                            {formatDate(event.starts_at)}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-border">
                          <div className={`font-semibold ${urgency.color}`}>
                            {urgency.text}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center">
                        <Target className="h-5 w-5 mr-2 text-primary" />
                        Category & Type
                      </h3>
                      <div className="bg-background rounded-lg p-4 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Category</span>
                          <Badge variant="outline">{event.category}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Event Type</span>
                          <Badge variant="outline">
                            {eventType.charAt(0).toUpperCase() +
                              eventType.slice(1)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="requirements" className="p-8">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center">
                      <BookOpen className="h-6 w-6 mr-2 text-primary" />
                      Requirements & Prerequisites
                    </h2>
                  </div>

                  {event.requirements && event.requirements.length > 0 ? (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
                      <h3 className="font-semibold text-primary mb-4 flex items-center">
                        <CheckCircle className="h-5 w-5 mr-2" />
                        What You Need
                      </h3>
                      <ul className="space-y-3">
                        {event.requirements.map((requirement, index) => (
                          <li key={index} className="flex items-start">
                            <div className="w-2 h-2 bg-primary rounded-full mt-2 mr-3 flex-shrink-0"></div>
                            <span className="text-primary">{requirement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="bg-success/5 border border-success/20 rounded-lg p-6 text-center">
                      <Zap className="h-12 w-12 text-success mx-auto mb-4" />
                      <h3 className="font-semibold text-success mb-2">
                        No Special Requirements
                      </h3>
                      <p className="text-success">
                        This event is open to everyone! Just bring your
                        enthusiasm and willingness to learn.
                      </p>
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    <Card className="border border-border">
                      <CardHeader>
                        <CardTitle className="flex items-center text-lg">
                          <Award className="h-5 w-5 mr-2 text-primary" />
                          Skill Level
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Badge
                          className={`${getLevelColor(event.level || 'beginner')} text-sm px-3 py-1`}
                        >
                          {(event.level || 'beginner').charAt(0).toUpperCase() +
                            (event.level || 'beginner').slice(1)}{' '}
                          Level
                        </Badge>
                        <p className="text-muted-foreground mt-2">
                          {event.level === 'beginner' &&
                            'Perfect for newcomers and those just starting out.'}
                          {event.level === 'intermediate' &&
                            'Suitable for those with some prior experience.'}
                          {event.level === 'advanced' &&
                            'Designed for experienced participants seeking challenges.'}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border border-border">
                      <CardHeader>
                        <CardTitle className="flex items-center text-lg">
                          <Users className="h-5 w-5 mr-2 text-success" />
                          Team Formation
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="font-medium text-foreground mb-2">
                          {getTeamSizeDisplay(event.team_size || 'solo')}
                        </div>
                        <p className="text-muted-foreground">
                          {event.team_size === 'solo' &&
                            'Individual participation - showcase your personal skills!'}
                          {event.team_size === '2_people' &&
                            'Partner up with a friend or colleague for this collaborative experience.'}
                          {event.team_size === 'group_4+' &&
                            'Form a team of 4 or more members to tackle this challenge together.'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="organizer" className="p-8">
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground mb-6">
                      Event Organizer
                    </h2>
                  </div>

                  {event.club ? (
                    <Card className="border border-border">
                      <CardContent className="p-6">
                        <div className="flex items-start space-x-4">
                          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-xl">
                            {event.club.name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-xl font-bold text-foreground">
                                {event.club.name}
                              </h3>
                              {event.club.is_verified && (
                                <Badge className="bg-primary/10 text-primary">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Verified
                                </Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground mb-3">
                              {event.club.description}
                            </p>
                            <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                              <div className="flex items-center">
                                <Users className="h-4 w-4 mr-1" />
                                <span>{event.club.members_count} members</span>
                              </div>
                              <div className="flex items-center">
                                <Calendar className="h-4 w-4 mr-1" />
                                <span>
                                  {event.club.events_hosted_count} events hosted
                                </span>
                              </div>
                              <div className="flex items-center">
                                <Star className="h-4 w-4 mr-1 text-warning" />
                                <span>
                                  {event.club.credibility_score?.toFixed(1)}{' '}
                                  rating
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="border border-border">
                      <CardContent className="p-6">
                        <div className="text-center">
                          <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Users className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <h3 className="text-xl font-bold text-foreground mb-2">
                            Independent Event
                          </h3>
                          <p className="text-muted-foreground">
                            This event is organized independently.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Contact Information */}
                  {(contactInfo.email || contactInfo.phone) && (
                    <Card className="border border-border">
                      <CardHeader>
                        <CardTitle className="text-lg">
                          Contact Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {contactInfo.email && (
                          <div className="flex items-center">
                            <Mail className="h-5 w-5 mr-3 text-muted-foreground" />
                            <a
                              href={`mailto:${contactInfo.email}`}
                              className="text-primary hover:text-primary"
                            >
                              {contactInfo.email}
                            </a>
                          </div>
                        )}
                        {contactInfo.phone && (
                          <div className="flex items-center">
                            <Phone className="h-5 w-5 mr-3 text-muted-foreground" />
                            <a
                              href={`tel:${contactInfo.phone}`}
                              className="text-primary hover:text-primary"
                            >
                              {contactInfo.phone}
                            </a>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              {/* Registration Card */}
              <Card className="border border-border shadow-soft-lg">
                <CardContent className="p-6">
                  {/* Price */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-3xl font-bold text-foreground">
                      {event.fee > 0 ? `₹${event.fee}` : 'Free'}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Heart className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-primary"
                      >
                        <Calendar className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-muted-foreground"
                      >
                        <Share2 className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  {/* Registration Status */}
                  <div className="mb-4">
                    <div
                      className={`font-semibold ${urgency.color} flex items-center`}
                    >
                      {urgency.level === 'expired' ? (
                        <AlertTriangle className="h-4 w-4 mr-2" />
                      ) : (
                        <Clock className="h-4 w-4 mr-2" />
                      )}
                      {urgency.text}
                    </div>
                  </div>

                  {/* Registration Status Messages */}
                  {registrationStatus === 'success' && (
                    <Alert className="mb-4 border-success/20 bg-success/5">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <AlertDescription className="text-success">
                        {successMessage ||
                          "Registration successful! You're all set for the event."}
                      </AlertDescription>
                    </Alert>
                  )}

                  {registrationStatus === 'error' && (
                    <Alert className="mb-4 border-destructive/20 bg-destructive/5">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <AlertDescription className="text-destructive">
                        {errorMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  {isRegistrationOpen ? (
                    <Button
                      onClick={handleRegistration}
                      disabled={registering || isRegistered}
                      className={`w-full py-3 rounded-lg font-semibold text-base mb-4 ${
                        isRegistered
                          ? 'bg-success hover:bg-success/90'
                          : 'bg-primary hover:bg-primary/90'
                      } text-primary-foreground`}
                    >
                      {isRegistered ? (
                        <>
                          <CheckCircle className="h-5 w-5 mr-2" />
                          Registered
                        </>
                      ) : event.team_size === 'solo' ? (
                        'Register Now'
                      ) : (
                        `Register Team`
                      )}
                    </Button>
                  ) : (
                    <Button
                      disabled
                      className="w-full py-3 rounded-lg font-semibold text-base mb-4 bg-muted text-muted-foreground"
                    >
                      Registration Closed
                    </Button>
                  )}

                  {/* Event Stats */}
                  <div className="space-y-3 text-sm border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Participants</span>
                      <span className="font-semibold text-foreground">
                        {event.current_participants}
                        {event.capacity &&
                          ` / ${event.capacity}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Event Views</span>
                      <span className="font-semibold text-foreground">2,450</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Team Size</span>
                      <span className="font-semibold text-foreground">
                        {getTeamSizeDisplay(event.team_size || 'solo')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Event Features */}
              <Card className="border border-border">
                <CardHeader>
                  <CardTitle className="text-lg">Event Features</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {contactInfo.certificates_enabled && (
                    <div className="flex items-center text-sm">
                      <Award className="h-4 w-4 mr-2 text-success" />
                      <span>Digital Certificates</span>
                    </div>
                  )}
                  {contactInfo.qr_enabled && (
                    <div className="flex items-center text-sm">
                      <CheckCircle className="h-4 w-4 mr-2 text-primary" />
                      <span>QR Code Attendance</span>
                    </div>
                  )}
                  <div className="flex items-center text-sm">
                    <Eye className="h-4 w-4 mr-2 text-primary" />
                    <span>Live Event Updates</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={showRegistrationDialog}
        onOpenChange={setShowRegistrationDialog}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center text-2xl">
              <User className="h-6 w-6 mr-2 text-primary" />
              {event?.team_size === 'solo'
                ? 'Register for Event'
                : 'Team Registration'}
            </DialogTitle>
            <DialogDescription>
              {event?.team_size === 'solo'
                ? 'Fill in your details to register for this event'
                : `Create your team of ${getTeamSizeDisplay(event?.team_size || 'solo').toLowerCase()} and register`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Status Messages */}
            {registrationStatus === 'error' && (
              <Alert className="border-destructive/20 bg-destructive/5">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            {event?.team_size === 'solo' ? (
              // Solo Registration Form
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground mb-4 text-lg">
                  Personal Information
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={registrationData.teamMembers[0]?.name || ''}
                      onChange={(e) =>
                        updateTeamMember(0, 'name', e.target.value)
                      }
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={registrationData.teamMembers[0]?.email || ''}
                      onChange={(e) =>
                        updateTeamMember(0, 'email', e.target.value)
                      }
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      value={registrationData.teamMembers[0]?.phone || ''}
                      onChange={(e) =>
                        updateTeamMember(0, 'phone', e.target.value)
                      }
                      placeholder="Enter your phone number"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="college">College/University</Label>
                    <Input
                      id="college"
                      value={registrationData.teamMembers[0]?.college || ''}
                      onChange={(e) =>
                        updateTeamMember(0, 'college', e.target.value)
                      }
                      placeholder="Enter your college"
                    />
                  </div>
                  <div>
                    <Label htmlFor="year">Year of Study *</Label>
                    <Select
                      value={registrationData.teamMembers[0]?.year || ''}
                      onValueChange={(value) =>
                        updateTeamMember(0, 'year', value)
                      }
                    >
                      <SelectTrigger id="year" className="w-full">
                        <SelectValue placeholder="Select your year of study" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1st year">1st Year</SelectItem>
                        <SelectItem value="2nd year">2nd Year</SelectItem>
                        <SelectItem value="3rd year">3rd Year</SelectItem>
                        <SelectItem value="4th year">4th Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="gender">Gender *</Label>
                    <Select
                      value={registrationData.teamMembers[0]?.gender || ''}
                      onValueChange={(value) =>
                        updateTeamMember(0, 'gender', value)
                      }
                    >
                      <SelectTrigger id="gender" className="w-full">
                        <SelectValue placeholder="Select your gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="branch">Branch</Label>
                    <Input
                      id="branch"
                      value={registrationData.branch}
                      onChange={(e) =>
                        setRegistrationData((prev) => ({
                          ...prev,
                          branch: e.target.value,
                        }))
                      }
                      placeholder="Your branch/department"
                    />
                  </div>
                </div>
              </div>
            ) : (
              // Team Registration Form
              <div className="space-y-6">
                <div>
                  <Label htmlFor="teamName">Team Name *</Label>
                  <Input
                    id="teamName"
                    value={registrationData.teamName}
                    onChange={(e) =>
                      setRegistrationData((prev) => ({
                        ...prev,
                        teamName: e.target.value,
                      }))
                    }
                    placeholder="Enter your team name"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-foreground text-lg">
                      Team Members
                    </h3>
                  </div>

                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {registrationData.teamMembers.map((member, index) => (
                      <Card key={index} className="border border-border p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-foreground">
                            {index === 0 ? 'Team Leader' : `Member ${index}`}
                          </h4>
                        </div>
                        <div className="grid md:grid-cols-2 gap-3">
                          <div>
                            <Label>Name *</Label>
                            <Input
                              value={member.name}
                              onChange={(e) =>
                                updateTeamMember(index, 'name', e.target.value)
                              }
                              placeholder="Full name"
                              required
                            />
                          </div>
                          <div>
                            <Label>Email *</Label>
                            <Input
                              type="email"
                              value={member.email}
                              onChange={(e) =>
                                updateTeamMember(index, 'email', e.target.value)
                              }
                              placeholder="Email address"
                              required
                            />
                          </div>
                          <div>
                            <Label>Phone</Label>
                            <Input
                              value={member.phone}
                              onChange={(e) =>
                                updateTeamMember(index, 'phone', e.target.value)
                              }
                              placeholder="Phone number"
                            />
                          </div>
                          <div>
                            <Label>College</Label>
                            <Input
                              value={member.college}
                              onChange={(e) =>
                                updateTeamMember(
                                  index,
                                  'college',
                                  e.target.value
                                )
                              }
                              placeholder="College/University"
                            />
                          </div>
                          <div>
                            <Label>Branch/Department</Label>
                            <Input
                              value={member.branch}
                              onChange={(e) =>
                                updateTeamMember(
                                  index,
                                  'branch',
                                  e.target.value
                                )
                              }
                              placeholder="e.g., Computer Science"
                            />
                          </div>
                          <div>
                            <Label>Year of Study *</Label>
                            <Select
                              value={member.year}
                              onValueChange={(value) =>
                                updateTeamMember(index, 'year', value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select year" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1st year">
                                  1st Year
                                </SelectItem>
                                <SelectItem value="2nd year">
                                  2nd Year
                                </SelectItem>
                                <SelectItem value="3rd year">
                                  3rd Year
                                </SelectItem>
                                <SelectItem value="4th year">
                                  4th Year
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Gender *</Label>
                            <Select
                              value={member.gender}
                              onValueChange={(value) =>
                                updateTeamMember(index, 'gender', value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select gender" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex space-x-3 pt-4 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRegistrationDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={submitRegistration}
                disabled={registering}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                {registering ? 'Registering...' : 'Complete Registration'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
