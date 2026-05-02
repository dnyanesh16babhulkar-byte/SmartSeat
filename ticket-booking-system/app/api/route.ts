// app/api/bookings/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  buildSegmentTreeFromDB,
  type SeatStatus,
} from "@/lib/segment-tree"; // adjust to your lib path

// ── Request / Response types ──────────────────────────────────────────────────

interface ConfirmBookingRequest {
  eventId:    string;
  seats: Array<{
    id:        string;  // UUID from event_seats
    seatIndex: number;  // 0-based index (segment tree leaf)
    version:   number;  // read version — for optimistic locking in DB
  }>;
}

interface ConfirmBookingResponse {
  ok:          boolean;
  bookingIds?: string[];
  error?:      string;
  code?:       "SEAT_CONFLICT" | "NOT_CONTIGUOUS" | "UNAUTHENTICATED" | "INVALID_REQUEST" | "INTERNAL";
  // Diagnostic: the segment tree's view of seat state at time of request
  treeSnapshot?: {
    requestedIndexes:  number[];
    treeSawAvailable:  boolean;
    globalMaxBlock:    number;
  };
}

// ── Max seats per booking transaction ────────────────────────────────────────
const MAX_SEATS_PER_BOOKING = 8;

// ── Rate limiting state (in-memory; use Upstash Redis in multi-node prod) ────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10_000; // 10 seconds
const RATE_LIMIT_MAX       = 5;      // max 5 booking attempts per 10s per user

// ── Route Handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/bookings/confirm
 *
 * Pipeline (all within one request):
 *   1. Authenticate via Supabase SSR session (server-side cookie read)
 *   2. Validate + rate-limit the request
 *   3. Fetch current seat snapshot from DB (for the event)
 *   4. Build a Segment Tree from the snapshot
 *   5. Validate that every requested seat_index is marked "available" in the tree
 *   6. Optionally verify contiguity (optional UX constraint for premium rows)
 *   7. Call the book_seats() Postgres RPC which performs the optimistic-lock UPDATE
 *   8. Return booking IDs or a structured error to the client
 *
 * WHY USE THE SEGMENT TREE HERE (SERVER-SIDE)?
 * ─────────────────────────────────────────────
 * The tree on the client is optimistic — it reflects the last known state.
 * Between the user clicking "Confirm" and this handler running, another user
 * may have booked one of the selected seats.
 *
 * We re-build the tree from a fresh DB snapshot here to validate:
 *   • Are all requested seats still available? (O(1) leaf lookup per seat)
 *   • Are there N seats genuinely contiguous? (O(log N) tree query)
 *
 * The tree validation adds ~0.5ms per call — negligible against the DB
 * round-trips, but it provides a clean, structured error before we even
 * attempt the Postgres transaction, reducing DB lock contention.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ConfirmBookingResponse>> {
  // ── 1. Supabase SSR session ─────────────────────────────────────────────
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) {
          // Route Handlers can't set cookies directly on the response here;
          // the middleware handles cookie refresh. This is fine for reads.
        },
        remove(name: string, options: CookieOptions) {},
      },
    },
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { ok: false, error: "Authentication required.", code: "UNAUTHENTICATED" },
      { status: 401 },
    );
  }

  // ── 2. Parse + validate request body ────────────────────────────────────
  let body: ConfirmBookingRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body.", code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  const { eventId, seats } = body;

  if (!eventId || typeof eventId !== "string") {
    return NextResponse.json(
      { ok: false, error: "eventId is required.", code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  if (!Array.isArray(seats) || seats.length === 0) {
    return NextResponse.json(
      { ok: false, error: "At least one seat is required.", code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  if (seats.length > MAX_SEATS_PER_BOOKING) {
    return NextResponse.json(
      { ok: false, error: `Maximum ${MAX_SEATS_PER_BOOKING} seats per booking.`, code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  // Validate each seat entry shape
  for (const seat of seats) {
    if (!seat.id || typeof seat.id !== "string")           return invalidSeat();
    if (typeof seat.seatIndex !== "number" || seat.seatIndex < 0) return invalidSeat();
    if (typeof seat.version   !== "number" || seat.version < 0)   return invalidSeat();
  }

  // ── 3. Rate limiting ─────────────────────────────────────────────────────
  // Keyed by user ID — prevents a single account from spamming the endpoint
  // during a high-demand on-sale event.
  const now      = Date.now();
  const rlEntry  = rateLimitMap.get(user.id);

  if (rlEntry && now < rlEntry.resetAt) {
    if (rlEntry.count >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { ok: false, error: "Too many booking attempts. Please wait a moment.", code: "INVALID_REQUEST" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rlEntry.resetAt - now) / 1000)) } },
      );
    }
    rlEntry.count++;
  } else {
    rateLimitMap.set(user.id, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  }

  // ── 4. Fetch seat snapshot for this event ────────────────────────────────
  // We fetch ALL seats for the event (not just the requested ones) because
  // we need the complete array to build the Segment Tree with correct indexing.
  const { data: seatRows, error: fetchError } = await supabase
    .from("event_seats")
    .select("id, seat_index, status, version")
    .eq("event_id", eventId)
    .order("seat_index", { ascending: true });

  if (fetchError || !seatRows || seatRows.length === 0) {
    console.error("[confirm] seat fetch error:", fetchError);
    return NextResponse.json(
      { ok: false, error: "Event seating data unavailable.", code: "INTERNAL" },
      { status: 500 },
    );
  }

  // ── 5. Build Segment Tree from DB snapshot ───────────────────────────────
  const tree = buildSegmentTreeFromDB(
    seatRows.map((r) => ({
      seat_index: r.seat_index,
      status:     r.status as SeatStatus,
    })),
  );

  // ── 6. Validate requested seats against the tree ─────────────────────────
  //
  // For each requested seat:
  //   a) Find the DB row by ID (to confirm it belongs to this event)
  //   b) Check that the seat_index leaf in the tree shows "available"
  //   c) Check that the DB row's version matches what the client sent
  //      (belt-and-suspenders on top of the Postgres optimistic lock)
  //
  // If ANY seat fails, we return immediately — no partial bookings.

  const requestedIndexes = seats.map((s) => s.seatIndex);
  const seatRowById      = new Map(seatRows.map((r) => [r.id, r]));
  const statusArray      = tree.toStatusArray();

  for (const reqSeat of seats) {
    const dbRow = seatRowById.get(reqSeat.id);

    if (!dbRow) {
      return NextResponse.json({
        ok:    false,
        error: `Seat ${reqSeat.id} not found for this event.`,
        code:  "INVALID_REQUEST",
      }, { status: 400 });
    }

    // Verify the seat index matches (prevents spoofed payloads)
    if (dbRow.seat_index !== reqSeat.seatIndex) {
      return NextResponse.json({
        ok:    false,
        error: "Seat index mismatch. Please refresh the seating map.",
        code:  "INVALID_REQUEST",
      }, { status: 400 });
    }

    // Tree availability check — O(1) leaf lookup
    const treeStatus = statusArray[reqSeat.seatIndex];
    if (treeStatus !== "available") {
      return NextResponse.json({
        ok:    false,
        error: `Seat ${dbRow.seat_index} is no longer available.`,
        code:  "SEAT_CONFLICT",
        treeSnapshot: {
          requestedIndexes,
          treeSawAvailable: false,
          globalMaxBlock:   tree.globalMaxBlock,
        },
      }, { status: 409 });
    }

    // Version mismatch check — another user booked between client read + confirm
    if (dbRow.version !== reqSeat.version) {
      return NextResponse.json({
        ok:    false,
        error: "Seat data has changed. Please review your selection.",
        code:  "SEAT_CONFLICT",
        treeSnapshot: {
          requestedIndexes,
          treeSawAvailable: true, // tree says available but version diverged
          globalMaxBlock:   tree.globalMaxBlock,
        },
      }, { status: 409 });
    }
  }

  // ── 7. Optional: contiguity check via Segment Tree ───────────────────────
  // If the user requested N seats, verify the Segment Tree can still find
  // a contiguous block of N starting at the minimum requested index.
  // This is a soft check — you may choose to skip it for non-adjacent bookings.
  //
  // For the "best available" flow (where the UI uses findContiguous(n)):
  //   const contiguous = tree.findContiguous(seats.length);
  //   if (!contiguous.found || contiguous.startIndex !== Math.min(...requestedIndexes)) { ... }
  //
  // For a "pick your own" flow (any seats, not necessarily adjacent):
  //   Skip this check. Only validate individual seat availability above.

  // ── 8. Call book_seats() Postgres RPC ───────────────────────────────────
  //
  // book_seats() is defined in schema.sql (§9).
  // It runs with SECURITY DEFINER and performs the optimistic-lock UPDATE:
  //   UPDATE event_seats SET status='booked' WHERE id=? AND version=?
  // If any UPDATE hits 0 rows → it raises SEAT_CONFLICT.
  //
  // Using a single RPC call keeps the booking atomic — either all seats
  // succeed or none do. No partial bookings escape.

  // Calculate total amount (in production: fetch price from DB / pricing table)
  const totalAmount = seats.length * 0; // pricing logic goes here

  const { data: rpcResult, error: rpcError } = await supabase.rpc("book_seats", {
    p_event_id: eventId,
    p_seat_ids: seats.map((s) => s.id),
    p_versions: seats.map((s) => s.version),
    p_amount:   totalAmount,
  });

  if (rpcError) {
    console.error("[confirm] book_seats RPC error:", rpcError.message);
    return NextResponse.json(
      { ok: false, error: "Booking failed. Please try again.", code: "INTERNAL" },
      { status: 500 },
    );
  }

  // RPC returns { ok: bool, booking_ids?: string[], error?: string }
  if (!rpcResult.ok) {
    const isSeatConflict = rpcResult.error?.startsWith("SEAT_CONFLICT");
    return NextResponse.json(
      {
        ok:    false,
        error: isSeatConflict ? "One or more seats were just taken." : rpcResult.error,
        code:  isSeatConflict ? "SEAT_CONFLICT" : "INTERNAL",
        treeSnapshot: {
          requestedIndexes,
          treeSawAvailable: true, // tree passed; DB found conflict
          globalMaxBlock:   tree.globalMaxBlock,
        },
      },
      { status: isSeatConflict ? 409 : 500 },
    );
  }

  // ── 9. Success ───────────────────────────────────────────────────────────
  return NextResponse.json(
    {
      ok:         true,
      bookingIds: rpcResult.booking_ids ?? [],
      treeSnapshot: {
        requestedIndexes,
        treeSawAvailable: true,
        globalMaxBlock:   tree.globalMaxBlock,
      },
    },
    { status: 201 },
  );
}

// ── Helper ────────────────────────────────────────────────────────────────────

function invalidSeat(): NextResponse<ConfirmBookingResponse> {
  return NextResponse.json(
    { ok: false, error: "Invalid seat data in request.", code: "INVALID_REQUEST" },
    { status: 400 },
  );
}

// ── Method guard ──────────────────────────────────────────────────────────────

export function GET(): NextResponse {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405, headers: { Allow: "POST" } },
  );
}