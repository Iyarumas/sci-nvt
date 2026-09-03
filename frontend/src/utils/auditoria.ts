import type { Bombeiro } from '../types/bombeiro';
import type { VigenciaSubstituicao } from '../services/vigenciaSubstituicaoService';
import { estaNoPeriodoISO, formatarDataBR, normalizarDataISO } from './datas';

export type PessoaAuditoria = Partial<Pick<Bombeiro, 'id' | 'matricula' | 'nome' | 'nomeCompleto' | 'nomeGuerra' | 'email'>> & {
  cargo?: string;
  equipe?: string;
  username?: string;
  cargoFixo?: string;
};

export type UsuarioAuditoria = {
  id?: string;
  username?: string;
  name?: string;
  personId?: string;
  personType?: string;
};

export type RegistroAuditavel = {
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
  status?: string;
  aprovadoEm?: string;
};

export type OpcoesPessoasAuditoria = {
  vigencias?: VigenciaSubstituicao[];
  dataReferencia?: unknown;
  equipeReferencia?: string | null;
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

function mesmoValor(a: unknown, b: unknown): boolean {
  const na = normalizar(a);
  const nb = normalizar(b);
  return !!na && !!nb && na === nb;
}

function equipeDaVaga(vigencia: VigenciaSubstituicao, bombeirosPorId: Map<string, PessoaAuditoria>): string {
  const original = bombeirosPorId.get(vigencia.funcionarioOriginalId);
  return original?.equipe || vigencia.equipe || '';
}

function vigenciaEfetivaPessoa(
  pessoa: PessoaAuditoria,
  opcoes: OpcoesPessoasAuditoria | undefined,
  bombeirosPorId: Map<string, PessoaAuditoria>,
): VigenciaSubstituicao | undefined {
  const dataReferencia = normalizarDataISO(opcoes?.dataReferencia);
  if (!dataReferencia || !pessoa.id) return undefined;

  const candidatas = (opcoes?.vigencias || []).filter(vigencia =>
    vigencia.ativa &&
    vigencia.substitutoId === pessoa.id &&
    vigencia.substitutoId !== vigencia.funcionarioOriginalId &&
    estaNoPeriodoISO(dataReferencia, vigencia.dataInicio, vigencia.dataFim)
  );
  if (candidatas.length === 0) return undefined;

  const equipeReferencia = normalizar(opcoes?.equipeReferencia);
  const candidatasDaEquipe = equipeReferencia
    ? candidatas.filter(vigencia =>
        normalizar(equipeDaVaga(vigencia, bombeirosPorId)) === equipeReferencia ||
        normalizar(vigencia.equipe) === equipeReferencia
      )
    : candidatas;

  const candidatasValidas = candidatasDaEquipe.length > 0 ? candidatasDaEquipe : candidatas;
  return [...candidatasValidas].sort((a, b) => a.nivelCascata - b.nivelCascata)[0];
}

function aplicarFuncaoEfetiva(
  pessoa: PessoaAuditoria,
  opcoes: OpcoesPessoasAuditoria | undefined,
  bombeirosPorId: Map<string, PessoaAuditoria>,
): PessoaAuditoria {
  const vigencia = vigenciaEfetivaPessoa(pessoa, opcoes, bombeirosPorId);
  if (!vigencia) return pessoa;

  return {
    ...pessoa,
    cargoFixo: pessoa.cargo,
    cargo: vigencia.cargoExercido || pessoa.cargo,
    equipe: equipeDaVaga(vigencia, bombeirosPorId) || pessoa.equipe,
  };
}

function buscarBombeiroParaUsuario(usuario: UsuarioAuditoria, bombeiros: PessoaAuditoria[]): PessoaAuditoria | undefined {
  if (usuario.personType === 'bombeiro' && usuario.personId) {
    const vinculado = bombeiros.find(b => mesmoValor(b.id, usuario.personId));
    if (vinculado) return vinculado;
  }

  return bombeiros.find(b =>
    mesmoValor(b.nomeCompleto, usuario.name) ||
    mesmoValor(b.nomeGuerra, usuario.name) ||
    mesmoValor(b.nome, usuario.name) ||
    mesmoValor(b.email, usuario.username)
  );
}

export function montarPessoasAuditoria(
  bombeiros: PessoaAuditoria[] = [],
  usuarios: UsuarioAuditoria[] = [],
  opcoes?: OpcoesPessoasAuditoria,
): PessoaAuditoria[] {
  const bombeirosPorId = new Map(bombeiros.filter(b => b.id).map(b => [b.id as string, b]));
  const bombeirosComFuncaoEfetiva = bombeiros.map(bombeiro => aplicarFuncaoEfetiva(bombeiro, opcoes, bombeirosPorId));
  const pessoas: PessoaAuditoria[] = [...bombeirosComFuncaoEfetiva];

  usuarios.forEach(usuario => {
    if (!usuario.username) return;
    const pessoaVinculada = buscarBombeiroParaUsuario(usuario, bombeirosComFuncaoEfetiva);

    if (pessoaVinculada) {
      pessoas.push({
        ...pessoaVinculada,
        username: usuario.username,
        nome: usuario.name || pessoaVinculada.nome || pessoaVinculada.nomeCompleto,
      });
      return;
    }

    pessoas.push({
      id: usuario.id,
      matricula: '',
      nome: usuario.name || usuario.username,
      nomeCompleto: usuario.name || usuario.username,
      nomeGuerra: usuario.name || usuario.username,
      email: '',
      username: usuario.username,
    });
  });

  return pessoas;
}

export function formatarUsuarioAuditoria(value: unknown, pessoas: PessoaAuditoria[] = []): string {
  const raw = String(value || '').trim();
  const alvo = normalizar(raw);
  if (!alvo) return 'Não informado';

  const pessoa =
    pessoas.find(p => normalizar(p.username) === alvo) ||
    pessoas.find(p =>
      normalizar(p.id) === alvo ||
      normalizar(p.matricula) === alvo ||
      normalizar(p.email) === alvo
    ) ||
    pessoas.find(p =>
      normalizar(p.nomeGuerra) === alvo ||
      normalizar(p.nomeCompleto) === alvo ||
      normalizar(p.nome) === alvo
    );

  if (!pessoa) return raw;
  const nome = pessoa.nomeGuerra || pessoa.nomeCompleto || pessoa.nome || raw;
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
