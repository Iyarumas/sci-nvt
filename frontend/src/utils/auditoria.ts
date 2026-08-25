import type { Bombeiro } from '../types/bombeiro';
import { formatarDataBR } from './datas';

type PessoaAuditoria = Pick<Bombeiro, 'id' | 'matricula' | 'nome' | 'nomeCompleto' | 'nomeGuerra' | 'email' | 'cargo'>;

export type RegistroAuditavel = {
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  status?: string;
  aprovadoEm?: string;
};

function normalizar(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9@._-]+/g, ' ')
    .trim();
}

function dataMs(value: unknown): number {
  const data = new Date(String(value || '')).getTime();
  return Number.isFinite(data) ? data : 0;
}

function houveAlteracaoDepois(depois: unknown, antes: unknown): boolean {
  const depoisMs = dataMs(depois);
  const antesMs = dataMs(antes);
  if (!depoisMs || !antesMs) return !!depois && !!antes && String(depois) !== String(antes);
  return depoisMs - antesMs > 1000;
}

function statusEhRascunho(status?: string): boolean {
  return ['rascunho', 'draft'].includes(normalizar(status));
}

function statusEhConcluido(status?: string): boolean {
  return ['aprovado', 'concluido', 'fechada', 'fechado', 'assinado', 'finalizado', 'arquivado', 'signed', 'archived']
    .includes(normalizar(status));
}

export function formatarUsuarioAuditoria(value: unknown, pessoas: PessoaAuditoria[] = []): string {
  const raw = String(value || '').trim();
  const alvo = normalizar(raw);
  if (!alvo) return 'Não informado';

  const pessoa = pessoas.find(p =>
    normalizar(p.id) === alvo ||
    normalizar(p.matricula) === alvo ||
    normalizar(p.nomeGuerra) === alvo ||
    normalizar(p.nomeCompleto) === alvo ||
    normalizar(p.nome) === alvo ||
    normalizar(p.email) === alvo
  ) || pessoas.find(p =>
    ` ${normalizar(p.nomeGuerra)} `.includes(` ${alvo} `) ||
    ` ${normalizar(p.nomeCompleto)} `.includes(` ${alvo} `)
  );

  if (!pessoa) return raw;
  const nome = pessoa.nomeGuerra || pessoa.nomeCompleto || raw;
  return [pessoa.cargo, nome].filter(Boolean).join(' ');
}

export function montarLinhasAuditoria(registro: RegistroAuditavel, pessoas: PessoaAuditoria[] = []): string[] {
  const linhas = [`Criado por ${formatarUsuarioAuditoria(registro.createdBy, pessoas)} em ${formatarDataBR(registro.createdAt, '—')}`];
  if (!registro.updatedBy || !registro.updatedAt || !houveAlteracaoDepois(registro.updatedAt, registro.createdAt)) return linhas;

  const usuario = formatarUsuarioAuditoria(registro.updatedBy, pessoas);
  const data = formatarDataBR(registro.updatedAt, '—');
  if (statusEhRascunho(registro.status)) {
    linhas.push(`Rascunho alterado por ${usuario} em ${data}`);
    return linhas;
  }

  if (statusEhConcluido(registro.status)) {
    if (!registro.aprovadoEm || houveAlteracaoDepois(registro.updatedAt, registro.aprovadoEm)) {
      linhas.push(`Editado por ${usuario} em ${data}`);
    }
    return linhas;
  }

  linhas.push(`Alterado por ${usuario} em ${data}`);
  return linhas;
}

export function resumoAuditoria(registro: RegistroAuditavel, pessoas: PessoaAuditoria[] = []): string {
  return montarLinhasAuditoria(registro, pessoas).join(' · ');
}
