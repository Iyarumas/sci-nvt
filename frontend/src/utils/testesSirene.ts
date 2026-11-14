import { atualizarOcorrencia, criarOcorrencia, listarOcorrencias } from '../services/ocorrenciaService';
import type { Ocorrencia } from '../types/ocorrencia';
import { dataSaidaPlantao, horarioPlantaoPorEquipe } from './equipes';
import { registroNoPlantao } from './plantaoRegistros';

/**
 * Testes de sirene do plantão (APOC ao assumir, TWR perto do fim). Cada teste vira UMA ocorrência do
 * plantão (LRO/Ocorrências), com a data do turno no campo "local" — assim vai sozinho para o LRO e para
 * as movimentações do fim de plantão. Corrigir atualiza a mesma ocorrência; não duplica.
 */
export type TipoTesteSirene = 'apoc' | 'twr';

export const TITULO_TESTE_SIRENE: Record<TipoTesteSirene, string> = {
  apoc: 'Teste sirene APOC',
  twr: 'Teste sirene TWR',
};

export const NAO_HOUVE = 'Não houve';

export interface EstadoTesteSirene {
  ocorrencia: Ocorrencia | null;
  hora: string;
  naoHouve: boolean;
}

const igual = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const QUEM: Record<TipoTesteSirene, RegExp> = { apoc: /\bapoc\b/i, twr: /\b(twr|torre)\b/i };

/**
 * O teste já lançado neste plantão. Primeiro o lançado pelo cartão (título padrão); senão, qualquer ocorrência
 * do plantão que fale de sirene + APOC ou sirene + TWR/torre (lançada à mão em LRO/Ocorrências) — assim não
 * vira pendente nem ganha um "Não houve" repetido.
 */
export function acharTesteSirene(ocorrencias: Ocorrencia[], tipo: TipoTesteSirene, equipe: string, dataPlantao: string): Ocorrencia | null {
  const doPlantao = ocorrencias.filter(o => registroNoPlantao({
    data: o.data, hora: o.hora, equipeRegistro: o.equipe, equipe, dataPlantao, dataTurno: o.local,
  }));
  return doPlantao.find(o => igual(o.titulo || '', TITULO_TESTE_SIRENE[tipo]))
    ?? doPlantao.find(o => {
      const texto = `${o.titulo || ''} ${o.descricao || ''}`;
      return /sirene/i.test(texto) && QUEM[tipo].test(texto);
    })
    ?? null;
}

export function estadoTesteSirene(ocorrencias: Ocorrencia[], tipo: TipoTesteSirene, equipe: string, dataPlantao: string): EstadoTesteSirene {
  const ocorrencia = acharTesteSirene(ocorrencias, tipo, equipe, dataPlantao);
  const naoHouve = !!ocorrencia && igual(ocorrencia.descricao || '', NAO_HOUVE);
  return { ocorrencia, hora: naoHouve ? '' : (ocorrencia?.hora || ''), naoHouve };
}

/** Dia do calendário da hora informada: no plantão da noite, de madrugada já é o dia seguinte. */
function diaDaHora(equipe: string, dataPlantao: string, hora: string): string {
  const horario = horarioPlantaoPorEquipe(equipe);
  if (horario.turno === 'Noturno' && hora && hora < horario.horarioTermino) return dataSaidaPlantao(equipe, dataPlantao);
  return dataPlantao;
}

/** Grava (cria ou atualiza) o teste do plantão. Quem marca "Não houve" não precisa informar hora. */
export async function salvarTesteSirene(params: {
  tipo: TipoTesteSirene;
  equipe: string;
  dataPlantao: string;
  hora: string;
  naoHouve: boolean;
  usuario: string;
  existente: Ocorrencia | null;
}): Promise<Ocorrencia | null> {
  const { tipo, equipe, dataPlantao, naoHouve, usuario, existente } = params;
  // "Não houve" fica na hora de início (APOC) ou de término (TWR) do plantão: assim aparece no começo
  // ou no fim do LRO, na ordem certa.
  const horario = horarioPlantaoPorEquipe(equipe);
  const hora = naoHouve ? (tipo === 'apoc' ? horario.horarioInicio : horario.horarioTermino) : params.hora;
  const fimNoDiaSeguinte = naoHouve && tipo === 'twr' && horario.turno === 'Noturno';
  const campos = {
    data: fimNoDiaSeguinte ? dataSaidaPlantao(equipe, dataPlantao) : diaDaHora(equipe, dataPlantao, hora),
    hora,
    equipe,
    titulo: TITULO_TESTE_SIRENE[tipo],
    descricao: naoHouve ? NAO_HOUVE : '',
    local: dataPlantao,
  };
  if (existente) return atualizarOcorrencia(existente.id, { ...campos, updatedBy: usuario });
  return criarOcorrencia({
    ...campos,
    tipoDocumento: 'BONA',
    numero: '',
    turno: '',
    categoria: 'Outros',
    envolvidos: '',
    acoesTomadas: '',
    status: 'Aberta',
    fotos: [],
    createdBy: usuario,
  });
}

/** No fim de plantão: o teste que ninguém lançou vale como "Não houve". Devolve os que foram lançados agora. */
export async function lancarTestesPendentesComoNaoHouve(equipe: string, dataPlantao: string, usuario: string): Promise<TipoTesteSirene[]> {
  const ocorrencias = await listarOcorrencias().catch(() => [] as Ocorrencia[]);
  const lancados: TipoTesteSirene[] = [];
  for (const tipo of ['apoc', 'twr'] as const) {
    if (acharTesteSirene(ocorrencias, tipo, equipe, dataPlantao)) continue;
    await salvarTesteSirene({ tipo, equipe, dataPlantao, hora: '', naoHouve: true, usuario, existente: null });
    lancados.push(tipo);
  }
  return lancados;
}
