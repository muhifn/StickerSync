/**
 * Native auth client — talks to our FastAPI backend (/auth/signup, /auth/login).
 * Token stored in localStorage; sent as Bearer on API calls.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7860";

const TOKEN_KEY = "stickersync_token";
const USER_KEY = "stickersync_uid";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getUserId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(USER_KEY);
}

export function setSession(token: string, userId: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, userId);
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export async function signup(
  email: string,
  password: string,
  referralCode?: string
): Promise<{ ok: true; user_id: string } | { ok: false; error: string }> {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      referral_code: referralCode || null,
    }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.detail || "Signup failed" };
  setSession(data.token, data.user_id);
  return { ok: true, user_id: data.user_id };
}

export async function login(
  email: string,
  password: string
): Promise<{ ok: true; user_id: string } | { ok: false; error: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.detail || "Login failed" };
  setSession(data.token, data.user_id);
  return { ok: true, user_id: data.user_id };
}
