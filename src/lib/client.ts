"use client";

export function getCsrf(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)cashpe_csrf=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : "";
}

export async function apiFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const headers = new Headers(opts.headers || {});
  const method = (opts.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const csrf = getCsrf();
    if (csrf) headers.set("x-csrf-token", csrf);
    if (!headers.has("Content-Type") && opts.body && typeof opts.body === "string") {
      headers.set("Content-Type", "application/json");
    }
  }
  return fetch(url, { ...opts, headers, credentials: "same-origin" });
}

export async function apiJson<T = unknown>(url: string, opts: RequestInit = {}): Promise<T> {
  const res = await apiFetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { error?: string }).error || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}
