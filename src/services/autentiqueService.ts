const API_URL = '/api/autentique-proxy';

async function graphqlRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-autentique-sandbox': 'true',
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0].message || 'Erro na API Autentique');
  }
  return json.data as T;
}

async function graphqlUpload<T>(query: string, variables: Record<string, unknown>, file: Blob, filename: string, sandbox = true): Promise<T> {
  const formData = new FormData();
  const ops = JSON.stringify({ query, variables: { ...variables, file: null } });
  formData.append('operations', ops);
  formData.append('map', JSON.stringify({ 'file': ['variables.file'] }));
  formData.append('file', file, filename);
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-autentique-sandbox': String(sandbox),
    },
    body: formData,
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0].message || 'Erro na API Autentique');
  }
  return json.data as T;
}

export interface AutentiqueSigner {
  email?: string;
  name?: string;
  phone?: string;
  delivery_method?: 'DELIVERY_METHOD_WHATSAPP' | 'DELIVERY_METHOD_SMS' | 'DELIVERY_METHOD_LINK';
  action: 'SIGN' | 'APPROVE' | 'RECOGNIZE' | 'SIGN_AS_A_WITNESS';
  positions?: { x: string; y: string; z: number; element: 'SIGNATURE' | 'NAME' | 'INITIALS' | 'DATE' | 'CPF' }[];
}

export interface CreateDocumentResult {
  id: string;
  name: string;
  created_at: string;
  signatures: {
    public_id: string;
    name: string;
    email: string;
    link: { short_link: string } | null;
    action: { name: string };
  }[];
}

export async function criarDocumento(
  pdfBlob: Blob,
  nome: string,
  signatarios: AutentiqueSigner[],
  pastaId?: string,
  sandbox = true,
): Promise<CreateDocumentResult> {
  const query = `
    mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
      createDocument(document: $document, signers: $signers, file: $file${pastaId ? ', folder_id: "' + pastaId + '"' : ''}) {
        id name created_at signatures {
          public_id name email link { short_link } action { name }
        }
      }
    }
  `;
  return graphqlUpload<CreateDocumentResult>(query, {
    document: { name: nome },
    signers: signatarios,
  }, pdfBlob, `${nome}.pdf`, sandbox);
}

export async function criarDocumentoComPasta(
  pdfBlob: Blob,
  nome: string,
  signatarios: AutentiqueSigner[],
  ano: number,
  mes: number,
  tipoDocumento: string,
  sandbox = true,
): Promise<CreateDocumentResult> {
  const pastaId = await garantirEstruturaPastas(String(ano), String(mes).padStart(2, '0'), tipoDocumento);
  return criarDocumento(pdfBlob, nome, signatarios, pastaId, sandbox);
}

export interface AutentiqueFolder {
  id: string;
  name: string;
  type: string;
  slug?: string;
  path?: string;
  parent_id?: string;
  children_counter?: number;
  created_at: string;
}

export async function criarPasta(nome: string, parentId?: string): Promise<AutentiqueFolder> {
  const query = `
    mutation CreateFolder($folder: FolderInput!${parentId ? ', $parent_id: UUID' : ''}) {
      createFolder(folder: $folder${parentId ? ', parent_id: $parent_id' : ''}) {
        id name type slug path children_counter created_at
      }
    }
  `;
  const vars: Record<string, unknown> = { folder: { name: nome } };
  if (parentId) vars.parent_id = parentId;
  return graphqlRequest<AutentiqueFolder>(query, vars);
}

export async function listarPastas(): Promise<AutentiqueFolder[]> {
  const query = `query { folders { id name type slug path children_counter created_at } }`;
  const data = await graphqlRequest<{ folders: AutentiqueFolder[] }>(query);
  return data.folders || [];
}

export async function buscarOuCriarPasta(nome: string, parentId?: string): Promise<AutentiqueFolder> {
  const todas = await listarPastas();
  const filtradas = todas.filter(f => f.name === nome && (parentId ? f.path?.includes(parentId) : !f.path));
  if (filtradas.length > 0) return filtradas[0];
  return criarPasta(nome, parentId);
}

const ROOT_FOLDER = 'Sistema SCI';

async function garantirEstruturaPastas(ano: string, mes: string, tipoDocumento: string): Promise<string> {
  const root = await buscarOuCriarPasta(ROOT_FOLDER);
  const tipo = await buscarOuCriarPasta(tipoDocumento, root.id);
  const anoFolder = await buscarOuCriarPasta(ano, tipo.id);
  const mesFolder = await buscarOuCriarPasta(mes, anoFolder.id);
  return mesFolder.id;
}

export interface AutentiqueDocumentData {
  id: string;
  name: string;
  created_at: string;
  deleted_at: string | null;
  sandbox: boolean;
  signatures: {
    public_id: string;
    name: string;
    email: string;
    signed: { created_at: string } | null;
    rejected: { created_at: string; reason?: string } | null;
    viewed: { created_at: string } | null;
  }[];
  files: { original: string; signed: string; certified?: string; pades?: string };
}

export async function buscarDocumento(id: string): Promise<AutentiqueDocumentData> {
  const query = `
    query GetDocument($id: UUID!) {
      document(id: $id) {
        id name created_at deleted_at sandbox
        signatures {
          public_id name email
          signed { created_at }
          rejected { created_at reason }
          viewed { created_at }
        }
        files { original signed certified pades }
      }
    }
  `;
  const data = await graphqlRequest<{ document: AutentiqueDocumentData }>(query, { id });
  return data.document;
}

export interface AutentiqueDocumentListResult {
  data: AutentiqueDocumentData[];
  total: number;
  has_more_pages: boolean;
}

export async function listarDocumentos(page = 1, limit = 60, showSandbox = true): Promise<AutentiqueDocumentListResult> {
  const query = `
    query ListDocuments($limit: Int, $page: Int, $showSandbox: Boolean) {
      documents(limit: $limit, page: $page, showSandbox: $showSandbox) {
        total
        data {
          id name created_at deleted_at sandbox
          signatures {
            public_id name email
            signed { created_at }
            rejected { created_at reason }
          }
          files { original signed }
        }
      }
    }
  `;
  const data = await graphqlRequest<{ documents: AutentiqueDocumentListResult }>(query, { limit, page, showSandbox });
  return data.documents;
}

export async function listarDocumentosDaPasta(pastaId: string, page = 1, limit = 60): Promise<AutentiqueDocumentListResult> {
  const query = `
    query ListDocumentsByFolder($folder_id: UUID!, $limit: Int, $page: Int) {
      documentsByFolder(folder_id: $folder_id, limit: $limit, page: $page) {
        data {
          id name created_at deleted_at sandbox
          signatures {
            public_id name email
            signed { created_at }
            rejected { created_at reason }
          }
          files { original signed }
        }
        has_more_pages
      }
    }
  `;
  const data = await graphqlRequest<{ documentsByFolder: AutentiqueDocumentListResult }>(query, { folder_id: pastaId, limit, page });
  return data.documentsByFolder;
}

export async function sincronizarStatusDocumento(
  autentiqueDocId: string,
  onStatusUpdate: (status: 'pending' | 'signed' | 'cancelled', signedAt?: string) => void,
): Promise<void> {
  const doc = await buscarDocumento(autentiqueDocId);

  const total = doc.signatures.length;
  const signedCount = doc.signatures.filter(s => s.signed?.created_at).length;
  const rejectedCount = doc.signatures.filter(s => s.rejected?.created_at).length;

  if (rejectedCount > 0) {
    onStatusUpdate('cancelled');
  } else if (signedCount === total) {
    const lastSigned = doc.signatures
      .filter(s => s.signed?.created_at)
      .map(s => s.signed!.created_at)
      .sort()
      .pop();
    onStatusUpdate('signed', lastSigned);
  } else {
    onStatusUpdate('pending');
  }
}

export async function sincronizarStatusDocumentoPorID(
  fillId: string,
  autentiqueDocId: string,
): Promise<{ status: 'pending' | 'signed' | 'cancelled'; signedAt?: string }> {
  const { atualizarPreenchimento } = await import('./documentoService');

  let resultStatus: 'pending' | 'signed' | 'cancelled' = 'pending';
  let resultSignedAt: string | undefined;

  await sincronizarStatusDocumento(autentiqueDocId, async (status, signedAt) => {
    resultStatus = status;
    resultSignedAt = signedAt;
    await atualizarPreenchimento(fillId, {
      status,
      ...(signedAt ? { filled_data: { data_assinatura: signedAt } as any } : {}),
    });
  });

  return { status: resultStatus, signedAt: resultSignedAt };
}
