"use client";

/**
 * components/SeatingGrid.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Interactive seating map. Light theme adaptation.
 *
 * ARCHITECTURE: unchanged from original —
 * • Server-side initial seat state (zero spinner on first paint)
 * • Supabase Realtime patches individual seat rows
 * • Framer Motion: staggered row entrance, seat spring selection, CSS held-pulse
 * • Segment Tree runs server-side; this component stays purely presentational
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SeatStatus = "available" | "held" | "booked" | "blocked";

export interface Seat {
  id:        string;
  seatIndex: number;
  rowLabel:  string;
  col:       number;
  section:   string;
  status:    SeatStatus;
  version:   number;
  price?:    number;
}

export interface SeatingGridProps {
  eventId:           string;
  eventTitle:        string;
  venueCapacity:     number;
  seats:             Seat[];
  maxSelectCount?:   number;
  onSelectionChange?: (selected: Seat[]) => void;
}

// ── Realtime payload ──────────────────────────────────────────────────────────

interface SeatRealtimePayload {
  eventType: "UPDATE";
  new: { id: string; status: SeatStatus; version: number };
  old: { id: string };
}

// ── State reducer ─────────────────────────────────────────────────────────────

type SeatMap = Map<string, Seat>;

type SeatAction =
  | { type: "INIT";          seats: Seat[] }
  | { type: "REMOTE_UPDATE"; id: string; status: SeatStatus; version: number }
  | { type: "SELECT";        id: string }
  | { type: "DESELECT";      id: string }
  | { type: "CLEAR_SELECTION" };

interface SeatState {
  seatMap:  SeatMap;
  selected: Set<string>;
}

function seatReducer(state: SeatState, action: SeatAction): SeatState {
  switch (action.type) {
    case "INIT":
      return { seatMap: new Map(action.seats.map((s) => [s.id, s])), selected: new Set() };

    case "REMOTE_UPDATE": {
      const newMap  = new Map(state.seatMap);
      const seat    = newMap.get(action.id);
      if (!seat) return state;
      newMap.set(action.id, { ...seat, status: action.status, version: action.version });
      const newSelected = new Set(state.selected);
      if (action.status !== "available") newSelected.delete(action.id);
      return { seatMap: newMap, selected: newSelected };
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

const SEAT_SIZE  = 34;
const MAX_SELECT = 8;

// ── Supabase client ───────────────────────────────────────────────────────────

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

  useEffect(() => {
    dispatch({ type: "INIT", seats: initialSeats });
  }, [initialSeats]);

  useEffect(() => {
    if (!onSelectionChange) return;
    const selectedSeats = [...state.selected]
      .map((id) => state.seatMap.get(id))
      .filter((s): s is Seat => !!s);
    onSelectionChange(selectedSeats);
  }, [state.selected, state.seatMap, onSelectionChange]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel  = supabase
      .channel(`event-seats:${eventId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "event_seats", filter: `event_id=eq.${eventId}` },
        (payload: SeatRealtimePayload) => {
          dispatch({ type: "REMOTE_UPDATE", id: payload.new.id, status: payload.new.status, version: payload.new.version });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId]);

  // ── Seat interaction ──────────────────────────────────────────────────────
  const handleSeatClick = useCallback(
    (seat: Seat) => {
      if (seat.status !== "available") return;
      if (state.selected.has(seat.id)) {
        dispatch({ type: "DESELECT", id: seat.id });
      } else {
        if (state.selected.size >= maxSelectCount) return;
        dispatch({ type: "SELECT", id: seat.id });
      }
    },
    [state.selected, maxSelectCount],
  );

  // ── Group seats by row ────────────────────────────────────────────────────
  const rows = useMemo(() => {
    const rowMap = new Map<string, Seat[]>();
    for (const seat of state.seatMap.values()) {
      if (!rowMap.has(seat.rowLabel)) rowMap.set(seat.rowLabel, []);
      rowMap.get(seat.rowLabel)!.push(seat);
    }
    for (const [, rowSeats] of rowMap) {
      rowSeats.sort((a, b) => a.col - b.col);
    }
    return [...rowMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [state.seatMap]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    let available = 0, held = 0, booked = 0;
    for (const seat of state.seatMap.values()) {
      if (seat.status === "available") available++;
      else if (seat.status === "held")   held++;
      else if (seat.status === "booked") booked++;
    }
    return { available, held, booked, selected: state.selected.size };
  }, [state.seatMap, state.selected]);

  // ── Animation variants ────────────────────────────────────────────────────
  const containerVariants = {
    hidden:  {},
    visible: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.03 } },
  };
  const rowVariants = {
    hidden:  { opacity: 0, y: prefersReducedMotion ? 0 : 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  };

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
      return { ...base, animate: { scale: 1.08, y: -1 }, transition: { type: "spring", stiffness: 300, damping: 18 } };
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
    <div
      className="w-full min-h-screen flex flex-col items-center px-4 py-12"
      style={{ background: "var(--bg-base)" }}
    >

      {/* ── Event Header ───────────────────────────────────────────────── */}
      <motion.header
        className="text-center mb-10 w-full max-w-4xl"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <p
          className="label-mono mb-3"
          style={{ color: "var(--accent)" }}
        >
          Select Your Seats
        </p>
        <h1
          className="text-4xl md:text-5xl font-bold mb-2"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
        >
          {eventTitle}
        </h1>
        <div
          className="mt-6 h-px"
          style={{ background: "var(--border)" }}
        />
      </motion.header>

      {/* ── Live Stats ─────────────────────────────────────────────────── */}
      <motion.div
        className="flex gap-8 mb-10 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        {[
          { label: "Available", value: stats.available, color: "var(--green)"       },
          { label: "Selected",  value: stats.selected,  color: "var(--accent)"      },
          { label: "Held",      value: stats.held,      color: "#6B5FD0"            },
          { label: "Booked",    value: stats.booked,    color: "var(--text-faint)"  },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col items-center">
            <motion.span
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-mono)", color }}
              key={value}
              initial={{ opacity: 0.4, scale: 0.85 }}
              animate={{ opacity: 1,   scale: 1     }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {value}
            </motion.span>
            <span
              className="label-mono mt-1"
              style={{ color: "var(--text-faint)" }}
            >
              {label}
            </span>
          </div>
        ))}
      </motion.div>

      {/* ── Stage Arc ──────────────────────────────────────────────────── */}
      <div className="w-full max-w-3xl mb-8">
        <div className="stage-arc h-9 flex items-center justify-center">
          <span
            className="label-mono"
            style={{ color: "var(--accent)", letterSpacing: "0.3em" }}
          >
            Stage
          </span>
        </div>
      </div>

      {/* ── Seat Grid ──────────────────────────────────────────────────── */}
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
              {/* Row label left */}
              <span
                className="w-6 text-center select-none shrink-0 label-mono"
                style={{ color: "var(--text-faint)" }}
              >
                {rowLabel}
              </span>

              {/* Seats */}
              <div className="flex gap-[6px]">
                {rowSeats.map((seat) => {
                  const isSelected   = state.selected.has(seat.id);
                  const motionProps  = getSeatMotionProps(seat, isSelected);
                  const seatClass    = isSelected ? "selected" : seat.status;

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
                      {SEAT_SIZE >= 32 && (
                        <span className="pointer-events-none" style={{ fontSize: 9 }}>
                          {seat.col}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Row label right */}
              <span
                className="w-6 text-center select-none shrink-0 label-mono"
                style={{ color: "var(--text-faint)" }}
              >
                {rowLabel}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <motion.div
        className="flex flex-wrap justify-center gap-6 mt-10 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        {[
          { label: "Available", className: "available", desc: "Click to select"  },
          { label: "Selected",  className: "selected",  desc: "Your selection"   },
          { label: "Held",      className: "held",      desc: "In someone's cart"},
          { label: "Booked",    className: "booked",    desc: "Permanently taken" },
        ].map(({ label, className: cls, desc }) => (
          <div key={label} className="flex items-center gap-2.5">
            <div
              className={`seat-btn ${cls} pointer-events-none`}
              style={{ width: 20, height: 20, fontSize: 0, borderRadius: 4 }}
              aria-hidden
            />
            <div>
              <p
                className="text-xs font-medium"
                style={{ color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: 12 }}
              >
                {label}
              </p>
              <p
                className="label-mono"
                style={{ color: "var(--text-faint)", fontSize: 9 }}
              >
                {desc}
              </p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Selection Tray ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedSeats.length > 0 && (
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
          >
            {/* Top border */}
            <div style={{ height: 1, background: "var(--border)" }} />

            <div
              className="glass px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              {/* Seat chips */}
              <div className="flex flex-wrap gap-2 flex-1">
                <AnimatePresence mode="popLayout">
                  {selectedSeats.map((seat) => (
                    <motion.button
                      key={seat.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer"
                      style={{
                        border:          "1px solid var(--border-strong)",
                        backgroundColor: "var(--bg-subtle)",
                        color:           "var(--text-secondary)",
                        fontFamily:      "var(--font-mono)",
                        fontSize:        "11px",
                        letterSpacing:   "0.06em",
                        transition:      "background 0.15s ease",
                      }}
                      onClick={() => dispatch({ type: "DESELECT", id: seat.id })}
                      initial={{ opacity: 0, scale: 0.8, x: -8 }}
                      animate={{ opacity: 1, scale: 1,   x: 0  }}
                      exit={{ opacity: 0,   scale: 0.7,  x: -6 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      aria-label={`Remove seat ${seat.rowLabel}${seat.col}`}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.background = "var(--bg-muted)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.background = "var(--bg-subtle)")
                      }
                    >
                      {seat.rowLabel}{seat.col}
                      <span style={{ color: "var(--text-faint)", fontSize: 14 }}>×</span>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>

              {/* Price + CTA */}
              <div className="flex items-center gap-5 shrink-0">
                <div className="text-right">
                  <p
                    className="label-mono mb-0.5"
                    style={{ color: "var(--text-faint)", fontSize: 9 }}
                  >
                    Total
                  </p>
                  <motion.p
                    className="text-xl font-bold"
                    style={{ fontFamily: "var(--font-display)", color: "var(--text-primary)" }}
                    key={totalPrice}
                    initial={{ opacity: 0.5, y: 4 }}
                    animate={{ opacity: 1,   y: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    {totalPrice > 0 ? `₹${totalPrice.toLocaleString("en-IN")}` : "—"}
                  </motion.p>
                </div>

                <motion.button
                  className="btn-accent px-6 py-3 rounded-xl text-sm font-semibold"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize:   "14px",
                    minWidth:   "148px",
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("confirmBooking", {
                        detail: {
                          eventId,
                          seats: selectedSeats.map((s) => ({
                            id: s.id, seatIndex: s.seatIndex, version: s.version,
                            rowLabel: s.rowLabel, col: s.col,
                          })),
                        },
                      }),
                    );
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