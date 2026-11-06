import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const API = 'https://api.autentique.com.br/v2/graphql';

const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

export interface PosicaoAutentique {
  x: string;
  y: string;
  z: number;
  angle: number;
  scale: number;
  element: 'SIGNATURE' | 'INITIALS' | 'NAME' | 'DATE' | 'CPF';
}

export interface SignatarioAutentique {
  email: string;
  action: 'SIGN';
  positions: PosicaoAutentique[];
}

export interface AssinaturaAutentique {
  public_id: string;
  email: string | null;
  signed: { created_at: string } | null;
  rejected: { created_at: string } | null;
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
}

/**
 * Chamadas à API GraphQL do Autentique. A chave fica só no servidor (AUTENTIQUE_TOKEN).
 * Custos (plano Profissional): criar documento e cada pedido por e-mail são cobrados;
 * consultar um documento custa R$ 0,001; reenviar avisos e listar pastas não são cobrados.
 */
@Injectable()
export class AutentiqueApiService {
  private readonly logger = new Logger(AutentiqueApiService.name);

  constructor(private readonly config: ConfigService) {}

  private get token(): string {
    const token = this.config.get<string>('AUTENTIQUE_TOKEN')?.trim();
    if (!token) throw new ServiceUnavailableException('A chave do Autentique (AUTENTIQUE_TOKEN) não está configurada.');
    return token;
  }

  /** Documentos de teste: não são cobrados e o Autentique apaga em alguns dias. */
  get sandbox(): boolean {
    return this.config.get<string>('AUTENTIQUE_MODO') === 'sandbox';
  }

  private async chamar<T>(body: BodyInit, json: boolean): Promise<T> {
    const resposta = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, ...(json ? { 'Content-Type': 'application/json' } : {}) },
      body,
    });
    const texto = await resposta.text();
    let dados: { data?: T; errors?: { message: string }[] };
    try {
      dados = JSON.parse(texto);
    } catch {
      throw new BadGatewayException('O Autentique não respondeu como esperado.');
    }
    if (dados.errors?.length) {
      this.logger.warn(`Autentique recusou: ${JSON.stringify(dados.errors).slice(0, 500)}`);
      throw new BadGatewayException(`Autentique: ${dados.errors.map(e => e.message).join('; ')}`);
    }
    return dados.data as T;
  }

  graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    return this.chamar<T>(JSON.stringify({ query, variables }), true);
  }

  async criarDocumento(params: {
    nome: string;
    nomeArquivo: string;
    pdf: Buffer;
    signatarios: SignatarioAutentique[];
    pastaId?: string | null;
  }): Promise<{ id: string; signatures: { public_id: string; email: string | null }[] }> {
    const query = `mutation CriarDocumento($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!${params.pastaId ? ', $folder: UUID' : ''}) {
      createDocument(sandbox: ${this.sandbox ? 'true' : 'false'}, document: $document, signers: $signers, file: $file${params.pastaId ? ', folder_id: $folder' : ''}) {
        id signatures { public_id email }
      }
    }`;
    const form = new FormData();
    form.append('operations', JSON.stringify({
      query,
      variables: {
        document: { name: params.nome },
        signers: params.signatarios,
        file: null,
        ...(params.pastaId ? { folder: params.pastaId } : {}),
      },
    }));
    form.append('map', JSON.stringify({ file: ['variables.file'] }));
    form.append('file', new Blob([new Uint8Array(params.pdf)], { type: 'application/pdf' }), params.nomeArquivo);
    const dados = await this.chamar<{ createDocument: { id: string; signatures: { public_id: string; email: string | null }[] } }>(form, false);
    return dados.createDocument;
  }

  /**
   * Pasta do mês dentro de "<base>/<ano>/<tipo>", no padrão que a equipe já usa ("NOVEMBRO 26").
   * Cria a pasta do mês se ainda não existir. Sem a pasta do ano/tipo, envia sem pasta.
   */
  async pastaDoMes(base: string, tipo: string, dataISO: string): Promise<string | null> {
    const [ano, mes] = dataISO.split('-').map(Number);
    if (!ano || !mes) return null;
    const caminhoTipo = normalizar(`${base}/${ano}/${tipo}`);
    const nomeMes = `${MESES[mes - 1]} ${String(ano).slice(-2)}`;
    try {
      const busca = await this.graphql<{ folders: { data: { id: string; path: string }[] } }>(
        `query($busca: String) { folders(display_children: true, search: $busca, limit: 60, page: 1) { data { id path } } }`,
        { busca: tipo },
      );
      const pastaTipo = busca.folders.data.find(f => normalizar(f.path) === caminhoTipo);
      if (!pastaTipo) {
        this.logger.warn(`Pasta "${base}/${ano}/${tipo}" não encontrada no Autentique; documento vai sem pasta.`);
        return null;
      }
      const filhas = await this.graphql<{ folder: { subfolders: { id: string; name: string }[] } }>(
        `query($id: UUID!) { folder(id: $id) { subfolders { id name } } }`,
        { id: pastaTipo.id },
      );
      const doMes = filhas.folder.subfolders.find(f => normalizar(f.name) === normalizar(nomeMes));
      if (doMes) return doMes.id;
      const criada = await this.graphql<{ createFolder: { id: string } }>(
        `mutation($pai: UUID, $pasta: FolderInput!) { createFolder(parent_id: $pai, folder: $pasta) { id } }`,
        { pai: pastaTipo.id, pasta: { name: nomeMes } },
      );
      return criada.createFolder.id;
    } catch (erro) {
      // Pasta é organização, não pode impedir o envio.
      this.logger.warn(`Não foi possível achar a pasta do mês: ${(erro as Error).message}`);
      return null;
    }
  }

  /** Situação de cada assinatura e o link do PDF assinado (custa R$ 0,001 por consulta). */
  async situacao(documentoId: string): Promise<{ signatures: AssinaturaAutentique[]; files: { signed: string | null } | null }> {
    const dados = await this.graphql<{ document: { signatures: AssinaturaAutentique[]; files: { signed: string | null } | null } }>(
      `query($id: UUID!) { document(id: $id) { signatures { public_id email signed { created_at } rejected { created_at } } files { signed } } }`,
      { id: documentoId },
    );
    return dados.document;
  }

  async baixarPdfAssinado(url: string): Promise<Buffer> {
    const resposta = await fetch(url, { headers: { Authorization: `Bearer ${this.token}` } });
    if (!resposta.ok) throw new BadGatewayException('Não foi possível baixar o PDF assinado do Autentique.');
    return Buffer.from(await resposta.arrayBuffer());
  }

  /** Reenvia o e-mail só para quem ainda não assinou. Não é cobrado. */
  async reenviar(publicIds: string[]): Promise<void> {
    if (!publicIds.length) return;
    await this.graphql(`mutation($ids: [UUID]) { resendSignatures(public_ids: $ids) }`, { ids: publicIds });
  }

  /** Link pessoal de assinatura, para mandar pelo WhatsApp. */
  async linkDeAssinatura(publicId: string): Promise<string> {
    const dados = await this.graphql<{ createLinkToSignature: { short_link: string } }>(
      `mutation($id: UUID!) { createLinkToSignature(public_id: $id) { short_link } }`,
      { id: publicId },
    );
    return dados.createLinkToSignature.short_link;
  }

  /**
   * Cancela: vence o prazo (ninguém mais consegue assinar pelos links) e manda para a lixeira.
   * Pela documentação do Autentique, só excluir não bloqueia a assinatura.
   */
  async cancelar(documentoId: string): Promise<void> {
    await this.graphql(
      `mutation($id: UUID!, $doc: UpdateDocumentInput!) { updateDocument(id: $id, document: $doc) { id } }`,
      { id: documentoId, doc: { deadline_at: new Date().toISOString() } },
    );
    await this.graphql(`mutation($id: UUID!) { deleteDocument(id: $id) }`, { id: documentoId });
  }
}
