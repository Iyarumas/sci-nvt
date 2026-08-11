import type { Bombeiro, Cargo, Equipe } from '../types/bombeiro';
import { listarAtivos, obterBombeiro } from '../services/bombeiroService';
import { listarVigencias } from '../services/vigenciaSubstituicaoService';

const EQUIPES: readonly Equipe[] = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Ferista', 'Embaixador'];
const CARGOS_RESPONSAVEIS_EQUIPE: readonly Cargo[] = ['BA-CE', 'BA-LR'];
const CARGOS_VISUALIZAM_ARQUIVO: readonly Cargo[] = ['BA-CE', 'BA-LR'];
const CARGOS_VISUALIZAM_CERTIFICACOES: readonly Cargo[] = ['BA-CE', 'BA-LR'];

export type CadastroModuloRestrito = 'equipamentos' | 'viaturas' | 'extintores' | 'agentesExtintores' | 'hidrantes';

export type AuthUserPermissao = {
  role?: string;
  name?: string;
  username?: string;
  pessoa?: {
    id?: string;
    nomeGuerra?: string;
    personType?: string;
    funcao?: string;
    equipe?: string;
  };
} | null;

export interface ContextoOperacionalPermissao {
  equipe: Equipe | null;
  cargo: string | null;
  canManageGlobal: boolean;
  isAdministradorSistema: boolean;
  bombeiroId: string | null;
}

export function isAdministradorSistema(user: AuthUserPermissao): boolean {
  return user?.role === 'desenvolvedor' || user?.role === 'admin';
}

export function isGSBase(user: AuthUserPermissao): boolean {
  return user?.pessoa?.personType === 'bombeiro' && user.pessoa.funcao === 'GS';
}

export function podeVerCadastroCompletoBase(user: AuthUserPermissao): boolean {
  return isAdministradorSistema(user) || isGSBase(user);
}

export function podeVerDadosPessoaisBase(user: AuthUserPermissao): boolean {
  return podeVerCadastroCompletoBase(user);
}

export function podeVerArquivoBase(user: AuthUserPermissao): boolean {
  if (podeVerCadastroCompletoBase(user)) return true;
  const cargo = user?.pessoa?.personType === 'bombeiro' ? user.pessoa.funcao : null;
  return CARGOS_VISUALIZAM_ARQUIVO.includes(cargo as Cargo);
}

export function podeVerCertificacoesBase(user: AuthUserPermissao): boolean {
  if (podeVerCadastroCompletoBase(user)) return true;
  const cargo = user?.pessoa?.personType === 'bombeiro' ? user.pessoa.funcao : null;
  return CARGOS_VISUALIZAM_CERTIFICACOES.includes(cargo as Cargo);
}

function equipeValida(equipe: string | undefined | null): Equipe | null {
  return equipe && (EQUIPES as readonly string[]).includes(equipe) ? equipe as Equipe : null;
}

function contextoBase(user: AuthUserPermissao): ContextoOperacionalPermissao {
  const admin = isAdministradorSistema(user);
  return {
    equipe: equipeValida(user?.pessoa?.equipe),
    cargo: user?.pessoa?.funcao || null,
    canManageGlobal: admin || isGSBase(user),
    isAdministradorSistema: admin,
    bombeiroId: user?.pessoa?.personType === 'bombeiro' ? user.pessoa.id || null : null,
  };
}

async function resolverBombeiroVinculado(user: AuthUserPermissao): Promise<Bombeiro | null> {
  if (!user || user.pessoa?.personType !== 'bombeiro') return null;

  const pessoaId = user.pessoa?.id;
  if (pessoaId) {
    try {
      return await obterBombeiro(pessoaId);
    } catch {
      // Continua para fallback por nome/equipe.
    }
  }

  try {
    const equipeBase = equipeValida(user.pessoa?.equipe);
    const ativos = equipeBase ? await listarAtivos({ equipe: equipeBase }) : await listarAtivos();
    return ativos.find(b =>
      b.id === pessoaId ||
      b.nomeCompleto === user.name ||
      b.nomeGuerra === user.pessoa?.nomeGuerra
    ) || null;
  } catch {
    return null;
  }
}

export async function resolverContextoOperacional(user: AuthUserPermissao): Promise<ContextoOperacionalPermissao> {
  const base = contextoBase(user);

  if (!user || base.isAdministradorSistema || user.pessoa?.personType !== 'bombeiro') {
    return base;
  }

  const bombeiro = await resolverBombeiroVinculado(user);
  if (!bombeiro) return base;

  const hoje = new Date().toISOString().split('T')[0];
  try {
    const vigencias = await listarVigencias({
      ativa: true,
      substitutoId: bombeiro.id,
      dataInicio: hoje,
      dataFim: hoje,
    });

    const vigenciaAtual = vigencias.find(v =>
      v.substitutoId !== v.funcionarioOriginalId &&
      v.dataInicio <= hoje &&
      hoje <= v.dataFim
    );

    const cargoEfetivo = vigenciaAtual?.cargoExercido || bombeiro.cargo;
    const equipeEfetiva = equipeValida(vigenciaAtual?.equipe) || bombeiro.equipe;

    return {
      equipe: equipeEfetiva,
      cargo: cargoEfetivo,
      canManageGlobal: cargoEfetivo === 'GS',
      isAdministradorSistema: false,
      bombeiroId: bombeiro.id,
    };
  } catch {
    return {
      equipe: bombeiro.equipe,
      cargo: bombeiro.cargo,
      canManageGlobal: bombeiro.cargo === 'GS',
      isAdministradorSistema: false,
      bombeiroId: bombeiro.id,
    };
  }
}

export function canGerenciarCadastroModulo(
  contexto: ContextoOperacionalPermissao,
  modulo: CadastroModuloRestrito,
): boolean {
  if (contexto.isAdministradorSistema || contexto.canManageGlobal) return true;
  if (!contexto.cargo || !CARGOS_RESPONSAVEIS_EQUIPE.includes(contexto.cargo as Cargo)) return false;

  if (modulo === 'equipamentos' || modulo === 'viaturas') {
    return contexto.equipe === 'Bravo';
  }

  return contexto.equipe === 'Alfa';
}

export function canAcessarDadosPessoais(contexto: ContextoOperacionalPermissao): boolean {
  return contexto.isAdministradorSistema || contexto.canManageGlobal;
}

export function canGerenciarEquipe(
  contexto: ContextoOperacionalPermissao,
  equipe?: string | null,
): boolean {
  if (canAcessarDadosPessoais(contexto)) return true;
  return !!contexto.equipe && !!equipe && contexto.equipe === equipe;
}

export function canCriarNaEquipe(
  contexto: ContextoOperacionalPermissao,
  equipe?: string | null,
): boolean {
  return canGerenciarEquipe(contexto, equipe);
}

export function podeVerRelatoriosBase(user: AuthUserPermissao): boolean {
  if (podeVerDadosPessoaisBase(user)) return true;
  return (
    user?.pessoa?.personType === 'bombeiro' &&
    user.pessoa.funcao === 'BA-LR' &&
    user.pessoa.equipe === 'Delta'
  );
}

export function canVisualizarRelatorios(contexto: ContextoOperacionalPermissao): boolean {
  if (canAcessarDadosPessoais(contexto)) return true;
  return contexto.cargo === 'BA-LR' && contexto.equipe === 'Delta';
}

export function canGerenciarArquivo(contexto: ContextoOperacionalPermissao): boolean {
  return canAcessarDadosPessoais(contexto);
}

export function canVisualizarArquivo(contexto: ContextoOperacionalPermissao): boolean {
  if (canGerenciarArquivo(contexto)) return true;
  return CARGOS_VISUALIZAM_ARQUIVO.includes(contexto.cargo as Cargo);
}

export function canGerenciarCertificacoes(contexto: ContextoOperacionalPermissao): boolean {
  return canAcessarDadosPessoais(contexto);
}

export function canVisualizarCertificacoes(contexto: ContextoOperacionalPermissao): boolean {
  if (canGerenciarCertificacoes(contexto)) return true;
  return CARGOS_VISUALIZAM_CERTIFICACOES.includes(contexto.cargo as Cargo);
}

export function equipeEscopoCertificacoes(contexto: ContextoOperacionalPermissao): Equipe | null {
  if (canGerenciarCertificacoes(contexto)) return null;
  return canVisualizarCertificacoes(contexto) ? contexto.equipe : null;
}

/**
 * Registos Diários (PTR-BA, LRO, Ocorrências)
 * - admin/dev: criam/gerem qualquer equipe
 * - GS: apenas visualiza (não cria/altera)
 * - BA-CE/BA-LR: podem criar em qualquer equipe (trocas de plantão), mas só alteram
 *   os registos que eles próprios criaram; o BA-LR também pode alterar os registos
 *   criados pelo BA-CE (chefe) da equipe do registo
 * - demais cargos: apenas visualizam
 */

export function canCriarRegistrosDiarios(contexto: ContextoOperacionalPermissao): boolean {
  if (contexto.isAdministradorSistema) return true;
  if (contexto.cargo === 'GS') return false;
  return contexto.cargo === 'BA-CE' || contexto.cargo === 'BA-LR';
}

function nomeIgual(username: string | null | undefined, criadoPor: string | null | undefined): boolean {
  const a = String(username || '').trim().toLowerCase();
  const b = String(criadoPor || '').trim().toLowerCase();
  return !!a && !!b && a === b;
}

function chefesDaEquipe(
  bombeiros: { nomeGuerra?: string; nomeCompleto?: string; email?: string; cargo?: string; equipe?: string }[],
  equipe?: string | null,
): { nomeGuerra?: string; nomeCompleto?: string; email?: string }[] {
  return (bombeiros || []).filter(b =>
    b.cargo === 'BA-CE' && (!equipe || b.equipe === equipe)
  );
}

export function canGerenciarRegistroDiario(
  contexto: ContextoOperacionalPermissao,
  registro: { createdBy?: string | null; equipe?: string | null },
  username: string | null | undefined,
  bombeiros?: { nomeGuerra?: string; nomeCompleto?: string; email?: string; cargo?: string; equipe?: string }[],
): boolean {
  if (contexto.isAdministradorSistema) return true;
  if (contexto.cargo === 'GS') return false;
  if (contexto.cargo !== 'BA-CE' && contexto.cargo !== 'BA-LR') return false;

  if (nomeIgual(username, registro.createdBy)) return true;

  if (contexto.cargo === 'BA-LR') {
    return chefesDaEquipe(bombeiros, registro.equipe).some(c =>
      nomeIgual(c.nomeGuerra, registro.createdBy) ||
      nomeIgual(c.nomeCompleto, registro.createdBy) ||
      nomeIgual(c.email, registro.createdBy)
    );
  }

  return false;
}
