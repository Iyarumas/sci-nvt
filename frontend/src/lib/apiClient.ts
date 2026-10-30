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

// ------------------------------------------------------------------ sessao

const TOKEN_KEY = 'sescinc-auth-token';
export const UNAUTHORIZED_EVENT = 'sescinc:unauthorized';

let authToken: string | null = (() => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
})();

export function getAuthToken(): string | null {
  return authToken;
}

export function setAuthToken(token: string | null): void {
  authToken = token;
  queryCache.clear();
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* navegador sem storage: o token fica apenas em memoria */
  }
}

/** Cabecalho Authorization para chamadas feitas fora do apiFetch (fetch direto, uploads). */
export function authHeaders(): Record<string, string> {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

function handleUnauthorized(): void {
  if (!authToken) return;
  setAuthToken(null);
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

/** fetch que envia o token quando a URL e da nossa API (ex.: download de arquivos do storage). */
export async function authorizedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const isApi = input.startsWith(API_BASE_URL) || input.startsWith('/api/');
  const response = await fetch(input, isApi ? { ...init, headers: { ...authHeaders(), ...(init.headers || {}) } } : init);
  if (isApi && response.status === 401) handleUnauthorized();
  return response;
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
      ...authHeaders(),
      ...(init.headers || {}),
    },
  });

  if (response.status === 401 && !path.startsWith('/auth/login')) {
    handleUnauthorized();
  }

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

  // Validacoes operacionais precisam consultar a API mesmo com cache ou leitura em andamento.
  if (init.cache === 'no-store' || !isDataQuery(path, init) || typeof init.body !== 'string') {
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
