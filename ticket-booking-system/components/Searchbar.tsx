"use client";

/**
 * components/SearchBar.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Premium event & venue autocomplete using the Trie from Phase 2.
 *
 * DESIGN PRINCIPLES:
 * ──────────────────
 * 1. ZERO NETWORK on keypress — the Trie lives in memory, search is synchronous.
 * 2. KEYBOARD FIRST — full arrow-key navigation, Enter to confirm, Escape to close.
 * 3. ACCENT HIGHLIGHT — matched prefix is highlighted in the accent colour.
 * 4. CATEGORY BADGES — each result shows a category pill.
 * 5. FREQUENCY BOOST — results with higher Trie frequency surface first.
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
import { Trie, type TrieSearchResult } from "@/lib/trie";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchBarProps {
  trie:            Trie;
  placeholder?:    string;
  maxResults?:     number;
  onResultSelect:  (result: TrieSearchResult) => void;
  className?:      string;
  boostUpcoming?:  boolean;
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

function HighlightedTerm({ term, query }: { term: string; query: string }) {
  const lowerTerm  = term.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const matchLen   = lowerTerm.startsWith(lowerQuery) ? lowerQuery.length : 0;

  if (matchLen === 0) {
    return <span style={{ color: "var(--text-primary)" }}>{term}</span>;
  }

  return (
    <>
      <span style={{ color: "var(--accent)", fontWeight: 600 }}>
        {term.slice(0, matchLen)}
      </span>
      <span style={{ color: "var(--text-secondary)" }}>
        {term.slice(matchLen)}
      </span>
    </>
  );
}

// ── Category badge colours — adapted for light theme ─────────────────────────

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  theatre:  { bg: "var(--green-light)",             text: "var(--green)"           },
  concert:  { bg: "var(--accent-light)",             text: "var(--accent)"          },
  sports:   { bg: "#FFF0E8",                         text: "#C44B00"                },
  movie:    { bg: "#FDE8E8",                         text: "#B83232"                },
  comedy:   { bg: "var(--amber-light)",              text: "var(--amber)"           },
  venue:    { bg: "var(--bg-subtle)",                text: "var(--text-muted)"      },
  other:    { bg: "var(--bg-muted)",                 text: "var(--text-faint)"      },
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

  const inputRef   = useRef<HTMLInputElement>(null);
  const listRef    = useRef<HTMLUListElement>(null);
  const listboxId  = useId();
  const debouncedQ = useDebounce(query, 60);

  // ── Boost upcoming events ─────────────────────────────────────────────────
  const boostFn = useMemo(() => {
    if (!boostUpcoming) return undefined;
    const now       = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    return (meta: TrieSearchResult["metadata"]) => {
      if (meta.type !== "event" || !meta.startsAt) return 0;
      const diff = new Date(meta.startsAt).getTime() - now;
      return diff > 0 && diff < oneWeekMs ? 8 : 0;
    };
  }, [boostUpcoming]);

  // ── Trie search — synchronous ─────────────────────────────────────────────
  const results: TrieSearchResult[] = useMemo(() => {
    const q = debouncedQ.trim();
    if (q.length < 1) return [];
    // @ts-ignore
    return trie.search(q, maxResults, boostFn);
  }, [debouncedQ, trie, maxResults, boostFn]);

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

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[activeIndex] as HTMLElement;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleSelect = useCallback(
    (result: TrieSearchResult) => {
      trie.recordSelection(result.term);
      setQuery(result.term);
      setIsOpen(false);
      setActiveIndex(-1);
      onResultSelect(result);
      inputRef.current?.blur();
    },
    [trie, onResultSelect],
  );

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

  function formatDate(iso?: string) {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div data-searchbar className={`relative w-full max-w-2xl ${className}`}>

      {/* ── Input wrapper ──────────────────────────────────────────────── */}
      <div
        className="relative flex items-center px-4 py-3.5 rounded-xl transition-all duration-200"
        style={{
          background:   "var(--bg-surface)",
          border:       `1.5px solid ${isFocused ? "var(--accent)" : "var(--border)"}`,
          boxShadow:    isFocused
            ? "0 0 0 3px rgba(42,71,219,0.1), 0 4px 20px rgba(0,0,0,0.06)"
            : "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        {/* Search icon */}
        <svg
          className="shrink-0 mr-3 pointer-events-none"
          width="17"
          height="17"
          viewBox="0 0 17 17"
          fill="none"
        >
          <circle
            cx="7" cy="7" r="5.5"
            stroke={isFocused ? "var(--accent)" : "var(--text-faint)"}
            strokeWidth="1.4"
            style={{ transition: "stroke 0.2s ease" }}
          />
          <line
            x1="11" y1="11" x2="15" y2="15"
            stroke={isFocused ? "var(--accent)" : "var(--text-faint)"}
            strokeWidth="1.4"
            strokeLinecap="round"
            style={{ transition: "stroke 0.2s ease" }}
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `result-${activeIndex}` : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 bg-transparent outline-none text-base"
          style={{
            fontFamily:    "var(--font-body)",
            fontSize:      "16px",
            fontWeight:    400,
            color:         "var(--text-primary)",
            caretColor:    "var(--accent)",
          } as React.CSSProperties}
        />

        {/* Clear button */}
        <AnimatePresence>
          {query.length > 0 && (
            <motion.button
              className="shrink-0 ml-2 p-1 flex items-center justify-center rounded-full"
              style={{
                color:      "var(--text-faint)",
                background: "var(--bg-subtle)",
              }}
              onClick={() => { setQuery(""); setIsOpen(false); inputRef.current?.focus(); }}
              aria-label="Clear search"
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ duration: 0.12 }}
              whileHover={{ background: "var(--bg-muted)" }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="10" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Results Dropdown ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-2 z-[100] overflow-hidden rounded-xl"
            style={{
              background: "var(--bg-surface)",
              border:     "1px solid var(--border)",
              boxShadow:  "0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
            }}
            initial={{ opacity: 0, y: -6, scaleY: 0.96 }}
            animate={{ opacity: 1, y: 0,  scaleY: 1 }}
            exit={{ opacity: 0,   y: -4,  scaleY: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Results header */}
            <div
              className="px-4 pt-3 pb-2 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <span style={{
                fontFamily:    "var(--font-mono)",
                fontSize:      "10px",
                letterSpacing: "0.18em",
                color:         "var(--text-faint)",
                textTransform: "uppercase",
              }}>
                {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{debouncedQ}&rdquo;
              </span>
              <span style={{
                fontFamily:    "var(--font-mono)",
                fontSize:      "10px",
                letterSpacing: "0.12em",
                color:         "var(--text-faint)",
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
              className="py-1 max-h-[380px] overflow-y-auto"
            >
              {results.map((result, index) => {
                const isActive  = index === activeIndex;
                const catStyle  = getCategoryStyle(result.metadata.type, result.metadata.category);
                const dateStr   = formatDate(result.metadata.startsAt);

                return (
                  <motion.li
                    key={`${result.metadata.id}-${index}`}
                    id={`result-${index}`}
                    role="option"
                    aria-selected={isActive}
                    className="px-4 py-3 cursor-pointer flex items-center justify-between gap-4"
                    style={{
                      backgroundColor: isActive ? "var(--bg-subtle)" : "transparent",
                      borderLeft:      isActive ? "2.5px solid var(--accent)" : "2.5px solid transparent",
                      transition:      "background-color 0.1s ease, border-color 0.1s ease",
                    }}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setActiveIndex(index)}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.025, duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {/* Left: term + meta */}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <p
                        className="text-sm leading-snug truncate"
                        style={{ fontFamily: "var(--font-body)", fontWeight: 400 }}
                      >
                        <HighlightedTerm term={result.term} query={debouncedQ} />
                      </p>
                      {(dateStr || result.metadata.city) && (
                        <p style={{
                          fontFamily:    "var(--font-mono)",
                          fontSize:      "10px",
                          letterSpacing: "0.06em",
                          color:         "var(--text-faint)",
                        }}>
                          {[dateStr, result.metadata.city].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>

                    {/* Right: category + popularity */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className="px-2 py-0.5 rounded-md"
                        style={{
                          fontFamily:    "var(--font-mono)",
                          fontSize:      "9px",
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          background:    catStyle.bg,
                          color:         catStyle.text,
                        }}
                      >
                        {result.metadata.type === "venue"
                          ? "Venue"
                          : result.metadata.category ?? "Event"}
                      </span>
                      {result.frequency > 0 && (
                        <div
                          className="flex gap-0.5"
                          aria-label={`Popularity: ${result.frequency}`}
                          title={`Booked ${result.frequency} times`}
                        >
                          {Array.from({ length: Math.min(result.frequency, 5) }).map((_, i) => (
                            <div
                              key={i}
                              style={{
                                width:           3,
                                height:          3,
                                borderRadius:    "50%",
                                backgroundColor: "var(--accent)",
                                opacity:         0.25 + i * 0.15,
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

            {/* Footer */}
            <div
              className="px-4 py-2.5"
              style={{ borderTop: "1px solid var(--border)", background: "var(--bg-subtle)" }}
            >
              <p style={{
                fontFamily:    "var(--font-mono)",
                fontSize:      "9px",
                color:         "var(--text-faint)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}>
                Powered by Prefix Search · {trie.size.toLocaleString()} indexed terms
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isFocused && debouncedQ.length >= 1 && results.length === 0 && (
          <motion.div
            className="absolute top-full left-0 right-0 mt-2 px-5 py-5 rounded-xl"
            style={{
              background: "var(--bg-surface)",
              border:     "1px solid var(--border)",
              boxShadow:  "0 8px 32px rgba(0,0,0,0.08)",
            }}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <p style={{
              fontFamily:  "var(--font-body)",
              fontSize:    "15px",
              fontWeight:  400,
              color:       "var(--text-muted)",
              fontStyle:   "italic",
            }}>
              No events found for &ldquo;{debouncedQ}&rdquo;
            </p>
            <p style={{
              fontFamily:    "var(--font-mono)",
              fontSize:      "10px",
              color:         "var(--text-faint)",
              letterSpacing: "0.1em",
              marginTop:     "6px",
            }}>
              Try a shorter prefix · e.g. &ldquo;{debouncedQ.slice(0, 3)}&rdquo;
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}