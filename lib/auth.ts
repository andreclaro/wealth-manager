/**
 * Simple authentication helper for development.
 * Uses localStorage to persist logged-in user.
 * Later: integrate with NextAuth.js or similar for real authentication.
 */

export const DEV_USER_ID = "dev-user";
const STORAGE_KEY = "portfolio_user";

// Client-side only storage
let cachedUser: { id: string; email: string } | null = null;

/**
 * Get the current user ID.
 * For development, returns the stored user or dev user.
 */
export function getCurrentUserId(): string {
  if (typeof window === "undefined") {
    return DEV_USER_ID;
  }
  
  if (cachedUser) {
    return cachedUser.id;
  }
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const user = JSON.parse(stored);
    cachedUser = user;
    return user.id;
  }
  
  return DEV_USER_ID;
}

/**
 * Get the current user context (for future expansion).
 */
export function getCurrentUser() {
  if (typeof window === "undefined") {
    return {
      id: DEV_USER_ID,
      name: "Development User",
      email: "dev@localhost",
    };
  }
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const user = JSON.parse(stored);
    return {
      id: user.id,
      name: user.email.split("@")[0],
      email: user.email,
    };
  }
  
  return {
    id: DEV_USER_ID,
    name: "Development User",
    email: "dev@localhost",
  };
}

/**
 * Set the logged-in user (called after login).
 */
export function setLoggedInUser(email: string): void {
  if (typeof window === "undefined") return;
  
  const user = {
    id: DEV_USER_ID, // In real auth, this would be the actual user ID
    email,
  };
  
  cachedUser = user;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

/**
 * Check if user is logged in.
 */
export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Log out the current user.
 */
export function logout(): void {
  if (typeof window === "undefined") return;
  
  cachedUser = null;
  localStorage.removeItem(STORAGE_KEY);
}
