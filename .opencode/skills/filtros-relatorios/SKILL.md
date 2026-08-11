---
name: filtros-relatorios
description: Filter and report patterns — period, equipe, assunto, pessoa filters across all report pages
---

## Overview

All report pages follow the same filter pattern. Filters are local state (useState), not global context.

## Common Filter Pattern

`	ypescript
const [filterMode, setFilterMode] = useState<'mes-ano' | 'periodo'>('mes-ano');
const [filtroMes, setFiltroMes] = useState('');
const [filtroAno, setFiltroAno] = useState('');
const [dataInicio, setDataInicio] = useState('');
const [dataFinal, setDataFinal] = useState('');
const [filtroEquipe, setFiltroEquipe] = useState('');
const [filtroAssunto, setFiltroAssunto] = useState('');     // PTR-BA specific
const [filtroPessoa, setFiltroPessoa] = useState('');       // PTR-BA specific
`

## Input Class

`	ypescript
const inputClass = 'rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated';
`

## Period Filter (pplyPeriodFilter)

`	ypescript
function applyPeriodFilter(lista: T[]): T[] {
  if (filterMode === 'mes-ano') {
    if (filtroMes) lista = lista.filter(p => new Date(p.data + 'T12:00:00').getMonth() + 1 === Number(filtroMes));
    if (filtroAno) lista = lista.filter(p => p.data?.startsWith(filtroAno));
  } else {
    if (dataInicio) lista = lista.filter(p => p.data >= dataInicio);
    if (dataFinal)  lista = lista.filter(p => p.data <= dataFinal);
  }
  return lista;
}
`

## Filter Bar Layout

The FilterBar is an inline component that returns a flex-wrap div with:
1. Mes/Ano toggle (segmented button)
2. Mes/Ano selects OR date range inputs (based on mode)
3. Equipe select (optional)
4. Assunto select (if applicable)
5. Pessoa select (if applicable)
6. Registro count badge

## Design Conventions

- All selects use inputClass for consistent styling
- Date inputs use 	ype="date" with inputClass
- Filter labels use iltro prefix for state variables
- Active filters are displayed via iltrosAtivos string (shown in PageTitle)
- Person filter uses .trim().toLowerCase() for case-insensitive comparison
- Stats cards use a 2-4 column grid with colored borders (emerald for hours, aviation for people, amber for teams)
