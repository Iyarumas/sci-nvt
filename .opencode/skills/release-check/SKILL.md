---
name: release-check
description: Pre-deployment release checklist — verify before deploying, publishing, or handoff
---

## Pre-Release Checklist

### Code Quality
- [ ] tk tsc --noEmit --pretty — zero TypeScript errors
- [ ] tk lint — no lint violations
- [ ] No console.log / debugger statements left in production code
- [ ] No TODO, FIXME, or HACK comments in changed files

### Build
- [ ] 
pm run build succeeds (Vite production build)
- [ ] Build output is in dist/ directory
- [ ] No missing assets or broken imports in build

### Testing
- [ ] All filters work: period, equipe, assunto, pessoa (where applicable)
- [ ] All print buttons open and render correctly
- [ ] Screen displays match print outputs (same data)
- [ ] Empty states show properly (no data, loading)
- [ ] Edge cases handled: null values, empty arrays, 0 hours

### Git
- [ ] tk git status — working tree is clean
- [ ] All changes are committed with descriptive messages
- [ ] tk git log --oneline -5 — recent commits are clear
- [ ] Remote is up to date: tk git pull

### Database
- [ ] Supabase migrations are applied (if applicable)
- [ ] No breaking column changes in production
- [ ] RLS policies are correct for new tables

### Environment
- [ ] .env.local has correct Supabase URL and anon key
- [ ] Vercel config (ercel.json) is up to date
- [ ] API endpoints in pi/ directory are correct

### Post-Deploy
- [ ] Verify app loads without errors in production
- [ ] Test authentication flow
- [ ] Verify filters, reports, and prints work in production
- [ ] Monitor logs for any 500 errors
