---
name: lro
description: LRO module — daily LRO records, occurrence reports, LRO generation with PDF preview
---

## Domain Overview

LRO (Livro de Registro de Ocorrencias) manages daily operational logs, occurrences, and generates formal LRO PDF documents.

## Key Files

| File | Purpose |
|------|---------|
| src/pages/RegistrosDiarios/LRODiario.tsx | Daily LRO text record entry |
| src/pages/RegistrosDiarios/LROOcorrencias.tsx | Operational occurrences log |
| src/pages/GerarLRO/GerarLRO.tsx | LRO generation wizard |
| src/pages/PreviewLRO/PreviewLRO.tsx | LRO preview before finalizing |
| src/pages/Relatorios/LRO.tsx | LRO reports |
| src/services/lroGenerator.ts | HTML ? LRO PDF generation engine |
| src/services/lroService.ts | Supabase CRUD for LRO records |
| src/services/lroDraftService.ts | Draft saving/loading |
| src/types/lro.ts | LRO type definitions |

## LRO Generator

lroGenerator.ts is the core — it takes instruction text, personnel data, and generates a formatted HTML string that gets converted to PDF. Key features:
- Auto-pulls PTR-BA instructions by team/date
- Instruction times array (instrucoesHorarios) paired with instruction text
- Templates in root: 	emplate-lro-nomes-funcoes.html, preview-lro.html

## GerarLRO Flow

1. User selects team, date, shift
2. useEffect auto-pulls PTR-BA records for that team/date ? sets instrucoes and instrucoesHorarios
3. User edits instructions, adds personnel
4. Preview ? lroGenerator builds HTML ? user confirms ? saves to Supabase

## Rules
1. Always check lroGenerator.ts for HTML generation logic — changes there affect all LRO outputs
2. PTR-BA auto-pull uses p.horaInicio for instruction times
3. LRO templates use \$ placeholders for variable substitution
4. Preview uses puppeteer for server-side PDF rendering
