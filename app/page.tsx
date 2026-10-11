'use client';
import { SimpleCarousel } from '@/components/ui/animated-feature-carousel';
import { useState, useEffect, useRef } from 'react';
import { CountAnimation } from '@/components/ui/count-animation';
import { Button } from '@/components/ui/button';
import { PricingSection } from '@/components/PricingSection';
import {
  PricingCardSimple,
  PricingCardAdvanced,
} from '@/components/PricingCard';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import EtherealBeamsHero from '@/components/ui/ethereal-beams-hero';
import FeaturesCards from '@/components/ui/feature-shader-cards';
import { BGGrid } from '@/components/ui/bg-grid';
import {
  Award,
  Users,
  Calendar,
  TrendingUp,
  ArrowRight,
  Play,
  Plus,
  ChevronRight,
  CheckCircle,
  Star,
  Shield,
  Globe,
  BarChart3,
  Trophy,
  Heart,
  MessageSquare,
  Mail,
  Phone,
  MapPin,
  Target,
} from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [counter, setCounter] = useState(0);
  const counterRef = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [activeTab, setActiveTab] = useState('students');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Animated counter effect
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let start = 0;
          const end = 50000;
          const duration = 2000;
          const increment = end / (duration / 16);

          const timer = setInterval(() => {
            start += increment;
            if (start >= end) {
              setCounter(end);
              clearInterval(timer);
            } else {
              setCounter(Math.floor(start));
            }
          }, 16);
        }
      },
      { threshold: 0.2 }
    );

    if (counterRef.current) {
      observer.observe(counterRef.current);
    }

    return () => observer.disconnect();
  }, [hasAnimated]);

  const navItems = [
    { name: 'Features', href: '#features' },
    { name: 'Pricing', href: '#pricing' },
    { name: 'Success Stories', href: '#testimonials' },
    { name: 'FAQ', href: '#faq' },
  ];

  const features = [
    {
      icon: Calendar,
      title: 'Smart Event Discovery',
      description:
        'AI-powered recommendations help you find events that match your interests and skill level.',
      color: 'bg-blue-600',
    },
    {
      icon: Users,
      title: 'Team Formation',
      description:
        'Connect with like-minded students and form teams for competitions and projects.',
      color: 'bg-emerald-600',
    },
    {
      icon: Trophy,
      title: 'Achievement Tracking',
      description:
        'Earn certificates, badges, and build your portfolio with every event you participate in.',
      color: 'bg-amber-600',
    },
    {
      icon: BarChart3,
      title: 'Analytics Dashboard',
      description:
        'Track your progress, see your growth, and get insights into your learning journey.',
      color: 'bg-violet-600',
    },
    {
      icon: Shield,
      title: 'Verified Events',
      description:
        'All events are verified by our team to ensure quality and authenticity.',
      color: 'bg-rose-600',
    },
    {
      icon: Globe,
      title: 'Multi-Campus Network',
      description:
        'Connect with students from 200+ colleges across India and participate in inter-college events.',
      color: 'bg-cyan-600',
    },
  ];

  const pricingPlans = [
    {
      name: 'Student',
      price: 'Free',
      description:
        'Perfect for students looking to discover and participate in events',
      features: [
        'Browse unlimited events',
        'Join up to 5 events per month',
        'Basic profile and certificates',
        'Community access',
        'Mobile app access',
      ],
      popular: false,
      cta: 'Get Started Free',
    },
    {
      name: 'Organizer',
      price: '₹999',
      period: '/month',
      description: 'Ideal for clubs and organizations hosting regular events',
      features: [
        'Host unlimited events',
        'Advanced analytics dashboard',
        'Custom branding options',
        'Priority support',
        'QR code attendance',
        'Certificate generation',
        'Revenue management',
      ],
      popular: true,
      cta: 'Start Free Trial',
    },
    {
      name: 'Institution',
      price: 'Custom',
      description: 'Comprehensive solution for colleges and universities',
      features: [
        'Multi-department management',
        'Custom integrations',
        'Dedicated account manager',
        'Advanced reporting',
        'White-label solution',
        'API access',
        '24/7 support',
      ],
      popular: false,
      cta: 'Contact Sales',
    },
  ];

  const testimonials = [
    {
      name: 'Priya Sharma',
      role: 'Computer Science Student',
      college: 'IIT Delhi',
      content:
        "Clunite helped me discover amazing hackathons and workshops. I've participated in 12 events this year and won 3 competitions!",
      rating: 5,
      avatar: 'PS',
    },
    {
      name: 'Rahul Gupta',
      role: 'Event Organizer',
      college: 'BITS Pilani',
      content:
        'Managing events has never been easier. The analytics dashboard gives us incredible insights into participant engagement.',
      rating: 5,
      avatar: 'RG',
    },
    {
      name: 'Dr. Anjali Mehta',
      role: 'Dean of Student Affairs',
      college: 'NIT Trichy',
      content:
        'Clunite has transformed how we manage campus events. Student participation has increased by 40% since we started using it.',
      rating: 5,
      avatar: 'AM',
    },
    {
      name: 'Arjun Patel',
      role: 'Startup Founder',
      college: 'IIM Ahmedabad',
      content:
        'I discovered my co-founder through a startup competition on Clunite. The platform truly connects the right people!',
      rating: 5,
      avatar: 'AP',
    },
  ];

  const faqs = [
    {
      question: 'How do I get started with Clunite?',
      answer:
        "Simply sign up with your college email address and start exploring events immediately. It's completely free for students!",
    },
    {
      question: 'Can I host events on Clunite?',
      answer:
        'Yes! You can start with our free organizer account to host small events, or upgrade to our paid plan for advanced features and unlimited events.',
    },
    {
      question: 'Are the events verified?',
      answer:
        'Absolutely. Our team verifies all events and organizers to ensure quality and authenticity. We also have a rating system for additional transparency.',
    },
    {
      question: 'Can I participate in events from other colleges?',
      answer:
        'Yes! Many events are open to students from multiple colleges. You can filter events to see which ones accept inter-college participation.',
    },
    {
      question: 'Do I get certificates for participating?',
      answer:
        'Most events provide digital certificates upon completion. These are automatically added to your Clunite profile and can be downloaded anytime.',
    },
    {
      question: 'Is there a mobile app?',
      answer:
        'Yes! Our mobile app is available for both iOS and Android, allowing you to discover events, register, and stay updated on the go.',
    },
    {
      question: 'How does the team formation feature work?',
      answer:
        'You can create or join teams for events that require group participation. Our matching algorithm suggests compatible teammates based on skills and interests.',
    },
    {
      question: 'What payment methods do you accept?',
      answer:
        'We accept all major credit/debit cards, UPI, net banking, and digital wallets. All transactions are secure and encrypted.',
    },
  ];

  const [query, setQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (i: number) => {
    setOpenIndex(openIndex === i ? null : i);
  };

  const filteredFaqs = query
    ? faqs.filter(({ question, answer }) =>
        (question + answer).toLowerCase().includes(query.toLowerCase())
      )
    : faqs;

  return (
    <div
      className="min-h-screen overflow-hidden"
      style={{ backgroundColor: '#000000', color: '#EEF2FF' }}
    >
      {/* New Ethereal Beams Hero Section */}
      <EtherealBeamsHero />

      {/* Dark Stats Section - Like Zapier */}
      <section
        className="relative py-24 px-6 overflow-hidden 
            [mask-image:radial-gradient(ellipse_at_center,var(--background),transparent)]"
        style={{
          backgroundColor: '#000000',
          color: '#EEF2FF',
          backgroundImage: `
          radial-gradient(circle at center,
            rgba(0, 0, 0, 0) 0%,     /* fully visible grid in center */
            rgba(0, 0, 0, 1) 000%     /* faded edges */
          ),
          linear-gradient(to right, rgba(255, 255, 255, 0) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0) 1px, transparent 1px)
        `,
          backgroundSize: '44px 44px',
        }}
      >
        <div className="max-w-7xl mx-auto relative z-10">
          <div
            className="mb-8 inline-flex items-center rounded-full backdrop-blur-xl px-4 py-2 text-sm leading-[1.5] tracking-[0.02em] font-sans"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: '#EEF2FF',
            }}
          >
            Real campus engagement. Real results.
          </div>

          <div className="mb-16">
            <h2
              className="text-6xl md:text-8xl font-bold mb-4"
              style={{ color: '#EEF2FF' }}
            >
              <CountAnimation number={50000} className="text-6xl md:text-8xl" />
              +
            </h2>

            <p className="text-xl" style={{ color: '#9AA0C7' }}>
              Students connected through Clunite (and counting)
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Discover events across 200+ colleges instantly',
                icon: Target,
              },
              {
                title: 'Smart recommendations match your interests',
                icon: Star,
              },
              {
                title: 'Form teams and connect with like-minded students',
                icon: Users,
              },
              {
                title: 'Track achievements and build your portfolio',
                icon: Trophy,
              },
            ].map((item, index) => (
              <div
                key={index}
                className="
                  group p-6 rounded-2xl cursor-pointer
                  transition-all duration-300
                  backdrop-blur-xl
                  shadow-[0_4px_30px_rgba(0,0,0,0.3)]
                  glass-card
                "
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div className="mb-4 group-hover:scale-105 transition-transform">
                  <item.icon className="h-8 w-8" style={{ color: '#00C2FF' }} />
                </div>

                <p
                  className="text-base leading-relaxed"
                  style={{ color: '#EEF2FF' }}
                >
                  {item.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trusted By Section */}
      <section
        className="relative py-24 px-6 overflow-hidden 
            [mask-image:radial-gradient(ellipse_at_center,var(--background),transparent)]"
        style={{
          backgroundImage: `
            radial-gradient(circle at center,
              rgba(0, 0, 0, 0) 0%,     /* fully visible grid in center */
              rgba(0, 0, 0, 1) 0%     /* faded edges */
            ),
            linear-gradient(to right, rgba(255, 255, 255, 0) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0) 1px, transparent 1px)
          `,
          backgroundSize: '44px 44px',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-sm mb-8" style={{ color: '#EEF2FF' }}>
            Trusted by students from India&apos;s top institutions
          </p>
          <div className="flex flex-wrap items-center justify-center gap-12 opacity-60">
            {[
              'IIT Delhi',
              'IIT Bombay',
              'BITS Pilani',
              'NIT Trichy',
              'VIT Vellore',
              'IIIT Hyderabad',
              'DTU',
              'NSUT',
            ].map((college, index) => (
              <div
                key={index}
                className="text-lg font-bold transition-colors cursor-pointer"
                style={{ color: '#EEF2FF' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#FF7A00')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#EEF2FF')}
              >
                {college}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section with Tabs */}
      <section
        className="relative py-24 px-6 overflow-hidden 
            [mask-image:radial-gradient(ellipse_at_center,var(--background),transparent)]"
        style={{
          backgroundColor: '#000000',
          color: '#EEF2FF',
          backgroundImage: `
  linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px) ,
`,
          backgroundSize: '44px 44px',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <div
              className="mb-8 inline-flex items-center rounded-full backdrop-blur-xl px-4 py-2 text-sm"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#EEF2FF',
              }}
            >
              Real campus teams, real results
            </div>

            <h2
              className="font-extrabold text-4xl md:text-5xl lg:text-6xl tracking-tight leading-[1.15] mb-6"
              style={{ color: '#EEF2FF' }}
            >
              Built for every campus role
            </h2>

            <p
              className="text-base sm:text-lg max-w-3xl"
              style={{ color: '#9AA0C7' }}
            >
              Whether you&apos;re a student, organizer, or club leader — Clunite has
              the tools you need.
            </p>
          </div>

          <SimpleCarousel
            slides={[
              {
                title: 'Students',
                subtitle: 'Discover Events Easily',
                image:
                  'https://images.unsplash.com/photo-1618761714954-0b8cd0026356',
              },
              {
                title: 'Organizers',
                subtitle: 'Host With Ease',
                image:
                  'https://images.unsplash.com/photo-1542393545-10f5cde2c810',
              },
              {
                title: 'Clubs',
                subtitle: 'Grow Your Community',
                image:
                  'https://images.unsplash.com/photo-1587620962725-abab7fe55159',
              },
              {
                title: 'Colleges',
                subtitle: 'Automated Workflows',
                image:
                  'https://images.unsplash.com/photo-1498050108023-c5249f4df085',
              },
            ]}
          />
        </div>
      </section>

      {/* Features Section - Shader Cards */}
      <FeaturesCards />

      {/* Pricing Section - Zapier Style */}
      {/* Pricing Section */}
      <div
        id="pricing"
        className="relative py-24 px-6 overflow-hidden 
      [mask-image:radial-gradient(ellipse_at_center,var(--background),transparent)]"
        style={{
          backgroundColor: '#000000',
          color: '#EEF2FF',
          backgroundImage: `
      linear-gradient(to right, rgba(255, 255, 255, 0) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0) 1px, transparent 1px)
    `,
          backgroundSize: '44px 44px',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div
              className="mb-8 inline-flex items-center rounded-full backdrop-blur-xl px-4 py-2 text-sm leading-[1.5] tracking-[0.02em] font-sans"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#EEF2FF',
              }}
            >
              Flexible Pricing
            </div>

            <h2
              className="font-sans font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-[1.15] tracking-[-0.01em] mb-4"
              style={{ color: '#EEF2FF' }}
            >
              Simple, transparent pricing
            </h2>

            <p
              className="font-sans text-base sm:text-lg leading-[1.7] tracking-[0.005em] max-w-2xl mx-auto"
              style={{ color: '#9AA0C7' }}
            >
              Choose the perfect plan for your needs. Start free and upgrade as
              you grow.
            </p>
          </div>

          {/* INSERT THE NEW COMPONENT HERE */}
          <PricingSection plans={pricingPlans} />
        </div>
      </div>

      {/* Success Stories Section - Zapier Style with Large Quote */}
      <section
        id="testimonials"
        className="relative py-24 px-6 overflow-hidden 
            [mask-image:radial-gradient(ellipse_at_center,var(--background),transparent)]"
        style={{
          backgroundColor: '#000000',
          color: '#EEF2FF',
          backgroundImage: `
  linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px) ,
`,
          backgroundSize: '44px 44px',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="mb-16">
            {/* Badge */}
            <div
              className="mb-8 inline-flex items-center rounded-full backdrop-blur-xl px-4 py-2 text-sm leading-[1.5] tracking-[0.02em] font-sans"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: '#EEF2FF',
              }}
            >
              Student Success Stories
            </div>

            {/* Heading */}
            <h2
              className="font-sans font-extrabold text-4xl md:text-5xl leading-[1.15] tracking-[-0.01em] mb-4"
              style={{ color: '#EEF2FF' }}
            >
              Loved by students across India
            </h2>

            {/* Description */}
            <p
              className="font-sans text-base sm:text-lg leading-[1.65] tracking-[0.005em] max-w-2xl"
              style={{ color: '#9AA0C7' }}
            >
              See how students are using Clunite to discover events, build
              teams, and grow their campus experience.
            </p>
          </div>

          {/* Featured Large Testimonial */}
          <div
            className="mb-8 p-6 rounded-xl"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="max-w-4xl">
              {/* Stars */}
              <div className="flex gap-1 mb-3">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-4 w-4"
                    style={{ fill: '#00C2FF', color: '#00C2FF' }}
                  />
                ))}
              </div>

              {/* Quote */}
              <p
                className="text-lg md:text-xl font-medium mb-4 leading-relaxed"
                style={{ color: '#EEF2FF' }}
              >
                &quot;Clunite completely transformed how I discover and participate
                in campus events. I&apos;ve connected with amazing people and built
                skills I never thought possible.&quot;
              </p>

              {/* User Info */}
              <div
                className="flex items-center gap-2 pt-4"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div>
                  <div
                    className="font-bold text-sm"
                    style={{ color: '#EEF2FF' }}
                  >
                    Priya Sharma
                  </div>
                  <div className="text-xs" style={{ color: '#9AA0C7' }}>
                    Computer Science Student
                  </div>
                  <div
                    className="text-xs font-medium"
                    style={{ color: '#9AA0C7' }}
                  >
                    IIT Delhi
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Grid of smaller testimonials */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testimonials.slice(1).map((testimonial, index) => (
              <div
                key={index}
                className="group relative p-4 rounded-xl transition-all duration-300"
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#9AA0C7';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                }}
              >
                <div className="flex gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-3.5 w-3.5"
                      style={{ fill: '#00C2FF', color: '#00C2FF' }}
                    />
                  ))}
                </div>

                <p
                  className="mb-3 leading-relaxed text-xs"
                  style={{ color: '#EEF2FF' }}
                >
                  &quot;{testimonial.content}&quot;
                </p>

                <div
                  className="pt-3"
                  style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div
                    className="font-bold text-xs"
                    style={{ color: '#EEF2FF' }}
                  >
                    {testimonial.name}
                  </div>
                  <div className="text-[10px]" style={{ color: '#9AA0C7' }}>
                    {testimonial.role}
                  </div>
                  <div
                    className="text-[10px] font-medium"
                    style={{ color: '#9AA0C7' }}
                  >
                    {testimonial.college}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section - Clean Accordion Style */}
      <section
        id="faq"
        className="relative py-24 px-6 overflow-hidden 
            [mask-image:radial-gradient(ellipse_at_center,var(--background),transparent)]"
        style={{
          backgroundColor: '#000000',
          color: '#EEF2FF',
          backgroundImage: `
  linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px) ,
`,
          backgroundSize: '44px 44px',
        }}
      >
        <div className="max-w-5xl mx-auto">
          {/* HEADER */}
          <header
            className="mb-10 flex items-end justify-between pb-6"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div>
              {/* Title */}
              <h1
                className="text-4xl md:text-6xl font-black tracking-tight"
                style={{ color: '#EEF2FF' }}
              >
                FAQ
              </h1>

              {/* Subtitle */}
              <p
                className="mt-2 text-sm md:text-base"
                style={{ color: '#9AA0C7' }}
              >
                Got questions? We&apos;ve got answers
              </p>
            </div>

            {/* Search Box */}
            <div className="flex items-center">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions…"
                className="h-10 w-56 rounded-xl bg-transparent px-3 text-sm outline-none transition placeholder:text-[#9AA0C7]"
                style={{
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#EEF2FF',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#00C2FF';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                }}
              />
            </div>
          </header>

          {/* FAQ GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredFaqs.map((faq, index) => (
              <div
                key={index}
                className="group rounded-2xl p-5 transition"
                style={{
                  border: '1px solid rgba(255,255,255,0.06)',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                }}
              >
                {/* TRIGGER */}
                <button
                  onClick={() => toggle(index)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div className="flex items-baseline gap-3">
                    {/* Number */}
                    <span className="text-xs" style={{ color: '#9AA0C7' }}>
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    {/* Question */}
                    <h3
                      className="text-base md:text-lg font-semibold"
                      style={{ color: '#EEF2FF' }}
                    >
                      {faq.question}
                    </h3>
                  </div>

                  {/* + / – icon */}
                  <span className="transition" style={{ color: '#EEF2FF' }}>
                    {openIndex === index ? '–' : '+'}
                  </span>
                </button>

                {/* CONTENT */}
                <div
                  className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                    openIndex === index
                      ? 'mt-3 grid-rows-[1fr]'
                      : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <p
                      className="text-sm leading-relaxed"
                      style={{ color: '#9AA0C7' }}
                    >
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Zapier Style with Background */}
      <section
        className="relative py-24 px-6 overflow-hidden 
            [mask-image:radial-gradient(ellipse_at_center,var(--background),transparent)]"
        style={{
          backgroundColor: '#000000',
          color: '#EEF2FF',
          backgroundImage: `
  linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px) ,
`,
          backgroundSize: '44px 44px',
        }}
      >
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2
            className="font-sans font-extrabold text-3xl md:text-5xl lg:text-6xl leading-tight tracking-[-0.02em] mb-4"
            style={{ color: '#EEF2FF' }}
          >
            Ready to transform your{' '}
            <span style={{ color: '#EEF2FF' }}>campus experience?</span>
          </h2>

          <p
            className="font-sans text-sm sm:text-base md:text-lg leading-relaxed tracking-[0.005em] mb-10 max-w-xl mx-auto"
            style={{ color: '#9AA0C7' }}
          >
            Join thousands of students already discovering amazing opportunities
            on Clunite.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup">
              <Button
                className="px-8 py-4 text-base md:text-lg font-semibold rounded-lg transition-transform duration-200 hover:scale-[1.03] flex items-center justify-center shadow-lg border-none"
                style={{
                  backgroundColor: '#00C2FF',
                  color: '#000000',
                  boxShadow: '0 4px 30px rgba(0, 194, 255, 0.2)',
                }}
              >
                Start automating today <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer - Zapier Style */}
      <footer
        className="relative py-24 px-6 overflow-hidden 
            [mask-image:radial-gradient(ellipse_at_center,var(--background),transparent)]"
        style={{
          backgroundColor: '#000000',
          color: '#EEF2FF',
          backgroundImage: `
  linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px) ,
`,
          backgroundSize: '44px 44px',
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: '#FF7A00' }}
                >
                  <span
                    className="font-bold text-xl"
                    style={{ color: '#000000' }}
                  >
                    C
                  </span>
                </div>
                <span
                  className="text-xl font-bold"
                  style={{ color: '#EEF2FF' }}
                >
                  Clunite
                </span>
              </div>
              <p className="leading-relaxed" style={{ color: '#9AA0C7' }}>
                Connecting students with opportunities across India&apos;s top
                colleges.
              </p>
            </div>

            <div>
              <h3
                className="font-bold text-base mb-4"
                style={{ color: '#EEF2FF' }}
              >
                Platform
              </h3>
              <ul className="space-y-3">
                <li>
                  <a
                    href="#"
                    className="transition-colors"
                    style={{ color: '#9AA0C7' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = '#00C2FF')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = '#9AA0C7')
                    }
                  >
                    Browse Events
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors"
                    style={{ color: '#9AA0C7' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = '#00C2FF')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = '#9AA0C7')
                    }
                  >
                    Host Events
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors"
                    style={{ color: '#9AA0C7' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = '#00C2FF')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = '#9AA0C7')
                    }
                  >
                    Join Clubs
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors"
                    style={{ color: '#9AA0C7' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = '#00C2FF')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = '#9AA0C7')
                    }
                  >
                    Analytics
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors"
                    style={{ color: '#9AA0C7' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = '#00C2FF')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = '#9AA0C7')
                    }
                  >
                    Mobile App
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3
                className="font-bold text-base mb-4"
                style={{ color: '#EEF2FF' }}
              >
                Resources
              </h3>
              <ul className="space-y-3">
                <li>
                  <a
                    href="#"
                    className="transition-colors"
                    style={{ color: '#9AA0C7' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = '#00C2FF')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = '#9AA0C7')
                    }
                  >
                    Help Center
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors"
                    style={{ color: '#9AA0C7' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = '#00C2FF')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = '#9AA0C7')
                    }
                  >
                    Community
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors"
                    style={{ color: '#9AA0C7' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = '#00C2FF')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = '#9AA0C7')
                    }
                  >
                    Blog
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors"
                    style={{ color: '#9AA0C7' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = '#00C2FF')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = '#9AA0C7')
                    }
                  >
                    API Docs
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="transition-colors"
                    style={{ color: '#9AA0C7' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = '#00C2FF')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = '#9AA0C7')
                    }
                  >
                    Status
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3
                className="font-bold text-base mb-4"
                style={{ color: '#EEF2FF' }}
              >
                Contact
              </h3>
              <ul className="space-y-3">
                <li>
                  <a
                    href="mailto:hello@clunite.com"
                    className="transition-colors"
                    style={{ color: '#9AA0C7' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = '#00C2FF')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = '#9AA0C7')
                    }
                  >
                    hello@clunite.com
                  </a>
                </li>
                <li>
                  <a
                    href="tel:+911234567890"
                    className="transition-colors"
                    style={{ color: '#9AA0C7' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = '#00C2FF')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = '#9AA0C7')
                    }
                  >
                    +91 12345 67890
                  </a>
                </li>
                <li>
                  <span style={{ color: '#9AA0C7' }}>Bangalore, India</span>
                </li>
              </ul>
            </div>
          </div>

          <div
            className="pt-8 flex flex-col md:flex-row justify-between items-center"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="mb-4 md:mb-0" style={{ color: '#9AA0C7' }}>
              © 2024 Clunite. All rights reserved.
            </div>
            <div className="flex space-x-6">
              <a
                href="#"
                className="transition-colors"
                style={{ color: '#9AA0C7' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#00C2FF')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9AA0C7')}
              >
                Privacy Policy
              </a>
              <a
                href="#"
                className="transition-colors"
                style={{ color: '#9AA0C7' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#00C2FF')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9AA0C7')}
              >
                Terms of Service
              </a>
              <a
                href="#"
                className="transition-colors"
                style={{ color: '#9AA0C7' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#00C2FF')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#9AA0C7')}
              >
                Cookie Policy
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
