import type { Bombeiro } from '../types/bombeiro';
import type { FeriasGozo } from '../types/ferias';
import type { VigenciaSubstituicao } from '../services/vigenciaSubstituicaoService';
import { estaNoPeriodoISO, hojeLocalISO, normalizarDataISO } from './datas';

export interface EfetivoMensalEntry {
  bombeiro: Bombeiro;
  cargoExercido: string;
  equipeEfetiva: string;
  substituindo?: {
    id: string;
    nome: string;
    cargo: string;
  };
}

/** Data usada no formulário; os plantões gerados resolvem seu próprio efetivo. */
export function dataReferenciaEfetivoMensal(mes: number, ano: number, hoje = hojeLocalISO()): string {
  const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const dataAtual = normalizarDataISO(hoje);
  return dataAtual.slice(0, 7) === inicioMes.slice(0, 7) ? dataAtual : inicioMes;
}

export function montarEfetivoMensal(params: {
  bombeiros: Bombeiro[];
  feriasGozo: FeriasGozo[];
  vigencias: VigenciaSubstituicao[];
  equipe: string;
  mes: number;
  ano: number;
  dataReferencia?: string;
}): EfetivoMensalEntry[] {
  const { bombeiros, feriasGozo, vigencias, equipe, mes, ano } = params;
  if (!equipe) return [];

  const dataReferencia = params.dataReferencia ?? dataReferenciaEfetivoMensal(mes, ano);
  const ativos = bombeiros.filter(b => !b.dataDesligamento);
  const porId = new Map(ativos.map(b => [b.id, b]));

  const equipeDaVaga = (v: VigenciaSubstituicao): string => {
    const original = porId.get(v.funcionarioOriginalId);
    return original?.equipe || v.equipe;
  };

  const vigenciasNoDia = vigencias.filter(v =>
    v.ativa &&
    estaNoPeriodoISO(dataReferencia, v.dataInicio, v.dataFim) &&
    equipeDaVaga(v) === equipe
  );
  const vigenciasReais = vigenciasNoDia.filter(v => v.substitutoId && v.substitutoId !== v.funcionarioOriginalId);
  const vigenciasAuto = vigenciasNoDia.filter(v => v.substitutoId && v.substitutoId === v.funcionarioOriginalId);

  const realPorOriginal = new Map<string, VigenciaSubstituicao>();
  const realPorSubstituto = new Map<string, VigenciaSubstituicao>();
  for (const v of vigenciasReais) {
    realPorOriginal.set(v.funcionarioOriginalId, v);
    realPorSubstituto.set(v.substitutoId, v);
  }

  const vagasAbertas = new Set(vigenciasAuto.map(v => v.funcionarioOriginalId));
  // "Gozadas" descreve o estado de hoje; no histórico vale o período real.
  const gozosNoDia = feriasGozo.filter(g =>
    estaNoPeriodoISO(dataReferencia, g.dataInicio, g.dataFim)
  );
  const emGozo = new Set(gozosNoDia.map(g => g.funcionarioId));

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

  const resultado: EfetivoMensalEntry[] = [];
  const adicionados = new Set<string>();

  const adicionar = (bombeiro: Bombeiro, cargoExercido: string, substituindo?: EfetivoMensalEntry['substituindo']) => {
    if (adicionados.has(bombeiro.id)) return;
    resultado.push({ bombeiro, cargoExercido, equipeEfetiva: equipe, substituindo });
    adicionados.add(bombeiro.id);
  };

  const membrosEquipe = ativos.filter(b => b.equipe === equipe);
  for (const membro of membrosEquipe) {
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

    if (emGozo.has(membro.id) || realPorOriginal.has(membro.id) || fallbackPorOriginal.has(membro.id) || vagasAbertas.has(membro.id)) {
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
