const DEFAULT_API_BASE_URL = 'http://localhost:3333/api';
const QUERY_CACHE_TTL_MS = 20_000;

type CachedQuery = {
  expiresAt: number;
  value: unknown;
};

const queryCache = new Map<string, CachedQuery>();
const pendingQueries = new Map<string, Promise<unknown>>();
let cacheGeneration = 0;

export const API_BASE_URL = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || DEFAULT_API_BASE_URL)
  .replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function isDataQuery(path: string, init: RequestInit): boolean {
  return init.method === 'POST' && /^\/data\/[^/]+\/query(?:\?|$)/.test(path);
}

function invalidatesDataCache(path: string, init: RequestInit): boolean {
  return init.method === 'POST' && (
    (/^\/data\/[^/]+\/(?:insert|update|delete)(?:\?|$)/.test(path)) ||
    path.startsWith('/rpc/')
  );
}

function cloneQueryValue<T>(value: unknown): T {
  return structuredClone(value) as T;
}

async function requestApi<T>(path: string, init: RequestInit): Promise<T> {
  const isFormData = init.body instanceof FormData;
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (invalidatesDataCache(path, init)) {
    cacheGeneration += 1;
    queryCache.clear();
  }

  if (!isDataQuery(path, init) || typeof init.body !== 'string') {
    return requestApi<T>(path, init);
  }

  const key = `${path}:${init.body}`;
  const now = Date.now();
  const cached = queryCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cloneQueryValue<T>(cached.value);
  }

  let pending = pendingQueries.get(key);
  if (!pending) {
    const generationAtRequest = cacheGeneration;
    pending = requestApi<unknown>(path, init)
      .then(value => {
        if (generationAtRequest === cacheGeneration) {
          queryCache.set(key, { value, expiresAt: Date.now() + QUERY_CACHE_TTL_MS });
        }
        return value;
      })
      .finally(() => pendingQueries.delete(key));
    pendingQueries.set(key, pending);
  }

  return cloneQueryValue<T>(await pending);
}
