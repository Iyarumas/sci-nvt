---
name: bombeiros-apocs
description: Firefighter and APOC personnel CRUD — cadastro, servicos, types, and RTK Query API
---

## Domain Overview

Manages firefighters (bombeiros) and APOC (Agente de Protecao e Operacoes de Combate) personnel records.

## Key Files

| File | Purpose |
|------|---------|
| src/pages/Bombeiros/Bombeiros.tsx | Firefighter list + CRUD |
| src/pages/Bombeiros/BombeiroForm.tsx | Firefighter create/edit form |
| src/pages/APOC/APOCs.tsx | APOC list |
| src/pages/APOC/APOCForm.tsx | APOC create/edit form |
| src/services/bombeiroService.ts | Supabase CRUD |
| src/services/apocService.ts | Supabase CRUD |
| src/types/bombeiro.ts | Bombeiro interface |
| src/types/apoc.ts | APOC interface |
| src/store/api/bombeiroApi.ts | RTK Query slice |
| src/store/api/apocApi.ts | RTK Query slice |

## Pattern

Each domain follows: types ? service ? RTK Query slice ? page

### Service Pattern
`	ypescript
import { supabase } from '../lib/supabase';
const TABLE = 'table_name';
export async function listar(): Promise<Type[]> { ... }
export async function obter(id: string): Promise<Type | null> { ... }
export async function criar(data: Partial<Type>): Promise<Type> { ... }
export async function atualizar(id: string, data: Partial<Type>): Promise<Type | null> { ... }
export async function excluir(id: string): Promise<boolean> { ... }
`

### RTK Query Pattern
`	ypescript
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
export const api = createApi({ reducerPath: 'domainApi', baseQuery: fakeBaseQuery(), endpoints: (builder) => ({ ... }) });
`

## Fields (bombeiros table)
id, nomeCompleto, nomeGuerra, cargo, equipe, dataDesligamento, ...

## Rules
1. Service functions handle loading ? Supabase calls
2. RTK Query slices use akeBaseQuery for custom async logic
3. Cache invalidation uses invalidatesTags with domain-specific tags
4. Forms use SearchSelect component for personnel selection
