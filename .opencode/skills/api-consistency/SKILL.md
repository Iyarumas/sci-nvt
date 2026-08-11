---
name: api-consistency
description: Enforce API_ENDPOINTS.md as the source of truth for all feature changes — ensure Supabase alterations are correct and data stays consistent
---

## API Consistency Process

### Golden Rule

**`API_ENDPOINTS.md` is the single source of truth for all Supabase interactions.**  
Every feature change, bug fix, or refactor must be validated against this file.

### 1. Before Any Feature Change

- [ ] Read `API_ENDPOINTS.md` to identify which endpoints/tables your change affects
- [ ] Cross-reference the **Tabela** column with the service functions you are modifying
- [ ] Check the **Estado** column — if marked ⚠️ or ❌, verify the bug is still present
- [ ] Locate the **Payload Response** section for each endpoint to understand the exact data shape

### 2. During Implementation

- [ ] **Never change a table/column without also checking:**
  - The service function's `rowTo*()` mapping (snake_case → camelCase)
  - The service function's `*ToRow()` / `*ToRow()` mapping (camelCase → snake_case)
  - The type definition in `src/types/`
  - All components that consume the type

- [ ] **New queries must match the REST equivalência** documented in the endpoints file
- [ ] **Error handling pattern must match** the documented approach:
  - `handleSupabaseError(err)` for critical operations (CREATE, UPDATE, DELETE)
  - Proper error propagation (throw, not silent `console.error`)
  - `.select().single()` only when result is guaranteed unique

### 3. After Implementation

- [ ] Run `rtk tsc --noEmit --pretty` to verify type consistency
- [ ] Run `rtk lint` to check code quality
- [ ] Update `API_ENDPOINTS.md` if:
  - A new endpoint was created
  - An existing endpoint signature changed (payload, params, return type)
  - An endpoint status changed (✅ → ⚠️ → ❌ or vice versa)
  - A new table/column was added to Supabase

### 4. Validation Checklist

For each modified endpoint:

```
□ Function name matches the exported name
□ HTTP method is correct (GET/POST/PATCH/DELETE)
□ Table name matches the database
□ Request payload matches type definition
□ Response payload matches type definition
□ Error handling follows project pattern
□ .single() is only used for unique lookups
□ No silent error handling (console.error without throw)
□ Types are updated and exported
```

### 5. Common Pitfalls to Avoid

| Pitfall | How to Avoid |
|---------|-------------|
| `.single()` on non-unique query | Filter by primary key or use `.maybeSingle()` |
| Silent `console.error` | Use `handleSupabaseError()` from the service |
| Missing `updated_at` on PATCH | Always set `updated_at: new Date().toISOString()` |
| Inconsistent snake_case/camelCase | Always use `rowTo*()` and `*ToRow()` helpers |
| Returning `void` on UPDATE | Always do `.select().single()` to return updated record |
| Passing empty string for optional fields | Use `null` instead of `''` where DB expects null |
