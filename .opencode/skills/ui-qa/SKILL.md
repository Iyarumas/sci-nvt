---
name: ui-qa
description: UI/QA testing — verify functionality, consistency, and edge cases across the system
---

## Test Checklist

### Filter Tests
- [ ] Period filter (mes-ano mode): select month only, year only, both, neither
- [ ] Period filter (periodo mode): start only, end only, both, neither
- [ ] Equipe filter: each team individually, all teams
- [ ] Assunto filter: each subject, multiple subjects in sequence
- [ ] Pessoa filter: exact match, case-insensitive match, trimmed match
- [ ] Combined filters: equipe + assunto, equipe + pessoa, assunto + pessoa, all three

### Screen Display Tests
- [ ] Summary view: hours appear in "Horas" column, registros in "Registros"
- [ ] Person view: click equipe ? see persons, hours appear
- [ ] Detail view: click person ? see individual PTR-BA cards with times
- [ ] Collapse/expand cards in detail view
- [ ] "Visualizar" modal opens with full PTR-BA details

### Print Tests
- [ ] "Horas por Equipe" button: opens print window with data
- [ ] "Imprimir" (person view): opens print window
- [ ] "Imprimir" (detail view): opens print window with Horario column
- [ ] "Efetivo" button: opens matrix with 3 equipes per page
- [ ] window.print() in individual view

### Edge Cases
- [ ] Empty state: no PTR-BA records ? "Nenhum PTR-BA encontrado"
- [ ] Loading state: spinner appears during data fetch
- [ ] Subject without participants ? shows "(sem participantes)"
- [ ] Empty horaInicio/horaTermino ? shows "-" or "0h"
- [ ] Print with zero records ? empty table
- [ ] All subjects selected in Efetivo ? all columns fit on one page

### Responsive Tests
- [ ] Filters wrap correctly on narrow screens
- [ ] Tables scroll horizontally on mobile
- [ ] Stats cards stack vertically on mobile
