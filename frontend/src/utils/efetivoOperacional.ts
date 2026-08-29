import type { AtivoItem } from '../components/ui/SearchSelect';
import type { Bombeiro } from '../types/bombeiro';
import type { DocumentFill } from '../types/document';
import type { TrocaSlot } from '../types/escala';
import type { FeriasGozo } from '../types/ferias';
import type { SubstituicaoTemporaria } from '../types/substituicaoTemporaria';
import type { VigenciaSubstituicao } from '../services/vigenciaSubstituicaoService';
import { estaNoPeriodoISO, mesmoDiaISO, parseDataLocalISO } from './datas';
import { equipeEstaNoPlantao } from './equipes';

export interface EfetivoOperacionalEntry {
  bombeiro: Bombeiro;
  cargoExercido: string;
  substituindo?: {
    id: string;
    nome: string;
    cargo: string;
  };
}

function nomeKey(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function cargoCampo(value: unknown): string {
  return String(value || '').split(' - ')[0].trim();
}

function pessoaPorNome(porNome: Map<string, Bombeiro>, nome: unknown): Bombeiro | undefined {
  return porNome.get(nomeKey(nome));
}

interface TrocaServicoResolvida {
  saindo: Bombeiro;
  entrando: Bombeiro;
  funcaoSaindo: string;
  funcaoEntrando: string;
}

interface ExtraAfastamentoResolvido {
  ausente: Bombeiro;
  substituto: Bombeiro;
  cargoAusente: string;
  cargoExercido: string;
  equipePlantao: string;
}

interface AfastamentoResolvido {
  ausente: Bombeiro;
  cargoAusente: string;
  equipePlantao: string;
}

function montarTrocasServicoResolvidas(params: {
  bombeiros: Bombeiro[];
  trocaFills: DocumentFill[];
  equipe: string;
  dataPlantao: string;
}): TrocaServicoResolvida[] {
  const { bombeiros, trocaFills, equipe, dataPlantao } = params;
  if (!equipe || !dataPlantao) return [];

  const ativos = bombeiros.filter(b => !b.dataDesligamento);
  const porNome = new Map<string, Bombeiro>();
  ativos.forEach(b => {
    if (b.nomeCompleto) porNome.set(nomeKey(b.nomeCompleto), b);
    if (b.nomeGuerra) porNome.set(nomeKey(b.nomeGuerra), b);
  });

  const result: TrocaServicoResolvida[] = [];
  const usados = new Set<string>();

  for (const fill of trocaFills || []) {
    if (fill.status && fill.status !== 'signed') continue;
    const fd = fill.filled_data || {};
    const solicitante = pessoaPorNome(porNome, fd.nome_solicitante);
    const solicitado = pessoaPorNome(porNome, fd.nome_solicitado);
    if (!solicitante || !solicitado) continue;

    const add = (saindo: Bombeiro, entrando: Bombeiro, funcaoSaindo: unknown, funcaoEntrando: unknown) => {
      if (saindo.equipe !== equipe) return;
      const chave = `${fill.id}:${saindo.id}:${entrando.id}`;
      if (usados.has(chave)) return;
      usados.add(chave);
      result.push({
        saindo,
        entrando,
        funcaoSaindo: saindo.cargo || cargoCampo(funcaoSaindo),
        funcaoEntrando: entrando.cargo || cargoCampo(funcaoEntrando),
      });
    };

    if (mesmoDiaISO(fd.data_solicitada, dataPlantao)) {
      add(solicitante, solicitado, fd.funcao_solicitante, fd.funcao_solicitado);
    }
    if (mesmoDiaISO(fd.data_folga_solicitado, dataPlantao)) {
      add(solicitado, solicitante, fd.funcao_solicitado, fd.funcao_solicitante);
    }
  }

  return result;
}

export function montarTrocasServicoDoDia(params: {
  bombeiros: Bombeiro[];
  trocaFills: DocumentFill[];
  equipe: string;
  dataPlantao: string;
}): TrocaSlot[] {
  return montarTrocasServicoResolvidas(params).map(troca => ({
    funcaoSaindo: troca.funcaoSaindo,
    nomeSaindo: troca.saindo.nomeCompleto || troca.saindo.nomeGuerra,
    funcaoEntrando: troca.funcaoEntrando,
    nomeEntrando: troca.entrando.nomeCompleto || troca.entrando.nomeGuerra,
  }));
}

export function montarEfetivoOperacional(params: {
  bombeiros: Bombeiro[];
  feriasGozo: FeriasGozo[];
  vigencias: VigenciaSubstituicao[];
  trocaFills: DocumentFill[];
  substituicoesTemporarias?: SubstituicaoTemporaria[];
  equipe: string;
  dataPlantao: string;
}): EfetivoOperacionalEntry[] {
  const { bombeiros, feriasGozo, vigencias, trocaFills, substituicoesTemporarias = [], equipe, dataPlantao } = params;
  if (!equipe || !dataPlantao) return [];

  const ativos = bombeiros.filter(b => !b.dataDesligamento);
  const porId = new Map(ativos.map(b => [b.id, b]));

  const equipeDaVaga = (v: VigenciaSubstituicao): string => {
    const original = porId.get(v.funcionarioOriginalId);
    return original?.equipe || v.equipe;
  };

  const vigenciasNoDia = vigencias.filter(v =>
    v.ativa &&
    v.substitutoId &&
    estaNoPeriodoISO(dataPlantao, v.dataInicio, v.dataFim) &&
    equipeDaVaga(v) === equipe
  );
  const vigenciasReais = vigenciasNoDia.filter(v => v.substitutoId !== v.funcionarioOriginalId);
  const vigenciasAuto = vigenciasNoDia.filter(v => v.substitutoId === v.funcionarioOriginalId);
  const realPorOriginal = new Map<string, VigenciaSubstituicao>();
  const realPorSubstituto = new Map<string, VigenciaSubstituicao>();
  for (const v of vigenciasReais) {
    realPorOriginal.set(v.funcionarioOriginalId, v);
    realPorSubstituto.set(v.substitutoId, v);
  }

  const trocaExcluidos = new Set<string>();
  const trocaIncluidos: EfetivoOperacionalEntry[] = [];
  for (const troca of montarTrocasServicoResolvidas({ bombeiros: ativos, trocaFills, equipe, dataPlantao })) {
    trocaExcluidos.add(troca.saindo.id);
    trocaExcluidos.add(troca.entrando.id);
    trocaIncluidos.push({
      bombeiro: troca.entrando,
      cargoExercido: troca.funcaoSaindo || troca.saindo.cargo,
      substituindo: {
        id: troca.saindo.id,
        nome: troca.saindo.nomeCompleto,
        cargo: troca.funcaoSaindo || troca.saindo.cargo,
      },
    });
  }

  const gozosNoDia = feriasGozo.filter(g =>
    g.status !== 'Gozadas' &&
    estaNoPeriodoISO(dataPlantao, g.dataInicio, g.dataFim)
  );
  const emGozo = new Set(gozosNoDia.map(g => g.funcionarioId));
  const vagasAbertas = new Set(vigenciasAuto.map(v => v.funcionarioOriginalId));

  const extrasAfastamento = montarExtrasAfastamentoResolvidos({
    substituicoes: substituicoesTemporarias,
    porId,
    vigencias,
    equipe,
    dataPlantao,
  });
  const afastamentosNoPlantao = montarAfastamentosResolvidos({
    substituicoes: substituicoesTemporarias,
    porId,
    vigencias,
    equipe,
    dataPlantao,
  });
  const extraAfastados = new Set(extrasAfastamento.map(extra => extra.ausente.id));
  const extraSubstitutos = new Set(extrasAfastamento.map(extra => extra.substituto.id));
  const afastadosTemporarios = new Set(afastamentosNoPlantao.map(afastamento => afastamento.ausente.id));

  const fallbackPorOriginal = new Map<string, { substituto: Bombeiro; cargo: string; original: Bombeiro }>();
  const fallbackPorSubstituto = new Map<string, { substituto: Bombeiro; cargo: string; original: Bombeiro }>();
  for (const gozo of gozosNoDia) {
    if (realPorOriginal.has(gozo.funcionarioId)) continue;
    const original = porId.get(gozo.funcionarioId);
    const substituto = gozo.substitutoId ? porId.get(gozo.substitutoId) : undefined;
    if (!original || !substituto) continue;
    if ((original.equipe || gozo.equipe) !== equipe) continue;
    const fallback = {
      substituto,
      cargo: gozo.funcaoSubstituicao || original.cargo,
      original,
    };
    fallbackPorOriginal.set(original.id, fallback);
    fallbackPorSubstituto.set(substituto.id, fallback);
  }

  const resultado: EfetivoOperacionalEntry[] = [];
  const adicionados = new Set<string>();
  const adicionar = (bombeiro: Bombeiro, cargoExercido: string, substituindo?: EfetivoOperacionalEntry['substituindo']) => {
    if (adicionados.has(bombeiro.id)) return;
    resultado.push({ bombeiro, cargoExercido, substituindo });
    adicionados.add(bombeiro.id);
  };

  for (const membro of ativos.filter(b => b.equipe === equipe)) {
    if (
      afastadosTemporarios.has(membro.id) ||
      extraAfastados.has(membro.id) ||
      extraSubstitutos.has(membro.id)
    ) {
      continue;
    }

    const substitui = realPorSubstituto.get(membro.id);
    const fallbackSubstitui = fallbackPorSubstituto.get(membro.id);
    if (substitui) {
      adicionar(membro, substitui.cargoExercido || membro.cargo, {
        id: substitui.funcionarioOriginalId,
        nome: substitui.funcionarioOriginalNome,
        cargo: substitui.cargoOriginalFuncionario,
      });
      continue;
    }
    if (fallbackSubstitui) {
      adicionar(membro, fallbackSubstitui.cargo, {
        id: fallbackSubstitui.original.id,
        nome: fallbackSubstitui.original.nomeCompleto,
        cargo: fallbackSubstitui.original.cargo,
      });
      continue;
    }
    if (
      emGozo.has(membro.id) ||
      realPorOriginal.has(membro.id) ||
      fallbackPorOriginal.has(membro.id) ||
      vagasAbertas.has(membro.id) ||
      trocaExcluidos.has(membro.id) ||
      afastadosTemporarios.has(membro.id) ||
      extraAfastados.has(membro.id) ||
      extraSubstitutos.has(membro.id)
    ) {
      continue;
    }
    adicionar(membro, membro.cargo);
  }

  for (const extra of extrasAfastamento) {
    adicionar(extra.substituto, extra.cargoExercido || extra.substituto.cargo, {
      id: extra.ausente.id,
      nome: extra.ausente.nomeCompleto,
      cargo: extra.cargoAusente || extra.ausente.cargo,
    });
  }

  for (const v of vigenciasReais) {
    if (afastadosTemporarios.has(v.substitutoId)) continue;
    if (extraSubstitutos.has(v.substitutoId)) continue;
    const substituto = porId.get(v.substitutoId);
    if (!substituto) continue;
    adicionar(substituto, v.cargoExercido || substituto.cargo, {
      id: v.funcionarioOriginalId,
      nome: v.funcionarioOriginalNome,
      cargo: v.cargoOriginalFuncionario,
    });
  }

  for (const troca of trocaIncluidos) {
    if (afastadosTemporarios.has(troca.bombeiro.id)) continue;
    if (extraSubstitutos.has(troca.bombeiro.id)) continue;
    adicionar(troca.bombeiro, troca.cargoExercido, troca.substituindo);
  }

  for (const fallback of fallbackPorSubstituto.values()) {
    if (afastadosTemporarios.has(fallback.substituto.id)) continue;
    if (extraSubstitutos.has(fallback.substituto.id)) continue;
    adicionar(fallback.substituto, fallback.cargo, {
      id: fallback.original.id,
      nome: fallback.original.nomeCompleto,
      cargo: fallback.original.cargo,
    });
  }

  const ordemCargo = ['GS', 'BA-CE', 'BA-LR', 'BA-MC', 'BA-2', 'BA-RE', 'OC'];
  return resultado.sort((a, b) => {
    const cargoA = ordemCargo.indexOf(a.cargoExercido);
    const cargoB = ordemCargo.indexOf(b.cargoExercido);
    if (cargoA !== cargoB) return cargoA - cargoB;
    return a.bombeiro.nomeGuerra.localeCompare(b.bombeiro.nomeGuerra);
  });
}

export function montarOpcoesEfetivoOperacional(efetivo: EfetivoOperacionalEntry[], equipe: string): AtivoItem[] {
  return efetivo.map(entry => ({
    id: entry.bombeiro.id,
    nomeGuerra: entry.bombeiro.nomeGuerra,
    nomeCompleto: entry.bombeiro.equipe === equipe
      ? entry.bombeiro.nomeCompleto
      : `${entry.bombeiro.nomeCompleto} (${entry.bombeiro.equipe})`,
    cargo: entry.cargoExercido,
    equipe,
  }));
}

function contextoAfastamentoNoPlantao(params: {
  sub: SubstituicaoTemporaria;
  porId: Map<string, Bombeiro>;
  vigencias: VigenciaSubstituicao[];
  dataPlantao: string;
}): AfastamentoResolvido | null {
  const { sub, porId, vigencias, dataPlantao } = params;
  const ausente = porId.get(sub.funcionarioId);
  if (!ausente) return null;

  const vigencia = vigencias.find(v =>
    v.ativa &&
    v.substitutoId === sub.funcionarioId &&
    v.substitutoId !== v.funcionarioOriginalId &&
    estaNoPeriodoISO(dataPlantao, v.dataInicio, v.dataFim)
  );
  const originalVigencia = vigencia ? porId.get(vigencia.funcionarioOriginalId) : undefined;

  return {
    ausente,
    cargoAusente: vigencia?.cargoExercido || sub.funcionarioCargo || ausente.cargo,
    equipePlantao: originalVigencia?.equipe || vigencia?.equipe || ausente.equipe,
  };
}

function montarAfastamentosResolvidos(params: {
  substituicoes: SubstituicaoTemporaria[];
  porId: Map<string, Bombeiro>;
  vigencias: VigenciaSubstituicao[];
  equipe: string;
  dataPlantao: string;
}): AfastamentoResolvido[] {
  const { substituicoes, porId, vigencias, equipe, dataPlantao } = params;
  const data = parseDataLocalISO(dataPlantao);
  if (Number.isNaN(data.getTime()) || !equipeEstaNoPlantao(equipe, data)) return [];

  const afastamentos: AfastamentoResolvido[] = [];
  for (const sub of substituicoes) {
    if (sub.tipo !== 'Afastamento' || sub.status !== 'Aprovada') continue;
    if (!estaNoPeriodoISO(dataPlantao, sub.dataInicio, sub.dataFim)) continue;
    const contexto = contextoAfastamentoNoPlantao({ sub, porId, vigencias, dataPlantao });
    if (!contexto || contexto.equipePlantao !== equipe) continue;
    afastamentos.push(contexto);
  }
  return afastamentos;
}

function montarExtrasAfastamentoResolvidos(params: {
  substituicoes: SubstituicaoTemporaria[];
  porId: Map<string, Bombeiro>;
  vigencias: VigenciaSubstituicao[];
  equipe: string;
  dataPlantao: string;
}): ExtraAfastamentoResolvido[] {
  const { substituicoes, porId, vigencias, equipe, dataPlantao } = params;
  const data = parseDataLocalISO(dataPlantao);
  if (Number.isNaN(data.getTime()) || !equipeEstaNoPlantao(equipe, data)) return [];

  const extras: ExtraAfastamentoResolvido[] = [];
  for (const sub of substituicoes) {
    if (sub.tipo !== 'Afastamento' || sub.status !== 'Aprovada') continue;
    if (!estaNoPeriodoISO(dataPlantao, sub.dataInicio, sub.dataFim)) continue;
    for (const elo of sub.cadeiaSubstituicao || []) {
      if (elo.tipo !== 'extra') continue;
      if (!mesmoDiaISO(elo.dataPlantao || '', dataPlantao)) continue;

      const contexto = contextoAfastamentoNoPlantao({
        sub,
        porId,
        vigencias,
        dataPlantao: elo.dataPlantao || dataPlantao,
      });
      const equipePlantao = elo.equipePlantao || elo.funcionarioEquipe || contexto?.equipePlantao || '';
      if (equipePlantao && equipePlantao !== equipe) continue;

      const ausente = porId.get(elo.funcionarioId || sub.funcionarioId) || contexto?.ausente;
      const substituto = porId.get(elo.substitutoId || elo.pessoaId || sub.substitutoId);
      if (!ausente || !substituto || ausente.id === substituto.id) continue;

      extras.push({
        ausente,
        substituto,
        cargoAusente: elo.funcionarioCargo || contexto?.cargoAusente || sub.funcionarioCargo || ausente.cargo,
        cargoExercido: elo.cargoExercido || elo.cargoVacante || contexto?.cargoAusente || sub.funcionarioCargo || ausente.cargo,
        equipePlantao: equipePlantao || equipe,
      });
    }
  }
  return extras;
}
