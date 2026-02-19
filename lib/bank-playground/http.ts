const DEFAULT_TIMEOUT_MS = 15000;
const MIN_TIMEOUT_MS = 1000;
const MAX_TIMEOUT_MS = 60000;

const TOKEN_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /"access_token"\s*:\s*"[^"]+"/gi,
  /"refresh_token"\s*:\s*"[^"]+"/gi,
  /"id_token"\s*:\s*"[^"]+"/gi,
  /"authorization"\s*:\s*"[^"]+"/gi,
  /apikey\s*[=:]\s*[^\s,]+/gi,
  /api[_-]?key\s*[=:]\s*[^\s,]+/gi,
];

export function getTimeoutMs(): number {
  const raw = process.env.TIMEOUT_MS;
  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(Math.max(parsed, MIN_TIMEOUT_MS), MAX_TIMEOUT_MS);
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = getTimeoutMs()
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: init.signal ?? controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function readResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text || null;
  } catch {
    return null;
  }
}

export function sanitizeMessage(message: string): string {
  return TOKEN_PATTERNS.reduce((value, pattern) => {
    return value.replace(pattern, "[REDACTED]");
  }, message);
}

export function extractErrorMessage(body: unknown): string | null {
  if (!body) return null;

  if (typeof body === "string") {
    return sanitizeMessage(body.slice(0, 300));
  }

  if (typeof body === "object") {
    const maybeError = (body as Record<string, unknown>).error;
    const maybeMessage = (body as Record<string, unknown>).message;
    const maybeDetails = (body as Record<string, unknown>).details;

    const candidates = [maybeError, maybeMessage, maybeDetails]
      .filter((value) => typeof value === "string")
      .map((value) => sanitizeMessage(String(value)));

    if (candidates.length > 0) {
      return candidates[0].slice(0, 300);
    }
  }

  return null;
}

export function unknownToErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request timed out while waiting for upstream provider response.";
  }

  if (error instanceof Error) {
    return sanitizeMessage(error.message);
  }

  return "Unexpected error while executing provider test.";
}

export function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return { value };
}
