---
name: api-endpoint
description: Create new Supabase endpoints following the API_ENDPOINTS.md pattern — and always keep API_ENDPOINTS.md updated
---

## API Endpoint Creation Process

### When to Use

- A new feature needs a new Supabase table
- A new CRUD operation is needed for an existing table
- A new RPC (stored procedure) is required
- A new Storage bucket operation is needed

### 1. Plan the Endpoint

Before writing code, determine:

```
□ Table name (snake_case, plural)
□ Primary key (usually UUID with gen_random_uuid())
□ All columns (name, type, default, nullable)
□ TypeScript interface name (PascalCase)
□ Service file name (<domain>Service.ts)
□ Functions needed (listar, obter, criar, atualizar, excluir)
□ Custom filters or joins
□ RLS policy requirements
```

### 2. Create Migration

Create a new file in `supabase/migrations/` with the next sequential number:

```
supabase/migrations/XXX_nome_da_migration.sql
```

**Migration template:**
```sql
CREATE TABLE IF NOT EXISTS nova_tabela (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ... columns
  created_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT,
  updated_at TEXT NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::TEXT
);

ALTER TABLE nova_tabela ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nova_tabela_all ON nova_tabela;
CREATE POLICY nova_tabela_all ON nova_tabela FOR ALL USING (true) WITH CHECK (true);
```

### 3. Create Types

Create `src/types/<domain>.ts`:

```typescript
export interface NovaTabela {
  id: string;
  // ... camelCase fields
  createdAt: string;
  updatedAt: string;
}
```

### 4. Create Service

Create `src/services/<domain>Service.ts` following the **established pattern**:

```typescript
import { supabase } from '../lib/supabase';
import type { NovaTabela } from '../types/<domain>';

const TABLE = 'nova_tabela';

function getDb() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

function handleSupabaseError(err: unknown): never {
  console.error('Erro Supabase:', err);
  const msg = err instanceof Error ? err.message : 'Erro inesperado no banco de dados';
  throw new Error(msg);
}

function rowToNovaTabela(row: Record<string, unknown>): NovaTabela {
  return {
    id: row.id as string,
    // ... map snake_case → camelCase
    createdAt: (row.created_at as string) || '',
    updatedAt: (row.updated_at as string) || '',
  };
}

export async function listarNovaTabela(): Promise<NovaTabela[]> {
  const db = getDb();
  const { data, error } = await db.from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data || []).map(rowToNovaTabela);
}

export async function criarNovaTabela(
  data: Omit<NovaTabela, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<NovaTabela> {
  const db = getDb();
  const now = new Date().toISOString();
  const { data: created, error } = await db
    .from(TABLE)
    .insert({ ...data, created_at: now, updated_at: now })
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return rowToNovaTabela(created);
}

export async function atualizarNovaTabela(id: string, data: Partial<NovaTabela>): Promise<NovaTabela | null> {
  const db = getDb();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  // map each camelCase field to snake_case
  if (data.campo !== undefined) row.campo = data.campo;
  const { data: updated, error } = await db.from(TABLE).update(row).eq('id', id).select().single();
  if (error) handleSupabaseError(error);
  return updated ? rowToNovaTabela(updated) : null;
}

export async function excluirNovaTabela(id: string): Promise<boolean> {
  const db = getDb();
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) handleSupabaseError(error);
  return true;
}
```

### 5. Update API_ENDPOINTS.md

**After creating the service, you MUST update `API_ENDPOINTS.md`.**

Find the appropriate section (or create a new one in numerical order) and add:

```markdown
---

# N. NovaTabela — `<domain>Service.ts`

**Tabela:** `nova_tabela`  
**Ficheiro:** `src/services/<domain>Service.ts`  
**Tipo:** `src/types/<domain>.ts` — `NovaTabela`

---

### listarNovaTabela

**Método HTTP:** GET  
**REST equivalência:** `GET /rest/v1/nova_tabela?select=*&order=created_at.desc`  
**Request Body:** —  
**Response:** `NovaTabela[]`  
**Estado:** ✅ OK  

**Payload Response:**
```json
[{
  "id": "uuid",
  "campo": "string | number | boolean",
  "createdAt": "string (ISO datetime)",
  "updatedAt": "string (ISO datetime)"
}]
```
```

Also update:
- The **Sumário** table at the top (add new entry)
- The **Total de serviços** / **Total de funções** counters
- The **Anexo A** if any bugs exist

### 6. Update the Feature Skill

If creating a full feature (not just an endpoint), reference the feature skill too:

```
rtk skill feature
```

### 7. Validation

- [ ] `rtk tsc --noEmit --pretty` — no type errors
- [ ] `rtk lint` — no lint errors
- [ ] `API_ENDPOINTS.md` is updated with the new endpoint
- [ ] All fields have proper snake_case/camelCase mapping
- [ ] `handleSupabaseError` is used (not silent `console.error`)
- [ ] `.select().single()` on CREATE returns the created record
- [ ] `.select().single()` on UPDATE returns the updated record
- [ ] DELETE verifies error before returning `true`
- [ ] All optional fields use `null` not `''` where appropriate
