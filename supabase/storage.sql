-- =====================================================
-- SCI Bombeiro - Storage Bucket para Documentos
-- Execute este SQL no Supabase SQL Editor DEPOIS do schema.sql
-- =====================================================

-- Criar bucket para documentos
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Política: permitir upload autenticado
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Política: permitir leitura pública
CREATE POLICY "Public can view documents"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'documents');

-- Política: permitir delete autenticado
CREATE POLICY "Authenticated users can delete documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
