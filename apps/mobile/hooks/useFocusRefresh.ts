import { useCallback, useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import * as Sentry from "@sentry/react-native";

// Triggering a refetch on every focus is not enough on its own: React Navigation
// rebuilds the navigation object identity fairly often (state/emitter/setOptions
// changes), and naively re-running on each rebuild issues a request without the
// screen ever losing focus. Screens that treat every run as "issue a request,
// then setState with the reply" therefore have a feedback path with nothing
// bounding it — one production session was seen reading at roughly frame rate
// until React aborted the tree with "Maximum update depth exceeded". This hook
// is the bound: concurrent reads share one request, a genuine focus transition
// (tracked via `useIsFocused`, immune to navigation-identity churn — see below)
// triggers at most one read, and a sustained run trips a breaker that stops
// refreshing and reports once.
//
// What drove the production re-runs that fast is still unidentified — it
// happened to another user and has not been reproduced — so the breaker bounds
// the damage rather than assuming a cause.

/**
 * A pathological run is many reads inside ONE mount with no idle gap. Counting a
 * consecutive run rather than reads-per-fixed-window matters: a runaway loop is
 * sequential at round-trip cadence (~300-400ms), so any window short enough to
 * catch it would keep resetting mid-run.
 */
const IDLE_GAP_MS = 1000;
/**
 * Normal use is one or two reads per visit, and leaving a screen unmounts it,
 * which resets these refs — so navigating in and out repeatedly cannot
 * accumulate towards this.
 */
const READ_LIMIT = 12;

export interface FocusRefreshOptions {
  /** Sentry tag identifying the screen, e.g. `"history.refreshLoop"`. */
  context: string;
  /** Extra Sentry payload, read lazily when the breaker trips. */
  detail?: () => Record<string, unknown>;
  /** `true` when the screen shows a full-screen spinner before its first read. */
  initialLoading?: boolean;
}

export interface FocusRefresh<T> {
  /**
   * Re-read on demand. Pass `{ force: true }` from a caller that must observe
   * state written by its own preceding mutation — sharing a read issued *before*
   * that write would resolve to pre-mutation data. Forced reads also bypass the
   * breaker, since they are one-per-tap and must not be silently dropped.
   *
   * Resolves to `null` when the fetcher fails or the breaker is open, matching
   * the convention in `useFinanceActions`.
   */
  refresh: (options?: { force?: boolean }) => Promise<T | null>;
  loading: boolean;
}

/**
 * Runs `fetcher` when the screen gains focus, safely: repeated invocations
 * collapse onto one in-flight request, and a runaway loop is cut off instead of
 * bringing the screen down.
 *
 * `fetcher` is read through a ref, so it does not need to be memoized and its
 * identity never re-subscribes the focus effect.
 */
export function useFocusRefresh<T>(
  fetcher: () => Promise<T>,
  options: FocusRefreshOptions
): FocusRefresh<T> {
  const { context } = options;
  const [loading, setLoading] = useState(options.initialLoading ?? false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const detailRef = useRef(options.detail);
  detailRef.current = options.detail;

  const inFlight = useRef<Promise<T | null> | null>(null);
  // Identifies the newest request. Compared instead of the promise itself so the
  // `finally` below doesn't have to reference the very binding it is assigned to.
  const requestSeq = useRef(0);
  const lastReadAt = useRef(0);
  const readCount = useRef(0);
  const breakerTripped = useRef(false);

  const refresh = useCallback(
    (opts?: { force?: boolean }): Promise<T | null> => {
      if (!opts?.force) {
        if (inFlight.current) return inFlight.current;
        if (breakerTripped.current) return Promise.resolve(null);
        const now = Date.now();
        if (now - lastReadAt.current > IDLE_GAP_MS) readCount.current = 0;
        lastReadAt.current = now;
        readCount.current += 1;
        if (readCount.current > READ_LIMIT) {
          breakerTripped.current = true;
          Sentry.captureMessage("focus refresh loop stopped", {
            level: "warning",
            tags: { context },
            extra: {
              consecutiveReads: readCount.current,
              idleGapMs: IDLE_GAP_MS,
              ...detailRef.current?.(),
            },
          });
          return Promise.resolve(null);
        }
      }

      setLoading(true);
      const seq = ++requestSeq.current;
      const pending = (async () => {
        try {
          return await fetcherRef.current();
        } catch {
          // Whatever the screen wants to show for a failure belongs in `fetcher`;
          // here a rejection must not escape and become an unhandled rejection,
          // because the focus effect below does not await this.
          return null;
        } finally {
          // A forced read supersedes this one — leave the flag to whichever
          // request is still current so a spinner doesn't clear early.
          if (requestSeq.current === seq) {
            inFlight.current = null;
            setLoading(false);
          }
        }
      })();
      inFlight.current = pending;
      return pending;
    },
    [context]
  );

  // `useIsFocused` (not `expo-router`'s `useFocusEffect`) on purpose: that fork's
  // internal "did we already fire for this focus" flag lives inside the effect
  // closure, which gets recreated — and reset to false — every time React
  // Navigation rebuilds the navigation object identity, even with no real
  // blur/focus in between. That's the redundant sequential refetch this hook
  // used to just absorb. `isFocused` is a plain boolean compared by value, and
  // `refresh` is a stable reference (see above), so this effect only re-runs
  // when a real focus transition happens — no extra ref needed to detect one.
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) void refresh();
  }, [isFocused, refresh]);

  return { refresh, loading };
}
