const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/admin";

// Product images (`AdminProduct.imageUrl`) come back as a path relative to
// the API's own origin (e.g. `/api/images/<file>`) — fine for web/, which
// shares an origin with the API via Nginx, but admin/ is a separate app
// (its own Vite dev port locally, its own subdomain in prod), so a bare
// relative `<img src>` would resolve against admin/'s own origin instead
// and silently 404/fall through to its SPA shell.
const API_ORIGIN = new URL(API_URL).origin;
export function resolveImageUrl(path: string | null): string | null {
  return path ? `${API_ORIGIN}${path}` : null;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
};
