import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar, Shield, Users, Plus, Trash2, FileText, Radio,
  ChevronDown, ChevronUp, Save, Pencil, Copy, Printer,
  AlertTriangle,
  ArrowRightLeft, ArrowRight, Sparkles, HelpCircle,
} from 'lucide-react';
import { SearchSelect, type AtivoItem } from '../../components/ui/SearchSelect';
import { AnimatedPageTour, type AnimatedTourStep } from '../../components/ui/AnimatedPageTour';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarEscalas, criarEscala, atualizarEscala, excluirEscala } from '../../services/escalaService';
import { listarAtivos } from '../../services/bombeiroService';
import { equipeEstaNoPlantao, horarioPlantaoPorEquipe } from '../../utils/equipes';
import { estaNoPeriodoISO, formatarDataBR, hojeLocalISO, mesmoDiaISO, parseDataLocalISO } from '../../utils/datas';
import { listarSubstituicoesTemporarias } from '../../services/substituicaoTemporariaService';
import { listarVigencias } from '../../services/vigenciaSubstituicaoService';
import type { VigenciaSubstituicao } from '../../services/vigenciaSubstituicaoService';
import { listarTrocasServicoAssinadas } from '../../services/efetivoOperacionalService';
import { listarFeriasGozo, listarEscalas as listarEscalasFerias, listarItensEscala } from '../../services/feriasService';
import { listarCompletas } from '../../services/escalaMensalService';
import { gerarRadioPlantao } from '../../services/escalaMensalGenerator';
import { FUNCOES_BDS_PTR } from '../../types/escala';
import { ASSUNTOS as ASSUNTOS_PTRBA } from '../../types/ptrb';
import type { EscalaDiaria, ExtraSlot, TrocaSlot } from '../../types/escala';
import type { Bombeiro, Cargo } from '../../types/bombeiro';
import type { DocumentFill } from '../../types/document';
import type { FeriasGozo } from '../../types/ferias';
import type { SubstituicaoTemporaria } from '../../types/substituicaoTemporaria';
import { montarEfetivoOperacional, montarOpcoesEfetivoOperacional, montarTrocasServicoDoDia } from '../../utils/efetivoOperacional';
import { validarCursoParaFuncao } from '../../utils/validacaoCursos';
import { RegraNegocioError } from '../../utils/regrasOperacionais';

const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta'] as const;

const optionCls = 'dark:bg-graphite-700 dark:text-graphite-100';
const inputClass = 'rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated';
const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ANOS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
const INSTRUTOR_SECTIONS = [
  { key: 'bds', label: 'BDS' },
  { key: 'ptr1', label: 'PTR-1' },
  { key: 'ptr2', label: 'PTR-2' },
  { key: 'ptr3', label: 'PTR-3' },
] as const;

type InstrutorSection = (typeof INSTRUTOR_SECTIONS)[number]['key'];

type EscalaDiariaTourStep = AnimatedTourStep & {
  mode: 'list' | 'form';
};

const ESCALA_DIARIA_TOUR_STEPS: EscalaDiariaTourStep[] = [
  {
    target: 'diaria-lista-filtros',
    mode: 'list',
    title: 'Lista das escalas diárias',
    body: 'Aqui você filtra as escalas já criadas por mês, ano, período e equipe.',
    detail: 'Use essa lista para conferir se o plantão do dia já foi montado antes de criar outro registro.',
  },
  {
    target: 'diaria-nova',
    mode: 'list',
    title: 'Crie a escala do plantão',
    body: 'Nova Escala Diária abre o formulário do dia. Ela deve ser feita para a equipe que está realmente de plantão naquela data.',
    detail: 'A diária usa a escala mensal como base e depois ajusta o efetivo com trocas, extras e afastamentos aprovados.',
  },
  {
    target: 'diaria-form-topo',
    mode: 'form',
    title: 'Equipe e data comandam a diária',
    body: 'Escolha equipe, chefe e data do plantão. Horário e turno são preenchidos conforme o regime da equipe.',
    detail: 'Esses campos definem qual mensal será consultada e quais trocas, atestados e extras entram naquele dia.',
  },
  {
    target: 'diaria-auto',
    mode: 'form',
    title: 'Use o auto-preenchimento',
    body: 'O botão Auto-Preenchimento busca a escala mensal do mês, monta as guarnições e aplica as regras do dia.',
    detail: 'Ele também considera trocas de serviço assinadas, férias, substituições, extras e atestados/afastamentos aprovados.',
  },
  {
    target: 'diaria-guarnicoes',
    mode: 'form',
    title: 'Confira as guarnições',
    body: 'As guarnições mostram quem fica em CCI 02, CCI 03 e CRS no plantão.',
    detail: 'Se alguém saiu por troca, extra ou atestado, a diária mostra o efetivo ajustado para aquele dia.',
  },
  {
    target: 'diaria-ptrba',
    mode: 'form',
    title: 'Preencha BDS e PTR-BA',
    body: 'Nessas seções você informa instrutor, função e assunto do PTR-BA do plantão.',
    detail: 'O PTR-BA puxa automaticamente essas informações conforme preenchido aqui, então revise antes de salvar a escala.',
  },
  {
    target: 'diaria-automacoes',
    mode: 'form',
    title: 'Trocas, extras e atestados',
    body: 'Essas áreas são automáticas e mostram o que o sistema encontrou para o dia do plantão.',
    detail: 'Trocas vêm das trocas de serviço aprovadas; extras e atestados vêm de afastamentos/substituições aprovadas.',
  },
  {
    target: 'diaria-radio',
    mode: 'form',
    title: 'Rádio vem da mensal',
    body: 'A escala de rádio do dia pode ser puxada da escala mensal e ajustada aqui quando necessário.',
    detail: 'Os horários definidos na mensal entram na diária para manter a comunicação do plantão organizada.',
  },
  {
    target: 'diaria-acoes',
    mode: 'form',
    title: 'Salve para alimentar o sistema',
    body: 'Depois de conferir tudo, salve a escala diária.',
    detail: 'A diária salva vira referência para PTR-BA, LRO e conferências do efetivo daquele plantão.',
  },
];

function emptyFuncaoSlot() {
  return { funcao: '', nomeGuerra: '', assunto: '' };
}

function emptyGuarnicoes() {
  return {
    cci02: { baMc: '', baCe: '', ba2: '' },
    cci03: { baMc: '', ba2_1: '', ba2_2: '' },
    crs: { baMc: '', baLr: '', baRe1: '', baRe2: '' },
  };
}

function emptyEscala(): Omit<EscalaDiaria, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> {
  return {
    equipe: '',
    chefeEquipe: '',
    dataPlantao: hojeLocalISO(),
    horarioInicio: '',
    horarioTermino: '',
    turno: '',
    guarnicoes: emptyGuarnicoes(),
    bds: emptyFuncaoSlot(),
    ptr1: emptyFuncaoSlot(),
    ptr2: emptyFuncaoSlot(),
    ptr3: emptyFuncaoSlot(),
    atestados: [],
    trocas: [],
    extras: [],
    radio: [],
  };
}

function montarEscalaInicial(equipePadrao?: string | null): Omit<EscalaDiaria, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> {
  const base = emptyEscala();
  if (!equipePadrao || !EQUIPES.includes(equipePadrao as any)) return base;
  const horario = horarioPlantaoPorEquipe(equipePadrao);
  return {
    ...base,
    equipe: equipePadrao,
    horarioInicio: horario.horarioInicio,
    horarioTermino: horario.horarioTermino,
    turno: horario.turno,
  };
}

function formatDate(d: string) {
  return formatarDataBR(d);
}

function autoPreencher(equipe: string) {
  return horarioPlantaoPorEquipe(equipe);
}

interface EfetivoDiarioEntry {
  bombeiro: Bombeiro;
  cargoExercido: string;
  substituindo?: {
    id: string;
    nome: string;
    cargo: string;
  };
}

type GrupoEscalaDetalhe = {
  titulo: string;
  linhas: Array<{ label: string; nome: string }>;
};

function valorEscala(value?: string): string {
  const texto = String(value || '').trim();
  return texto || '-';
}

function gruposGuarnicaoDetalhe(escala: EscalaDiaria): GrupoEscalaDetalhe[] {
  return [
    {
      titulo: 'FAÍSCA 2',
      linhas: [
        { label: 'BA-MC', nome: valorEscala(escala.guarnicoes?.cci02?.baMc) },
        { label: 'BA-CE', nome: valorEscala(escala.guarnicoes?.cci02?.baCe) },
        { label: 'BA-2', nome: valorEscala(escala.guarnicoes?.cci02?.ba2) },
      ],
    },
    {
      titulo: 'FAÍSCA 3',
      linhas: [
        { label: 'BA-MC', nome: valorEscala(escala.guarnicoes?.cci03?.baMc) },
        { label: 'BA-2', nome: valorEscala(escala.guarnicoes?.cci03?.ba2_1) },
        { label: 'BA-2', nome: valorEscala(escala.guarnicoes?.cci03?.ba2_2) },
      ],
    },
    {
      titulo: 'CRS',
      linhas: [
        { label: 'BA-MC', nome: valorEscala(escala.guarnicoes?.crs?.baMc) },
        { label: 'BA-LR', nome: valorEscala(escala.guarnicoes?.crs?.baLr) },
        { label: 'BA-RE', nome: valorEscala(escala.guarnicoes?.crs?.baRe1) },
        { label: 'BA-RE', nome: valorEscala(escala.guarnicoes?.crs?.baRe2) },
      ],
    },
  ];
}

function dataNoPeriodo(data: string, dataInicio: string, dataFim: string): boolean {
  return estaNoPeriodoISO(data, dataInicio, dataFim);
}

function trocasIguais(a: TrocaSlot[], b: TrocaSlot[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((troca, index) => {
    const outra = b[index];
    return troca.funcaoSaindo === outra.funcaoSaindo &&
      troca.nomeSaindo === outra.nomeSaindo &&
      troca.funcaoEntrando === outra.funcaoEntrando &&
      troca.nomeEntrando === outra.nomeEntrando;
  });
}

function motivoAfastamentoLabel(sub: SubstituicaoTemporaria): string {
  if (sub.motivo === 'Atestado Medico') return 'Atestado medico';
  if (sub.motivo === 'INSS Indeterminado') return 'INSS/Indeterminado';
  if (sub.motivo === 'Outro') return sub.motivoOutro || 'Outro';
  return sub.motivo;
}

function afastadoEstaNoPlantao(sub: SubstituicaoTemporaria, equipe: string, dataPlantao: string): boolean {
  if (!dataNoPeriodo(dataPlantao, sub.dataInicio, sub.dataFim)) return false;
  const data = parseDataLocalISO(dataPlantao);
  if (Number.isNaN(data.getTime())) return false;
  return equipeEstaNoPlantao(equipe, data);
}

function extraNoPlantao(
  elo: SubstituicaoTemporaria['cadeiaSubstituicao'][number],
  equipe: string,
  dataPlantao: string,
): boolean {
  const equipePlantao = String(elo.equipePlantao || elo.funcionarioEquipe || '');
  return (!equipePlantao || equipePlantao === equipe) && mesmoDiaISO(elo.dataPlantao || '', dataPlantao);
}

function contextoAfastamentoNoDia(params: {
  sub: SubstituicaoTemporaria;
  bombeiros: Bombeiro[];
  vigencias?: VigenciaSubstituicao[];
  dataPlantao: string;
  elo?: SubstituicaoTemporaria['cadeiaSubstituicao'][number];
}) {
  const { sub, bombeiros, vigencias = [], dataPlantao, elo } = params;
  const afastado = bombeiros.find(b => b.id === sub.funcionarioId);
  const vigencia = vigencias.find(v =>
    v.ativa &&
    v.substitutoId === sub.funcionarioId &&
    v.substitutoId !== v.funcionarioOriginalId &&
    dataNoPeriodo(dataPlantao, v.dataInicio, v.dataFim)
  );
  const originalVigencia = vigencia ? bombeiros.find(b => b.id === vigencia.funcionarioOriginalId) : undefined;
  const equipePlantao = elo?.equipePlantao ||
    elo?.funcionarioEquipe ||
    originalVigencia?.equipe ||
    vigencia?.equipe ||
    afastado?.equipe ||
    '';
  const cargoAfastado = elo?.funcionarioCargo ||
    vigencia?.cargoExercido ||
    afastado?.cargo ||
    sub.funcionarioCargo;

  return {
    afastado,
    equipePlantao,
    cargoAfastado,
  };
}

function montarAtestadosAfastamentoDoDia(params: {
  substituicoes: SubstituicaoTemporaria[];
  bombeiros: Bombeiro[];
  vigencias?: VigenciaSubstituicao[];
  equipe: string;
  dataPlantao: string;
}): string[] {
  const { substituicoes, bombeiros, vigencias, equipe, dataPlantao } = params;
  const atestados: string[] = [];
  for (const sub of substituicoes) {
    if (sub.tipo !== 'Afastamento' || sub.status !== 'Aprovada') continue;
    const eloDia = (sub.cadeiaSubstituicao || []).find(elo =>
      elo.tipo === 'extra' && extraNoPlantao(elo, equipe, dataPlantao)
    );
    const dataContexto = eloDia?.dataPlantao || dataPlantao;
    const contexto = contextoAfastamentoNoDia({ sub, bombeiros, vigencias, dataPlantao: dataContexto, elo: eloDia });
    if (contexto.equipePlantao !== equipe) continue;
    if (!afastadoEstaNoPlantao(sub, contexto.equipePlantao, dataPlantao)) continue;
    const nome = contexto.afastado?.nomeCompleto || sub.funcionarioNome;
    atestados.push(`${contexto.cargoAfastado} ${nome} - ${motivoAfastamentoLabel(sub)}`);
  }
  return atestados;
}

function montarExtrasAfastamentoDoDia(params: {
  substituicoes: SubstituicaoTemporaria[];
  bombeiros: Bombeiro[];
  vigencias?: VigenciaSubstituicao[];
  equipe: string;
  dataPlantao: string;
}): ExtraSlot[] {
  const { substituicoes, bombeiros, vigencias, equipe, dataPlantao } = params;
  const extras: ExtraSlot[] = [];
  for (const sub of substituicoes) {
    if (sub.tipo !== 'Afastamento' || sub.status !== 'Aprovada') continue;
    for (const elo of sub.cadeiaSubstituicao || []) {
      if (elo.tipo !== 'extra' || !extraNoPlantao(elo, equipe, dataPlantao)) continue;
      const dataContexto = elo.dataPlantao || dataPlantao;
      const contexto = contextoAfastamentoNoDia({ sub, bombeiros, vigencias, dataPlantao: dataContexto, elo });
      if (contexto.equipePlantao !== equipe) continue;
      if (!afastadoEstaNoPlantao(sub, contexto.equipePlantao, dataPlantao)) continue;
      const substituto = bombeiros.find(b => b.id === (elo.substitutoId || elo.pessoaId));
      const cargoExercido = elo.cargoExercido || elo.cargoVacante || sub.funcionarioCargo;
      extras.push({
        dataPlantao: dataContexto,
        equipePlantao: contexto.equipePlantao,
        funcionarioId: sub.funcionarioId,
        substitutoId: substituto?.id || elo.substitutoId || elo.pessoaId,
        funcaoSaindo: contexto.cargoAfastado,
        nomeSaindo: contexto.afastado?.nomeGuerra || elo.funcionarioNome || sub.funcionarioNome,
        nomeSaindoCompleto: contexto.afastado?.nomeCompleto || elo.funcionarioNome || sub.funcionarioNome,
        funcaoEntrando: cargoExercido,
        nomeEntrando: substituto?.nomeGuerra || elo.substitutoNome || elo.pessoaNome,
        nomeEntrandoCompleto: substituto?.nomeCompleto || elo.substitutoNome || elo.pessoaNome,
        cargoOriginalEntrando: substituto?.cargo || elo.substitutoCargo || elo.pessoaCargo,
      });
    }
  }
  return extras;
}

function normalizarNomeComparacao(value?: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function slotCorrespondeAoExtra(slot: string, extra: ExtraSlot): boolean {
  const alvo = normalizarNomeComparacao(slot);
  if (!alvo || alvo === '-') return false;
  return [extra.nomeSaindo, extra.nomeSaindoCompleto]
    .map(normalizarNomeComparacao)
    .filter(Boolean)
    .some(nome => nome === alvo || nome.startsWith(`${alvo} `) || alvo.startsWith(`${nome} `));
}

function aplicarExtraNoNome(nome: string, extras: ExtraSlot[]): string {
  const extra = extras.find(item => slotCorrespondeAoExtra(nome, item));
  return extra?.nomeEntrando || nome;
}

function aplicarExtrasNasGuarnicoes(guarnicoes: EscalaDiaria['guarnicoes'], extras: ExtraSlot[]): EscalaDiaria['guarnicoes'] {
  if (!extras.length) return guarnicoes;
  return {
    cci02: {
      baMc: aplicarExtraNoNome(guarnicoes?.cci02?.baMc || '', extras),
      baCe: aplicarExtraNoNome(guarnicoes?.cci02?.baCe || '', extras),
      ba2: aplicarExtraNoNome(guarnicoes?.cci02?.ba2 || '', extras),
    },
    cci03: {
      baMc: aplicarExtraNoNome(guarnicoes?.cci03?.baMc || '', extras),
      ba2_1: aplicarExtraNoNome(guarnicoes?.cci03?.ba2_1 || '', extras),
      ba2_2: aplicarExtraNoNome(guarnicoes?.cci03?.ba2_2 || '', extras),
    },
    crs: {
      baMc: aplicarExtraNoNome(guarnicoes?.crs?.baMc || '', extras),
      baLr: aplicarExtraNoNome(guarnicoes?.crs?.baLr || '', extras),
      baRe1: aplicarExtraNoNome(guarnicoes?.crs?.baRe1 || '', extras),
      baRe2: aplicarExtraNoNome(guarnicoes?.crs?.baRe2 || '', extras),
    },
  };
}

function _montarEfetivoDiario(params: {
  bombeiros: Bombeiro[];
  feriasGozo: FeriasGozo[];
  vigencias: VigenciaSubstituicao[];
  trocaFills: any[];
  equipe: string;
  dataPlantao: string;
}): EfetivoDiarioEntry[] {
  const { bombeiros, feriasGozo, vigencias, trocaFills, equipe, dataPlantao } = params;
  if (!equipe || !dataPlantao) return [];

  const ativos = bombeiros.filter(b => !b.dataDesligamento);
  const porId = new Map(ativos.map(b => [b.id, b]));
  const porNome = new Map<string, Bombeiro>();
  ativos.forEach(b => {
    if (b.nomeCompleto) porNome.set(b.nomeCompleto.toLowerCase(), b);
    if (b.nomeGuerra) porNome.set(b.nomeGuerra.toLowerCase(), b);
  });
  const equipeDaVaga = (v: VigenciaSubstituicao): string => {
    const original = porId.get(v.funcionarioOriginalId);
    return original?.equipe || v.equipe;
  };

  const vigenciasNoDia = vigencias.filter(v =>
    v.ativa &&
    v.substitutoId &&
    dataNoPeriodo(dataPlantao, v.dataInicio, v.dataFim) &&
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

  // Trocas de serviço aprovadas (documento):
  // - data_solicitada: dia de folga do solicitante → solicitado substitui o solicitante
  // - data_folga_solicitado: dia de folga do solicitado → solicitante substitui o solicitado
  const trocasNoDia = (trocaFills || []).filter(fl => {
    const fd = fl?.filled_data || {};
    return (mesmoDiaISO(fd?.data_solicitada, dataPlantao) || mesmoDiaISO(fd?.data_folga_solicitado, dataPlantao)) && fd?.nome_solicitante && fd?.nome_solicitado;
  });
  const trocaExcluidos = new Set<string>();
  const trocaIncluidos: { bombeiro: Bombeiro; cargo: string; substituindo: EfetivoDiarioEntry['substituindo'] }[] = [];
  for (const fl of trocasNoDia) {
    const fd = fl.filled_data || {};
    const sol = porNome.get(String(fd.nome_solicitante || '').toLowerCase());
    const solic = porNome.get(String(fd.nome_solicitado || '').toLowerCase());
    if (!sol || !solic) continue;
    const solDia = mesmoDiaISO(fd?.data_solicitada, dataPlantao);
    const solicDia = mesmoDiaISO(fd?.data_folga_solicitado, dataPlantao);
    if (solDia && sol.equipe === equipe) {
      trocaExcluidos.add(sol.id);
      trocaExcluidos.add(solic.id);
      trocaIncluidos.push({
        bombeiro: solic,
        cargo: sol.cargo,
        substituindo: { id: sol.id, nome: sol.nomeCompleto, cargo: sol.cargo },
      });
    } else if (solicDia && solic.equipe === equipe) {
      trocaExcluidos.add(sol.id);
      trocaExcluidos.add(solic.id);
      trocaIncluidos.push({
        bombeiro: sol,
        cargo: solic.cargo,
        substituindo: { id: solic.id, nome: solic.nomeCompleto, cargo: solic.cargo },
      });
    }
  }

  const gozosNoDia = feriasGozo.filter(g =>
    g.status !== 'Gozadas' &&
    dataNoPeriodo(dataPlantao, g.dataInicio, g.dataFim)
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

  const resultado: EfetivoDiarioEntry[] = [];
  const adicionados = new Set<string>();
  const adicionar = (bombeiro: Bombeiro, cargoExercido: string, substituindo?: EfetivoDiarioEntry['substituindo']) => {
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
    if (emGozo.has(membro.id) || realPorOriginal.has(membro.id) || fallbackPorOriginal.has(membro.id) || vagasAbertas.has(membro.id) || trocaExcluidos.has(membro.id)) {
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

  for (const t of trocaIncluidos) {
    adicionar(t.bombeiro, t.cargo, t.substituindo);
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

function _montarOpcoesEfetivoDiario(efetivo: EfetivoDiarioEntry[], equipe: string): AtivoItem[] {
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

const SLOT_ROLE_MAP: Record<string, Cargo> = {
  'BA-CE': 'BA-CE',
  'BA-LR': 'BA-LR',
  'BA-MC': 'BA-MC',
};

function SlotFuncao({
  label,
  value,
  onChange,
  allBombeiros,
  veiculo,
  options,
  cargoFiltro,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  allBombeiros: Bombeiro[];
  veiculo?: 'crs' | 'cci';
  options: AtivoItem[];
  cargoFiltro?: string;
}) {
  const role = SLOT_ROLE_MAP[label];
  const selecionado = value ? allBombeiros.find(b => b.nomeGuerra === value) : null;
  const aviso = selecionado && role ? validarCursoParaFuncao(selecionado, role, veiculo) : null;

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-graphite-500 dark:text-graphite-400">{label}</p>
      <SearchSelect value={value} onChange={onChange} placeholder={`Selecione ${label}`} options={options} cargo={cargoFiltro} showCargo showEquipe />
      {aviso && (
        <div className={`mt-1.5 flex items-start gap-2 rounded-lg px-2.5 py-2 text-[11px] leading-tight ${
          aviso.nivel === 'bloqueado'
            ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
        }`}>
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{aviso.mensagem}</span>
        </div>
      )}
    </div>
  );
}

// ─── FORM ────────────────────────────────────────────────
function EscalaDiariaForm({
  escala,
  onSave,
  onCancel,
  canManageGlobal,
  equipeEfetiva,
}: {
  escala?: EscalaDiaria;
  onSave: (data: Omit<EscalaDiaria, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => void;
  onCancel: () => void;
  canManageGlobal: boolean;
  equipeEfetiva: string | null;
}) {
  const [form, setForm] = useState(() => montarEscalaInicial(canManageGlobal ? null : equipeEfetiva));
  const [allBombeiros, setAllBombeiros] = useState<Bombeiro[]>([]);
  const [feriasGozo, setFeriasGozo] = useState<FeriasGozo[]>([]);
  const [vigencias, setVigencias] = useState<VigenciaSubstituicao[]>([]);
  const [trocaFills, setTrocaFills] = useState<DocumentFill[]>([]);
  const [substituicoesTemporarias, setSubstituicoesTemporarias] = useState<SubstituicaoTemporaria[]>([]);
  const [autoFilling, setAutoFilling] = useState(false);

  useEffect(() => {
    Promise.all([
      listarAtivos(),
      listarFeriasGozo(),
      listarVigencias({ ativa: true }),
      listarSubstituicoesTemporarias(),
    ]).then(([ativos, gozos, vigs, substituicoes]) => {
      setAllBombeiros(ativos);
      setFeriasGozo(gozos);
      setVigencias(vigs);
      setSubstituicoesTemporarias(substituicoes);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    listarTrocasServicoAssinadas().then(setTrocaFills).catch(() => {});
  }, []);

  useEffect(() => {
    const novas = montarTrocasServicoDoDia({
      bombeiros: allBombeiros,
      trocaFills,
      equipe: form.equipe,
      dataPlantao: form.dataPlantao,
    });
    setForm(f => {
      if (trocasIguais(f.trocas, novas)) return f;
      return { ...f, trocas: novas };
    });
  }, [form.dataPlantao, form.equipe, allBombeiros, trocaFills]);

  useEffect(() => {
    if (!form.equipe || !form.dataPlantao || allBombeiros.length === 0) return;
    const substituicoesAprovadas = substituicoesTemporarias.filter(s => s.status === 'Aprovada');
    const extrasDoDia = montarExtrasAfastamentoDoDia({
      substituicoes: substituicoesAprovadas,
      bombeiros: allBombeiros,
      vigencias,
      equipe: form.equipe,
      dataPlantao: form.dataPlantao,
    });
    const atestadosDoDia = montarAtestadosAfastamentoDoDia({
      substituicoes: substituicoesAprovadas,
      bombeiros: allBombeiros,
      vigencias,
      equipe: form.equipe,
      dataPlantao: form.dataPlantao,
    });
    setForm(f => {
      const guarnicoesComExtras = aplicarExtrasNasGuarnicoes(f.guarnicoes, extrasDoDia);
      const chefeComExtra = aplicarExtraNoNome(f.chefeEquipe, extrasDoDia);
      const unchanged =
        JSON.stringify(f.extras || []) === JSON.stringify(extrasDoDia) &&
        JSON.stringify(f.atestados || []) === JSON.stringify(atestadosDoDia) &&
        JSON.stringify(f.guarnicoes) === JSON.stringify(guarnicoesComExtras) &&
        f.chefeEquipe === chefeComExtra;
      if (unchanged) return f;
      return {
        ...f,
        atestados: atestadosDoDia,
        extras: extrasDoDia,
        chefeEquipe: chefeComExtra,
        guarnicoes: guarnicoesComExtras,
      };
    });
  }, [allBombeiros, form.dataPlantao, form.equipe, substituicoesTemporarias, vigencias]);

  useEffect(() => {
    if (escala) {
      setForm({
        equipe: escala.equipe,
        chefeEquipe: escala.chefeEquipe,
        dataPlantao: escala.dataPlantao,
        horarioInicio: escala.horarioInicio,
        horarioTermino: escala.horarioTermino,
        turno: escala.turno,
        guarnicoes: escala.guarnicoes,
        bds: escala.bds || emptyFuncaoSlot(),
        ptr1: escala.ptr1 || emptyFuncaoSlot(),
        ptr2: escala.ptr2 || emptyFuncaoSlot(),
        ptr3: escala.ptr3 || emptyFuncaoSlot(),
        atestados: escala.atestados,
        trocas: [],
        extras: escala.extras || [],
        radio: escala.radio,
      });
    } else if (!canManageGlobal && equipeEfetiva) {
      setForm(montarEscalaInicial(equipeEfetiva));
    }
  }, [escala, canManageGlobal, equipeEfetiva]);

  const autoFillKeyRef = useRef(escala ? `${escala.equipe}|${escala.dataPlantao}` : '');
  const userChangedScheduleRef = useRef(false);
  useEffect(() => {
    if (!form.equipe || !form.dataPlantao || autoFilling) return;
    const key = `${form.equipe}|${form.dataPlantao}`;
    const escalaOriginalKey = escala ? `${escala.equipe}|${escala.dataPlantao}` : '';
    if (escalaOriginalKey && !userChangedScheduleRef.current) {
      autoFillKeyRef.current = escalaOriginalKey;
      return;
    }
    if (escalaOriginalKey && key === escalaOriginalKey) {
      autoFillKeyRef.current = key;
      return;
    }
    if (autoFillKeyRef.current === key) return;
    autoFillKeyRef.current = key;
    autoPreencherGuarnicoes();
  }, [form.equipe, form.dataPlantao, escala, autoFilling]);

  const efetivoDiario = useMemo(() => montarEfetivoOperacional({
    bombeiros: allBombeiros,
    feriasGozo,
    vigencias,
    trocaFills,
    substituicoesTemporarias,
    equipe: form.equipe,
    dataPlantao: form.dataPlantao,
  }), [allBombeiros, feriasGozo, vigencias, trocaFills, substituicoesTemporarias, form.equipe, form.dataPlantao]);

  const efetivoOptions = useMemo(
    () => montarOpcoesEfetivoOperacional(efetivoDiario, form.equipe),
    [efetivoDiario, form.equipe],
  );

  const opcoesPorCargo = (cargos: string[]) => efetivoOptions.filter(o => o.cargo && cargos.includes(o.cargo));
  const opcoesChefe = opcoesPorCargo(['BA-CE']);
  const opcoesBaMc = opcoesPorCargo(['BA-MC']);
  const opcoesBaLr = opcoesPorCargo(['BA-LR']);
  const opcoesBa2 = opcoesPorCargo(['BA-2']);
  const opcoesBaRe = opcoesPorCargo(['BA-2', 'BA-RE']);

  function updateEquipe(equipe: string) {
    if (!canManageGlobal) return;
    userChangedScheduleRef.current = true;
    if (!equipe) {
      setForm(f => ({
        ...f,
        equipe: '',
        horarioInicio: '',
        horarioTermino: '',
        turno: '',
        chefeEquipe: '',
        guarnicoes: emptyGuarnicoes(),
        bds: emptyFuncaoSlot(),
        ptr1: emptyFuncaoSlot(),
        ptr2: emptyFuncaoSlot(),
        ptr3: emptyFuncaoSlot(),
        atestados: [],
        trocas: [],
        radio: [],
        extras: [],
      }));
      return;
    }
    const auto = autoPreencher(equipe);
    const membros = montarEfetivoOperacional({
      bombeiros: allBombeiros,
      feriasGozo,
      vigencias,
      trocaFills,
      substituicoesTemporarias,
      equipe,
      dataPlantao: form.dataPlantao,
    }).map(entry => ({ nomeGuerra: entry.bombeiro.nomeGuerra, cargo: entry.cargoExercido }));
    const find = (cargo: Cargo) => {
      const idx = membros.findIndex(b => b.cargo === cargo);
      if (idx !== -1) return membros.splice(idx, 1)[0].nomeGuerra;
      return '';
    };
    const findAny = (cargos: Cargo[]) => {
      for (const c of cargos) {
        const idx = membros.findIndex(b => b.cargo === c);
        if (idx !== -1) return membros.splice(idx, 1)[0].nomeGuerra;
      }
      return '';
    };
    const chefe = find('BA-CE');
    const mc1 = find('BA-MC'), mc2 = find('BA-MC'), mc3 = find('BA-MC');
    const lr = find('BA-LR');
    const b2_1 = findAny(['BA-2','BA-RE']), b2_2 = findAny(['BA-2','BA-RE']), b2_3 = findAny(['BA-2','BA-RE']), b2_4 = findAny(['BA-2','BA-RE']), b2_5 = findAny(['BA-2','BA-RE']);
    setForm(f => ({
      ...f,
      equipe,
      ...auto,
      chefeEquipe: chefe,
      guarnicoes: {
        crs: { baMc: mc1, baLr: lr, baRe1: b2_1, baRe2: b2_2 },
        cci02: { baMc: mc2, baCe: chefe, ba2: b2_3 },
        cci03: { baMc: mc3, ba2_1: b2_4, ba2_2: b2_5 },
      },
      bds: emptyFuncaoSlot(),
      ptr1: emptyFuncaoSlot(),
      ptr2: emptyFuncaoSlot(),
      ptr3: emptyFuncaoSlot(),
      atestados: [],
      trocas: [],
      radio: [],
      extras: [],
    }));
  }

  async function autoPreencherGuarnicoes() {
    if (!form.equipe || !form.dataPlantao || autoFilling) return;
    setAutoFilling(true);
    try {
      const [all, gozos, escalas, vigs, completas, trocasDocs, substituicoesDocs] = await Promise.all([
        listarAtivos(),
        listarFeriasGozo(),
        listarEscalasFerias(),
        listarVigencias({ ativa: true }),
        listarCompletas(),
        listarTrocasServicoAssinadas(),
        listarSubstituicoesTemporarias(),
      ]);
      const substituicoesAprovadas = substituicoesDocs.filter(s => s.status === 'Aprovada');
      const extrasDoDia = montarExtrasAfastamentoDoDia({
        substituicoes: substituicoesAprovadas,
        bombeiros: all,
        vigencias: vigs,
        equipe: form.equipe,
        dataPlantao: form.dataPlantao,
      });
      const atestadosDoDia = montarAtestadosAfastamentoDoDia({
        substituicoes: substituicoesAprovadas,
        bombeiros: all,
        vigencias: vigs,
        equipe: form.equipe,
        dataPlantao: form.dataPlantao,
      });
      const extraPorFuncionario = new Map(extrasDoDia.map(extra => [extra.funcionarioId || '', extra]));
      const afastadosPorExtra = new Set(extrasDoDia.map(extra => extra.funcionarioId).filter(Boolean));
      const substitutosPorExtra = new Set(extrasDoDia.map(extra => extra.substitutoId).filter(Boolean));

      setAllBombeiros(all);
      setFeriasGozo(gozos);
      setVigencias(vigs);
      setTrocaFills(trocasDocs);
      setSubstituicoesTemporarias(substituicoesDocs);

      const allItems: any[] = [];
      for (const esc of escalas) {
        if (esc.status !== 'Aprovado') continue;
        const its = await listarItensEscala(esc.id);
        for (const i of its) {
          if (!i.rejeitado && i.feriasGozoId) allItems.push(i);
        }
      }

      const dateObj = parseDataLocalISO(form.dataPlantao);

      function isEmGozo(bId: string) {
        return gozos.find((g: any) => {
          if (g.funcionarioId !== bId || g.status === 'Gozadas') return false;
          return dataNoPeriodo(form.dataPlantao, g.dataInicio, g.dataFim);
        });
      }

      // Encontrar substituto de uma pessoa (troca → vigência → gozo → item)
      function encontrarSubstituto(bId: string): { id: string; nome: string } | null {
        const extra = extraPorFuncionario.get(bId);
        if (extra?.substitutoId) {
          return { id: extra.substitutoId, nome: extra.nomeEntrandoCompleto || extra.nomeEntrando };
        }
        const pessoa = all.find((bb: any) => bb.id === bId);
        if (pessoa) {
          const pNome = pessoa.nomeCompleto?.toLowerCase();
          const pGuerra = pessoa.nomeGuerra?.toLowerCase();
          const troca = trocasDocs.find((fl: any) => {
            const fd = fl?.filled_data || {};
            const solNome = String(fd?.nome_solicitante || '').toLowerCase();
            const solicNome = String(fd?.nome_solicitado || '').toLowerCase();
            if (mesmoDiaISO(fd?.data_solicitada, form.dataPlantao) && (solNome === pNome || solNome === pGuerra)) return true;
            if (mesmoDiaISO(fd?.data_folga_solicitado, form.dataPlantao) && (solicNome === pNome || solicNome === pGuerra)) return true;
            return false;
          });
          if (troca) {
            const fd = troca.filled_data || {};
            const isSol = String(fd?.nome_solicitante || '').toLowerCase() === pNome || String(fd?.nome_solicitante || '').toLowerCase() === pGuerra;
            const quem = isSol ? fd?.nome_solicitado : fd?.nome_solicitante;
            const sub = all.find((bb: any) => bb.nomeCompleto === quem || bb.nomeGuerra === quem);
            if (sub) return { id: sub.id, nome: sub.nomeCompleto };
          }
        }
        const v = vigs.find((vx: any) =>
          vx.funcionarioOriginalId === bId &&
          vx.ativa &&
          dataNoPeriodo(form.dataPlantao, vx.dataInicio, vx.dataFim)
        );
        if (v && v.substitutoId) return { id: v.substitutoId, nome: v.substitutoNome };
        const g = gozos.find((gx: any) =>
          gx.funcionarioId === bId &&
          gx.substitutoId &&
          gx.status !== 'Gozadas' &&
          dataNoPeriodo(form.dataPlantao, gx.dataInicio, gx.dataFim)
        );
        if (g) return { id: g.substitutoId, nome: g.substitutoNome };
        const item = allItems.find((ix: any) =>
          ix.funcionarioId === bId &&
          (ix.substitutoId || ix.feristaId) &&
          dataNoPeriodo(form.dataPlantao, ix.dataInicio, ix.dataFim)
        );
        if (item) return { id: item.substitutoId || item.feristaId, nome: item.substitutoNome || item.feristaNome };
        return null;
      }

      // ── 1. Tentar usar a escala mensal como base ──
      const mensal = completas.find((c: any) =>
        c.config.equipe === form.equipe &&
        c.config.mes === (dateObj.getMonth() + 1) &&
        c.config.ano === dateObj.getFullYear()
      );

      let slotChefe = '';
      let slotCrsBaMc = '', slotCrsBaLr = '', slotCrsBaRe1 = '', slotCrsBaRe2 = '';
      let slotCci02BaMc = '', slotCci02BaCe = '', slotCci02Ba2 = '';
      let slotCci03BaMc = '', slotCci03Ba2_1 = '', slotCci03Ba2_2 = '';
      const usados = new Set<string>();

      if (mensal) {
        const pessoas = mensal.config.pessoas;
        const mapeamento: [number, (v: string) => void][] = [
          [0, v => { slotChefe = v; slotCci02BaCe = v; }],  // Chefe BA-CE
          [1, v => slotCrsBaLr = v],  // Líder BA-LR
          [2, v => slotCrsBaMc = v],  // Condutor BA-MC CRS
          [3, v => slotCci02BaMc = v], // Condutor BA-MC CCI F2
          [4, v => slotCci03BaMc = v], // Condutor BA-MC CCI F3
          [5, v => slotCrsBaRe1 = v],  // BA-2 CRS 1
          [6, v => slotCrsBaRe2 = v],  // BA-2 CRS 2
          [7, v => slotCci02Ba2 = v],  // BA-2 CCI F2
          [8, v => slotCci03Ba2_1 = v], // BA-2 CCI F3 1
          [9, v => slotCci03Ba2_2 = v], // BA-2 CCI F3 2
        ];
        for (const [idx, setter] of mapeamento) {
          const p = pessoas[idx];
          if (!p || !p.nomeGuerra) continue;
          // Verificar se a pessoa tem substituto no dia (férias, troca ou vigência)
          const b = all.find((bb: any) => bb.nomeGuerra === p.nomeGuerra);
          if (b) {
            const subInfo = encontrarSubstituto(b.id);
            if (subInfo) {
              const sub = all.find((bb: any) => bb.id === subInfo.id);
              if (sub && !usados.has(sub.id)) {
                setter(sub.nomeGuerra);
                usados.add(sub.id);
                continue;
              }
            }
            // Não tem substituto disponível → mantém o original
            if (!usados.has(b.id)) {
              setter(p.nomeGuerra);
              usados.add(b.id);
            }
          }
        }
      }

      // ── 2. Pool para preencher slots que ficaram vazios ──
      const pool: { bombeiro: any; cargo: string }[] = [];
      const ocupados = new Set<string>();
      const substituidosNoDia = new Set<string>();
      for (const v of vigs) {
        if (!v.ativa || !v.substitutoId || v.substitutoId === v.funcionarioOriginalId) continue;
        if (!dataNoPeriodo(form.dataPlantao, v.dataInicio, v.dataFim)) continue;
        const original = all.find((bb: any) => bb.id === v.funcionarioOriginalId);
        if ((original?.equipe || v.equipe) === form.equipe) substituidosNoDia.add(v.funcionarioOriginalId);
      }
      const trocaExcluidosNoDia = new Set<string>();
      const trocaIncluidosNoDia: { bombeiro: any; cargo: string }[] = [];
      for (const fl of trocasDocs) {
        const fd = fl?.filled_data || {};
        const solDia = mesmoDiaISO(fd?.data_solicitada, form.dataPlantao);
        const solicDia = mesmoDiaISO(fd?.data_folga_solicitado, form.dataPlantao);
        if ((!solDia && !solicDia) || !fd?.nome_solicitante || !fd?.nome_solicitado) continue;
        const sol = all.find((bb: any) => bb.nomeCompleto === fd.nome_solicitante || bb.nomeGuerra === fd.nome_solicitante);
        const solic = all.find((bb: any) => bb.nomeCompleto === fd.nome_solicitado || bb.nomeGuerra === fd.nome_solicitado);
        if (!sol || !solic) continue;
        if (solDia && sol.equipe === form.equipe) {
          trocaExcluidosNoDia.add(sol.id);
          trocaExcluidosNoDia.add(solic.id);
          trocaIncluidosNoDia.push({ bombeiro: solic, cargo: sol.cargo });
        } else if (solicDia && solic.equipe === form.equipe) {
          trocaExcluidosNoDia.add(sol.id);
          trocaExcluidosNoDia.add(solic.id);
          trocaIncluidosNoDia.push({ bombeiro: sol, cargo: solic.cargo });
        }
      }
      for (const extra of extrasDoDia) {
        const substituto = all.find((bb: any) => bb.id === extra.substitutoId);
        if (substituto && !ocupados.has(substituto.id) && !usados.has(substituto.id)) {
          pool.push({ bombeiro: substituto, cargo: extra.funcaoEntrando || substituto.cargo });
          ocupados.add(substituto.id);
        }
      }
      for (const m of all.filter((b: any) => b.equipe === form.equipe)) {
        if (usados.has(m.id) || substituidosNoDia.has(m.id) || trocaExcluidosNoDia.has(m.id) || afastadosPorExtra.has(m.id) || substitutosPorExtra.has(m.id)) continue;
        if (!isEmGozo(m.id)) {
          pool.push({ bombeiro: m, cargo: m.cargo });
          continue;
        }
        const subInfo = encontrarSubstituto(m.id);
        if (subInfo) {
          const sub = all.find((bb: any) => bb.id === subInfo.id);
          if (sub && !ocupados.has(sub.id) && !usados.has(sub.id)) {
            pool.push({ bombeiro: sub, cargo: m.cargo });
            ocupados.add(sub.id);
          }
        }
      }
      for (const v of vigs) {
        if (v.ativa && v.equipe === form.equipe && dataNoPeriodo(form.dataPlantao, v.dataInicio, v.dataFim) && !ocupados.has(v.substitutoId) && !usados.has(v.substitutoId)) {
          const sub = all.find((bb: any) => bb.id === v.substitutoId);
          if (sub) { pool.push({ bombeiro: sub, cargo: v.cargoExercido || sub.cargo }); ocupados.add(sub.id); }
        }
      }
      for (const t of trocaIncluidosNoDia) {
        if (!ocupados.has(t.bombeiro.id) && !usados.has(t.bombeiro.id)) {
          pool.push({ bombeiro: t.bombeiro, cargo: t.cargo });
          ocupados.add(t.bombeiro.id);
        }
      }

      // ── 3. Aplicar trocas temporárias ──
      const trocasAtivas = substituicoesAprovadas.filter(s =>
        s.tipo !== 'Afastamento' &&
        s.status === 'Aprovada' &&
        estaNoPeriodoISO(form.dataPlantao, s.dataInicio, s.dataFim)
      );
      // Aplicar swaps nos nomes dos slots
      for (const t of trocasAtivas) {
        const slotsAtuais = [slotChefe, slotCrsBaMc, slotCrsBaLr, slotCrsBaRe1, slotCrsBaRe2,
          slotCci02BaMc, slotCci02BaCe, slotCci02Ba2, slotCci03BaMc, slotCci03Ba2_1, slotCci03Ba2_2];
        const setVars: ((v: string) => void)[] = [
          v => slotChefe = v, v => slotCrsBaMc = v, v => slotCrsBaLr = v,
          v => slotCrsBaRe1 = v, v => slotCrsBaRe2 = v, v => slotCci02BaMc = v,
          v => slotCci02BaCe = v, v => slotCci02Ba2 = v, v => slotCci03BaMc = v,
          v => slotCci03Ba2_1 = v, v => slotCci03Ba2_2 = v,
        ];
        const saindoNome = t.funcionarioNome;
        const entrandoNome = t.substitutoNome;
        // Procurar o "saindo" nos slots (pelo nomeGuerra ou nome completo)
        const idxSaindo = slotsAtuais.findIndex(s => {
          const b = all.find((bb: any) => bb.nomeGuerra === s || bb.nomeCompleto === s);
          return b && (b.nome === saindoNome || b.nomeCompleto === saindoNome || b.nomeGuerra === saindoNome);
        });
        const idxEntrando = slotsAtuais.findIndex(s => {
          const b = all.find((bb: any) => bb.nomeGuerra === s || bb.nomeCompleto === s);
          return b && (b.nome === entrandoNome || b.nomeCompleto === entrandoNome || b.nomeGuerra === entrandoNome);
        });
        if (idxSaindo !== -1 && idxEntrando !== -1) {
          const temp = slotsAtuais[idxSaindo];
          setVars[idxSaindo](slotsAtuais[idxEntrando]);
          setVars[idxEntrando](temp);
        } else if (idxSaindo !== -1) {
          // "Saindo" está num slot mas "entrando" não → substituir no pool
          const entrandoPool = pool.find(p => p.bombeiro.nome === entrandoNome || p.bombeiro.nomeCompleto === entrandoNome);
          if (entrandoPool) {
            setVars[idxSaindo](entrandoPool.bombeiro.nomeGuerra);
          }
        }
      }

      // ── 4. Preencher slots vazios com pool ──
      const buscarPool = (cargo: string) => {
        const idx = pool.findIndex(p => p.cargo === cargo && !usados.has(p.bombeiro.id));
        if (idx === -1) return null;
        usados.add(pool[idx].bombeiro.id);
        return pool[idx];
      };
      if (!slotChefe) { const p = buscarPool('BA-CE'); if (p) slotChefe = p.bombeiro.nomeGuerra; }
      if (!slotCrsBaMc) { const p = buscarPool('BA-MC'); if (p) slotCrsBaMc = p.bombeiro.nomeGuerra; }
      if (!slotCci02BaMc) { const p = buscarPool('BA-MC'); if (p) slotCci02BaMc = p.bombeiro.nomeGuerra; }
      if (!slotCci03BaMc) { const p = buscarPool('BA-MC'); if (p) slotCci03BaMc = p.bombeiro.nomeGuerra; }
      if (!slotCrsBaLr) { const p = buscarPool('BA-LR'); if (p) slotCrsBaLr = p.bombeiro.nomeGuerra; }
      if (!slotCrsBaRe1) { const p = buscarPool('BA-2') || buscarPool('BA-RE'); if (p) slotCrsBaRe1 = p.bombeiro.nomeGuerra; }
      if (!slotCrsBaRe2) { const p = buscarPool('BA-2') || buscarPool('BA-RE'); if (p) slotCrsBaRe2 = p.bombeiro.nomeGuerra; }
      if (!slotCci02Ba2) { const p = buscarPool('BA-2') || buscarPool('BA-RE'); if (p) slotCci02Ba2 = p.bombeiro.nomeGuerra; }
      if (!slotCci03Ba2_1) { const p = buscarPool('BA-2') || buscarPool('BA-RE'); if (p) slotCci03Ba2_1 = p.bombeiro.nomeGuerra; }
      if (!slotCci03Ba2_2) { const p = buscarPool('BA-2') || buscarPool('BA-RE'); if (p) slotCci03Ba2_2 = p.bombeiro.nomeGuerra; }

      // ── 5. Preencher escala de rádio ──
      let radioPreenchido: { funcao: string; nomeGuerra: string; horarioInicio: string; horarioFim: string }[] = [];
      if (mensal) {
        const plantaoDia = mensal.paradas.find((p: any) => p.dia === dateObj.getDate());
        let radioSlots: { horario: string; horarioFim: string; pessoaNomeGuerra: string; fixo: boolean }[] = [];
        if (plantaoDia && plantaoDia.radio.length > 0) {
          radioSlots = plantaoDia.radio;
        } else if (mensal.config.pessoas.some((p: any) => p?.id)) {
          const idxPlantao = dateObj.getDate();
          const radioGerado = gerarRadioPlantao(mensal.config.pessoas, idxPlantao, form.equipe);
          radioSlots = radioGerado;
        }
        if (radioSlots.length > 0) {
          radioPreenchido = radioSlots.map((r: any) => {
            const pessoa = all.find((bb: any) => bb.nomeGuerra === r.pessoaNomeGuerra);
            let nomeFinal = r.pessoaNomeGuerra;
            const subInfo = pessoa ? encontrarSubstituto(pessoa.id) : null;
            if (subInfo) {
              const sub = all.find((bb: any) => bb.id === subInfo.id);
              if (sub) nomeFinal = sub.nomeGuerra;
            }
            const pessoaFinal = all.find((bb: any) => bb.nomeGuerra === nomeFinal);
            return {
              funcao: pessoaFinal?.cargo || 'BA-2',
              nomeGuerra: nomeFinal,
              horarioInicio: r.horario,
              horarioFim: r.horarioFim,
            };
          });
        }
      }

      setForm(f => ({
        ...f,
        chefeEquipe: slotChefe || f.chefeEquipe,
        guarnicoes: {
          crs: {
            baMc: slotCrsBaMc || f.guarnicoes?.crs?.baMc || '',
            baLr: slotCrsBaLr || f.guarnicoes?.crs?.baLr || '',
            baRe1: slotCrsBaRe1 || f.guarnicoes?.crs?.baRe1 || '',
            baRe2: slotCrsBaRe2 || f.guarnicoes?.crs?.baRe2 || '',
          },
          cci02: {
            baMc: slotCci02BaMc || f.guarnicoes?.cci02?.baMc || '',
            baCe: slotCci02BaCe || f.guarnicoes?.cci02?.baCe || '',
            ba2: slotCci02Ba2 || f.guarnicoes?.cci02?.ba2 || '',
          },
          cci03: {
            baMc: slotCci03BaMc || f.guarnicoes?.cci03?.baMc || '',
            ba2_1: slotCci03Ba2_1 || f.guarnicoes?.cci03?.ba2_1 || '',
            ba2_2: slotCci03Ba2_2 || f.guarnicoes?.cci03?.ba2_2 || '',
          },
        },
        atestados: atestadosDoDia,
        extras: extrasDoDia,
        radio: radioPreenchido.length > 0 ? radioPreenchido : f.radio,
      }));
    } catch (err) {
      console.error('Erro no auto-preenchimento:', err);
    } finally {
      setAutoFilling(false);
    }
  }

  function updateGuarnicao(section: 'cci02' | 'cci03' | 'crs', field: string, value: string) {
    setForm(f => ({
      ...f,
      guarnicoes: { ...f.guarnicoes, [section]: { ...((f.guarnicoes as any)?.[section]), [field]: value } },
    }));
  }

  function updateInstrutor(section: InstrutorSection, field: 'funcao' | 'nomeGuerra' | 'assunto', value: string) {
    setForm(f => ({
      ...f,
      [section]: { ...f[section], [field]: value, ...(field === 'funcao' ? { nomeGuerra: '' } : {}) },
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      ...form,
      trocas: montarTrocasServicoDoDia({
        bombeiros: allBombeiros,
        trocaFills,
        equipe: form.equipe,
        dataPlantao: form.dataPlantao,
      }),
    });
  }

  const autoPreencherButton = (
    <button type="button" onClick={autoPreencherGuarnicoes} disabled={!form.equipe || autoFilling}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-aviation-300 bg-white px-4 py-2.5 text-sm font-medium text-aviation-700 transition-all duration-200 hover:bg-aviation-50 disabled:opacity-50 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300 dark:hover:bg-aviation-900/30 sm:w-auto">
      {autoFilling ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-aviation-700 border-t-transparent dark:border-aviation-300" />
      ) : (
        <Sparkles className="h-4 w-4" />
      )}
      {autoFilling ? 'Preenchendo...' : 'Auto-Preenchimento'}
    </button>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" data-escala-diaria-tour="diaria-form-topo">
        <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">
          {escala?.id ? 'Editar Escala Diária' : escala ? 'Clonar Escala Diária' : 'Nova Escala Diária'}
        </h3>
        <span data-escala-diaria-tour="diaria-auto">{autoPreencherButton}</span>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(180px,0.9fr)_minmax(260px,1.2fr)_minmax(180px,0.9fr)]">
          <div>
            <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Equipe</label>
            <select value={form.equipe} onChange={e => updateEquipe(e.target.value)}
              className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated"
              disabled={!canManageGlobal}>
              <option value="" className={optionCls}>Selecionar equipe</option>
              {EQUIPES.filter(eq => canManageGlobal || eq === equipeEfetiva).map(eq => <option key={eq} value={eq} className={optionCls}>{eq}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Chefe de Equipe - SCI NVT</label>
            <SearchSelect value={form.chefeEquipe} onChange={v => setForm(f => ({ ...f, chefeEquipe: v }))} placeholder="Selecione o chefe" options={opcoesChefe} cargo="BA-CE" showCargo showEquipe />
            {form.chefeEquipe && (() => {
              const b = allBombeiros.find(x => x.nomeGuerra === form.chefeEquipe);
              const aviso = b ? validarCursoParaFuncao(b, 'BA-CE') : null;
              return aviso ? (
                <div className={`mt-1.5 flex items-start gap-2 rounded-lg px-2.5 py-2 text-[11px] leading-tight ${
                  aviso.nivel === 'bloqueado'
                    ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                }`}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{aviso.mensagem}</span>
                </div>
              ) : null;
            })()}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Data do Plantão</label>
            <input type="date" value={form.dataPlantao} onChange={e => {
              userChangedScheduleRef.current = true;
              setForm(f => ({ ...f, dataPlantao: e.target.value }));
            }}
              className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Horário Início</label>
            <input type="time" value={form.horarioInicio} disabled
              className="w-full rounded-xl border border-graphite-200/60 bg-graphite-100/50 px-3 py-2.5 text-sm text-graphite-400 dark:border-border-dark dark:bg-surface-card dark:text-graphite-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Horário Término</label>
            <input type="time" value={form.horarioTermino} disabled
              className="w-full rounded-xl border border-graphite-200/60 bg-graphite-100/50 px-3 py-2.5 text-sm text-graphite-400 dark:border-border-dark dark:bg-surface-card dark:text-graphite-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Turno</label>
            <input value={form.turno} disabled
              className="w-full rounded-xl border border-graphite-200/60 bg-graphite-100/50 px-3 py-2.5 text-sm text-graphite-400 dark:border-border-dark dark:bg-surface-card dark:text-graphite-500" />
          </div>
        </div>
      </div>

      {/* Guarnições */}
      <fieldset data-escala-diaria-tour="diaria-guarnicoes">
        <legend className="mb-4 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">
          <Shield className="mr-1 inline h-4 w-4" /> Guarnições
        </legend>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* CCI 02 */}
          <div className="rounded-xl border border-graphite-200/60 bg-graphite-50/50 p-4 dark:border-border-dark dark:bg-surface-card/50">
            <h4 className="mb-3 text-sm font-bold text-graphite-700 dark:text-graphite-300">CCI 02</h4>
            <div className="space-y-3">
              <SlotFuncao label="BA-MC" value={form.guarnicoes?.cci02?.baMc || ''} onChange={v => updateGuarnicao('cci02', 'baMc', v)} allBombeiros={allBombeiros} veiculo="cci" options={opcoesBaMc} cargoFiltro="BA-MC" />
              <SlotFuncao label="BA-CE" value={form.guarnicoes?.cci02?.baCe || ''} onChange={v => updateGuarnicao('cci02', 'baCe', v)} allBombeiros={allBombeiros} options={opcoesChefe} cargoFiltro="BA-CE" />
              <SlotFuncao label="BA-2" value={form.guarnicoes?.cci02?.ba2 || ''} onChange={v => updateGuarnicao('cci02', 'ba2', v)} allBombeiros={allBombeiros} options={opcoesBa2} cargoFiltro="BA-2" />
            </div>
          </div>
          {/* CCI 03 */}
          <div className="rounded-xl border border-graphite-200/60 bg-graphite-50/50 p-4 dark:border-border-dark dark:bg-surface-card/50">
            <h4 className="mb-3 text-sm font-bold text-graphite-700 dark:text-graphite-300">CCI 03</h4>
            <div className="space-y-3">
              <SlotFuncao label="BA-MC" value={form.guarnicoes?.cci03?.baMc || ''} onChange={v => updateGuarnicao('cci03', 'baMc', v)} allBombeiros={allBombeiros} veiculo="cci" options={opcoesBaMc} cargoFiltro="BA-MC" />
              <SlotFuncao label="BA-2" value={form.guarnicoes?.cci03?.ba2_1 || ''} onChange={v => updateGuarnicao('cci03', 'ba2_1', v)} allBombeiros={allBombeiros} options={opcoesBa2} cargoFiltro="BA-2" />
              <SlotFuncao label="BA-2" value={form.guarnicoes?.cci03?.ba2_2 || ''} onChange={v => updateGuarnicao('cci03', 'ba2_2', v)} allBombeiros={allBombeiros} options={opcoesBa2} cargoFiltro="BA-2" />
            </div>
          </div>
          {/* CRS */}
          <div className="rounded-xl border border-graphite-200/60 bg-graphite-50/50 p-4 dark:border-border-dark dark:bg-surface-card/50">
            <h4 className="mb-3 text-sm font-bold text-graphite-700 dark:text-graphite-300">CRS</h4>
            <div className="space-y-3">
              <SlotFuncao label="BA-MC" value={form.guarnicoes?.crs?.baMc || ''} onChange={v => updateGuarnicao('crs', 'baMc', v)} allBombeiros={allBombeiros} veiculo="crs" options={opcoesBaMc} cargoFiltro="BA-MC" />
              <SlotFuncao label="BA-LR" value={form.guarnicoes?.crs?.baLr || ''} onChange={v => updateGuarnicao('crs', 'baLr', v)} allBombeiros={allBombeiros} options={opcoesBaLr} cargoFiltro="BA-LR" />
              <SlotFuncao label="BA-RE" value={form.guarnicoes?.crs?.baRe1 || ''} onChange={v => updateGuarnicao('crs', 'baRe1', v)} allBombeiros={allBombeiros} options={opcoesBaRe} />
              <SlotFuncao label="BA-RE" value={form.guarnicoes?.crs?.baRe2 || ''} onChange={v => updateGuarnicao('crs', 'baRe2', v)} allBombeiros={allBombeiros} options={opcoesBaRe} />
            </div>
          </div>
        </div>
      </fieldset>

      {/* BDS / PTR-1 / PTR-2 / PTR-3 */}
      <div className="space-y-8" data-escala-diaria-tour="diaria-ptrba">
      {INSTRUTOR_SECTIONS.map(({ key: section, label }) => {
        const funcaoSelecionada = form[section].funcao;
        const isApoc = funcaoSelecionada === 'APOC';
        const instrutorOptions = isApoc
          ? undefined
          : funcaoSelecionada
            ? opcoesPorCargo([funcaoSelecionada])
            : efetivoOptions;
        return (
        <fieldset key={section}>
          <legend className="mb-4 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">
            <FileText className="mr-1 inline h-4 w-4" /> {label}
          </legend>
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-48">
              <label className="mb-1 block text-xs font-medium text-graphite-500 dark:text-graphite-400">Função do Instrutor</label>
              <select value={funcaoSelecionada} onChange={e => updateInstrutor(section, 'funcao', e.target.value)}
                className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated">
                <option value="" className={optionCls}>Selecione</option>
                {FUNCOES_BDS_PTR.map(f => <option key={f} value={f} className={optionCls}>{f}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-48">
              <label className="mb-1 block text-xs font-medium text-graphite-500 dark:text-graphite-400">Nome de Guerra (Instrutor)</label>
              <SearchSelect
                value={form[section].nomeGuerra}
                onChange={v => updateInstrutor(section, 'nomeGuerra', v)}
                placeholder="Nome de guerra"
                cargo={isApoc ? 'APOC' : undefined}
                options={instrutorOptions}
                showCargo
                showEquipe
              />
            </div>
          </div>
          {section !== 'bds' && (
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-graphite-500 dark:text-graphite-400">Assunto do PTR-BA</label>
              <select
                value={form[section].assunto || ''}
                onChange={e => updateInstrutor(section, 'assunto', e.target.value)}
                className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated"
              >
                <option value="" className={optionCls}>Selecione o assunto</option>
                {ASSUNTOS_PTRBA.map(assunto => <option key={assunto} value={assunto} className={optionCls}>{assunto}</option>)}
              </select>
            </div>
          )}
        </fieldset>
        );
      })}
      </div>

      {/* Trocas (automáticas - somente leitura) */}
      <div className="space-y-8" data-escala-diaria-tour="diaria-automacoes">
        <fieldset>
          <legend className="mb-4 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">
            <Users className="mr-1 inline h-4 w-4" /> Trocas {form.trocas.length > 0 && <span className="ml-1 text-[10px] text-amber-600">(automáticas - carregadas do sistema)</span>}
          </legend>
          {form.trocas.length === 0 ? (
            <p className="text-sm text-graphite-400 dark:text-graphite-500">Nenhuma troca registrada para este plantão.</p>
          ) : (
            <div className="space-y-2">
              {form.trocas.map((t, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/10">
                  <ArrowRightLeft className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-medium text-graphite-900 dark:text-graphite-100">{t.nomeSaindo}</span>
                    <span className="mx-1.5 text-graphite-400">({t.funcaoSaindo})</span>
                    <ArrowRight className="mx-1 inline h-3 w-3 text-amber-500" />
                    <span className="font-medium text-graphite-900 dark:text-graphite-100">{t.nomeEntrando}</span>
                    <span className="mx-1.5 text-graphite-400">({t.funcaoEntrando})</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-4 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">
            <Users className="mr-1 inline h-4 w-4" /> Extras {form.extras.length > 0 && <span className="ml-1 text-[10px] text-purple-600">(automáticos - afastamento/atestados)</span>}
          </legend>
          {form.extras.length === 0 ? (
            <p className="text-sm text-graphite-400 dark:text-graphite-500">Nenhum extra registrado para este plantão.</p>
          ) : (
            <div className="space-y-2">
              {form.extras.map((extra, i) => {
                const funcaoLabel = extra.cargoOriginalEntrando && extra.cargoOriginalEntrando !== extra.funcaoEntrando
                  ? `${extra.cargoOriginalEntrando} -> ${extra.funcaoEntrando}`
                  : extra.funcaoEntrando;
                return (
                  <div key={`${extra.substitutoId || extra.nomeEntrando}-${i}`} className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50/50 px-4 py-3 dark:border-purple-800 dark:bg-purple-900/10">
                    <Users className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
                    <div className="min-w-0 flex-1 text-sm">
                      <span className="font-medium text-graphite-900 dark:text-graphite-100">{extra.nomeEntrandoCompleto || extra.nomeEntrando}</span>
                      <span className="mx-1.5 text-graphite-400">({funcaoLabel}) substitui</span>
                      <span className="font-medium text-graphite-900 dark:text-graphite-100">{extra.nomeSaindoCompleto || extra.nomeSaindo}</span>
                      <span className="mx-1.5 text-graphite-400">({extra.funcaoSaindo})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-4 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">
            <FileText className="mr-1 inline h-4 w-4" /> Atestados {form.atestados.length > 0 && <span className="ml-1 text-[10px] text-orange-600">(automáticos)</span>}
          </legend>
          {form.atestados.length === 0 ? (
            <p className="text-sm text-graphite-400 dark:text-graphite-500">Nenhum atestado ou afastamento aprovado para este plantão.</p>
          ) : (
            <div className="space-y-2">
              {form.atestados.map((atestado, i) => (
                <div key={`${atestado}-${i}`} className="rounded-xl border border-orange-200 bg-orange-50/50 px-4 py-3 text-sm text-graphite-900 dark:border-orange-800 dark:bg-orange-900/10 dark:text-graphite-100">
                  {atestado}
                </div>
              ))}
            </div>
          )}
        </fieldset>
      </div>

      {/* Escala de Rádio */}
      <fieldset data-escala-diaria-tour="diaria-radio">
        <legend className="mb-4 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">
          <Radio className="mr-1 inline h-4 w-4" /> Escala de Rádio
        </legend>
        <div className="space-y-4">
          {form.radio.map((r, i) => {
            const isApoc = r.funcao === 'APOC';
            const radioOptions = isApoc
              ? undefined
              : r.funcao
                ? opcoesPorCargo([r.funcao])
                : efetivoOptions;
            return (
            <div key={i} className="rounded-xl border border-graphite-200/60 bg-graphite-50/50 p-4 dark:border-border-dark dark:bg-surface-card/50">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-graphite-500">Rádio {i + 1}</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, radio: f.radio.filter((_, j) => j !== i) }))}
                  className="rounded-xl p-1.5 text-alert-red transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs text-graphite-500">Função</label>
                  <select value={r.funcao} onChange={e => {
                    const next = [...form.radio];
                    next[i] = { ...next[i], funcao: e.target.value, nomeGuerra: '' };
                    setForm(f => ({ ...f, radio: next }));
                  }}
                    className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated">
                    <option value="" className={optionCls}>Selecione</option>
                    {FUNCOES_BDS_PTR.map(f => <option key={f} value={f} className={optionCls}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-graphite-500">Nome de Guerra</label>
                  <SearchSelect value={r.nomeGuerra} onChange={v => {
                    const next = [...form.radio];
                    next[i] = { ...next[i], nomeGuerra: v };
                    setForm(f => ({ ...f, radio: next }));
                  }} placeholder="Nome de guerra" cargo={isApoc ? 'APOC' : undefined} options={radioOptions} showCargo showEquipe />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-graphite-500">Início</label>
                  <input type="time" value={r.horarioInicio} onChange={e => {
                    const next = [...form.radio];
                    next[i] = { ...next[i], horarioInicio: e.target.value };
                    setForm(f => ({ ...f, radio: next }));
                  }}
                    className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-graphite-500">Fim</label>
                  <input type="time" value={r.horarioFim} onChange={e => {
                    const next = [...form.radio];
                    next[i] = { ...next[i], horarioFim: e.target.value };
                    setForm(f => ({ ...f, radio: next }));
                  }}
                    className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" />
                </div>
              </div>
            </div>
            );
          })}
          <button type="button" onClick={() => setForm(f => ({ ...f, radio: [...f.radio, { funcao: '', nomeGuerra: '', horarioInicio: '', horarioFim: '' }] }))}
            className="flex items-center gap-1 text-sm text-aviation-600 hover:text-aviation-700 dark:text-aviation-400">
            <Plus className="h-4 w-4" /> Adicionar escala de rádio
          </button>
        </div>
      </fieldset>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-graphite-200 pt-6 dark:border-border-dark" data-escala-diaria-tour="diaria-acoes">
        <button type="button" onClick={onCancel}
          className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2.5 text-sm font-medium text-graphite-700 backdrop-blur-sm transition-all duration-200 hover:bg-graphite-50 hover:border-graphite-300 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200 dark:hover:bg-surface-hover/50">
          Cancelar
        </button>
        <button type="submit"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
          <Save className="h-4 w-4" />
          {escala ? 'Salvar Alterações' : 'Criar Escala'}
        </button>
      </div>
    </form>
  );
}

function EscalaDetalhesConteudo({ escala, printable = false }: { escala: EscalaDiaria; printable?: boolean }) {
  const [vigenciasAtivas, setVigenciasAtivas] = useState<VigenciaSubstituicao[]>([]);
  const grupos = gruposGuarnicaoDetalhe(escala);
  const atestados = (escala.atestados || []).map(atestado => atestado.trim()).filter(Boolean);
  const trocas = escala.trocas || [];
  const extras = escala.extras || [];
  const radio = escala.radio || [];
  const horario = [escala.horarioInicio, escala.horarioTermino].filter(Boolean).join(' - ');

  useEffect(() => {
    if (!escala.dataPlantao || !escala.equipe) return;
    listarVigencias({ equipe: escala.equipe, ativa: true, dataInicio: escala.dataPlantao, dataFim: escala.dataPlantao })
      .then(setVigenciasAtivas)
      .catch(() => setVigenciasAtivas([]));
  }, [escala.dataPlantao, escala.equipe]);

  return (
    <div className={printable ? 'daily-scale-print-content space-y-5 text-graphite-950 print:space-y-2 print:text-[10px] print:leading-tight' : 'space-y-5'}>
      <div className="daily-scale-summary grid grid-cols-2 gap-4 sm:grid-cols-4 print:grid-cols-4 print:gap-2">
        <div>
          <p className="text-xs font-semibold text-graphite-400 dark:text-graphite-500 print:text-graphite-500">Data</p>
          <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100 print:text-[10px] print:text-graphite-950">{formatDate(escala.dataPlantao)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-graphite-400 dark:text-graphite-500 print:text-graphite-500">Hora</p>
          <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100 print:text-[10px] print:text-graphite-950">{valorEscala(horario)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-graphite-400 dark:text-graphite-500 print:text-graphite-500">Turno</p>
          <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100 print:text-[10px] print:text-graphite-950">{valorEscala(escala.turno)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-graphite-400 dark:text-graphite-500 print:text-graphite-500">Chefe</p>
          <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100 print:text-[10px] print:text-graphite-950">{valorEscala(escala.chefeEquipe)}</p>
        </div>
      </div>

      <div className="daily-scale-guarnicoes grid gap-3 lg:grid-cols-3 print:grid-cols-3 print:gap-2">
          {grupos.map(grupo => (
            <div key={grupo.titulo} className="daily-print-avoid-break rounded-xl border border-graphite-200 bg-graphite-50 p-3 dark:border-border-dark dark:bg-surface-hover print:border-graphite-300 print:bg-white print:p-2">
              <p className="text-sm font-bold text-aviation-700 dark:text-aviation-300 print:text-[10px] print:text-aviation-800">{grupo.titulo}</p>
              <div className="mt-3 space-y-2 print:mt-2 print:space-y-1">
                {grupo.linhas.map((linha, index) => (
                  <div key={`${grupo.titulo}-${linha.label}-${index}`} className="grid grid-cols-[72px_1fr] gap-3 rounded-lg border border-graphite-200 bg-white/70 px-3 py-2 dark:border-border-dark dark:bg-surface-card/70 print:grid-cols-[42px_1fr] print:gap-1 print:border-graphite-200 print:bg-white print:px-2 print:py-1">
                    <p className="text-xs font-bold text-aviation-700 dark:text-aviation-300 print:text-[9px] print:text-aviation-800">{linha.label}</p>
                    <p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100 print:text-[10px] print:text-graphite-950">{linha.nome}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      <div className="daily-scale-training-radio grid gap-4 print:gap-2">
          <div className="daily-print-avoid-break rounded-xl border border-graphite-200 bg-graphite-50 p-4 dark:border-border-dark dark:bg-surface-hover print:border-graphite-300 print:bg-white print:p-2">
            <div className="mb-3 flex items-center gap-2 print:mb-2 print:gap-1">
              <FileText className="h-4 w-4 text-aviation-500 print:h-3 print:w-3 print:text-aviation-800" />
              <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100 print:text-[10px] print:text-graphite-950">BDS / PTR</p>
            </div>
            <div className="space-y-2 print:space-y-1">
              {INSTRUTOR_SECTIONS.map(({ key, label }) => {
                const slot = escala[key];
                return (
                  <div key={label} className="grid gap-1 sm:grid-cols-[80px_1fr] print:grid-cols-[48px_1fr] print:gap-1">
                    <p className="text-xs font-bold text-aviation-700 dark:text-aviation-300 print:text-[9px] print:text-aviation-800">{label}</p>
                    <div>
                      <p className="text-sm text-graphite-900 dark:text-graphite-100 print:text-[10px] print:text-graphite-950">{valorEscala(slot?.funcao)}: {valorEscala(slot?.nomeGuerra)}</p>
                      {slot?.assunto && (
                        <p className="mt-0.5 text-xs text-graphite-500 dark:text-graphite-400 print:text-[8px] print:text-graphite-600">Assunto: {slot.assunto}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="daily-print-avoid-break rounded-xl border border-graphite-200 bg-graphite-50 p-4 dark:border-border-dark dark:bg-surface-hover print:border-graphite-300 print:bg-white print:p-2">
            <div className="mb-3 flex items-center gap-2 print:mb-2 print:gap-1">
              <Radio className="h-4 w-4 text-aviation-500 print:h-3 print:w-3 print:text-aviation-800" />
              <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100 print:text-[10px] print:text-graphite-950">Escala de Rádio</p>
            </div>
            {radio.length > 0 ? (
              <div className="space-y-2 print:space-y-1">
                {radio.map((r, index) => (
                  <div key={index} className="grid grid-cols-[58px_minmax(0,1fr)_auto] items-center gap-2 text-sm text-graphite-900 dark:text-graphite-100 print:grid-cols-[40px_minmax(0,1fr)_auto] print:gap-1 print:text-[9px] print:text-graphite-950">
                    <span className="font-bold">{valorEscala(r.funcao)}</span>
                    <span className="min-w-0 truncate font-semibold">{valorEscala(r.nomeGuerra)}</span>
                    <span className="whitespace-nowrap text-graphite-400 dark:text-graphite-500 print:text-graphite-600">
                      {valorEscala(r.horarioInicio)} às {valorEscala(r.horarioFim)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-graphite-500 dark:text-graphite-400">-</p>
            )}
          </div>
      </div>

        {vigenciasAtivas.length > 0 && (
          <div className="daily-scale-substituicoes daily-print-avoid-break rounded-xl border border-graphite-200 bg-graphite-50 p-4 dark:border-border-dark dark:bg-surface-hover print:border-graphite-300 print:bg-white print:p-2">
            <div className="mb-3 flex items-center gap-2 print:mb-2 print:gap-1">
              <Shield className="h-4 w-4 text-aviation-500 print:h-3 print:w-3 print:text-aviation-800" />
              <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100 print:text-[10px] print:text-graphite-950">Substituições Ativas</p>
            </div>
            <div className="space-y-2 print:space-y-1">
              {vigenciasAtivas.map((v, index) => (
                <p key={index} className="text-sm text-graphite-900 dark:text-graphite-100 print:text-[9px] print:text-graphite-950">
                  <span className="font-semibold">{v.substitutoNome}</span>
                  <span className="text-graphite-400"> ({v.cargoExercido}) substitui </span>
                  <span className="font-semibold">{v.funcionarioOriginalNome}</span>
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="daily-scale-footer grid gap-4 print:gap-2">
          <div className="daily-print-avoid-break h-full rounded-xl border border-graphite-200 bg-graphite-50 p-4 dark:border-border-dark dark:bg-surface-hover print:border-graphite-300 print:bg-white print:p-2">
            <p className="mb-3 text-sm font-bold text-graphite-900 dark:text-graphite-100 print:mb-2 print:text-[10px] print:text-graphite-950">Trocas</p>
            <div className="space-y-1 print:space-y-0.5">
              {trocas.map((troca, index) => (
                <p key={index} className="text-sm text-graphite-900 dark:text-graphite-100 print:text-[9px] print:text-graphite-950">
                  {troca.funcaoSaindo} {troca.nomeSaindo} ↔ {troca.funcaoEntrando} {troca.nomeEntrando}
                </p>
              ))}
            </div>
          </div>

          <div className="daily-print-avoid-break h-full rounded-xl border border-graphite-200 bg-graphite-50 p-4 dark:border-border-dark dark:bg-surface-hover print:border-graphite-300 print:bg-white print:p-2">
            <p className="mb-3 text-sm font-bold text-graphite-900 dark:text-graphite-100 print:mb-2 print:text-[10px] print:text-graphite-950">Extras</p>
            <div className="space-y-1 print:space-y-0.5">
              {extras.map((extra, index) => {
                const funcaoLabel = extra.cargoOriginalEntrando && extra.cargoOriginalEntrando !== extra.funcaoEntrando
                  ? `${extra.cargoOriginalEntrando} -> ${extra.funcaoEntrando}`
                  : extra.funcaoEntrando;
                return (
                  <p key={index} className="text-sm text-graphite-900 dark:text-graphite-100 print:text-[9px] print:text-graphite-950">
                    {funcaoLabel} {extra.nomeEntrandoCompleto || extra.nomeEntrando} substitui {extra.funcaoSaindo} {extra.nomeSaindoCompleto || extra.nomeSaindo}
                  </p>
                );
              })}
            </div>
          </div>

          <div className="daily-print-avoid-break h-full rounded-xl border border-graphite-200 bg-graphite-50 p-4 dark:border-border-dark dark:bg-surface-hover print:border-graphite-300 print:bg-white print:p-2">
            <p className="mb-3 text-sm font-bold text-graphite-900 dark:text-graphite-100 print:mb-2 print:text-[10px] print:text-graphite-950">Atestados</p>
            <div className="space-y-1 print:space-y-0.5">
              {atestados.map((atestado, index) => (
                <p key={index} className="text-sm text-graphite-900 dark:text-graphite-100 print:text-[9px] print:text-graphite-950">{atestado}</p>
              ))}
            </div>
          </div>
        </div>
    </div>
  );
}

// ─── LIST VIEW ──────────────────────────────────────────────
function EscalaCard({ escala, onPrint, onEdit, onDelete, onClone, canManage }: {
  escala: EscalaDiaria;
  onPrint: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClone: () => void;
  canManage: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setExpanded(current => !current)}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setExpanded(current => !current);
        }
      }}
      className="rounded-2xl border border-graphite-200/60 bg-white/80 p-4 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-aviation-300 hover:bg-white hover:shadow-md dark:border-border-dark dark:bg-surface-card dark:hover:border-aviation-700 dark:hover:bg-surface-elevated"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-aviation-50 to-aviation-100 shadow-sm dark:from-aviation-900/30 dark:to-aviation-800/20">
            <Calendar className="h-5 w-5 text-aviation-600 dark:text-aviation-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">
              {escala.equipe} - {formatDate(escala.dataPlantao)}
            </p>
            <p className="text-xs text-graphite-500">
              {escala.turno} · {escala.horarioInicio} às {escala.horarioTermino}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={event => { event.stopPropagation(); onPrint(); }} title="Imprimir escala"
            className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
            <Printer className="h-4 w-4" />
          </button>
          {canManage && (
            <>
              <button onClick={event => { event.stopPropagation(); onEdit(); }} title="Editar"
                className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={event => { event.stopPropagation(); onClone(); }} title="Clonar"
                className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
                <Copy className="h-4 w-4" />
              </button>
            </>
          )}
          {canManage && (
            <button onClick={event => { event.stopPropagation(); onDelete(); }} title="Excluir"
              className="rounded-xl p-1.5 text-alert-red transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button onClick={event => { event.stopPropagation(); setExpanded(!expanded); }} title={expanded ? 'Recolher resumo' : 'Expandir resumo'}
            className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-graphite-200 pt-4 dark:border-border-dark">
          <EscalaDetalhesConteudo escala={escala} />
        </div>
      )}
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────
export function EscalaDiariaView() {
  const { user, canManageGlobal, canManageEquipe, equipeEfetiva } = useContextoOperacional();
  const username = user?.username || '';
  const canCreate = canManageGlobal || !!equipeEfetiva;
  const [escalas, setEscalas] = useState<EscalaDiaria[]>([]);
  const [mode, setMode] = useState<'list' | 'form' | 'print'>('list');
  const [editando, setEditando] = useState<EscalaDiaria | null>(null);
  const [visualizando, setVisualizando] = useState<EscalaDiaria | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [filterMode, setFilterMode] = useState<'mes-ano' | 'periodo'>('mes-ano');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const tutorialOrigemRef = useRef<{
    mode: 'list' | 'form' | 'print';
    editando: EscalaDiaria | null;
    visualizando: EscalaDiaria | null;
    scrollX: number;
    scrollY: number;
  } | null>(null);
  const escalasFiltradas = useMemo(() => {
    let lista = escalas;
    if (filtroEquipe) lista = lista.filter(e => e.equipe === filtroEquipe);
    if (filterMode === 'mes-ano') {
      if (filtroAno) lista = lista.filter(e => e.dataPlantao?.startsWith(filtroAno));
      if (filtroMes) lista = lista.filter(e => (parseDataLocalISO(e.dataPlantao).getMonth() + 1).toString() === filtroMes);
    } else {
      if (dataInicio) lista = lista.filter(e => e.dataPlantao >= dataInicio);
      if (dataFinal) lista = lista.filter(e => e.dataPlantao <= dataFinal);
    }
    return lista;
  }, [escalas, filtroEquipe, filterMode, filtroAno, filtroMes, dataInicio, dataFinal]);

  function tutorialIndexInicial(): number {
    const formIndex = ESCALA_DIARIA_TOUR_STEPS.findIndex(step => step.mode === 'form');
    return mode === 'form' && formIndex >= 0 ? formIndex : 0;
  }

  function abrirTutorialDiaria() {
    if (showTutorial || !canCreate) return;
    tutorialOrigemRef.current = {
      mode,
      editando,
      visualizando,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
    setTutorialStepIndex(tutorialIndexInicial());
    setShowTutorial(true);
  }

  function fecharTutorialDiaria() {
    const origem = tutorialOrigemRef.current;
    setShowTutorial(false);
    if (origem) {
      setMode(origem.mode);
      setEditando(origem.editando);
      setVisualizando(origem.visualizando);
      window.setTimeout(() => {
        window.scrollTo({ left: origem.scrollX, top: origem.scrollY, behavior: 'smooth' });
      }, 80);
    }
    tutorialOrigemRef.current = null;
  }

  function voltarTutorialDiaria() {
    setTutorialStepIndex(index => Math.max(0, index - 1));
  }

  function avancarTutorialDiaria() {
    if (tutorialStepIndex >= ESCALA_DIARIA_TOUR_STEPS.length - 1) {
      fecharTutorialDiaria();
      return;
    }
    setTutorialStepIndex(tutorialStepIndex + 1);
  }

  useEffect(() => {
    if (!showTutorial) return;
    const tourStep = ESCALA_DIARIA_TOUR_STEPS[tutorialStepIndex] || ESCALA_DIARIA_TOUR_STEPS[0];
    if (tourStep.mode === 'form' && mode !== 'form') {
      setEditando(null);
      setMode('form');
    }
    if (tourStep.mode === 'list' && mode !== 'list') setMode('list');
  }, [showTutorial, tutorialStepIndex, mode]);

  function renderBotaoTutorialDiaria() {
    if (showTutorial || !canCreate) return null;
    return (
      <button
        type="button"
        onClick={abrirTutorialDiaria}
        aria-label="Abrir tutorial animado da Escala Diária"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-aviation-500 to-aviation-700 text-white shadow-2xl shadow-aviation-500/30 ring-4 ring-white/70 transition-all hover:scale-105 hover:from-aviation-400 hover:to-aviation-600 dark:ring-graphite-900/80"
      >
        <HelpCircle className="h-7 w-7" />
      </button>
    );
  }

  function renderTutorialDiaria() {
    return (
      <AnimatedPageTour
        open={showTutorial}
        steps={ESCALA_DIARIA_TOUR_STEPS}
        stepIndex={tutorialStepIndex}
        targetAttribute="data-escala-diaria-tour"
        onBack={voltarTutorialDiaria}
        onNext={avancarTutorialDiaria}
        onClose={fecharTutorialDiaria}
      />
    );
  }

  async function carregar() {
    const [todas, bombeiros, trocas, substituicoes, vigencias] = await Promise.all([
      listarEscalas(),
      listarAtivos().catch(() => []),
      listarTrocasServicoAssinadas().catch(() => []),
      listarSubstituicoesTemporarias().catch(() => []),
      listarVigencias({ ativa: true }).catch(() => []),
    ]);
    const substituicoesAprovadas = substituicoes.filter(s => s.status === 'Aprovada');
    setEscalas(todas.map(escala => {
      const extras = montarExtrasAfastamentoDoDia({
        substituicoes: substituicoesAprovadas,
        bombeiros,
        vigencias,
        equipe: escala.equipe,
        dataPlantao: escala.dataPlantao,
      });
      return {
        ...escala,
        chefeEquipe: aplicarExtraNoNome(escala.chefeEquipe, extras),
        guarnicoes: aplicarExtrasNasGuarnicoes(escala.guarnicoes, extras),
        trocas: montarTrocasServicoDoDia({
        bombeiros,
        trocaFills: trocas,
        equipe: escala.equipe,
        dataPlantao: escala.dataPlantao,
        }),
        atestados: montarAtestadosAfastamentoDoDia({
          substituicoes: substituicoesAprovadas,
          bombeiros,
          vigencias,
          equipe: escala.equipe,
          dataPlantao: escala.dataPlantao,
        }),
        extras,
      };
    }));
  }

  useEffect(() => { carregar(); }, [username]);

  async function handleSave(data: Omit<EscalaDiaria, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) {
    const equipeAlvo = canManageGlobal ? data.equipe : equipeEfetiva || data.equipe;
    if (!canManageEquipe(equipeAlvo)) {
      alert('Você só pode salvar escalas da sua equipe efetiva.');
      return;
    }
    if (editando?.id && !canManageEquipe(editando.equipe)) {
      alert('Você só pode editar escalas da sua equipe efetiva.');
      return;
    }
    try {
      const payload = { ...data, equipe: equipeAlvo as string };
      let saved: EscalaDiaria | null;
      if (editando && editando.id) {
        saved = await atualizarEscala(editando.id, payload);
      } else {
        saved = await criarEscala({ ...payload, createdBy: username });
      }
      setEditando(null);
      await carregar();
      if (saved) {
        setVisualizando(saved);
        setMode('list');
      } else {
        setMode('list');
      }
    } catch (err) {
      if (err instanceof RegraNegocioError) {
        alert(err.errors.join('\n'));
      } else {
        alert(err instanceof Error ? err.message : 'Erro ao salvar a escala diária. Contate o administrador.');
      }
    }
  }

  function handleClone(e: EscalaDiaria) {
    if (!canManageEquipe(e.equipe)) {
      alert('Você só pode clonar escalas da sua equipe efetiva.');
      return;
    }
    setEditando({
      ...e,
      id: '',
      createdAt: '',
      updatedAt: '',
      createdBy: '',
      dataPlantao: hojeLocalISO(),
    });
    setMode('form');
  }

  async function handleDelete(id: string) {
    const alvo = escalas.find(e => e.id === id);
    if (!alvo || !canManageEquipe(alvo.equipe)) {
      alert('Você só pode excluir escalas da sua equipe efetiva.');
      setConfirmDelete(null);
      return;
    }
    await excluirEscala(id);
    setConfirmDelete(null);
    carregar();
  }


  if (mode === 'form') {
    return (
      <div>
        {renderBotaoTutorialDiaria()}
        <EscalaDiariaForm
          escala={editando || undefined}
          onSave={handleSave}
          onCancel={() => { setMode('list'); setEditando(null); }}
          canManageGlobal={canManageGlobal}
          equipeEfetiva={equipeEfetiva}
        />
        {renderTutorialDiaria()}
      </div>
    );
  }

  if (mode === 'print' && visualizando) {
    return (
      <ViewMode escala={visualizando} onBack={() => setMode('list')} />
    );
  }

  return (
    <div>
      {renderBotaoTutorialDiaria()}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4" data-escala-diaria-tour="diaria-lista-filtros">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-xl border border-graphite-300/60 bg-white/70 text-xs font-medium dark:border-border-dark dark:bg-surface-card">
            <button onClick={() => setFilterMode('mes-ano')}
              className={`px-3 py-2 transition-colors ${filterMode === 'mes-ano' ? 'bg-aviation-600 text-white' : 'text-graphite-600 hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover'}`}>
              Mês/Ano
            </button>
            <button onClick={() => setFilterMode('periodo')}
              className={`px-3 py-2 transition-colors ${filterMode === 'periodo' ? 'bg-aviation-600 text-white' : 'text-graphite-600 hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover'}`}>
              Período
            </button>
          </div>
          {filterMode === 'mes-ano' ? (
            <>
              <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={inputClass}>
                <option value="">Todos</option>
                {ANOS.map(a => <option key={a} value={a} className={optionCls}>{a}</option>)}
              </select>
              <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className={inputClass}>
                <option value="">Todos os meses</option>
                {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1} className={optionCls}>{m}</option>)}
              </select>
            </>
          ) : (
            <>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputClass} placeholder="Data início" />
              <span className="text-xs text-graphite-400">a</span>
              <input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)} className={inputClass} placeholder="Data fim" />
            </>
          )}
          <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)} className={inputClass}>
            <option value="" className={optionCls}>Todas as equipes</option>
            {EQUIPES.map(eq => <option key={eq} value={eq} className={optionCls}>{eq}</option>)}
          </select>
          <p className="text-sm text-graphite-500 dark:text-graphite-400">
            {escalasFiltradas.length} escala(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canCreate && (
          <button onClick={() => { setEditando(null); setMode('form'); }}
            data-escala-diaria-tour="diaria-nova"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
            <Plus className="h-4 w-4" /> Nova Escala Diária
          </button>
          )}
        </div>
      </div>

      {escalasFiltradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
          <Calendar className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhuma escala encontrada</h3>
          <p className="text-sm text-graphite-400">{canCreate ? 'Clique em "Nova Escala Diária" para criar a primeira.' : 'Nenhuma escala disponível.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {escalasFiltradas.map(e => (
            <EscalaCard
              key={e.id}
              escala={e}
              canManage={canManageEquipe(e.equipe)}
              onPrint={() => { setVisualizando(e); setMode('print'); }}
              onEdit={() => { setEditando(e); setMode('form'); }}
              onClone={() => handleClone(e)}
              onDelete={() => setConfirmDelete(e.id)}
            />
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white/95 p-6 shadow-xl shadow-black/5 backdrop-blur-sm dark:bg-surface-elevated/95 dark:shadow-black/20">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            <p className="mb-6 text-sm text-graphite-500">Tem certeza que deseja excluir esta escala?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2 text-sm font-medium text-graphite-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-graphite-50 hover:border-graphite-300 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200 dark:hover:bg-surface-hover/50">
                Cancelar
              </button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="rounded-xl bg-gradient-to-r from-alert-red to-red-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-red-500/30 active:scale-[0.98]">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
      {renderTutorialDiaria()}
    </div>
  );
}

function ViewMode({ escala, onBack }: { escala: EscalaDiaria; onBack: () => void }) {
  return (
    <div className="mx-auto max-w-5xl">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 6mm; }
          html,
          body,
          #root {
            background: #ffffff !important;
          }
          #print-area.daily-scale-print-area {
            background: #ffffff !important;
            color: #0b0e14 !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: calc(297mm - 12mm) !important;
            display: flex !important;
            flex-direction: column !important;
            overflow: hidden !important;
          }
          #print-area.daily-scale-print-area .daily-print-header {
            background: #060f1f !important;
            color: #ffffff !important;
            border-color: #060f1f !important;
            border-radius: 12px 12px 0 0 !important;
            flex: 0 0 auto !important;
            padding: 7mm 8mm 7mm !important;
          }
          #print-area.daily-scale-print-area .daily-print-header h1,
          #print-area.daily-scale-print-area .daily-print-header p {
            color: #ffffff !important;
          }
          #print-area.daily-scale-print-area .daily-print-team-badge {
            background: #1e3a6e !important;
            border-color: rgba(255, 255, 255, 0.1) !important;
            color: #ffffff !important;
          }
          #print-area.daily-scale-print-area .daily-scale-print-body {
            background: #ffffff !important;
            flex: 1 1 auto !important;
            min-height: 0 !important;
            padding: 5mm 8mm 6mm !important;
          }
          #print-area.daily-scale-print-area .daily-scale-print-content {
            height: 100% !important;
            width: 100% !important;
            display: grid !important;
            grid-template-rows: auto minmax(50mm, 0.8fr) minmax(92mm, 1.35fr) auto minmax(38mm, 0.55fr) !important;
            gap: 3mm !important;
          }
          #print-area.daily-scale-print-area .daily-scale-print-content > * {
            margin-top: 0 !important;
          }
          #print-area.daily-scale-print-area .daily-scale-summary {
            grid-row: 1 !important;
          }
          #print-area.daily-scale-print-area .daily-scale-guarnicoes {
            grid-row: 2 !important;
          }
          #print-area.daily-scale-print-area .daily-scale-training-radio {
            grid-row: 3 !important;
          }
          #print-area.daily-scale-print-area .daily-scale-substituicoes {
            grid-row: 4 !important;
          }
          #print-area.daily-scale-print-area .daily-scale-footer {
            grid-row: 5 !important;
          }
          #print-area.daily-scale-print-area .daily-scale-guarnicoes,
          #print-area.daily-scale-print-area .daily-scale-training-radio,
          #print-area.daily-scale-print-area .daily-scale-footer {
            align-items: stretch !important;
          }
          #print-area.daily-scale-print-area .daily-scale-guarnicoes > *,
          #print-area.daily-scale-print-area .daily-scale-training-radio > *,
          #print-area.daily-scale-print-area .daily-scale-footer > * {
            height: 100% !important;
          }
          #print-area.daily-scale-print-area .daily-scale-training-radio,
          #print-area.daily-scale-print-area .daily-scale-footer {
            grid-template-columns: 1fr !important;
          }
          #print-area.daily-scale-print-area .daily-print-avoid-break {
            padding: 2.8mm !important;
          }
          #print-area.daily-scale-print-area h1 {
            font-size: 22px !important;
            line-height: 1.05 !important;
          }
          #print-area.daily-scale-print-area .daily-scale-print-content p,
          #print-area.daily-scale-print-area .daily-scale-print-content span {
            line-height: 1.18 !important;
          }
          #print-area.daily-scale-print-area,
          #print-area.daily-scale-print-area * {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          #print-area.daily-scale-print-area .daily-print-avoid-break {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print-hidden">
        <div>
          <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">
            Impressão da Escala Diária
          </h3>
          <p className="text-sm text-graphite-500 dark:text-graphite-400">
            {escala.equipe} · {formatDate(escala.dataPlantao)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-3 py-1.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
            <Printer className="h-4 w-4" /> Imprimir
          </button>
          <button onClick={onBack}
            className="rounded-xl border border-graphite-300/60 bg-white/80 px-3 py-1.5 text-sm font-medium text-graphite-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-graphite-50 hover:border-graphite-300 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200 dark:hover:bg-surface-hover/50">
            Fechar
          </button>
        </div>
      </div>
      <div id="print-area" className="daily-scale-print-area overflow-hidden rounded-2xl border border-graphite-200 bg-white shadow-sm dark:border-border-dark dark:bg-surface-card print:border-0 print:bg-white print:shadow-none">
        <div className="daily-print-header border-b border-aviation-900 bg-aviation-900 px-6 py-5 text-white print:px-3 print:py-2">
          <div className="flex flex-wrap items-start justify-between gap-4 print:gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-aviation-100 print:text-[9px]">SESCINC</p>
              <h1 className="mt-1 text-2xl font-bold print:text-lg">Escala Diária</h1>
            </div>
            <div className="daily-print-team-badge rounded-xl bg-aviation-600 px-4 py-2 text-right text-white shadow-sm print:px-2 print:py-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-aviation-100 print:text-[9px]">Equipe</p>
              <p className="text-lg font-bold print:text-sm">{escala.equipe}</p>
            </div>
          </div>
        </div>

        <div className="daily-scale-print-body p-6 print:p-3">
          <EscalaDetalhesConteudo escala={escala} printable />
        </div>
      </div>
    </div>
  );
}
