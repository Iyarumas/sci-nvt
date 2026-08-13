UPDATE documents
SET
  template_pdf_url = COALESCE(NULLIF(template_pdf_url, ''), '/templates/troca.pdf'),
  source_module = COALESCE(source_module, 'trocas'),
  updated_at = NOW()
WHERE active = TRUE
  AND (source_module = 'trocas' OR name ILIKE '%troca%')
  AND (template_pdf_url IS NULL OR template_pdf_url = '' OR source_module IS NULL);
