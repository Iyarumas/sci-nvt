---
name: escalas
description: Escalas module — daily scales, monthly scales, vacation scheduling, and substitutions
---

## Domain Overview

Manages work scales/schedules for firefighters: daily assignments, monthly planning, vacation integration, and substitution handling.

## Key Files

| File | Purpose |
|------|---------|
| src/pages/Escalas/Escalas.tsx | Main scales page |
| src/pages/Escalas/EscalaDiaria.tsx | Daily scale view/edit |
| src/pages/Escalas/EscalaMensal.tsx | Monthly scale view |
| src/pages/Ferias/Ferias.tsx | Vacation management |
| src/pages/Funcionarios/Substituicoes.tsx | Substitution requests |
| src/services/escalaService.ts | Daily scale CRUD |
| src/services/escalaMensalService.ts | Monthly scale CRUD |
| src/services/escalaMensalGenerator.ts | Monthly scale generation logic |
| src/services/feriasService.ts | Vacation CRUD |
| src/services/substituicaoService.ts | Substitution CRUD |
| src/services/substituicaoTemporariaService.ts | Temporary substitution CRUD |
| src/types/escala.ts | Scale types |
| src/types/escalaMensal.ts | Monthly scale types |
| src/types/ferias.ts | Vacation types |
| src/store/api/escalaApi.ts | RTK Query slice |

## Integration Points

- Escalas depend on bombeiros for personnel listing
- Ferias feed into escala diaria to mark absent personnel
- Substituicoes handle shift swaps between firefighters
- disponiveis (available personnel) in PTRBADiario is computed from membrosEquipe - ferias + substituicoes

## Data Flow for Disponiveis (PTR-BA integration)

`	ypescript
membrosEquipe = bombeiros.filter(b => b.equipe === form.equipe && !b.dataDesligamento);
emFerias = feriasGozo.filter(f => f.equipe === form.equipe && f.status === 'Em Gozo');
disponiveis = membrosEquipe - emFerias - substituidos + substitutos;
`

## Rules
1. Monthly scale generation uses escalaMensalGenerator.ts — complex logic with shift patterns
2. Vacation conflicts are checked against existing scale assignments
3. Substitutions can be temporary (troca) or permanent (substituicao)
