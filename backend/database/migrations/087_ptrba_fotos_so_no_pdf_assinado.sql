-- PTR-BA já assinado com o PDF guardado: as fotos ficam só no PDF assinado (que já as contém).
-- A evidência fica marcada com fotoNoPdfAssinado para a tela continuar contando a foto.
-- Mesma regra que o sistema aplica sozinho quando um PTR-BA fica assinado (envios.service.ts).
UPDATE ptrba_completo_registros r
   SET evidencias = (
     SELECT coalesce(jsonb_agg(
       CASE WHEN jsonb_typeof(e) = 'object' AND coalesce(e->>'imagem', '') <> ''
         THEN (e - 'imagem') || jsonb_build_object('imagem', '', 'fotoNoPdfAssinado', true)
         ELSE e END
       ORDER BY ordem), '[]'::jsonb)
     FROM jsonb_array_elements(r.evidencias) WITH ORDINALITY AS t(e, ordem))
 WHERE jsonb_typeof(r.evidencias) = 'array'
   -- Só PTR-BA de novembro de 2026 em diante (início do Autentique); os antigos ficam com as fotos.
   AND r.data::date >= DATE '2026-11-01'
   AND EXISTS (SELECT 1 FROM autentique_envios a
                WHERE a.tipo = 'ptrba' AND a.referencia_id::text = r.id::text
                  AND a.status = 'assinado' AND a.pdf_assinado_url IS NOT NULL)
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(r.evidencias) e
                WHERE jsonb_typeof(e) = 'object' AND coalesce(e->>'imagem', '') <> '');
