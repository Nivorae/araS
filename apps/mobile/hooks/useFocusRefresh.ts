import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import * as Sentry from "@sentry/react-native";

// A focus effect is NOT once-per-visit. React Navigation caches each screen's
// navigation object and rebuilds the whole cache when the navigator's state,
// emitter or setOptions identity changes; useFocusEffect re-runs its body against
// the new identity, without the screen ever losing focus. Measured on a real
// device: two runs in a single visit with no dependency change and no remount.
//
// Screens that treat every run as "issue a request, then setState with the reply"
// therefore have a feedback path with nothing bounding it — one production session
// was seen reading at roughly frame rate until React aborted the tree with
// "Maximum update depth exceeded". This hook is the bound: concurrent reads share
// one request, and a sustained run trips a breaker that stops refreshing and
// reports once.
//
// What drove the re-runs that fast is still unidentified — it happened to another
// user and has not been reproduced — so this bounds the damage rather than
// assuming a cause.

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

  // `refresh` is stable (it reads everything else through refs), so this effect
  // only ever re-subscribes when React Navigation rebuilds the navigation object.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  return { refresh, loading };
}
