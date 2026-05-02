"use client";

/**
 * components/SeatingGrid.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive seating map for the Premium Ticket Booking System.
 *
 * ARCHITECTURE:
 * ─────────────
 * • Initial seat state is fetched server-side (passed as props) — zero
 *   loading spinner on first paint; the grid appears fully formed.
 * • Supabase Realtime subscription patches individual seat rows as other
 *   users hold/book/release seats — no full refetch needed.
 * • Framer Motion handles three animation layers:
 *     1. Grid reveal: staggered row-by-row entrance on mount
 *     2. Seat selection: springy scale + gold glow on click
 *     3. Held seats: continuous violet pulse (via CSS animation in globals.css,
 *        Framer Motion manages the mount/unmount transition of the class)
 * • The Segment Tree is NOT run here — this component only manages visual
 *   state and selection. The tree runs on the server (Route Handler) when
 *   the user confirms booking. This keeps the UI thread free.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createClient }  from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SeatStatus = "available" | "held" | "booked" | "blocked";

export interface Seat {
  id:         string;       // UUID from DB (event_seats.id)
  seatIndex:  number;       // 0-based contiguous index
  rowLabel:   string;       // "A", "B", "C"…
  col:        number;       // 1-based column number
  section:    string;       // "Orchestra", "Balcony"
  status:     SeatStatus;
  version:    number;       // for optimistic locking in the Route Handler
  price?:     number;       // optional per-seat pricing tier
}

export interface SeatingGridProps {
  eventId:        string;
  eventTitle:     string;
  venueCapacity:  number;
  seats:          Seat[];                          // server-side initial state
  maxSelectCount?: number;                         // default 8
  onSelectionChange?: (selected: Seat[]) => void;
}

// ── Realtime payload type ─────────────────────────────────────────────────────

interface SeatRealtimePayload {
  eventType: "UPDATE";
  new: { id: string; status: SeatStatus; version: number };
  old: { id: string };
}

// ── State reducer for seat map ────────────────────────────────────────────────
// A reducer (vs. useState) prevents stale closures in the Realtime callback.

type SeatMap = Map<string, Seat>;

type SeatAction =
  | { type: "INIT";         seats: Seat[] }
  | { type: "REMOTE_UPDATE"; id: string; status: SeatStatus; version: number }
  | { type: "SELECT";        id: string }
  | { type: "DESELECT";      id: string }
  | { type: "CLEAR_SELECTION" };

interface SeatState {
  seatMap:   SeatMap;
  selected:  Set<string>;
}

function seatReducer(state: SeatState, action: SeatAction): SeatState {
  switch (action.type) {
    case "INIT":
      return {
        seatMap:  new Map(action.seats.map((s) => [s.id, s])),
        selected: new Set(),
      };

    case "REMOTE_UPDATE": {
      // A remote update should de-select a seat if another user just grabbed it
      const newMap = new Map(state.seatMap);
      const seat   = newMap.get(action.id);
      if (!seat) return state;
      newMap.set(action.id, { ...seat, status: action.status, version: action.version });

      const newSelected = new Set(state.selected);
      if (action.status !== "available") newSelected.delete(action.id);

      return { seatMap: newSelected.size !== state.selected.size
                 ? { ...state, seatMap: newMap, selected: newSelected }
                 : { ...state, seatMap: newMap }
               , selected: newSelected };
    }

    case "SELECT": {
      const seat = state.seatMap.get(action.id);
      if (!seat || seat.status !== "available") return state;
      return { ...state, selected: new Set([...state.selected, action.id]) };
    }

    case "DESELECT": {
      const next = new Set(state.selected);
      next.delete(action.id);
      return { ...state, selected: next };
    }

    case "CLEAR_SELECTION":
      return { ...state, selected: new Set() };

    default:
      return state;
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SEAT_SIZE    = 34; // px — matches seat-md in tailwind config
const SEAT_GAP     = 6;  // px — inter-seat gap
const MAX_SELECT   = 8;

// ── Supabase client (client-side instance) ────────────────────────────────────
// In production: import from "@/lib/supabase/client" to ensure singleton

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// ── SeatingGrid ───────────────────────────────────────────────────────────────

export default function SeatingGrid({
  eventId,
  eventTitle,
  venueCapacity,
  seats: initialSeats,
  maxSelectCount = MAX_SELECT,
  onSelectionChange,
}: SeatingGridProps) {
  const prefersReducedMotion = useReducedMotion();

  const [state, dispatch] = useReducer(seatReducer, {
    seatMap:  new Map(),
    selected: new Set<string>(),
  });

  // Initialise from server-side props
  useEffect(() => {
    dispatch({ type: "INIT", seats: initialSeats });
  }, [initialSeats]);

  // Notify parent of selection changes
  useEffect(() => {
    if (!onSelectionChange) return;
    const selectedSeats = [...state.selected]
      .map((id) => state.seatMap.get(id))
      .filter((s): s is Seat => !!s);
    onSelectionChange(selectedSeats);
  }, [state.selected, state.seatMap, onSelectionChange]);

  // ── Supabase Realtime subscription ─────────────────────────────────────────
  // Subscribes to row-level changes on event_seats for this specific event.
  // When another user transitions a seat (available → held → booked) we patch
  // our local seatMap immediately — no network refetch, sub-100ms UI update.
  useEffect(() => {
    const supabase = getSupabaseClient();

    const channel = supabase
      .channel(`event-seats:${eventId}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "event_seats",
          filter: `event_id=eq.${eventId}`,
        },
        (payload: SeatRealtimePayload) => {
          dispatch({
            type:    "REMOTE_UPDATE",
            id:      payload.new.id,
            status:  payload.new.status,
            version: payload.new.version,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  // ── Seat interaction ────────────────────────────────────────────────────────
  const handleSeatClick = useCallback(
    (seat: Seat) => {
      if (seat.status !== "available") return;

      if (state.selected.has(seat.id)) {
        dispatch({ type: "DESELECT", id: seat.id });
      } else {
        if (state.selected.size >= maxSelectCount) return; // cap
        dispatch({ type: "SELECT", id: seat.id });
      }
    },
    [state.selected, maxSelectCount],
  );

  // ── Group seats by row ──────────────────────────────────────────────────────
  const rows = useMemo(() => {
    const rowMap = new Map<string, Seat[]>();
    for (const seat of state.seatMap.values()) {
      if (!rowMap.has(seat.rowLabel)) rowMap.set(seat.rowLabel, []);
      rowMap.get(seat.rowLabel)!.push(seat);
    }
    // Sort each row by column
    for (const [, rowSeats] of rowMap) {
      rowSeats.sort((a, b) => a.col - b.col);
    }
    // Sort rows alphabetically
    return [...rowMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [state.seatMap]);

  // ── Statistics ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let available = 0, held = 0, booked = 0;
    for (const seat of state.seatMap.values()) {
      if (seat.status === "available") available++;
      else if (seat.status === "held")   held++;
      else if (seat.status === "booked") booked++;
    }
    return { available, held, booked, selected: state.selected.size };
  }, [state.seatMap, state.selected]);

  // ── Animation variants ──────────────────────────────────────────────────────
  const containerVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: prefersReducedMotion ? 0 : 0.03 },
    },
  };

  const rowVariants = {
    hidden:  { opacity: 0, y: prefersReducedMotion ? 0 : 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  };

  // ── Seat motion values ──────────────────────────────────────────────────────
  // Framer Motion animates the scale/opacity; the CSS class handles colour/shadow.
  // This separation keeps the animation system clean.
  function getSeatMotionProps(seat: Seat, isSelected: boolean) {
    const base = {
      whileHover: seat.status === "available"
        ? { scale: 1.14, y: -2, transition: { type: "spring", stiffness: 400, damping: 20 } }
        : {},
      whileTap: seat.status === "available"
        ? { scale: 0.92, transition: { duration: 0.08 } }
        : {},
    };

    if (isSelected) {
      return {
        ...base,
        animate: { scale: 1.08, y: -1 },
        transition: { type: "spring", stiffness: 300, damping: 18 },
      };
    }
    return { ...base, animate: { scale: 1, y: 0 } };
  }

  const selectedSeats = useMemo(() =>
    [...state.selected].map((id) => state.seatMap.get(id)).filter(Boolean) as Seat[],
    [state.selected, state.seatMap]
  );

  const totalPrice = useMemo(() =>
    selectedSeats.reduce((sum, s) => sum + (s.price ?? 0), 0),
    [selectedSeats]
  );

  return (
    <div className="w-full min-h-screen bg-void flex flex-col items-center px-4 py-12">

      {/* ── Event Header ──────────────────────────────────────────────── */}
      <motion.header
        className="text-center mb-10 w-full max-w-4xl"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <p
          className="text-xs tracking-[0.25em] uppercase mb-3"
          style={{ color: "var(--gold-base)", fontFamily: "var(--font-mono)" }}
        >
          Select Your Seats
        </p>
        <h1
          className="text-4xl md:text-5xl font-light mb-2 text-gold-gradient"
          style={{ fontFamily: "var(--font-display)", fontWeight: 300 }}
        >
          {eventTitle}
        </h1>
        <div className="divider-gold mt-6" />
      </motion.header>

      {/* ── Live Availability Stats ───────────────────────────────────── */}
      <motion.div
        className="flex gap-8 mb-10 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        {[
          { label: "Available",  value: stats.available, color: "var(--seat-available-ring)" },
          { label: "Selected",   value: stats.selected,  color: "var(--gold-base)" },
          { label: "Held",       value: stats.held,      color: "var(--seat-held-ring)" },
          { label: "Booked",     value: stats.booked,    color: "var(--silver-deep)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center">
            <motion.span
              className="text-2xl font-light"
              style={{ fontFamily: "var(--font-mono)", color }}
              key={value} // re-animate number when it changes
              initial={{ opacity: 0.4, scale: 0.85 }}
              animate={{ opacity: 1,   scale: 1 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {value}
            </motion.span>
            <span
              className="text-xs mt-1 uppercase tracking-[0.15em]"
              style={{ color: "var(--silver-mid)", fontFamily: "var(--font-mono)", fontSize: "10px" }}
            >
              {label}
            </span>
          </div>
        ))}
      </motion.div>

      {/* ── Stage Arc ─────────────────────────────────────────────────── */}
      <div className="w-full max-w-3xl mb-8">
        <div className="stage-arc h-8 flex items-center justify-center">
          <span
            className="text-xs tracking-[0.3em] uppercase"
            style={{ color: "var(--gold-muted)", fontFamily: "var(--font-mono)", fontSize: "10px" }}
          >
            Stage
          </span>
        </div>
      </div>

      {/* ── Seat Grid ─────────────────────────────────────────────────── */}
      <div className="w-full max-w-5xl overflow-x-auto pb-4">
        <motion.div
          className="flex flex-col items-center gap-[6px] min-w-max mx-auto"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {rows.map(([rowLabel, rowSeats], rowIdx) => (
            <motion.div
              key={rowLabel}
              className="flex items-center gap-[6px]"
              variants={rowVariants}
              custom={rowIdx}
            >
              {/* Row label */}
              <span
                className="w-6 text-center text-xs select-none shrink-0"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--silver-deep)",
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                }}
              >
                {rowLabel}
              </span>

              {/* Seats */}
              <div className="flex gap-[6px]">
                {rowSeats.map((seat) => {
                  const isSelected = state.selected.has(seat.id);
                  const motionProps = getSeatMotionProps(seat, isSelected);
                  const seatClass = isSelected ? "selected" : seat.status;

                  return (
                    <motion.button
                      key={seat.id}
                      className={`seat-btn ${seatClass}`}
                      style={{ width: SEAT_SIZE, height: SEAT_SIZE }}
                      onClick={() => handleSeatClick(seat)}
                      disabled={seat.status !== "available" && !isSelected}
                      aria-label={`Row ${rowLabel} seat ${seat.col} — ${isSelected ? "selected" : seat.status}`}
                      aria-pressed={isSelected}
                      title={`${rowLabel}${seat.col} · ${seat.section}${seat.price ? ` · ₹${seat.price}` : ""}`}
                      {...motionProps}
                      layout
                    >
                      {/* Show column number only for wider seats */}
                      {SEAT_SIZE >= 32 && (
                        <span className="pointer-events-none" style={{ fontSize: 9 }}>
                          {seat.col}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Row label (right side) */}
              <span
                className="w-6 text-center text-xs select-none shrink-0"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--silver-deep)",
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                }}
              >
                {rowLabel}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ── Legend ────────────────────────────────────────────────────── */}
      <motion.div
        className="flex flex-wrap justify-center gap-6 mt-10 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        {[
          { label: "Available", className: "available",  desc: "Click to select"   },
          { label: "Selected",  className: "selected",   desc: "Your selection"     },
          { label: "Held",      className: "held",       desc: "In someone's cart"  },
          { label: "Booked",    className: "booked",     desc: "Permanently taken"  },
        ].map(({ label, className, desc }) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`seat-btn ${className} pointer-events-none`}
              style={{ width: 20, height: 20, fontSize: 0, borderRadius: 4 }}
              aria-hidden
            />
            <div>
              <p className="text-xs" style={{ color: "var(--silver-light)", fontFamily: "var(--font-mono)", fontSize: 10 }}>
                {label}
              </p>
              <p className="text-xs" style={{ color: "var(--silver-deep)", fontFamily: "var(--font-mono)", fontSize: 9 }}>
                {desc}
              </p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Selection Tray ────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedSeats.length > 0 && (
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
          >
            {/* Gold divider at top of tray */}
            <div className="divider-gold" />
            <div
              className="glass px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              {/* Selected seat chips */}
              <div className="flex flex-wrap gap-2 flex-1">
                <AnimatePresence mode="popLayout">
                  {selectedSeats.map((seat) => (
                    <motion.button
                      key={seat.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill border text-xs cursor-pointer"
                      style={{
                        borderColor:     "var(--gold-dim)",
                        backgroundColor: "rgba(212,168,71,0.08)",
                        color:           "var(--gold-bright)",
                        fontFamily:      "var(--font-mono)",
                        fontSize:        "11px",
                        letterSpacing:   "0.08em",
                      }}
                      onClick={() => dispatch({ type: "DESELECT", id: seat.id })}
                      initial={{ opacity: 0, scale: 0.8, x: -10 }}
                      animate={{ opacity: 1, scale: 1,   x: 0 }}
                      exit={{ opacity: 0,   scale: 0.7,  x: -8 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      aria-label={`Remove seat ${seat.rowLabel}${seat.col}`}
                    >
                      {seat.rowLabel}{seat.col}
                      <span style={{ color: "var(--gold-dim)", fontSize: 14 }}>×</span>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>

              {/* Price + CTA */}
              <div className="flex items-center gap-5 shrink-0">
                <div className="text-right">
                  <p
                    className="text-xs uppercase tracking-[0.15em] mb-0.5"
                    style={{ color: "var(--silver-mid)", fontFamily: "var(--font-mono)", fontSize: 9 }}
                  >
                    Total
                  </p>
                  <motion.p
                    className="text-xl font-light"
                    style={{ fontFamily: "var(--font-display)", color: "var(--gold-shine)" }}
                    key={totalPrice}
                    initial={{ opacity: 0.5, y: 4 }}
                    animate={{ opacity: 1,   y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {totalPrice > 0 ? `₹${totalPrice.toLocaleString("en-IN")}` : "—"}
                  </motion.p>
                </div>

                <motion.button
                  className="btn-gold px-6 py-3 rounded-sm text-sm tracking-[0.15em] uppercase text-obsidian font-medium"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "12px",
                    color: "var(--color-void)",
                    minWidth: "140px",
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  // Parent should wire this to open the confirmation modal
                  // which then calls the /api/bookings/confirm route
                  onClick={() => {
                    // Dispatch to parent — this component stays presentational
                    const event = new CustomEvent("confirmBooking", {
                      detail: {
                        eventId,
                        seats: selectedSeats.map((s) => ({
                          id: s.id, seatIndex: s.seatIndex, version: s.version,
                          rowLabel: s.rowLabel, col: s.col,
                        })),
                      },
                    });
                    window.dispatchEvent(event);
                  }}
                >
                  Confirm {selectedSeats.length} Seat{selectedSeats.length > 1 ? "s" : ""}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}