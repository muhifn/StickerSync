/**
 * Auth client — Google OAuth only (backend issues our JWT after the
 * Google callback; token is stored in localStorage and sent as Bearer).
 * Email/password auth was removed to keep bots out of signups.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7860";

const TOKEN_KEY = "stickersync_token";
const USER_KEY = "stickersync_uid";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, userId: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, userId);
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

/** Fetch /me balance; returns display string like "3 free" or "12 credits", or null. */
export async function refreshBalance(): Promise<string | null> {
  const t = getToken();
  if (!t) return null;
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) return null;
    const me = await res.json();
    return me.free_downloads > 0 ? `${me.free_downloads} free` : `${me.private_credits} credits`;
  } catch {
    return null;
  }
}
