const BASE_URL = '/api';

export interface ApiIssue {
  path: string;
  message: string;
}

/** Error thrown for non-2xx API responses, carrying status + field issues. */
export class ApiError extends Error {
  readonly status: number;
  readonly issues?: ApiIssue[];

  constructor(status: number, message: string, issues?: ApiIssue[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.issues = issues;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

// Paths that must not trigger the silent-refresh retry (to avoid loops).
const NO_RETRY = new Set(['/auth/refresh', '/auth/login', '/auth/register']);

async function request<T>(
  path: string,
  options: RequestOptions = {},
  allowRetry = true,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  // On an expired access token, try a single silent refresh then retry once.
  if (res.status === 401 && allowRetry && !NO_RETRY.has(path)) {
    const refreshed = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshed.ok) {
      return request<T>(path, options, false);
    }
  }

  const data: unknown =
    res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    const payload = (data ?? {}) as { error?: string; issues?: ApiIssue[] };
    throw new ApiError(
      res.status,
      payload.error ?? res.statusText ?? 'Request failed',
      payload.issues,
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
