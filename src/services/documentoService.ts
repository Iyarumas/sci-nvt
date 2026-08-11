import type { Document, DocumentField, DocumentSigner, DocumentFill, DocumentWithFields } from '../types/document';
import { supabase } from '../lib/supabase';

const BUCKET = 'document-pdfs';

function getDb() {
  if (!supabase) throw new Error('Supabase nao configurado. Verifique as credenciais no arquivo .env');
  return supabase;
}

function handleSupabaseError(err: unknown): never {
  console.error('Erro Supabase:', err);
  const msg =
    err instanceof Error ? err.message :
    err && typeof err === 'object' && 'message' in err ? String((err as any).message) :
    'Erro inesperado no banco de dados';
  throw new Error(msg);
}

// =====================================================
// DOCUMENTOS (TEMPLATES)
// =====================================================

export async function listarDocumentos(): Promise<Document[]> {
  const db = getDb();
  const { data, error } = await db
    .from('documents')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) handleSupabaseError(error);
  return (data as Document[]) || [];
}

export async function buscarDocumento(id: string): Promise<DocumentWithFields | null> {
  const db = getDb();
  const { data: doc, error: docErr } = await db
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();
  if (docErr) handleSupabaseError(docErr);
  if (!doc) return null;

  const [fieldsRes, signersRes] = await Promise.all([
    db.from('document_fields').select('*').eq('document_id', id).order('order_index'),
    db.from('document_signers').select('*').eq('document_id', id).order('order_index'),
  ]);

  if (fieldsRes.error) handleSupabaseError(fieldsRes.error);
  if (signersRes.error) handleSupabaseError(signersRes.error);

  return {
    ...(doc as Document),
    document_fields: (fieldsRes.data as DocumentField[]) || [],
    document_signers: (signersRes.data as DocumentSigner[]) || [],
  };
}

export async function criarDocumento(data: Omit<Document, 'id' | 'created_at' | 'updated_at'>): Promise<Document> {
  const db = getDb();
  const { data: created, error } = await db
    .from('documents')
    .insert({
      name: data.name,
      description: data.description,
      category: data.category,
      template_pdf_url: data.template_pdf_url,
      active: data.active,
      source_module: data.source_module,
    })
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return created as Document;
}

export async function atualizarDocumento(id: string, updates: Partial<Document>): Promise<Document | null> {
  const db = getDb();
  const { data, error } = await db
    .from('documents')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return data as Document;
}

export async function excluirDocumento(id: string): Promise<boolean> {
  const db = getDb();

  await excluirPdf(id);

  await db.from('document_fills').delete().eq('document_id', id);
  await db.from('document_fields').delete().eq('document_id', id);
  await db.from('document_signers').delete().eq('document_id', id);

  const { error } = await db.from('documents').delete().eq('id', id);
  if (error) handleSupabaseError(error);

  return true;
}

// =====================================================
// CAMPOS DO DOCUMENTO
// =====================================================

export async function criarCampo(data: Omit<DocumentField, 'id' | 'created_at'>): Promise<DocumentField> {
  const db = getDb();
  const { data: created, error } = await db
    .from('document_fields')
    .insert({
      document_id: data.document_id,
      field_name: data.field_name,
      field_label: data.field_label,
      field_type: data.field_type,
      required: data.required,
      placeholder: data.placeholder,
      options: data.options,
      order_index: data.order_index,
      page: data.page,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      font_size: data.font_size,
      data_source: data.data_source,
      is_signature: data.is_signature,
      signer_role: data.signer_role,
      read_only: data.read_only ?? false,
      conditional_on: data.conditional_on ?? null,
    })
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return created as DocumentField;
}

export async function criarCamposEmLote(
  documentId: string,
  fields: Omit<DocumentField, 'id' | 'created_at'>[],
): Promise<DocumentField[]> {
  const db = getDb();
  const rows = fields.map((f, i) => ({
    document_id: documentId,
    field_name: f.field_name,
    field_label: f.field_label,
    field_type: f.field_type,
    required: f.required,
    placeholder: f.placeholder,
    options: f.options,
    order_index: f.order_index ?? i,
    page: f.page ?? 1,
    x: f.x ?? 0,
    y: f.y ?? 0,
    width: f.width ?? 150,
    height: f.height ?? 20,
    font_size: f.font_size ?? 10,
    data_source: f.data_source ?? 'manual',
    is_signature: f.is_signature ?? false,
    signer_role: f.signer_role ?? null,
    read_only: f.read_only ?? false,
    conditional_on: f.conditional_on ?? null,
  }));
  const { data, error } = await db
    .from('document_fields')
    .insert(rows)
    .select();
  if (error) handleSupabaseError(error);
  return (data as DocumentField[]) || [];
}

export async function sincronizarCamposTemplate(
  doc: DocumentWithFields,
  templateFields: Omit<DocumentField, 'id' | 'created_at'>[],
): Promise<DocumentField[]> {
  const existingNames = new Set(doc.document_fields.map(f => f.field_name));
  const missing = templateFields.filter(tf => !existingNames.has(tf.field_name));
  if (missing.length === 0) return [];
  return criarCamposEmLote(doc.id, missing);
}

export async function atualizarCampo(id: string, updates: Partial<DocumentField>): Promise<DocumentField | null> {
  const db = getDb();
  const { data, error } = await db
    .from('document_fields')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return data as DocumentField;
}

export async function excluirCampo(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from('document_fields').delete().eq('id', id);
  if (error) handleSupabaseError(error);
}

export async function listarCampos(documentId: string): Promise<DocumentField[]> {
  const db = getDb();
  const { data, error } = await db
    .from('document_fields')
    .select('*')
    .eq('document_id', documentId)
    .order('order_index');
  if (error) handleSupabaseError(error);
  return (data as DocumentField[]) || [];
}

// =====================================================
// SIGNATÁRIOS
// =====================================================

export async function criarSignatario(data: Omit<DocumentSigner, 'id' | 'created_at'>): Promise<DocumentSigner> {
  const db = getDb();
  const { data: created, error } = await db
    .from('document_signers')
    .insert({
      document_id: data.document_id,
      signer_name: data.signer_name,
      signer_role: data.signer_role,
      order_index: data.order_index,
      required: data.required,
    })
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return created as DocumentSigner;
}

export async function atualizarSignatario(id: string, updates: Partial<DocumentSigner>): Promise<DocumentSigner | null> {
  const db = getDb();
  const { data, error } = await db
    .from('document_signers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return data as DocumentSigner;
}

export async function excluirSignatario(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from('document_signers').delete().eq('id', id);
  if (error) handleSupabaseError(error);
}

export async function listarSignatarios(documentId: string): Promise<DocumentSigner[]> {
  const db = getDb();
  const { data, error } = await db
    .from('document_signers')
    .select('*')
    .eq('document_id', documentId)
    .order('order_index');
  if (error) handleSupabaseError(error);
  return (data as DocumentSigner[]) || [];
}

// =====================================================
// PREENCHIMENTOS
// =====================================================

export async function criarPreenchimento(data: Omit<DocumentFill, 'id' | 'created_at' | 'updated_at'>): Promise<DocumentFill> {
  const db = getDb();
  const { data: created, error } = await db
    .from('document_fills')
    .insert({
      document_id: data.document_id,
      filled_by: data.filled_by,
      filled_data: data.filled_data,
      status: data.status,
      autentique_document_id: data.autentique_document_id,
      autentique_link: data.autentique_link,
    })
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return created as DocumentFill;
}

export async function listarPreenchimentos(params?: string | {
  documentId?: string;
  status?: string;
  created_at_gte?: string;
  created_at_lte?: string;
}): Promise<DocumentFill[]> {
  const db = getDb();
  const filtros = typeof params === 'string' ? { documentId: params } : params;
  let query = db.from('document_fills').select('*').order('created_at', { ascending: false });
  if (filtros?.documentId) query = query.eq('document_id', filtros.documentId);
  if (filtros?.status) query = query.eq('status', filtros.status);
  if (filtros?.created_at_gte) query = query.gte('created_at', filtros.created_at_gte);
  if (filtros?.created_at_lte) query = query.lte('created_at', filtros.created_at_lte);
  const { data, error } = await query;
  if (error) handleSupabaseError(error);
  return (data as DocumentFill[]) || [];
}

export async function atualizarPreenchimento(id: string, updates: Partial<DocumentFill>): Promise<DocumentFill | null> {
  const db = getDb();
  const { data, error } = await db
    .from('document_fills')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) handleSupabaseError(error);
  return data as DocumentFill;
}

export async function excluirPreenchimento(id: string): Promise<void> {
  const db = getDb();
  const { error } = await db.from('document_fills').delete().eq('id', id);
  if (error) handleSupabaseError(error);
}

// =====================================================
// UPLOAD PDF (Supabase Storage)
// =====================================================

export async function uploadPDF(docId: string, file: File): Promise<string> {
  const db = getDb();
  const sanitizedName = file.name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const path = `${docId}/${Date.now()}_${sanitizedName}`;

  const { error: uploadErr } = await db.storage
    .from(BUCKET)
    .upload(path, file, { contentType: 'application/pdf', upsert: true });
  if (uploadErr) handleSupabaseError(uploadErr);

  return path;
}

export async function getPdfDownloadUrl(path: string): Promise<string | null> {
  const db = getDb();
  const { data, error } = await db.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);
  if (error) {
    console.error('Erro ao gerar URL do PDF:', error);
    return null;
  }
  return data?.signedUrl || null;
}

export async function getPdfBlob(path: string): Promise<Blob | null> {
  if (path.startsWith('/')) {
    try {
      const res = await fetch(path);
      if (!res.ok) {
        console.error('Erro ao buscar PDF local:', res.statusText);
        return null;
      }
      return await res.blob();
    } catch (err) {
      console.error('Erro ao buscar PDF local:', err);
      return null;
    }
  }
  const db = getDb();
  const { data, error } = await db.storage
    .from(BUCKET)
    .download(path);
  if (error) {
    console.error('Erro ao baixar PDF:', error);
    return null;
  }
  return data;
}

export async function excluirPdf(docId: string): Promise<void> {
  const db = getDb();
  const { data: files } = await db.storage
    .from(BUCKET)
    .list(docId);
  if (files && files.length > 0) {
    const paths = files.map((f: { name: string }) => `${docId}/${f.name}`);
    await db.storage.from(BUCKET).remove(paths);
  }
}

export async function listarPdfsStorage(): Promise<{ name: string; path: string; id: string }[]> {
  const db = getDb();
  const { data: folders } = await db.storage.from(BUCKET).list('', { limit: 100 });
  if (!folders) return [];

  const results: { name: string; path: string; id: string }[] = [];
  for (const folder of folders) {
    if (!folder.name) continue;
    const { data: files } = await db.storage.from(BUCKET).list(folder.name, { limit: 50 });
    if (files) {
      for (const f of files) {
        if (f.name && f.name.endsWith('.pdf')) {
          const fullPath = `${folder.name}/${f.name}`;
          const displayName = f.name.replace(/^\d+_/, '').replace(/\.pdf$/i, '');
          results.push({ name: displayName, path: fullPath, id: fullPath });
        }
      }
    }
  }
  return results;
}
