import { cookies } from "next/headers";

// Server Components run in Node, not the browser — they can't use the
// same-origin "/api" rewrite (that only applies to requests the Next.js
// *server itself* receives from a browser). They need a direct, absolute
// address for the backend, and must manually forward the incoming request's
// session cookie since server-to-server fetch doesn't carry browser cookies
// automatically. NEXT_PUBLIC_API_URL is the browser-facing (RTK Query) URL;
// this is the separate server-only one.
export const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000/api";

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const cookieStore = await cookies();
  return fetch(`${API_INTERNAL_URL}${path}`, {
    ...init,
    headers: { ...init?.headers, cookie: cookieStore.toString() },
    cache: "no-store",
  });
}

export async function apiGet<T>(path: string): Promise<T | null> {
  const res = await apiFetch(path);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}
