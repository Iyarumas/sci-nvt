import type { FiltrosRelatorioFerias, RelatorioFerias } from '../types/relatorioFerias';
import { montarRelatorioFerias } from '../utils/relatorioFerias';
import { dataLocalISO } from '../utils/datas';
import { listarAtivos } from './bombeiroService';
import { listarEscalas, listarFeriasGozo, listarItensEscala } from './feriasService';
import { listarSubstituicoesTemporarias } from './substituicaoTemporariaService';
import { listarVigencias } from './vigenciaSubstituicaoService';

/** Mesmas fontes e recorte do Quadro de Efetivos, sem gravar registros. */
export async function carregarRelatorioFerias(filtros: FiltrosRelatorioFerias): Promise<RelatorioFerias> {
  const inicio = `${filtros.ano}-${String(filtros.mes).padStart(2, '0')}-01`;
  const fim = dataLocalISO(new Date(filtros.ano, filtros.mes, 0));
  const [bombeiros, feriasGozo, escalas, substituicoes, vigencias] = await Promise.all([
    listarAtivos(), listarFeriasGozo(), listarEscalas(), listarSubstituicoesTemporarias(),
    listarVigencias({ ativa: true, dataInicio: inicio, dataFim: fim }),
  ]);
  const itens = await Promise.all(escalas.filter(e => e.status === 'Aprovado' && e.ano === filtros.ano).map(e => listarItensEscala(e.id)));
  return montarRelatorioFerias({ bombeiros, feriasGozo, itensEscala: itens.flat(), substituicoes, vigencias }, filtros);
}
