---
name: ptr-ba
description: PTR-BA module — reports, filters, printing, daily registration, and participant management
---

## Domain Overview

PTR-BA tracks training hours per firefighter per subject. Two entry points:
- **Daily Registration**: src/pages/RegistrosDiarios/PTRBADiario.tsx
- **Reports**: src/pages/Relatorios/PTRBA.tsx — filtering, aggregation, printing

## Key Files

| File | Purpose |
|------|---------|
| src/pages/RegistrosDiarios/PTRBADiario.tsx | Daily form, list, view mode |
| src/pages/Relatorios/PTRBA.tsx | Aggregated reports with filters and printing |
| src/types/ptrb.ts | Interfaces, ASSUNTOS constant |
| src/services/ptrbService.ts | Supabase CRUD |
| src/store/api/ptrbApi.ts | RTK Query slice |

## Data Flow

calcHoras(inicio, termino) ? decimal hours (0 for empty/NaN)
expandParticipants(ptrbs) ? one row per participant with full PTRB hours
iltered useMemo ? applies all filters (period, equipe, assunto, pessoa)

## Print System

| Button | Handler | Generator |
|--------|---------|-----------|
| "Horas por Equipe" | handlePrintSummary | gerarHTMLImpressao |
| "Imprimir" (person) | handlePrintPerson | gerarHTMLImpressao |
| "Imprimir" (detail) | handlePrintDetail | gerarHTMLImpressao |
| "Efetivo" | handlePrintEfetivo | imprimirHTMLEfetivo |

All prints: 11px, table-layout fixed, numbered assuntos, landscape, 8mm margins.
Efetivo: 3 equipes per page, Funcao 7%/Nome 14% width.

## Rules
1. Both screen AND print paths must be updated for any hours change
2. calcHoras is the single source of truth for computed hours
3. Person filter uses .trim().toLowerCase() for name matching
4. Assuntos use zero-padded numbers from ASSUNTOS constant
