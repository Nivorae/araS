const DEFAULT_TIMEOUT_MS = 5000;

export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retries a transient (429/5xx) upstream response after a short delay. Client
// errors (4xx other than 429) are returned as-is on the first attempt — only
// rate-limiting and server-side failures are worth retrying.
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  options?: { retries?: number; delayMs?: number; timeoutMs?: number }
): Promise<Response> {
  const retries = options?.retries ?? 1;
  const delayMs = options?.delayMs ?? 300;

  let response = await fetchWithTimeout(url, init, options?.timeoutMs);
  for (let attempt = 0; attempt < retries && RETRYABLE_STATUSES.has(response.status); attempt++) {
    await sleep(delayMs * (attempt + 1));
    response = await fetchWithTimeout(url, init, options?.timeoutMs);
  }
  return response;
}
