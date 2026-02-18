import { NextResponse } from "next/server";
import { getCurrentUserId } from "./auth";

/**
 * Get authenticated user ID or return 401 response
 * Use in API routes to ensure user is authenticated
 */
export async function requireAuth(): Promise<
  | { userId: string; error: null }
  | { userId: null; error: NextResponse }
> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return {
      userId: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { userId, error: null };
}

/**
 * Standard error response for API routes
 */
export function apiError(message: string, status: number = 500): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Standard success response for API routes
 */
export function apiSuccess<T>(data: T): NextResponse {
  return NextResponse.json(data);
}

/**
 * Handle async API route with standard error handling
 */
export async function handleApiRoute<T>(
  handler: (userId: string) => Promise<T>
): Promise<NextResponse> {
  const { userId, error } = await requireAuth();

  if (error) return error;

  try {
    const result = await handler(userId);
    return apiSuccess(result);
  } catch (err) {
    console.error("API Error:", err);
    return apiError(
      err instanceof Error ? err.message : "Internal server error"
    );
  }
}
