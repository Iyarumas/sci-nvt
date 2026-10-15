import type { Bombeiro } from '../types/bombeiro';
import type { EscalaFeriasItem, FeriasGozo } from '../types/ferias';
import { calcularPeriodosAquisitivos } from '../types/ferias';
import type { SubstituicaoTemporaria } from '../types/substituicaoTemporaria';
import { MOTIVOS_SUBSTITUICAO } from '../types/substituicaoTemporaria';
import type { VigenciaSubstituicao } from '../services/vigenciaSubstituicaoService';
import type { CoberturaRelatorioFerias, FiltrosRelatorioFerias, PessoaRelatorioFerias, RelatorioFerias } from '../types/relatorioFerias';
import { agruparAfastamentosIndeterminados, calcularTempoAfastamento } from './afastamentos';
import { dataLocalISO, normalizarDataISO, parseDataLocalISO, periodosSobrepostosISO, somarDiasISO } from './datas';
import { filtrarQuadroEfetivosPorMes } from './efetivoOperacional';

interface DadosRelatorioFerias {
  bombeiros: Bombeiro[];
  feriasGozo: FeriasGozo[];
  itensEscala: EscalaFeriasItem[];
  vigencias: VigenciaSubstituicao[];
  substituicoes: SubstituicaoTemporaria[];
}

const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Ferista', 'Embaixador'];
const CARGOS = ['GS', 'BA-CE', 'BA-LR', 'BA-MC', 'BA-RE', 'BA-2', 'OC'];
const nomePessoa = (pessoa?: Bombeiro, salvo = '') => pessoa?.nomeCompleto || pessoa?.nomeGuerra || salvo;

function periodoAquisitivo(dataAdmissao: string, numero: number) {
  const existente = calcularPeriodosAquisitivos(dataAdmissao).find(p => p.numero === numero);
  if (existente) return existente;
  // O relatório também permite anos futuros; o helper da tela só enumera períodos já iniciados.
  const inicio = parseDataLocalISO(dataAdmissao);
  if (!Number.isInteger(numero) || numero < 1 || Number.isNaN(inicio.getTime()) || inicio.getFullYear() + numero > 9999) return null;
  inicio.setFullYear(inicio.getFullYear() + numero - 1);
  const fim = new Date(inicio);
  fim.setFullYear(fim.getFullYear() + 1);
  fim.setDate(fim.getDate() - 1);
  return { dataInicio: dataLocalISO(inicio), dataFim: dataLocalISO(fim) };
}

/** Não apresenta como disponível quem estiver de férias ou afastado em parte da cobertura. */
function periodosDisponiveis(inicio: string, fim: string, bloqueios: { dataInicio: string; dataFim: string }[]) {
  let periodos = [{ dataInicio: inicio, dataFim: fim }];
  for (const bloqueio of bloqueios) {
    const bloqueioInicio = normalizarDataISO(bloqueio.dataInicio);
    const bloqueioFim = normalizarDataISO(bloqueio.dataFim);
    periodos = periodos.flatMap(periodo => {
      if (!periodosSobrepostosISO(periodo.dataInicio, periodo.dataFim, bloqueioInicio, bloqueioFim)) return [periodo];
      return [
        ...(bloqueioInicio > periodo.dataInicio ? [{ dataInicio: periodo.dataInicio, dataFim: somarDiasISO(bloqueioInicio, -1) }] : []),
        ...(bloqueioFim < periodo.dataFim ? [{ dataInicio: somarDiasISO(bloqueioFim, 1), dataFim: periodo.dataFim }] : []),
      ];
    });
  }
  return periodos;
}

export function montarRelatorioFerias(dados: DadosRelatorioFerias, filtros: FiltrosRelatorioFerias): RelatorioFerias {
  const { mes, ano, incluirAfastados } = filtros;
  if (!Number.isInteger(mes) || mes < 1 || mes > 12 || !Number.isInteger(ano) || ano < 1900 || ano > 9998) {
    throw new Error('Informe um mês e ano válidos.');
  }
  const ativos = dados.bombeiros.filter(b => !b.dataDesligamento);
  const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const fimMes = dataLocalISO(new Date(ano, mes, 0));
  const porId = new Map(ativos.map(b => [b.id, b]));
  const quadro = filtrarQuadroEfetivosPorMes({ ...dados, mes, ano });
  const afastamentos = dados.substituicoes.filter(s => s.tipo === 'Afastamento' && s.status === 'Aprovada');
  const pessoas: PessoaRelatorioFerias[] = [];

  for (const gozo of quadro.feriasGozo) {
    const pessoa = porId.get(gozo.funcionarioId);
    if (!pessoa) continue;
    const inicio = normalizarDataISO(gozo.dataInicio);
    const fim = normalizarDataISO(gozo.dataFim);
    const item = quadro.itensEscala.find(i => i.feriasGozoId === gozo.id);
    const periodo = periodoAquisitivo(pessoa.dataAdmissao, gozo.periodoNumero);
    const vigencias = quadro.vigencias.filter(v => v.feriasId === gozo.id && ['ferias', 'cascata'].includes(v.motivo));
    const propostas = vigencias.map(v => ({
      substitutoId: v.substitutoId,
      nome: nomePessoa(porId.get(v.substitutoId), v.substitutoNome),
      cargoOriginal: v.cargoOriginalSubstituto || porId.get(v.substitutoId)?.cargo || '',
      cargoExercido: v.cargoExercido || v.cargoOriginalFuncionario,
      equipe: v.equipe,
      substituindoNome: nomePessoa(porId.get(v.funcionarioOriginalId), v.funcionarioOriginalNome),
      dataInicio: normalizarDataISO(v.dataInicio) > inicio ? normalizarDataISO(v.dataInicio) : inicio,
      dataFim: normalizarDataISO(v.dataFim) < fim ? normalizarDataISO(v.dataFim) : fim,
      nivel: v.nivelCascata,
    }));

    // Cadastros legados e manuais podem ter a cobertura somente no gozo/item aprovado.
    if (!vigencias.some(v => v.funcionarioOriginalId === pessoa.id)) {
      const substitutoId = item?.substitutoId || gozo.substitutoId;
      const substitutoNome = item?.substitutoNome || gozo.substitutoNome;
      const substituto = porId.get(substitutoId);
      if ((substitutoId || substitutoNome) && substitutoId !== pessoa.id) propostas.unshift({
        substitutoId,
        nome: nomePessoa(substituto, substitutoNome),
        cargoOriginal: substituto?.cargo || '',
        cargoExercido: item?.funcaoSubstituicao || gozo.funcaoSubstituicao || pessoa.cargo,
        equipe: pessoa.equipe,
        substituindoNome: nomePessoa(pessoa, gozo.funcionarioNome),
        dataInicio: inicio, dataFim: fim, nivel: 1,
      });
      if (!vigencias.length && item?.feristaId && item.feristaId !== substitutoId && substituto) propostas.push({
        substitutoId: item.feristaId,
        nome: nomePessoa(porId.get(item.feristaId), item.feristaNome),
        cargoOriginal: porId.get(item.feristaId)?.cargo || '',
        cargoExercido: substituto.cargo,
        equipe: substituto.equipe,
        substituindoNome: nomePessoa(substituto, substitutoNome),
        dataInicio: inicio, dataFim: fim, nivel: 2,
      });
    }

    const coberturas: CoberturaRelatorioFerias[] = [];
    const vistas = new Set<string>();
    for (const proposta of propostas.sort((a, b) => a.nivel - b.nivel || a.dataInicio.localeCompare(b.dataInicio))) {
      if (!proposta.nome || proposta.dataInicio > proposta.dataFim) continue;
      // Um ID antigo não é resolvido por nome para outra pessoa.
      if (proposta.substitutoId && !porId.has(proposta.substitutoId)) continue;
      const bloqueios = [
        ...afastamentos.filter(a => a.funcionarioId === proposta.substitutoId),
        ...dados.feriasGozo.filter(g => g.funcionarioId === proposta.substitutoId),
      ];
      const coberturaInicio = proposta.dataInicio > inicioMes ? proposta.dataInicio : inicioMes;
      const coberturaFim = proposta.dataFim < fimMes ? proposta.dataFim : fimMes;
      if (coberturaInicio > coberturaFim) continue;
      for (const disponivel of periodosDisponiveis(coberturaInicio, coberturaFim, bloqueios)) {
        const { substitutoId, ...cobertura } = { ...proposta, ...disponivel };
        const chave = [substitutoId || cobertura.nome, cobertura.substituindoNome, cobertura.cargoExercido, cobertura.equipe, cobertura.dataInicio, cobertura.dataFim].join('|');
        if (vistas.has(chave)) continue;
        vistas.add(chave);
        coberturas.push(cobertura);
      }
    }
    pessoas.push({
      id: gozo.id,
      nome: nomePessoa(pessoa, gozo.funcionarioNome),
      cargo: pessoa.cargo,
      equipe: pessoa.equipe,
      dataInicio: inicio, dataFim: fim, dias: gozo.dias,
      periodoNumero: gozo.periodoNumero,
      aquisitivoInicio: periodo?.dataInicio || '',
      aquisitivoFim: periodo?.dataFim || '',
      coberturas,
    });
  }

  const afastados = incluirAfastados ? agruparAfastamentosIndeterminados(afastamentos)
    .filter(grupo => porId.has(grupo.atual.funcionarioId) && periodosSobrepostosISO(grupo.dataInicio, grupo.dataFim, inicioMes, fimMes))
    .map(grupo => {
      const pessoa = porId.get(grupo.atual.funcionarioId)!;
      return {
        nome: nomePessoa(pessoa, grupo.atual.funcionarioNome), cargo: pessoa.cargo, equipe: pessoa.equipe,
        tipoAfastamento: MOTIVOS_SUBSTITUICAO.find(m => m.value === grupo.atual.motivo)?.label || grupo.atual.motivo,
        // Mesmo conteúdo do campo Descrição no cadastro; CID, prazo e extras são campos separados.
        motivo: (grupo.atual.motivoOutro || '').split(/\r?\n/)
          .filter(linha => !/^\s*(?:CID|Prazo|Extras):/i.test(linha)).join('\n').trim(),
        dataInicio: normalizarDataISO(grupo.dataInicio), dataFim: normalizarDataISO(grupo.dataFim),
        retorno: calcularTempoAfastamento(grupo.dataInicio, grupo.dataFim, fimMes).dataRetorno,
      };
    }).sort((a, b) => EQUIPES.indexOf(a.equipe) - EQUIPES.indexOf(b.equipe) || a.nome.localeCompare(b.nome, 'pt-BR')) : [];

  return {
    ...filtros,
    equipes: EQUIPES.map(equipe => ({
      equipe,
      pessoas: pessoas.filter(p => p.equipe === equipe).sort((a, b) =>
        CARGOS.indexOf(a.cargo) - CARGOS.indexOf(b.cargo) || a.nome.localeCompare(b.nome, 'pt-BR') || a.dataInicio.localeCompare(b.dataInicio)),
    })).filter(grupo => grupo.pessoas.length > 0),
    afastados,
  };
}
