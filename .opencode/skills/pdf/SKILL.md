---
name: pdf
description: PDF generation — puppeteer, jspdf, pdf-lib, html-to-image, and PDF service utilities
---

## Overview

The system generates PDFs through multiple approaches depending on the use case.

## PDF Approaches

### 1. Puppeteer (Server-side LRO)
- Used in: lroGenerator.ts ? htmlPdfService.ts
- Generates full LRO documents from HTML templates
- Requires puppeteer running in the Vercel serverless environment
- Templates: 	emplate-lro-nomes-funcoes.html, preview-lro.html

### 2. jspdf (Client-side)
- Used in: various report pages for simple PDF export
- Lightweight, runs in browser
- Good for tables and simple layouts

### 3. pdf-lib (Server-side)
- Used in: pdfService.ts, scripts/add-acroform-fields.cjs
- PDF manipulation (form filling, merging, field extraction)
- Used with Autentique integration for digital signatures

### 4. html-to-image (Client-side)
- Used for: converting HTML elements to PNG images
- Then embedded into PDF via jspdf

## Key Files

| File | Approach | Purpose |
|------|----------|---------|
| src/services/htmlPdfService.ts | Puppeteer | Server-side HTML?PDF |
| src/services/pdfService.ts | pdf-lib | PDF manipulation |
| src/services/lroGenerator.ts | html ? string | LRO HTML generation |
| scripts/add-acroform-fields.cjs | pdf-lib | Auto-fill PDF forms |

## Rules
1. Client-side PDF: use jspdf for simple reports
2. Server-side PDF: use htmlPdfService with puppeteer
3. PDF manipulation: use pdf-lib for merging, form filling, encryption
4. Templates use \$ placeholders for variable interpolation
