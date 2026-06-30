import { useAuth } from "@clerk/clerk-expo";
import { useMemo } from "react";
import type { ApiResponse } from "@repo/shared";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type GetToken = (options?: { template?: string }) => Promise<string | null>;

// Wraps fetch against the existing Next.js API (apps/web). Every call attaches
// the Clerk session token as `Authorization: Bearer <token>`, which the backend
// `auth()` validates networklessly — no backend changes required.
async function request<T>(getToken: GetToken, path: string, init?: RequestInit): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError(
      "CONFIG",
      "EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and set your LAN IP.",
      0
    );
  }

  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  let body: ApiResponse<T>;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError("NETWORK", `Unexpected response (HTTP ${res.status})`, res.status);
  }

  if (!body.success) {
    throw new ApiError(body.error.code, body.error.message, res.status);
  }
  return body.data;
}

// For endpoints that return plain JSON (not ApiResponse envelope), e.g. /api/stocks/*
async function rawRequest<T>(getToken: GetToken, path: string): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError(
      "CONFIG",
      "EXPO_PUBLIC_API_URL is not set. Copy .env.example to .env and set your LAN IP.",
      0
    );
  }
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    throw new ApiError("HTTP", `HTTP error ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

export function createApi(getToken: GetToken) {
  return {
    get: <T>(path: string) => request<T>(getToken, path),
    post: <T>(path: string, data: unknown) =>
      request<T>(getToken, path, { method: "POST", body: JSON.stringify(data) }),
    put: <T>(path: string, data: unknown) =>
      request<T>(getToken, path, { method: "PUT", body: JSON.stringify(data) }),
    patch: <T>(path: string, data: unknown) =>
      request<T>(getToken, path, { method: "PATCH", body: JSON.stringify(data) }),
    delete: <T>(path: string) => request<T>(getToken, path, { method: "DELETE" }),
    rawGet: <T>(path: string) => rawRequest<T>(getToken, path),
  };
}

export type Api = ReturnType<typeof createApi>;

// Hook for components: gives an api client bound to the current session token.
export function useApi(): Api {
  const { getToken } = useAuth();
  return useMemo(() => createApi(getToken), [getToken]);
}
