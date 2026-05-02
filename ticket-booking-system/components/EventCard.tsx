"use client";

import { motion } from "framer-motion";

// ── Types ─────────────────────────────────────────────────────────────────────

export type EventCategory = "Concert" | "Sports" | "Theatre" | "Comedy" | "Festival" | "Other";

export interface EventCardProps {
  id:              string;
  title:           string;
  venue:           string;
  date:            string;
  category:        EventCategory;
  price:           number;          // base price in ₹
  totalSeats:      number;
  availableSeats:  number;
  imageHue?:       number;          // 0-360 — generates a gradient cover if no image
  imageUrl?:       string;
  onClick?:        () => void;
}

// ── Category config ───────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  EventCategory,
  { color: string; bg: string; icon: React.ReactNode }
> = {
  Concert: {
    color: "var(--accent)",
    bg:    "var(--accent-light)",
    icon: (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 9V5l4-3 4 3v4" />
        <circle cx="6" cy="9" r="1.5" />
      </svg>
    ),
  },
  Sports: {
    color: "#C44B00",
    bg:    "#FFF0E8",
    icon: (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="6" cy="6" r="4.5" />
        <path d="M3 3.5C4.5 5 4.5 7 3 8.5" />
        <path d="M9 3.5C7.5 5 7.5 7 9 8.5" />
        <line x1="1.5" y1="6" x2="10.5" y2="6" />
      </svg>
    ),
  },
  Theatre: {
    color: "#1A7A45",
    bg:    "var(--green-light)",
    icon: (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M1 9.5c1.5-2 4-2 4 0" />
        <path d="M7 9.5c1.5-2 4-2 4 0" />
        <circle cx="3" cy="5" r="2" />
        <circle cx="9" cy="5" r="2" />
      </svg>
    ),
  },
  Comedy: {
    color: "#8B5E00",
    bg:    "var(--amber-light)",
    icon: (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="6" cy="6" r="4.5" />
        <path d="M3.5 7.5C4.2 8.5 7.8 8.5 8.5 7.5" />
        <circle cx="4.5" cy="5" r="0.75" fill="currentColor" stroke="none" />
        <circle cx="7.5" cy="5" r="0.75" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  Festival: {
    color: "#6B2DB0",
    bg:    "#F3EAFD",
    icon: (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M6 1v2M6 9v2M1 6h2M9 6h2" />
        <path d="M2.9 2.9l1.4 1.4M7.7 7.7l1.4 1.4" />
        <circle cx="6" cy="6" r="2" />
      </svg>
    ),
  },
  Other: {
    color: "var(--text-muted)",
    bg:    "var(--bg-subtle)",
    icon: (
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="6" cy="6" r="4.5" />
        <line x1="6" y1="3" x2="6" y2="6.5" />
        <circle cx="6" cy="8.5" r="0.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
};

// ── Availability helpers ──────────────────────────────────────────────────────

function availabilityLabel(pct: number): { label: string; color: string } {
  if (pct > 0.6) return { label: "Good availability", color: "var(--green)" };
  if (pct > 0.2) return { label: "Filling fast",       color: "var(--amber)" };
  return              { label: "Almost sold out",      color: "#C44B00" };
}

// ── EventCard ─────────────────────────────────────────────────────────────────

export default function EventCard({
  title,
  venue,
  date,
  category,
  price,
  totalSeats,
  availableSeats,
  imageHue = 220,
  imageUrl,
  onClick,
}: EventCardProps) {
  const cfg     = CATEGORY_CONFIG[category] ?? CATEGORY_CONFIG.Other;
  const pct     = totalSeats > 0 ? availableSeats / totalSeats : 0;
  const avail   = availabilityLabel(pct);
  const barPct  = Math.min(pct * 100, 100);

  return (
    <motion.article
      className="rounded-2xl overflow-hidden flex flex-col cursor-pointer group"
      style={{
        background:    "var(--bg-surface)",
        border:        "1px solid var(--border)",
        transition:    "box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease",
      }}
      whileHover={{ y: -4, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }}
      onHoverStart={(e) => {
        (e.target as HTMLElement).closest("article")!.style.boxShadow =
          "0 12px 40px rgba(0,0,0,0.10)";
        (e.target as HTMLElement).closest("article")!.style.borderColor =
          "var(--border-strong)";
      }}
      onHoverEnd={(e) => {
        const el = (e.target as HTMLElement).closest("article");
        if (el) {
          el.style.boxShadow = "none";
          el.style.borderColor = "var(--border)";
        }
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      aria-label={`${title} — ${venue} — ${date}`}
    >
      {/* Cover */}
      <div
        className="relative h-44 overflow-hidden"
        style={{
          background: imageUrl
            ? "var(--bg-muted)"
            : `linear-gradient(135deg,
                hsl(${imageHue}, 55%, 88%) 0%,
                hsl(${(imageHue + 30) % 360}, 45%, 92%) 50%,
                hsl(${(imageHue + 60) % 360}, 40%, 90%) 100%)`,
        }}
      >
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="w-full h-full object-cover"
            style={{
              transition: "transform 0.5s ease",
            }}
          />
        )}

        {/* Abstract seat rows visualisation */}
        {!imageUrl && (
          <div
            className="absolute inset-0 flex flex-col justify-end px-5 pb-4 gap-1.5"
            style={{ opacity: 0.35 }}
          >
            {[7, 9, 11, 9, 7].map((cols, row) => (
              <div key={row} className="flex justify-center gap-1">
                {Array.from({ length: cols }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-sm"
                    style={{
                      width: 14,
                      height: 10,
                      background: `hsl(${imageHue}, 50%, 55%)`,
                      opacity: Math.random() > 0.25 ? 0.6 : 0.2,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Category badge */}
        <div className="absolute top-3 left-3">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              background:    cfg.bg,
              color:         cfg.color,
              fontFamily:    "var(--font-mono)",
              fontSize:      "10px",
              letterSpacing: "0.08em",
              backdropFilter: "blur(8px)",
            }}
          >
            {cfg.icon}
            {category.toUpperCase()}
          </span>
        </div>

        {/* Price badge */}
        <div className="absolute top-3 right-3">
          <span
            className="inline-block px-2.5 py-1 rounded-full text-xs font-bold"
            style={{
              background:    "rgba(255,255,255,0.88)",
              color:         "var(--text-primary)",
              fontFamily:    "var(--font-display)",
              backdropFilter: "blur(8px)",
            }}
          >
            ₹{price.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5">
        {/* Date */}
        <p
          className="label-mono mb-2"
          style={{ color: "var(--text-faint)" }}
        >
          {date}
        </p>

        {/* Title */}
        <h3
          className="text-xl font-bold mb-1 leading-tight line-clamp-2 group-hover:text-accent transition-colors duration-200"
          style={{
            fontFamily: "var(--font-display)",
            color:      "var(--text-primary)",
          }}
        >
          {title}
        </h3>

        {/* Venue */}
        <p
          className="text-sm mb-4 line-clamp-1"
          style={{ color: "var(--text-muted)" }}
        >
          <svg
            className="inline mr-1.5"
            style={{ verticalAlign: "-2px" }}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          >
            <path d="M6 1C4.3 1 3 2.3 3 4c0 2.5 3 7 3 7s3-4.5 3-7c0-1.7-1.3-3-3-3z" />
            <circle cx="6" cy="4" r="1" fill="currentColor" stroke="none" />
          </svg>
          {venue}
        </p>

        {/* Spacer */}
        <div className="mt-auto">
          {/* Availability bar */}
          <div className="flex items-center justify-between mb-1.5">
            <span
              className="text-xs"
              style={{ color: avail.color, fontFamily: "var(--font-mono)", fontSize: "10px", letterSpacing: "0.06em" }}
            >
              {avail.label}
            </span>
            <span
              className="text-xs"
              style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)", fontSize: "10px" }}
            >
              {availableSeats.toLocaleString("en-IN")} left
            </span>
          </div>

          <div
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--bg-muted)" }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: avail.color }}
              initial={{ width: 0 }}
              animate={{ width: `${barPct}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            />
          </div>

          {/* Book button */}
          <motion.button
            className="w-full mt-4 py-2.5 rounded-xl text-sm font-semibold btn-accent"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            Book Tickets
          </motion.button>
        </div>
      </div>
    </motion.article>
  );
}