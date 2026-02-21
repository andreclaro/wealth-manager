import { NextRequest, NextResponse } from "next/server";

type CounterEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitOptions = {
  windowMs: number;
  maxRequests: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const counters = new Map<string, CounterEntry>();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanupAt = 0;

function maybeCleanupExpiredCounters(now: number) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
    return;
  }

  for (const [key, value] of counters) {
    if (value.resetAt <= now) {
      counters.delete(key);
    }
  }

  lastCleanupAt = now;
}

function getClientIdentifier(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  const cloudflareIp = request.headers.get("cf-connecting-ip");
  if (cloudflareIp) {
    return cloudflareIp.trim();
  }

  const userAgent = request.headers.get("user-agent") || "unknown";
  return `ua:${userAgent.slice(0, 80)}`;
}

export function checkRateLimit(
  request: NextRequest,
  scope: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  maybeCleanupExpiredCounters(now);

  const clientId = getClientIdentifier(request);
  const key = `${scope}:${clientId}`;
  const current = counters.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + options.windowMs;
    counters.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      limit: options.maxRequests,
      remaining: options.maxRequests - 1,
      resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil(options.windowMs / 1000)),
    };
  }

  if (current.count >= options.maxRequests) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((current.resetAt - now) / 1000)
    );

    return {
      allowed: false,
      limit: options.maxRequests,
      remaining: 0,
      resetAt: current.resetAt,
      retryAfterSeconds,
    };
  }

  current.count += 1;
  counters.set(key, current);

  return {
    allowed: true,
    limit: options.maxRequests,
    remaining: Math.max(0, options.maxRequests - current.count),
    resetAt: current.resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

export function buildRateLimitResponse(
  result: RateLimitResult,
  message = "Too many requests"
) {
  return NextResponse.json(
    {
      error: message,
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    }
  );
}
