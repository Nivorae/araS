"use client";

import { useState, useEffect } from "react";
import { z } from "zod";

const CACHE_KEY = "usd_twd_rate";
const CACHE_TTL_MS = 86400000; // 24 hours
const DEFAULT_RATE = 32.5;

const CachedRateSchema = z.object({
  rate: z.number().positive(),
  timestamp: z.number().int().nonnegative(),
});

export function useExchangeRate(): {
  rate: number;
  isManual: boolean;
  isLoading: boolean;
  convertToTWD: (usdAmount: number) => number;
  setManualRate: (rate: number) => void;
} {
  const [rate, setRate] = useState<number>(DEFAULT_RATE);
  const [isManual, setIsManual] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadRate() {
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const result = CachedRateSchema.safeParse(JSON.parse(cached));
          if (result.success) {
            const age = Date.now() - result.data.timestamp;
            if (age < CACHE_TTL_MS) {
              setRate(result.data.rate);
              setIsManual(false);
              setIsLoading(false);
              return;
            }
          } else {
            localStorage.removeItem(CACHE_KEY);
          }
        }
      } catch {
        localStorage.removeItem(CACHE_KEY);
      }

      try {
        const res = await fetch("/api/exchange-rate");
        if (!res.ok) throw new Error("Non-OK response");
        const data: { TWD: number } = await res.json();
        const fetched = data.TWD;
        if (!fetched || fetched <= 0) throw new Error("Invalid rate");

        localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: fetched, timestamp: Date.now() }));
        setRate(fetched);
        setIsManual(false);
      } catch {
        setIsManual(true);
        setRate(DEFAULT_RATE);
      } finally {
        setIsLoading(false);
      }
    }

    loadRate();
  }, []);

  function setManualRate(newRate: number) {
    setRate(newRate);
    setIsManual(true);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ rate: newRate, timestamp: Date.now() }));
    } catch {
      // Ignore storage errors
    }
  }

  function convertToTWD(usdAmount: number): number {
    return usdAmount * rate;
  }

  return { rate, isManual, isLoading, convertToTWD, setManualRate };
}
