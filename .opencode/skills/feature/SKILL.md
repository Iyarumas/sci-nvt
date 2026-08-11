---
name: feature
description: Develop new features — standard patterns, consistent design, and full implementation workflow
---

## Feature Development Process

### 1. Understand the Domain
- [ ] Find the existing module closest to the new feature
- [ ] Study its types, services, and page structure
- [ ] Identify the data source (Supabase table, RTK Query, local state)

### 2. Architecture Decision

Choose the right pattern:

**Simple CRUD**: types ? service ? page (no Redux needed)
- Use for: small modules with isolated data
- Example: extintores, hidrantes

**CRUD + Caching**: types ? service ? RTK Query slice ? page
- Use for: modules with shared/refetched data
- Example: bombeiros, escalas

**Complex Logic**: types ? service ? page with useMemo/useState
- Use for: reports, aggregations, printing
- Example: PTRBA.tsx, LRO.tsx

### 3. File Naming Convention

`
src/types/<domain>.ts          ? export interface DomainType { ... }
src/services/<domain>Service.ts ? export async function listar<Domain>() { ... }
src/store/api/<domain>Api.ts    ? export const api = createApi({ ... })
src/pages/<Domain>/<Domain>.tsx ? export function <Domain>() { ... }
src/pages/<Domain>/<Domain>Form.tsx ? export function <Domain>Form() { ... }
`

### 4. Design Consistency

**Page Layout**:
`	sx
<PageContainer>
  <PageTitle icon={IconComponent} title="..." subtitle="..." />
  <FilterBar /> {/* if needed */}
  <StatsCards /> {/* if needed */}
  <DataTable />
</PageContainer>
`

**Card Style**:
`	sx
<div className="rounded-2xl border border-graphite-200/60 bg-white/80 p-6 shadow-sm dark:border-border-dark dark:bg-surface-card">
`

**Stats Card Style**:
`	sx
<div className="rounded-xl border border-<color>-200 bg-<color>-50 p-3 text-center dark:border-<color>-800 dark:bg-<color>-900/20">
`

**Input Style**: Use the shared inputClass constant from similar pages.

**Button Styles**:
- Primary: g-gradient-to-r from-aviation-600 to-aviation-700 text-white shadow-lg shadow-aviation-500/20
- Secondary: order border-aviation-300 bg-white text-aviation-700
- Back: order border-graphite-300/60 bg-white/80 text-graphite-700

### 5. Implementation Order
1. Define types
2. Implement service
3. Create page with filters + display
4. Add print functionality if needed
5. Run tk tsc --noEmit --pretty to verify
6. Run tk lint to check code quality
