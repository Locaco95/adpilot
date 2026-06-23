/* ── AdPilot — API Client ───────────────────────────────────────── */
import { API_BASE } from "@/lib/constants";

const TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  ms = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e: unknown) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(
        "Request timed out — backend may be waking up, please retry"
      );
    }
    throw e;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("adpilot_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    // Clear auth and redirect
    if (typeof window !== "undefined") {
      localStorage.removeItem("adpilot_token");
      document.cookie =
        "adpilot_token=; Max-Age=0; path=/; SameSite=Lax";
      window.location.href = "/login";
    }
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body.detail ?? body.message ?? message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<T>(res);
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  timeoutMs?: number
): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }, timeoutMs);
  return handleResponse<T>(res);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
  });
  return handleResponse<T>(res);
}

export async function apiPatch<T>(
  path: string,
  body: unknown
): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}
