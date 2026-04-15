import { getServerSessionToken } from "./session";

/**
 * Typed fetch wrapper for the backend Hono API.
 * On the server, reads the session cookie and forwards it as a Bearer token.
 * On the client, pass `token` explicitly (see useAuth().getToken()).
 */

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  token?: string;
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.name = "ApiClientError";
  }
}

function resolveServerToken(): string | undefined {
  try {
    return getServerSessionToken();
  } catch {
    return undefined;
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");

  let token = options.token;
  if (!token && typeof window === "undefined") {
    token = resolveServerToken();
  }
  if (token) headers.set("authorization", `Bearer ${token}`);

  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const rawText = await res.text();
  const parsed = rawText ? (JSON.parse(rawText) as unknown) : null;

  if (!res.ok) {
    const err = (parsed as { error?: { code: string; message: string; details?: unknown } }).error;
    throw new ApiClientError(
      res.status,
      err?.code ?? "unknown_error",
      err?.message ?? res.statusText,
      err?.details,
    );
  }

  return (parsed as { data: T }).data;
}
