"use client";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { useFinanceStore } from "@/store/useFinanceStore";
import { createAccountChangeTracker } from "@/lib/accountChange";
import { clearCachedFetch } from "@/hooks/useCachedFetch";

export function FinanceDataProvider() {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const fetchAll = useFinanceStore((s) => s.fetchAll);
  // The store and fetch caches are module-level and outlive sign-out, so the
  // next account signed in on this browser would first render the previous
  // account's data (and fetchAll's 30s warm-cache guard would keep it there).
  // Clear them whenever the observed account changes — same as mobile's root
  // layout (bb324db).
  const trackAccount = useRef(
    createAccountChangeTracker(() => {
      useFinanceStore.getState().reset();
      clearCachedFetch();
    })
  ).current;

  useEffect(() => {
    if (!isLoaded) return;
    trackAccount(userId ?? null);
    fetchAll(!!isSignedIn);
  }, [isLoaded, isSignedIn, userId, fetchAll, trackAccount]);

  return null;
}
