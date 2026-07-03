import { NextResponse } from "next/server";
import { ZodError } from "zod";
import * as Sentry from "@sentry/nextjs";
import type { ApiSuccess, ApiError, PaginationMeta } from "@repo/shared";

export function ok<T>(data: T, status = 200, meta?: PaginationMeta): NextResponse {
  const body: ApiSuccess<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  if (meta) body.meta = meta;
  return NextResponse.json(body, { status });
}

export function err(code: string, message: string, status = 400, details?: unknown): NextResponse {
  const error: { code: string; message: string; details?: unknown } = { code, message };
  if (details !== undefined) error.details = details;
  const body: ApiError = {
    success: false,
    error,
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(body, { status });
}

export function handleError(e: unknown): NextResponse {
  if (e instanceof ZodError) {
    return err("VALIDATION_ERROR", "Invalid request data", 400, e.flatten());
  }
  Sentry.captureException(e);
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : e instanceof Error
        ? e.message
        : String(e);
  return err("INTERNAL_ERROR", message, 500);
}
