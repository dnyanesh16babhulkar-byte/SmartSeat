"use client";

import { motion, useInView, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";
import EventCard from "@/components/EventCard";

// ── Mock data ──────────────────────────────────────────────────────────────────

const FEATURED_EVENTS = [
  {
    id: "1",
    title: "Arijit Singh Live",
    venue: "MMRDA Grounds, Mumbai",
    date: "15 Jun 2025",
    category: "Concert" as const,
    price: 2499,
    totalSeats: 12000,
    availableSeats: 3240,
    imageHue: 220,
  },
  {
    id: "2",
    title: "IPL Finals 2025",
    venue: "Wankhede Stadium, Mumbai",
    date: "25 May 2025",
    category: "Sports" as const,
    price: 1999,
    totalSeats: 33000,
    availableSeats: 890,
    imageHue: 15,
  },
  {
    id: "3",
    title: "Hamlet — NCPA",
    venue: "National Centre for the Arts",
    date: "2 Jun 2025",
    category: "Theatre" as const,
    price: 899,
    totalSeats: 1100,
    availableSeats: 156,
    imageHue: 140,
  },
];

const FEATURES = [
  {
    number: "01",
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="9" cy="9" r="6.5" />
        <path d="M14.5 14.5L19.5 19.5" />
        <path d="M6 9h6M9 6v6" />
      </svg>
    ),
    title: "Trie-Powered Search",
    description:
      "Every keystroke queries an in-memory Trie — O(P + K) complexity, zero network round-trips. Results appear before you finish typing.",
    tag: "Data Structure: Trie",
    color: "var(--accent)",
    bg: "var(--accent-light)",
  },
  {
    number: "02",
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M11 3v4M11 3l-3 4M11 3l3 4" />
        <path d="M4 11H8M4 11L8 8M4 11l4 3" />
        <path d="M18 11H14M18 11l-4-3M18 11l-4 3" />
        <path d="M11 19v-4M11 19l-3-4M11 19l3-4" />
        <rect x="8" y="8" width="6" height="6" rx="1" />
      </svg>
    ),
    title: "Segment Tree Seats",
    description:
      "Find the best contiguous block of N seats in O(log N). The Segment Tree tracks live availability across every row and section.",
    tag: "Data Structure: Segment Tree",
    color: "#1A7A45",
    bg: "var(--green-light)",
  },
  {
    number: "03",
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M3 12l4 4 4-4" />
        <path d="M7 16V7a5 5 0 0110 0" />
        <path d="M19 10l-4 4-4-4" />
      </svg>
    ),
    title: "Real-time Sync",
    description:
      "Supabase Realtime pushes seat changes to all connected clients in under 100 ms. No stale state, no double-booking.",
    tag: "Tech: Supabase Realtime",
    color: "var(--amber)",
    bg: "var(--amber-light)",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Search for an Event",
    description:
      "Type any event, artist, or venue name. Our Trie autocomplete surfaces ranked results instantly.",
  },
  {
    n: "02",
    title: "Choose Your Seats",
    description:
      "Browse the interactive seat map. The Segment Tree highlights the best available blocks for your group size.",
  },
  {
    n: "03",
    title: "Confirm & Receive",
    description:
      "Seats are held for 5 minutes. Complete checkout and your e-ticket arrives instantly.",
  },
];

const STATS = [
  { value: "1,200+", label: "Events indexed" },
  { value: "50k+",   label: "Seats tracked" },
  { value: "<100ms", label: "Seat sync latency" },
  { value: "O(log N)", label: "Availability query" },
];

// ── Animation variants ────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay },
  }),
};

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="label-mono mb-4 inline-flex items-center gap-2"
      style={{ color: "var(--accent)" }}
    >
      <span
        className="inline-block w-5 h-px"
        style={{ background: "var(--accent)" }}
      />
      {children}
    </p>
  );
}

function InViewSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={fadeUp}
      custom={delay}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────

function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 glass"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div
        className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between"
      >
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 group">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--accent)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="5" width="4" height="5" rx="1" fill="white" opacity="0.9" />
              <rect x="6" y="5" width="4" height="5" rx="1" fill="white" />
              <rect x="11" y="5" width="4" height="5" rx="1" fill="white" opacity="0.9" />
              <rect x="1" y="3" width="4" height="2" rx="1" fill="white" opacity="0.5" />
              <rect x="6" y="3" width="4" height="2" rx="1" fill="white" opacity="0.5" />
              <rect x="11" y="3" width="4" height="2" rx="1" fill="white" opacity="0.5" />
            </svg>
          </div>
          <span
            className="text-lg font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          >
            SmartSeat
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {["Events", "How It Works", "About"].map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase().replace(/ /g, "-")}`}
              className="text-sm font-medium transition-colors duration-150"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--text-muted)",
              }}
              onMouseEnter={(e) =>
                ((e.target as HTMLElement).style.color = "var(--text-primary)")
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLElement).style.color = "var(--text-muted)")
              }
            >
              {link}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-3">
          <a
            href="/events"
            className="hidden sm:inline-flex btn-accent px-4 py-2 rounded-lg text-sm items-center gap-1.5"
          >
            Book Now
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 7h10M8 3l4 4-4 4" />
            </svg>
          </a>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {menuOpen ? (
                <>
                  <line x1="4" y1="4" x2="16" y2="16" />
                  <line x1="16" y1="4" x2="4" y2="16" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="17" y2="6" />
                  <line x1="3" y1="10" x2="17" y2="10" />
                  <line x1="3" y1="14" x2="17" y2="14" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="md:hidden overflow-hidden"
            style={{ borderTop: "1px solid var(--border)", background: "var(--bg-surface)" }}
          >
            <div className="px-6 py-4 flex flex-col gap-4">
              {["Events", "How It Works", "About"].map((link) => (
                <a
                  key={link}
                  href={`#${link.toLowerCase().replace(/ /g, "-")}`}
                  className="text-sm font-medium"
                  style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)" }}
                  onClick={() => setMenuOpen(false)}
                >
                  {link}
                </a>
              ))}
              <a
                href="/events"
                className="btn-accent px-4 py-2 rounded-lg text-sm text-center"
                onClick={() => setMenuOpen(false)}
              >
                Book Now
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────

function Hero() {
  const [query, setQuery] = useState("");

  return (
    <section className="relative min-h-[88vh] flex flex-col items-center justify-center text-center px-6 py-24 overflow-hidden">
      {/* Dot grid */}
      <div
        className="absolute inset-0 dot-grid pointer-events-none"
        style={{ opacity: 0.55 }}
      />

      {/* Radial fade on dot grid edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 0%, var(--bg-base) 80%)",
        }}
      />

      {/* Accent blob */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(42,71,219,0.07) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -58%)",
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto w-full">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8 text-xs font-medium"
          style={{
            background: "var(--accent-light)",
            color: "var(--accent)",
            border: "1px solid rgba(42,71,219,0.18)",
            fontFamily: "var(--font-mono)",
            letterSpacing: "0.12em",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: "var(--accent)" }}
          />
          DSA-POWERED TICKET BOOKING
        </motion.div>

        {/* Headline */}
        <motion.h1
          className="text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.08] tracking-tight mb-6"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.08 }}
        >
          Every Seat.{" "}
          <br className="hidden sm:block" />
          <span className="text-gradient-accent">Found Instantly.</span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          className="text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed"
          style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)", fontWeight: 400 }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.18 }}
        >
          Trie-accelerated search. Segment Tree seat availability.
          Real-time sync across all users — every pick, every second.
        </motion.p>

        {/* Search Bar */}
        <motion.div
          className="max-w-2xl mx-auto mb-10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.26 }}
        >
          <div
            className="flex items-center gap-3 px-5 py-4 rounded-2xl shadow-sm transition-shadow duration-200"
            style={{
              background: "var(--bg-surface)",
              border: "1.5px solid var(--border)",
              boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
            }}
            onFocus={(e) =>
              ((e.currentTarget as HTMLElement).style.boxShadow =
                "0 0 0 3px rgba(42,71,219,0.12), 0 4px 24px rgba(0,0,0,0.08)")
            }
            onBlur={(e) =>
              ((e.currentTarget as HTMLElement).style.boxShadow =
                "0 2px 16px rgba(0,0,0,0.06)")
            }
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              style={{ color: "var(--text-faint)", flexShrink: 0 }}
            >
              <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 12L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events, artists, venues…"
              className="flex-1 bg-transparent outline-none text-base"
              style={{
                fontFamily: "var(--font-body)",
                color: "var(--text-primary)",
                fontSize: "16px",
                caretColor: "var(--accent)",
              }}
            />

            <a
              href="/events"
              className="btn-accent shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap"
            >
              Search
            </a>
          </div>

          <p
            className="mt-3 text-xs text-center"
            style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}
          >
            Try: "Arijit", "IPL Finals", "NCPA Theatre"
          </p>
        </motion.div>

        {/* CTA row */}
        <motion.div
          className="flex flex-wrap items-center justify-center gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.38 }}
        >
          <a
            href="/events"
            className="btn-accent flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
          >
            Browse Events
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 7h10M8 3l4 4-4 4" />
            </svg>
          </a>
          <a
            href="#how-it-works"
            className="btn-ghost flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium"
          >
            See How It Works
          </a>
        </motion.div>
      </div>

      {/* Stats strip */}
      <motion.div
        className="absolute bottom-10 left-0 right-0 z-10"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.55 }}
      >
        <div className="max-w-3xl mx-auto px-6">
          <div
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-4 rounded-2xl"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            }}
          >
            {STATS.map(({ value, label }, i) => (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && (
                  <span
                    className="hidden sm:block w-px h-5"
                    style={{ background: "var(--border)" }}
                  />
                )}
                <span
                  className="text-sm font-bold"
                  style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                >
                  {value}
                </span>
                <span
                  className="text-xs"
                  style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────

function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="features"
      className="py-24 px-6"
      style={{ background: "var(--bg-surface)" }}
    >
      <div className="max-w-6xl mx-auto">
        <InViewSection className="text-center mb-16">
          <SectionLabel>Features</SectionLabel>
          <h2
            className="text-4xl md:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          >
            Built on Real Algorithms
          </h2>
          <p
            className="text-lg max-w-xl mx-auto"
            style={{ color: "var(--text-muted)" }}
          >
            Not just a booking UI — every feature is backed by a data
            structure you can inspect and understand.
          </p>
        </InViewSection>

        <motion.div
          ref={ref}
          className="grid md:grid-cols-3 gap-6"
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
        >
          {FEATURES.map((f) => (
            <motion.div
              key={f.number}
              variants={fadeUp}
              className="rounded-2xl p-8 cursor-default group relative overflow-hidden"
              style={{
                background: "var(--bg-base)",
                border: "1px solid var(--border)",
                transition: "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease",
              }}
              whileHover={{
                y: -4,
                transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow =
                  "0 12px 40px rgba(0,0,0,0.08)";
                (e.currentTarget as HTMLElement).style.borderColor =
                  "var(--border-strong)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.boxShadow = "none";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            >
              {/* Number watermark */}
              <span
                className="absolute top-5 right-6 text-6xl font-black pointer-events-none select-none"
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--border)",
                  lineHeight: 1,
                }}
              >
                {f.number}
              </span>

              {/* Icon */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{ background: f.bg, color: f.color }}
              >
                {f.icon}
              </div>

              {/* Tag */}
              <p
                className="label-mono mb-3"
                style={{ color: f.color }}
              >
                {f.tag}
              </p>

              {/* Title */}
              <h3
                className="text-xl font-bold mb-3"
                style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
              >
                {f.title}
              </h3>

              {/* Description */}
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {f.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────

function HowItWorks() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="how-it-works" className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <InViewSection className="text-center mb-16">
          <SectionLabel>How It Works</SectionLabel>
          <h2
            className="text-4xl md:text-5xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          >
            Three Steps to Your Seat
          </h2>
        </InViewSection>

        <motion.div
          ref={ref}
          className="relative"
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
        >
          {/* Connecting line */}
          <div
            className="hidden md:block absolute top-12 left-[16.66%] right-[16.66%] h-px"
            style={{ background: "var(--border)" }}
          />

          <div className="grid md:grid-cols-3 gap-10 md:gap-8 relative z-10">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                variants={fadeUp}
                custom={i * 0.1}
                className="flex flex-col items-center text-center"
              >
                {/* Number circle */}
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mb-6 relative"
                  style={{
                    background:
                      i === 0
                        ? "var(--accent)"
                        : "var(--bg-surface)",
                    border: i === 0 ? "none" : `1.5px solid var(--border)`,
                    color: i === 0 ? "white" : "var(--text-muted)",
                  }}
                >
                  <span
                    className="text-lg font-bold"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {step.n}
                  </span>
                </div>

                <h3
                  className="text-xl font-bold mb-3"
                  style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                >
                  {step.title}
                </h3>
                <p
                  className="text-sm leading-relaxed max-w-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <InViewSection className="text-center mt-14" delay={0.1}>
          <a
            href="/events"
            className="btn-accent inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold"
          >
            Get Started Free
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 7.5h11M9 3.5l4 4-4 4" />
            </svg>
          </a>
        </InViewSection>
      </div>
    </section>
  );
}

// ── Featured Events ───────────────────────────────────────────────────────────

function FeaturedEvents() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="events"
      className="py-24 px-6"
      style={{ background: "var(--bg-surface)", borderTop: "1px solid var(--border)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
          <InViewSection>
            <SectionLabel>Upcoming</SectionLabel>
            <h2
              className="text-4xl md:text-5xl font-bold tracking-tight"
              style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
            >
              Featured Events
            </h2>
          </InViewSection>
          <InViewSection delay={0.1}>
            <a
              href="/events"
              className="btn-ghost px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-1.5"
            >
              View All
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 7h10M8 3l4 4-4 4" />
              </svg>
            </a>
          </InViewSection>
        </div>

        <motion.div
          ref={ref}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          variants={stagger}
        >
          {FEATURED_EVENTS.map((event) => (
            <motion.div key={event.id} variants={fadeUp}>
              <EventCard {...event} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ── DSA Spotlight ──────────────────────────────────────────────────────────────

function DSASpotlight() {
  return (
    <section
      className="py-24 px-6 relative overflow-hidden"
      style={{ background: "var(--bg-inverse)" }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="max-w-5xl mx-auto relative z-10">
        <InViewSection className="text-center mb-14">
          <p
            className="label-mono mb-4"
            style={{ color: "var(--accent-dim)" }}
          >
            <span
              className="inline-block w-5 h-px mr-2"
              style={{ background: "var(--accent-dim)", verticalAlign: "middle" }}
            />
            Under the Hood
          </p>
          <h2
            className="text-4xl md:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-display)", color: "#FFFFFF" }}
          >
            Algorithms That Scale
          </h2>
          <p
            className="text-lg max-w-xl mx-auto"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            SmartSeat isn&apos;t just a UI project. Every booking flow is
            powered by classical data structures.
          </p>
        </InViewSection>

        {/* Complexity table */}
        <InViewSection delay={0.1}>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            {/* Header */}
            <div
              className="grid grid-cols-3 px-6 py-3"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              {["Operation", "Data Structure", "Complexity"].map((h) => (
                <span
                  key={h}
                  className="text-xs font-medium"
                  style={{
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.15em",
                    color: "rgba(255,255,255,0.4)",
                    textTransform: "uppercase",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>

            {[
              { op: "Prefix search",       ds: "Trie",             cx: "O(P + K)",    accent: "var(--accent-dim)" },
              { op: "Seat block query",     ds: "Segment Tree",     cx: "O(log N)",    accent: "#4CAF7D" },
              { op: "Seat update",          ds: "Segment Tree",     cx: "O(log N)",    accent: "#4CAF7D" },
              { op: "Frequency boost",      ds: "Trie node weight", cx: "O(1)",        accent: "var(--accent-dim)" },
              { op: "Realtime sync",        ds: "Supabase Channel", cx: "sub-100 ms",  accent: "#E8C46A" },
            ].map((row, i) => (
              <div
                key={row.op}
                className="grid grid-cols-3 px-6 py-4"
                style={{
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <span
                  className="text-sm"
                  style={{ color: "rgba(255,255,255,0.75)", fontFamily: "var(--font-body)" }}
                >
                  {row.op}
                </span>
                <span
                  className="text-sm"
                  style={{ color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-mono)", fontSize: "12px" }}
                >
                  {row.ds}
                </span>
                <span
                  className="text-sm font-medium"
                  style={{ color: row.accent, fontFamily: "var(--font-mono)", fontSize: "12px" }}
                >
                  {row.cx}
                </span>
              </div>
            ))}
          </div>
        </InViewSection>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="py-12 px-6"
      style={{ borderTop: "1px solid var(--border)", background: "var(--bg-surface)" }}
    >
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent)" }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="5" width="4" height="5" rx="1" fill="white" />
              <rect x="6" y="5" width="4" height="5" rx="1" fill="white" />
              <rect x="11" y="5" width="4" height="5" rx="1" fill="white" />
            </svg>
          </div>
          <span
            className="font-bold text-base tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
          >
            SmartSeat
          </span>
        </div>

        {/* Centre note */}
        <p
          className="text-xs text-center"
          style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}
        >
          DSA Project · Trie + Segment Tree · Built with Next.js
        </p>

        {/* Links */}
        <div className="flex items-center gap-5">
          {["GitHub", "About"].map((l) => (
            <a
              key={l}
              href="#"
              className="text-xs transition-colors duration-150"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-body)" }}
              onMouseEnter={(e) =>
                ((e.target as HTMLElement).style.color = "var(--text-primary)")
              }
              onMouseLeave={(e) =>
                ((e.target as HTMLElement).style.color = "var(--text-muted)")
              }
            >
              {l}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <FeaturedEvents />
        <DSASpotlight />
      </main>
      <Footer />
    </>
  );
}