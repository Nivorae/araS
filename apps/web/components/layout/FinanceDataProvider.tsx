"use client";
import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { useFinanceStore } from "@/store/useFinanceStore";

export function FinanceDataProvider() {
  const { isSignedIn } = useAuth();
  const fetchAll = useFinanceStore((s) => s.fetchAll);

  useEffect(() => {
    if (isSignedIn !== undefined) {
      fetchAll(isSignedIn);
    }
  }, [isSignedIn, fetchAll]);

  return null;
}
