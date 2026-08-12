import { apiFetch, apiUrl } from './apiClient';

type CompatError = {
  message: string;
  code?: string;
};

type CompatResponse<T = any> = {
  data: T | null;
  error: CompatError | null;
  count?: number | null;
};

type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'like' | 'ilike';

type Filter = {
  column: string;
  operator: FilterOperator;
  value?: unknown;
  values?: unknown[];
};

type Order = {
  column: string;
  ascending?: boolean;
};

type ApiResult = {
  data: unknown;
  error: null;
  count?: number | null;
};

function toCompatError(error: unknown): CompatError {
  if (error instanceof Error) return { message: error.message };
  return { message: 'Erro inesperado na API' };
}

class QueryBuilder<T = any> implements PromiseLike<CompatResponse<T>> {
  private readonly table: string;
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private selection = '*';
  private payload: unknown;
  private filters: Filter[] = [];
  private orExpressions: string[] = [];
  private orders: Order[] = [];
  private maxRows?: number;
  private countMode?: 'exact';
  private headMode = false;
  private returning = false;
  private singleMode: 'single' | 'maybeSingle' | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(columns = '*', options?: { count?: 'exact'; head?: boolean }): this {
    this.selection = columns || '*';
    this.countMode = options?.count;
    this.headMode = options?.head ?? false;
    if (this.action !== 'select') this.returning = true;
    return this;
  }

  insert(payload: unknown): this {
    this.action = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: Record<string, unknown>): this {
    this.action = 'update';
    this.payload = payload;
    return this;
  }

  delete(): this {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    return this.filter(column, 'eq', value);
  }

  neq(column: string, value: unknown): this {
    return this.filter(column, 'neq', value);
  }

  gt(column: string, value: unknown): this {
    return this.filter(column, 'gt', value);
  }

  gte(column: string, value: unknown): this {
    return this.filter(column, 'gte', value);
  }

  lt(column: string, value: unknown): this {
    return this.filter(column, 'lt', value);
  }

  lte(column: string, value: unknown): this {
    return this.filter(column, 'lte', value);
  }

  ilike(column: string, value: unknown): this {
    return this.filter(column, 'ilike', value);
  }

  like(column: string, value: unknown): this {
    return this.filter(column, 'like', value);
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ column, operator: 'in', values });
    return this;
  }

  is(column: string, value: unknown): this {
    return this.filter(column, 'is', value);
  }

  or(expression: string): this {
    this.orExpressions.push(expression);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: options?.ascending });
    return this;
  }

  limit(count: number): this {
    this.maxRows = count;
    return this;
  }

  single(): this {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle(): this {
    this.singleMode = 'maybeSingle';
    return this;
  }

  then<TResult1 = CompatResponse<T>, TResult2 = never>(
    onfulfilled?: ((value: CompatResponse<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private filter(column: string, operator: FilterOperator, value: unknown): this {
    this.filters.push({ column, operator, value });
    return this;
  }

  private async execute(): Promise<CompatResponse<T>> {
    try {
      const endpoint = `/data/${encodeURIComponent(this.table)}/${this.action === 'select' ? 'query' : this.action}`;
      const body = this.requestBody();
      const result = await apiFetch<ApiResult>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return this.normalize(result);
    } catch (error) {
      return { data: null, error: toCompatError(error), count: null };
    }
  }

  private requestBody(): Record<string, unknown> {
    if (this.action === 'select') {
      return {
        select: this.selection,
        filters: this.filters,
        or: this.orExpressions,
        orders: this.orders,
        limit: this.maxRows,
        count: this.countMode,
        head: this.headMode,
      };
    }

    return {
      payload: this.payload,
      filters: this.filters,
      or: this.orExpressions,
      select: this.returning ? this.selection : undefined,
    };
  }

  private normalize(result: ApiResult): CompatResponse<T> {
    let data = result.data;

    if (this.singleMode) {
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      if (rows.length === 0) {
        if (this.singleMode === 'maybeSingle') {
          return { data: null, error: null, count: result.count ?? null };
        }
        return {
          data: null,
          error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
          count: result.count ?? null,
        };
      }
      if (rows.length > 1) {
        return {
          data: null,
          error: { code: 'PGRST116', message: 'JSON object requested, multiple rows returned' },
          count: result.count ?? null,
        };
      }
      data = rows[0];
    }

    return { data: data as T, error: null, count: result.count ?? null };
  }
}

class StorageBucket {
  private readonly bucket: string;

  constructor(bucket: string) {
    this.bucket = bucket;
  }

  async upload(path: string, file: File | Blob, _options?: Record<string, unknown>): Promise<CompatResponse<{ path: string }>> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await apiFetch<{ path: string }>(
        `/storage/${encodeURIComponent(this.bucket)}/upload?path=${encodeURIComponent(path)}`,
        { method: 'POST', body: formData },
      );
      return { data, error: null };
    } catch (error) {
      return { data: null, error: toCompatError(error) };
    }
  }

  async createSignedUrl(path: string, _expiresIn: number): Promise<CompatResponse<{ signedUrl: string }>> {
    try {
      const data = await apiFetch<{ signedUrl: string }>(`/storage/${encodeURIComponent(this.bucket)}/signed-url`, {
        method: 'POST',
        body: JSON.stringify({ path }),
      });
      return { data, error: null };
    } catch (error) {
      return { data: null, error: toCompatError(error) };
    }
  }

  async download(path: string): Promise<CompatResponse<Blob>> {
    try {
      const response = await fetch(apiUrl(`/storage/${encodeURIComponent(this.bucket)}/file?path=${encodeURIComponent(path)}`));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { data: await response.blob(), error: null };
    } catch (error) {
      return { data: null, error: toCompatError(error) };
    }
  }

  async list(prefix = '', _options?: Record<string, unknown>): Promise<CompatResponse<{ name: string; id: string; path: string }[]>> {
    try {
      const data = await apiFetch<{ name: string; id: string; path: string }[]>(
        `/storage/${encodeURIComponent(this.bucket)}/list?prefix=${encodeURIComponent(prefix)}`,
      );
      return { data, error: null };
    } catch (error) {
      return { data: null, error: toCompatError(error) };
    }
  }

  async remove(paths: string[]): Promise<CompatResponse<{ ok: boolean }>> {
    try {
      const data = await apiFetch<{ ok: boolean }>(`/storage/${encodeURIComponent(this.bucket)}/remove`, {
        method: 'POST',
        body: JSON.stringify({ paths }),
      });
      return { data, error: null };
    } catch (error) {
      return { data: null, error: toCompatError(error) };
    }
  }

  getPublicUrl(path: string): { data: { publicUrl: string } } {
    return {
      data: {
        publicUrl: apiUrl(`/storage/${encodeURIComponent(this.bucket)}/file?path=${encodeURIComponent(path)}`),
      },
    };
  }
}

const supabase = {
  from<T = any>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(table);
  },

  async rpc<T = any>(name: string, params?: Record<string, unknown>): Promise<CompatResponse<T>> {
    try {
      const data = await apiFetch<T>(`/rpc/${encodeURIComponent(name)}`, {
        method: 'POST',
        body: JSON.stringify(params ?? {}),
      });
      return { data, error: null };
    } catch (error) {
      return { data: null, error: toCompatError(error) };
    }
  },

  storage: {
    from(bucket: string): StorageBucket {
      return new StorageBucket(bucket);
    },
  },
};

export { supabase };
