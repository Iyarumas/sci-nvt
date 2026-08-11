---
name: bug-fix
description: Investigate and fix bugs — systematic approach to diagnose and resolve issues
---

## Bug Investigation Process

### 1. Understand the Bug
- [ ] Reproduce the issue with specific steps
- [ ] Note which view/page/component is affected
- [ ] Note which data is affected (which filters, which records)

### 2. Check the Data Flow
- [ ] Is the data loading? Check the service call
- [ ] Is the data stored correctly? Check state after load
- [ ] Is the computation correct? Check useMemo/derived state
- [ ] Is the display correct? Check the render/print path

### 3. Common Bug Patterns in This Codebase

**Hours not appearing** (PTR-BA):
- calcHoras returns 0 ? empty/invalid time strings
- calcHoras returns NaN ? malformed time format
-  ? horasStr(v) : '-' ? 0 is falsy, shows "-"
- Fix: use  != null && v > 0 or always show horasStr(v)

**Filter not working**:
- === exact string match fails ? whitespace/accents mismatch
- Fix: use .trim().toLowerCase() on both sides
- Missing dependency in useMemo ? stale filter data

**Print not working**:
- Missing function (imprimirHTML was removed in a refactor)
- HTML generation error ? check gerarHTMLImpressao parameters
- CSS issue ? table overflows page, content hidden

### 4. Verify the Fix
- [ ] Test the exact reproduction steps
- [ ] Test edge cases (empty, null, undefined)
- [ ] Run TypeScript check (tk tsc --noEmit --pretty)
- [ ] Check both screen AND print paths if applicable

### 5. Commit
- [ ] Stage only relevant files
- [ ] Write descriptive commit message explaining root cause
- [ ] Use tk git for compact git operations
