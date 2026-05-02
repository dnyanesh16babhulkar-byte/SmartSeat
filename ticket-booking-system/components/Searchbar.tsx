"use client";

/**
 * components/SearchBar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Premium event & venue autocomplete using the Trie from Phase 2.
 *
 * DESIGN PRINCIPLES:
 * ──────────────────
 * 1. ZERO NETWORK on keypress — the Trie lives in memory, search is synchronous.
 *    The only network call is the initial bulk-load (once at app start or
 *    hydration time via a Server Component that passes `trieData` as a prop).
 *
 * 2. KEYBOARD FIRST — full arrow-key navigation, Enter to confirm, Escape to close.
 *    Screen-reader accessible via aria-combobox / aria-activedescendant.
 *
 * 3. GOLD HIGHLIGHT — the matched prefix is highlighted in gold, the rest in silver.
 *    Implemented with a character-level split rather than dangerouslySetInnerHTML.
 *
 * 4. CATEGORY BADGES — each result shows an editorial category pill
 *    (THEATRE · CONCERT · SPORTS) in a monospaced micro-label.
 *
 * 5. FREQUENCY BOOST — results with higher Trie frequency (past clicks) surface
 *    first. The `recordSelection` call on pick feeds back into the Trie.
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trie, type TrieSearchResult } from "@/lib/trie"; // adjust import path

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchBarProps {
  trie:             Trie;          // pre-built Trie passed from parent/server
  placeholder?:     string;
  maxResults?:      number;        // default 7
  onResultSelect:   (result: TrieSearchResult) => void;
  className?:       string;
  /** Optional: boost events happening in the next 7 days */
  boostUpcoming?:   boolean;
}

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ── Highlight component ───────────────────────────────────────────────────────
// Splits the result term into a matched prefix (gold) and remainder (silver).
// Pure character split — no regex, no dangerouslySetInnerHTML.

function HighlightedTerm({ term, query }: { term: string; query: string }) {
  const lowerTerm  = term.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const matchLen   = lowerTerm.startsWith(lowerQuery) ? lowerQuery.length : 0;

  if (matchLen === 0) {
    return <span style={{ color: "var(--silver-light)" }}>{term}</span>;
  }

  return (
    <>
      <span style={{ color: "var(--gold-bright)", fontWeight: 400 }}>
        {term.slice(0, matchLen)}
      </span>
      <span style={{ color: "var(--silver-base)" }}>
        {term.slice(matchLen)}
      </span>
    </>
  );
}

// ── Category badge colours ────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  theatre:  { bg: "rgba(212,168,71,0.1)",  text: "var(--gold-muted)"  },
  concert:  { bg: "rgba(91,79,206,0.12)",  text: "#8B80E8"            },
  sports:   { bg: "rgba(45,90,62,0.15)",   text: "#4CAF7D"            },
  movie:    { bg: "rgba(180,40,40,0.12)",  text: "#E87070"            },
  comedy:   { bg: "rgba(168,120,0,0.12)",  text: "#D4A030"            },
  venue:    { bg: "rgba(60,60,60,0.2)",    text: "var(--silver-base)" },
  other:    { bg: "rgba(40,40,40,0.2)",    text: "var(--silver-deep)" },
};

function getCategoryStyle(type: string, category?: string) {
  const key = type === "venue" ? "venue" : (category ?? "other");
  return CATEGORY_STYLES[key] ?? CATEGORY_STYLES.other;
}

// ── SearchBar ─────────────────────────────────────────────────────────────────

export default function SearchBar({
  trie,
  placeholder    = "Search events, venues, artists…",
  maxResults     = 7,
  onResultSelect,
  className      = "",
  boostUpcoming  = true,
}: SearchBarProps) {
  const [query,       setQuery]       = useState("");
  const [isOpen,      setIsOpen]      = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isFocused,   setIsFocused]   = useState(false);

  const inputRef     = useRef<HTMLInputElement>(null);
  const listRef      = useRef<HTMLUListElement>(null);
  const listboxId    = useId();
  const debouncedQ   = useDebounce(query, 60); // 60ms — fast enough for Trie

  // ── Boost function — upcoming events rank higher ──────────────────────────
  const boostFn = useMemo(() => {
    if (!boostUpcoming) return undefined;
    const now       = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    return (meta: TrieSearchResult["metadata"]) => {
      if (meta.type !== "event" || !meta.startsAt) return 0;
      const diff = new Date(meta.startsAt).getTime() - now;
      return diff > 0 && diff < oneWeekMs ? 8 : 0; // +8 score for this-week events
    };
  }, [boostUpcoming]);

  // ── Trie search — synchronous, O(P + K) ──────────────────────────────────
  const results: TrieSearchResult[] = useMemo(() => {
    const q = debouncedQ.trim();
    if (q.length < 1) return [];
    // @ts-ignore — boostFn type is compatible
    return trie.search(q, maxResults, boostFn);
  }, [debouncedQ, trie, maxResults, boostFn]);

  // Sync open state to results availability
  useEffect(() => {
    setIsOpen(results.length > 0 && isFocused);
    setActiveIndex(-1);
  }, [results, isFocused]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) {
      if (e.key === "ArrowDown" && results.length > 0) {
        setIsOpen(true);
        setActiveIndex(0);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => (i <= 0 ? -1 : i - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0 && results[activeIndex]) {
          handleSelect(results[activeIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
        break;
      case "Tab":
        setIsOpen(false);
        break;
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[activeIndex] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // ── Select handler ────────────────────────────────────────────────────────
  const handleSelect = useCallback(
    (result: TrieSearchResult) => {
      trie.recordSelection(result.term); // feed frequency back to Trie
      setQuery(result.term);
      setIsOpen(false);
      setActiveIndex(-1);
      onResultSelect(result);
      inputRef.current?.blur();
    },
    [trie, onResultSelect],
  );

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (!inputRef.current?.closest("[data-searchbar]")?.contains(target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // ── Format date for display ───────────────────────────────────────────────
  function formatDate(iso?: string) {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      data-searchbar
      className={`relative w-full max-w-2xl ${className}`}
    >
      {/* ── Input wrapper ─────────────────────────────────────────────── */}
      <div
        className="relative flex items-center"
        style={{
          borderBottom: isFocused
            ? "1px solid var(--gold-base)"
            : "1px solid var(--color-ash)",
          transition: "border-color 0.3s ease",
        }}
      >
        {/* Search icon — thin SVG, not an emoji */}
        <svg
          className="absolute left-0 shrink-0 pointer-events-none"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <circle
            cx="6.5" cy="6.5" r="5"
            stroke={isFocused ? "var(--gold-base)" : "var(--silver-deep)"}
            strokeWidth="1"
            style={{ transition: "stroke 0.3s ease" }}
          />
          <line
            x1="10.5" y1="10.5" x2="14.5" y2="14.5"
            stroke={isFocused ? "var(--gold-base)" : "var(--silver-deep)"}
            strokeWidth="1"
            strokeLinecap="round"
            style={{ transition: "stroke 0.3s ease" }}
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `result-${activeIndex}` : undefined
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="w-full bg-transparent pl-7 pr-10 py-4 outline-none"
          style={{
            fontFamily:     "var(--font-display)",
            fontSize:       "18px",
            fontWeight:     300,
            color:          "var(--silver-white)",
            letterSpacing:  "0.02em",
            caretColor:     "var(--gold-base)",
          }}
          style={{
            fontFamily:    "var(--font-display)",
            fontSize:      "18px",
            fontWeight:    300,
            color:         "var(--silver-white)",
            letterSpacing: "0.02em",
            caretColor:    "var(--gold-base)",
          } as React.CSSProperties}
        />

        {/* Clear button — appears only when there's a query */}
        <AnimatePresence>
          {query.length > 0 && (
            <motion.button
              className="absolute right-0 p-1 flex items-center justify-center"
              onClick={() => { setQuery(""); setIsOpen(false); inputRef.current?.focus(); }}
              aria-label="Clear search"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.15 }}
              style={{ color: "var(--silver-deep)" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <line x1="2" y1="2" x2="12" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="12" y1="2" x2="2" y2="12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Animated gold underline on focus */}
      <motion.div
        className="absolute bottom-0 left-0 h-px"
        style={{ background: "var(--gold-base)", originX: 0 }}
        animate={{ scaleX: isFocused ? 1 : 0, opacity: isFocused ? 1 : 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        initial={{ scaleX: 0, opacity: 0 }}
      />

      {/* ── Results Dropdown ───────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-1 z-[100] overflow-hidden"
            style={{
              background:   "var(--color-abyss)",
              border:       "1px solid var(--color-ash)",
              borderTop:    "1px solid var(--gold-dim)",
            }}
            initial={{ opacity: 0, y: -8, scaleY: 0.94 }}
            animate={{ opacity: 1, y: 0,  scaleY: 1 }}
            exit={{ opacity: 0,   y: -6,  scaleY: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              background: "var(--color-abyss)",
              border:     "1px solid var(--color-ash)",
              borderTop:  "1px solid var(--gold-dim)",
              transformOrigin: "top",
            } as React.CSSProperties}
          >
            {/* Results count — editorial micro-label */}
            <div
              className="px-4 pt-3 pb-1.5 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--color-graphite)" }}
            >
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.2em",
                color: "var(--silver-deep)",
                textTransform: "uppercase",
              }}>
                {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{debouncedQ}&rdquo;
              </span>
              <span style={{
                fontFamily: "var(--font-mono)",
                fontSize: "9px",
                letterSpacing: "0.15em",
                color: "var(--silver-deep)",
                textTransform: "uppercase",
              }}>
                ↑↓ Navigate · ↵ Select
              </span>
            </div>

            <ul
              ref={listRef}
              id={listboxId}
              role="listbox"
              aria-label="Search results"
              className="py-1 max-h-[400px] overflow-y-auto"
            >
              {results.map((result, index) => {
                const isActive = index === activeIndex;
                const catStyle = getCategoryStyle(result.metadata.type, result.metadata.category);
                const dateStr  = formatDate(result.metadata.startsAt);

                return (
                  <motion.li
                    key={`${result.metadata.id}-${index}`}
                    id={`result-${index}`}
                    role="option"
                    aria-selected={isActive}
                    className="px-4 py-3 cursor-pointer flex items-center justify-between gap-4"
                    style={{
                      backgroundColor: isActive ? "var(--color-graphite)" : "transparent",
                      borderLeft: isActive
                        ? "2px solid var(--gold-base)"
                        : "2px solid transparent",
                      transition: "background-color 0.12s ease, border-color 0.12s ease",
                    }}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setActiveIndex(index)}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay:    index * 0.03,
                      duration: 0.18,
                      ease:     [0.16, 1, 0.3, 1],
                    }}
                  >
                    {/* Left: term + date */}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <p
                        className="text-base leading-tight truncate"
                        style={{ fontFamily: "var(--font-display)", fontWeight: 300 }}
                      >
                        <HighlightedTerm term={result.term} query={debouncedQ} />
                      </p>
                      {(dateStr || result.metadata.city) && (
                        <p style={{
                          fontFamily:    "var(--font-mono)",
                          fontSize:      "10px",
                          letterSpacing: "0.06em",
                          color:         "var(--silver-mid)",
                        }}>
                          {[dateStr, result.metadata.city].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>

                    {/* Right: category badge + frequency signal */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className="px-2 py-0.5 rounded-sm"
                        style={{
                          fontFamily:    "var(--font-mono)",
                          fontSize:      "9px",
                          letterSpacing: "0.15em",
                          textTransform: "uppercase",
                          background:    catStyle.bg,
                          color:         catStyle.text,
                        }}
                      >
                        {result.metadata.type === "venue"
                          ? "Venue"
                          : result.metadata.category ?? "Event"}
                      </span>
                      {/* Popularity dots — subtle frequency visualisation */}
                      {result.frequency > 0 && (
                        <div className="flex gap-0.5" aria-label={`Popularity: ${result.frequency}`} title={`Booked ${result.frequency} times`}>
                          {Array.from({ length: Math.min(result.frequency, 5) }).map((_, i) => (
                            <div
                              key={i}
                              style={{
                                width: 3, height: 3,
                                borderRadius: "50%",
                                backgroundColor: "var(--gold-dim)",
                                opacity: 0.4 + i * 0.15,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.li>
                );
              })}
            </ul>

            {/* Footer: keyboard hint */}
            <div
              className="px-4 py-2"
              style={{ borderTop: "1px solid var(--color-graphite)" }}
            >
              <p style={{
                fontFamily: "var(--font-mono)",
                fontSize:   "9px",
                color:      "var(--silver-deep)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}>
                Powered by Prefix Search · {trie.size.toLocaleString()} indexed terms
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty state ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isFocused && debouncedQ.length >= 1 && results.length === 0 && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-1 px-5 py-5"
            style={{
              background: "var(--color-abyss)",
              border:     "1px solid var(--color-ash)",
              borderTop:  "1px solid var(--color-graphite)",
            }}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p style={{
              fontFamily:    "var(--font-display)",
              fontSize:      "15px",
              fontWeight:    300,
              color:         "var(--silver-mid)",
              fontStyle:     "italic",
            }}>
              No events found for &ldquo;{debouncedQ}&rdquo;
            </p>
            <p style={{
              fontFamily:    "var(--font-mono)",
              fontSize:      "10px",
              color:         "var(--silver-deep)",
              letterSpacing: "0.1em",
              marginTop:     "4px",
            }}>
              Try a shorter prefix · e.g. &ldquo;{debouncedQ.slice(0, 3)}&rdquo;
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}