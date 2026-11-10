import { readFileSync } from 'fs';
import { createSign } from 'crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Acesso SÓ DE LEITURA ao Google Drive com a conta de serviço.
 * A chave nunca fica no repositório: vem de GOOGLE_DRIVE_CREDENCIAIS_ARQUIVO (caminho do .json)
 * ou GOOGLE_DRIVE_CREDENCIAIS_JSON (o conteúdo do .json, puro ou em base64).
 */
interface Credenciais {
  client_email: string;
  private_key: string;
}

export interface ItemDrive {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  size?: string;
  modifiedTime?: string;
}

export const PASTA_MIME = 'application/vnd.google-apps.folder';
const ESCOPO = 'https://www.googleapis.com/auth/drive.readonly';
const API = 'https://www.googleapis.com/drive/v3';

@Injectable()
export class DriveApiService {
  private readonly logger = new Logger(DriveApiService.name);
  private credenciais: Credenciais | null | undefined;
  private token: { valor: string; expira: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  get pastaRaiz(): string | null {
    return this.config.get<string>('GOOGLE_DRIVE_PASTA_RAIZ')?.trim() || null;
  }

  get configurado(): boolean {
    return !!this.pastaRaiz && !!this.lerCredenciais();
  }

  private lerCredenciais(): Credenciais | null {
    if (this.credenciais !== undefined) return this.credenciais;
    try {
      let texto = this.config.get<string>('GOOGLE_DRIVE_CREDENCIAIS_JSON')?.trim() || '';
      const arquivo = this.config.get<string>('GOOGLE_DRIVE_CREDENCIAIS_ARQUIVO')?.trim();
      if (!texto && arquivo) texto = readFileSync(arquivo, 'utf8');
      if (texto && !texto.startsWith('{')) texto = Buffer.from(texto, 'base64').toString('utf8');
      const json = texto ? (JSON.parse(texto) as Partial<Credenciais>) : null;
      this.credenciais = json?.client_email && json.private_key
        ? { client_email: json.client_email, private_key: json.private_key }
        : null;
    } catch (erro) {
      this.logger.error(`Não consegui ler a chave do Google Drive: ${(erro as Error).message}`);
      this.credenciais = null;
    }
    return this.credenciais;
  }

  private async tokenDeAcesso(): Promise<string> {
    if (this.token && this.token.expira > Date.now() + 60_000) return this.token.valor;
    const cred = this.lerCredenciais();
    if (!cred) throw new ServiceUnavailableException('O acesso ao Google Drive não está configurado.');
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const agora = Math.floor(Date.now() / 1000);
    const corpo = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
      iss: cred.client_email, scope: ESCOPO, aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600,
    })}`;
    const assinatura = createSign('RSA-SHA256').update(corpo).sign(cred.private_key, 'base64url');
    const resposta = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${corpo}.${assinatura}` }),
    });
    const json = (await resposta.json()) as { access_token?: string; expires_in?: number; error?: string };
    if (!json.access_token) {
      this.logger.error(`Google recusou o acesso: ${json.error ?? resposta.status}`);
      throw new ServiceUnavailableException('O Google Drive recusou o acesso do sistema.');
    }
    this.token = { valor: json.access_token, expira: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return json.access_token;
  }

  /** Filhos de várias pastas de uma vez (poucas chamadas mesmo com dezenas de pessoas). */
  async filhosDe(pastas: string[]): Promise<ItemDrive[]> {
    const itens: ItemDrive[] = [];
    for (let i = 0; i < pastas.length; i += 40) {
      const grupo = pastas.slice(i, i + 40);
      const q = `(${grupo.map(id => `'${id.replace(/'/g, '')}' in parents`).join(' or ')}) and trashed = false`;
      let pageToken = '';
      do {
        const params = new URLSearchParams({
          q, pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
          fields: 'nextPageToken,files(id,name,mimeType,parents,size,modifiedTime)',
        });
        if (pageToken) params.set('pageToken', pageToken);
        const json = await this.get<{ files: ItemDrive[]; nextPageToken?: string }>(`${API}/files?${params}`);
        itens.push(...json.files);
        pageToken = json.nextPageToken ?? '';
      } while (pageToken);
    }
    return itens;
  }

  /** Conteúdo de um arquivo (PDF ou imagem). */
  async baixar(id: string): Promise<{ dados: Buffer; tipo: string }> {
    const token = await this.tokenDeAcesso();
    const resposta = await fetch(`${API}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!resposta.ok) throw new ServiceUnavailableException('Não consegui abrir o arquivo no Google Drive.');
    return {
      dados: Buffer.from(await resposta.arrayBuffer()),
      tipo: resposta.headers.get('content-type') || 'application/octet-stream',
    };
  }

  private async get<T>(url: string): Promise<T> {
    const token = await this.tokenDeAcesso();
    const resposta = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    const json = (await resposta.json()) as T & { error?: { message?: string } };
    if (!resposta.ok || json.error) {
      this.logger.error(`Erro do Google Drive: ${json.error?.message ?? resposta.status}`);
      throw new ServiceUnavailableException('Não consegui ler o Google Drive agora.');
    }
    return json;
  }
}
