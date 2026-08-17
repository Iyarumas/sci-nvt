import type { AtivoItem } from '../components/ui/SearchSelect';
import type { Bombeiro } from '../types/bombeiro';
import type { DocumentFill } from '../types/document';
import type { FeriasGozo } from '../types/ferias';
import type { VigenciaSubstituicao } from '../services/vigenciaSubstituicaoService';
import { estaNoPeriodoISO, mesmoDiaISO } from './datas';

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

export function montarEfetivoOperacional(params: {
  bombeiros: Bombeiro[];
  feriasGozo: FeriasGozo[];
  vigencias: VigenciaSubstituicao[];
  trocaFills: DocumentFill[];
  equipe: string;
  dataPlantao: string;
}): EfetivoOperacionalEntry[] {
  const { bombeiros, feriasGozo, vigencias, trocaFills, equipe, dataPlantao } = params;
  if (!equipe || !dataPlantao) return [];

  const ativos = bombeiros.filter(b => !b.dataDesligamento);
  const porId = new Map(ativos.map(b => [b.id, b]));
  const porNome = new Map<string, Bombeiro>();
  ativos.forEach(b => {
    if (b.nomeCompleto) porNome.set(nomeKey(b.nomeCompleto), b);
    if (b.nomeGuerra) porNome.set(nomeKey(b.nomeGuerra), b);
  });

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

  const trocasNoDia = (trocaFills || []).filter(fl => {
    const fd = fl?.filled_data || {};
    return (mesmoDiaISO(fd?.data_solicitada, dataPlantao) || mesmoDiaISO(fd?.data_folga_solicitado, dataPlantao)) &&
      fd?.nome_solicitante &&
      fd?.nome_solicitado;
  });
  const trocaExcluidos = new Set<string>();
  const trocaIncluidos: EfetivoOperacionalEntry[] = [];
  for (const fl of trocasNoDia) {
    const fd = fl.filled_data || {};
    const solicitante = porNome.get(nomeKey(fd.nome_solicitante));
    const solicitado = porNome.get(nomeKey(fd.nome_solicitado));
    if (!solicitante || !solicitado) continue;

    if (mesmoDiaISO(fd.data_solicitada, dataPlantao) && solicitante.equipe === equipe) {
      trocaExcluidos.add(solicitante.id);
      trocaExcluidos.add(solicitado.id);
      trocaIncluidos.push({
        bombeiro: solicitado,
        cargoExercido: solicitante.cargo,
        substituindo: { id: solicitante.id, nome: solicitante.nomeCompleto, cargo: solicitante.cargo },
      });
    }

    if (mesmoDiaISO(fd.data_folga_solicitado, dataPlantao) && solicitado.equipe === equipe) {
      trocaExcluidos.add(solicitante.id);
      trocaExcluidos.add(solicitado.id);
      trocaIncluidos.push({
        bombeiro: solicitante,
        cargoExercido: solicitado.cargo,
        substituindo: { id: solicitado.id, nome: solicitado.nomeCompleto, cargo: solicitado.cargo },
      });
    }
  }

  const gozosNoDia = feriasGozo.filter(g =>
    g.status !== 'Gozadas' &&
    estaNoPeriodoISO(dataPlantao, g.dataInicio, g.dataFim)
  );
  const emGozo = new Set(gozosNoDia.map(g => g.funcionarioId));
  const vagasAbertas = new Set(vigenciasAuto.map(v => v.funcionarioOriginalId));

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
      trocaExcluidos.has(membro.id)
    ) {
      continue;
    }
    adicionar(membro, membro.cargo);
  }

  for (const v of vigenciasReais) {
    const substituto = porId.get(v.substitutoId);
    if (!substituto) continue;
    adicionar(substituto, v.cargoExercido || substituto.cargo, {
      id: v.funcionarioOriginalId,
      nome: v.funcionarioOriginalNome,
      cargo: v.cargoOriginalFuncionario,
    });
  }

  for (const troca of trocaIncluidos) {
    adicionar(troca.bombeiro, troca.cargoExercido, troca.substituindo);
  }

  for (const fallback of fallbackPorSubstituto.values()) {
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
