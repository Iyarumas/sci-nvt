import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar, ChevronDown, ChevronUp, Save, Printer, Pencil,
  Trash2, Radio, Shield, Users, ClipboardList,
  Sparkles, AlertTriangle, X, Eye, Image, HelpCircle,
} from 'lucide-react';
import { SearchSelect, type AtivoItem } from '../../components/ui/SearchSelect';
import { AlertModal } from '../../components/ui/AlertModal';
import { AnimatedPageTour, type AnimatedTourStep } from '../../components/ui/AnimatedPageTour';
import { listarAtivos } from '../../services/bombeiroService';
import { equipesNoDia } from '../../utils/equipes';
import { dataLocalISO, formatarDataBR, periodosSobrepostosISO } from '../../utils/datas';
import { listarFeriasGozo, listarItensEscala } from '../../services/feriasService';
import { listarVigencias, type VigenciaSubstituicao } from '../../services/vigenciaSubstituicaoService';
import type { Bombeiro, Cargo } from '../../types/bombeiro';
import type { FeriasGozo } from '../../types/ferias';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { useGlobalAlert, type GlobalAlertVariant } from '../../context/GlobalAlertContext';
import { validarCursoParaFuncao } from '../../utils/validacaoCursos';
import { toPng } from 'html-to-image';
import {
  listarCompletas, novaConfigId, salvarCompleta,
  gerarEscalaMensal, gerarNomesMes,
  excluirConfig,
} from '../../services/escalaMensalService';
import { equipeRadioDiurna, getRadioSplitIndex, getSlotsRadio, LOCAIS_FAXINA, RESPONSABILIDADES_MENSAIS, type EscalaMensalConfig, type EscalaMensalCompleta, type FaxinaMensalItem, type PessoaEscala, type RadioMensalManual, type ResponsabilidadeMensalItem, type Veiculo, type FuncaoVeiculo } from '../../types/escalaMensal';

const MESES = gerarNomesMes();

interface SlotDef {
  label: string;
  funcao: 'chefe' | 'lider' | 'ba-mc' | 'ba-2';
  veiculo: Veiculo;
  funcaoNoVeiculo: FuncaoVeiculo;
  isRadioFixo: boolean;
  cargoFiltro?: string;
}

const SLOTS: SlotDef[] = [
  { label: 'Chefe de Equipe (BA-CE · CCI F2)', funcao: 'chefe', veiculo: 'cciF2', funcaoNoVeiculo: 'BaCe', isRadioFixo: false, cargoFiltro: 'BA-CE' },
  { label: 'Líder de Resgate (BA-LR · CRS)', funcao: 'lider', veiculo: 'crs', funcaoNoVeiculo: 'BaLr', isRadioFixo: false, cargoFiltro: 'BA-LR' },
  { label: 'Condutor (BA-MC · CRS)', funcao: 'ba-mc', veiculo: 'crs', funcaoNoVeiculo: 'BaMc', isRadioFixo: false, cargoFiltro: 'BA-MC' },
  { label: 'Condutor (BA-MC · CCI F2)', funcao: 'ba-mc', veiculo: 'cciF2', funcaoNoVeiculo: 'BaMc', isRadioFixo: false, cargoFiltro: 'BA-MC' },
  { label: 'Condutor (BA-MC · CCI F3)', funcao: 'ba-mc', veiculo: 'cciF3', funcaoNoVeiculo: 'BaMc', isRadioFixo: false, cargoFiltro: 'BA-MC' },
  { label: 'BA-2 (CRS)', funcao: 'ba-2', veiculo: 'crs', funcaoNoVeiculo: 'Ba2-1', isRadioFixo: false, cargoFiltro: 'BA-2' },
  { label: 'BA-2 (CRS)', funcao: 'ba-2', veiculo: 'crs', funcaoNoVeiculo: 'Ba2-2', isRadioFixo: false, cargoFiltro: 'BA-2' },
  { label: 'BA-2 (CCI F2)', funcao: 'ba-2', veiculo: 'cciF2', funcaoNoVeiculo: 'Ba2', isRadioFixo: false, cargoFiltro: 'BA-2' },
  { label: 'BA-2 (CCI F3)', funcao: 'ba-2', veiculo: 'cciF3', funcaoNoVeiculo: 'Ba2-1', isRadioFixo: false, cargoFiltro: 'BA-2' },
  { label: 'BA-2 (CCI F3 · Rádio Fixo)', funcao: 'ba-2', veiculo: 'cciF3', funcaoNoVeiculo: 'Ba2-2', isRadioFixo: true, cargoFiltro: 'BA-2' },
];

const RADIO_SELECT_COUNT = 4;

function formatarDataRadioMensal(data: unknown): string {
  return formatarDataBR(data);
}

const RESPONSABILIDADES_SELECTS = [
  {
    key: RESPONSABILIDADES_MENSAIS[0],
    label: RESPONSABILIDADES_MENSAIS[0],
    descricoes: [RESPONSABILIDADES_MENSAIS[0]],
  },
  {
    key: RESPONSABILIDADES_MENSAIS[1],
    label: RESPONSABILIDADES_MENSAIS[1],
    descricoes: [RESPONSABILIDADES_MENSAIS[1]],
  },
  {
    key: RESPONSABILIDADES_MENSAIS[2],
    label: `${RESPONSABILIDADES_MENSAIS[2]} / ${RESPONSABILIDADES_MENSAIS[3]}`,
    descricoes: [RESPONSABILIDADES_MENSAIS[2], RESPONSABILIDADES_MENSAIS[3]],
  },
] as const;

interface RadioManualState {
  comunicanteId: string;
  antesMeiaNoiteIds: string[];
  depoisMeiaNoiteIds: string[];
}

function criarRadioManualVazio(): RadioManualState {
  return {
    comunicanteId: '',
    antesMeiaNoiteIds: Array(RADIO_SELECT_COUNT).fill(''),
    depoisMeiaNoiteIds: Array(RADIO_SELECT_COUNT).fill(''),
  };
}

interface EfetivoMensalEntry {
  bombeiro: Bombeiro;
  cargoExercido: string;
  equipeEfetiva: string;
  substituindo?: {
    id: string;
    nome: string;
    cargo: string;
  };
}

function dataLocal(data: string): Date {
  return new Date(`${data}T12:00:00`);
}

function intervaloMes(mes: number, ano: number) {
  const inicio = new Date(ano, mes - 1, 1, 12);
  const fim = new Date(ano, mes, 0, 12);
  return { inicio, fim };
}

function sobrepoePeriodo(dataInicio: string, dataFim: string, inicio: Date, fim: Date): boolean {
  if (!dataInicio || !dataFim) return false;
  return dataLocal(dataInicio) <= fim && dataLocal(dataFim) >= inicio;
}

function cargoParaSlot(slot: SlotDef): Cargo {
  if (slot.funcao === 'chefe') return 'BA-CE';
  if (slot.funcao === 'lider') return 'BA-LR';
  if (slot.funcao === 'ba-mc') return 'BA-MC';
  return 'BA-2';
}

function podeFazerRadio(entry: EfetivoMensalEntry): boolean {
  return entry.cargoExercido !== 'BA-CE' && entry.cargoExercido !== 'BA-LR';
}

function paridadePorSequencia(equipe: string, mes: number, ano: number): 'par' | 'impar' {
  const total = new Date(ano, mes, 0).getDate();
  for (let dia = 1; dia <= total; dia++) {
    const equipes = equipesNoDia(new Date(ano, mes - 1, dia, 12));
    if (equipes.some(eq => eq === equipe)) return dia % 2 === 0 ? 'par' : 'impar';
  }
  return equipe === 'Alfa' || equipe === 'Bravo' ? 'impar' : 'par';
}

function montarEfetivoMensal(params: {
  bombeiros: Bombeiro[];
  feriasGozo: FeriasGozo[];
  vigencias: VigenciaSubstituicao[];
  equipe: string;
  mes: number;
  ano: number;
}): EfetivoMensalEntry[] {
  const { bombeiros, feriasGozo, vigencias, equipe, mes, ano } = params;
  if (!equipe) return [];

  const { inicio, fim } = intervaloMes(mes, ano);
  const ativos = bombeiros.filter(b => !b.dataDesligamento);
  const porId = new Map(ativos.map(b => [b.id, b]));

  const equipeDaVaga = (v: VigenciaSubstituicao): string => {
    const original = porId.get(v.funcionarioOriginalId);
    return original?.equipe || v.equipe;
  };

  const vigenciasNoMes = vigencias.filter(v =>
    v.ativa &&
    sobrepoePeriodo(v.dataInicio, v.dataFim, inicio, fim) &&
    equipeDaVaga(v) === equipe
  );
  const vigenciasReais = vigenciasNoMes.filter(v => v.substitutoId && v.substitutoId !== v.funcionarioOriginalId);
  const vigenciasAuto = vigenciasNoMes.filter(v => v.substitutoId && v.substitutoId === v.funcionarioOriginalId);

  const realPorOriginal = new Map<string, VigenciaSubstituicao>();
  const realPorSubstituto = new Map<string, VigenciaSubstituicao>();
  for (const v of vigenciasReais) {
    realPorOriginal.set(v.funcionarioOriginalId, v);
    realPorSubstituto.set(v.substitutoId, v);
  }

  const vagasAbertas = new Set(vigenciasAuto.map(v => v.funcionarioOriginalId));
  const gozosNoMes = feriasGozo.filter(g =>
    g.status !== 'Gozadas' &&
    sobrepoePeriodo(g.dataInicio, g.dataFim, inicio, fim)
  );
  const emGozo = new Set(gozosNoMes.map(g => g.funcionarioId));

  const fallbackPorOriginal = new Map<string, { substituto: Bombeiro; cargo: string; original: Bombeiro }>();
  const fallbackPorSubstituto = new Map<string, { substituto: Bombeiro; cargo: string; original: Bombeiro }>();
  for (const gozo of gozosNoMes) {
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

function montarOpcoesEfetivo(efetivo: EfetivoMensalEntry[], equipe: string): AtivoItem[] {
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

function pessoaEscala(entry: EfetivoMensalEntry, slot: SlotDef): Partial<PessoaEscala> {
  return {
    id: entry.bombeiro.id,
    nome: entry.bombeiro.nome || entry.bombeiro.nomeCompleto,
    nomeGuerra: entry.bombeiro.nomeGuerra,
    funcao: slot.funcao,
    veiculo: slot.veiculo,
    funcaoNoVeiculo: slot.funcaoNoVeiculo,
    isRadioFixo: slot.isRadioFixo,
  };
}

function montarPessoasPorSlots(efetivo: EfetivoMensalEntry[]): (Partial<PessoaEscala> | null)[] {
  const usados = new Set<string>();

  return SLOTS.map(slot => {
    const cargoSlot = cargoParaSlot(slot);
    const encontrado = efetivo.find(entry => {
      if (entry.cargoExercido !== cargoSlot || usados.has(entry.bombeiro.id)) return false;
      if (slot.funcao === 'ba-2') return true;
      const veiculoBA = slot.veiculo === 'crs' ? 'crs' as const : 'cci' as const;
      const validacao = validarCursoParaFuncao(entry.bombeiro, cargoSlot, slot.funcao === 'ba-mc' ? veiculoBA : undefined);
      return validacao?.nivel !== 'bloqueado';
    });
    if (!encontrado) return null;
    usados.add(encontrado.bombeiro.id);
    return pessoaEscala(encontrado, slot);
  });
}

function resolverPessoaSelecionada(
  pessoa: Partial<PessoaEscala> | null,
  slot: SlotDef,
  efetivo: EfetivoMensalEntry[],
): Partial<PessoaEscala> | null {
  if (!pessoa?.id) return pessoa;
  const cargoSlot = cargoParaSlot(slot);
  const selecionadaNoEfetivo = efetivo.find(entry =>
    entry.bombeiro.id === pessoa.id && entry.cargoExercido === cargoSlot
  );
  if (selecionadaNoEfetivo) return pessoaEscala(selecionadaNoEfetivo, slot);

  const substitutoDaVaga = efetivo.find(entry =>
    entry.substituindo?.id === pessoa.id && entry.cargoExercido === cargoSlot
  );
  if (substitutoDaVaga) return pessoaEscala(substitutoDaVaga, slot);

  return pessoa;
}

function resolverPessoasSelecionadas(
  pessoas: (Partial<PessoaEscala> | null)[],
  efetivo: EfetivoMensalEntry[],
): (Partial<PessoaEscala> | null)[] {
  return SLOTS.map((slot, idx) => resolverPessoaSelecionada(pessoas[idx], slot, efetivo));
}

function montarFaxinaSelecionada(faxinaManual: Record<string, string>, efetivo: EfetivoMensalEntry[]): FaxinaMensalItem[] {
  const porId = new Map(efetivo.map(entry => [entry.bombeiro.id, entry]));
  const itens: FaxinaMensalItem[] = [];
  for (const local of LOCAIS_FAXINA) {
    const entry = porId.get(faxinaManual[local] || '');
    if (!entry) continue;
    itens.push({
      local,
      pessoaNome: entry.bombeiro.nome || entry.bombeiro.nomeCompleto,
      pessoaNomeGuerra: entry.bombeiro.nomeGuerra,
    });
  }
  return itens;
}

function faxinaParaState(faxina: FaxinaMensalItem[], bombeiros: Bombeiro[]): Record<string, string> {
  const state: Record<string, string> = {};
  for (const item of faxina) {
    const b = bombeiros.find(bb => bb.nomeGuerra === item.pessoaNomeGuerra || bb.nomeCompleto === item.pessoaNome);
    if (b) state[item.local] = b.id;
  }
  return state;
}

function refPessoa(entry: EfetivoMensalEntry) {
  return {
    id: entry.bombeiro.id,
    pessoaNome: entry.bombeiro.nome || entry.bombeiro.nomeCompleto,
    pessoaNomeGuerra: entry.bombeiro.nomeGuerra,
  };
}

function montarResponsabilidadesSelecionadas(state: Record<string, string>, efetivo: EfetivoMensalEntry[]): ResponsabilidadeMensalItem[] {
  const porId = new Map(efetivo.map(entry => [entry.bombeiro.id, entry]));
  const itens: ResponsabilidadeMensalItem[] = [];
  for (const grupo of RESPONSABILIDADES_SELECTS) {
    const entry = porId.get(state[grupo.key] || '');
    if (!entry) continue;
    for (const descricao of grupo.descricoes) {
      itens.push({ descricao, ...refPessoa(entry) });
    }
  }
  return itens;
}

function responsabilidadesParaState(responsabilidades: ResponsabilidadeMensalItem[], bombeiros: Bombeiro[]): Record<string, string> {
  const state: Record<string, string> = {};
  for (const grupo of RESPONSABILIDADES_SELECTS) {
    const item = responsabilidades.find(resp => grupo.descricoes.some(descricao => descricao === resp.descricao));
    if (!item) continue;
    const b = bombeiros.find(bb => bb.nomeGuerra === item.pessoaNomeGuerra || bb.nomeCompleto === item.pessoaNome);
    if (b) state[grupo.key] = b.id;
  }
  return state;
}

function montarRadioSelecionado(state: RadioManualState, efetivo: EfetivoMensalEntry[]): RadioMensalManual | undefined {
  const porId = new Map(efetivo.map(entry => [entry.bombeiro.id, entry]));
  const toRef = (id: string) => {
    const entry = porId.get(id);
    return entry ? refPessoa(entry) : null;
  };
  const comunicante = toRef(state.comunicanteId);
  const antesMeiaNoite = state.antesMeiaNoiteIds.map(toRef).filter((p): p is NonNullable<ReturnType<typeof toRef>> => !!p);
  const depoisMeiaNoite = state.depoisMeiaNoiteIds.map(toRef).filter((p): p is NonNullable<ReturnType<typeof toRef>> => !!p);
  if (!comunicante && antesMeiaNoite.length === 0 && depoisMeiaNoite.length === 0) return undefined;
  return {
    ...(comunicante ? { comunicante } : {}),
    ...(antesMeiaNoite.length ? { antesMeiaNoite } : {}),
    ...(depoisMeiaNoite.length ? { depoisMeiaNoite } : {}),
  };
}

function radioParaState(completa: EscalaMensalCompleta | null, bombeiros: Bombeiro[]): RadioManualState {
  const state = criarRadioManualVazio();
  const radio = completa?.paradas[0]?.radio || [];
  if (radio.length === 0) return state;
  const idPorNome = (nomeGuerra: string) => bombeiros.find(b => b.nomeGuerra === nomeGuerra)?.id || '';
  const comunicante = radio.find(r => r.fixo)?.pessoaNomeGuerra;
  if (comunicante) state.comunicanteId = idPorNome(comunicante);
  const dinamicos = radio.filter(r => !r.fixo);
  const split = getRadioSplitIndex(radio);
  state.antesMeiaNoiteIds = dinamicos.slice(0, split).slice(0, RADIO_SELECT_COUNT).map(r => idPorNome(r.pessoaNomeGuerra));
  state.depoisMeiaNoiteIds = dinamicos.slice(split).slice(0, RADIO_SELECT_COUNT).map(r => idPorNome(r.pessoaNomeGuerra));
  while (state.antesMeiaNoiteIds.length < RADIO_SELECT_COUNT) state.antesMeiaNoiteIds.push('');
  while (state.depoisMeiaNoiteIds.length < RADIO_SELECT_COUNT) state.depoisMeiaNoiteIds.push('');
  return state;
}

function prepararCapturaPng(el: HTMLElement): { width: number; height: number; restore: () => void } {
  const elements = [el, ...Array.from(el.querySelectorAll<HTMLElement>('*'))];
  const previousStyles = elements.map(node => [node, node.getAttribute('style')] as const);
  el.classList.add('png-exporting');

  for (const node of elements) {
    node.style.overflow = 'visible';
    node.style.overflowX = 'visible';
    node.style.overflowY = 'visible';
    node.style.maxHeight = 'none';
    node.style.setProperty('scrollbar-width', 'none');
    node.style.setProperty('-ms-overflow-style', 'none');
  }

  const width = Math.ceil(Math.max(el.scrollWidth, el.getBoundingClientRect().width));
  const height = Math.ceil(Math.max(el.scrollHeight, el.getBoundingClientRect().height));

  return {
    width,
    height,
    restore: () => {
      el.classList.remove('png-exporting');
      for (const [node, style] of previousStyles) {
        if (style === null) node.removeAttribute('style');
        else node.setAttribute('style', style);
      }
    },
  };
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

type EscalaMensalTourStep = AnimatedTourStep & {
  mode: 'list' | 'setup';
};

const ESCALA_MENSAL_TOUR_STEPS: EscalaMensalTourStep[] = [
  {
    target: 'mensal-lista-topo',
    mode: 'list',
    title: 'Escala Mensal organiza o mês',
    body: 'Aqui ficam as escalas mensais já criadas. Ela é a base para montar o efetivo da equipe durante o mês inteiro.',
    detail: 'Quando a escala mensal está correta, a escala diária consegue puxar as pessoas esperadas para cada plantão sem começar do zero.',
  },
  {
    target: 'mensal-lista-filtros',
    mode: 'list',
    title: 'Filtre por equipe',
    body: 'Use o filtro para localizar a escala mensal de uma equipe específica e conferir quantas escalas existem na lista.',
    detail: 'Antes de criar uma diária, confira se já existe escala mensal da equipe e do mês correspondente.',
  },
  {
    target: 'mensal-nova',
    mode: 'list',
    title: 'Crie a mensal primeiro',
    body: 'O botão Nova Escala Mensal abre a configuração do mês. Preencha essa etapa antes de depender do auto-preenchimento da diária.',
    detail: 'A mensal define a distribuição principal da equipe, responsabilidades, limpeza e rádio que depois servem de base para o dia de plantão.',
  },
  {
    target: 'mensal-configuracao',
    mode: 'setup',
    title: 'Equipe, mês e plantões',
    body: 'Escolha a equipe, mês e ano. A paridade dos plantões é calculada pelo sistema conforme o ciclo operacional.',
    detail: 'Esses dados dizem ao sistema quais dias daquele mês pertencem à equipe e quais pessoas devem entrar no cálculo do efetivo mensal.',
  },
  {
    target: 'mensal-guarnicoes',
    mode: 'setup',
    title: 'Monte as guarnições do mês',
    body: 'Aqui entram CRS, CCI F2 e CCI F3. O sistema usa as pessoas ativas, férias e substituições para sugerir o efetivo válido do mês.',
    detail: 'Essas posições são a base que a escala diária tenta puxar quando você cria o plantão de uma data específica.',
  },
  {
    target: 'mensal-radio',
    mode: 'setup',
    title: 'Defina os horários de rádio',
    body: 'A escala mensal também organiza o comunicante e os horários de rádio do mês.',
    detail: 'Quando a diária for criada, ela busca essa configuração de rádio da mensal para preencher o plantão do dia com os horários corretos.',
  },
  {
    target: 'mensal-acoes',
    mode: 'setup',
    title: 'Gere e salve a escala',
    body: 'Depois de revisar equipe, guarnições, responsabilidades e rádio, gere a escala mensal para deixá-la disponível ao restante do sistema.',
    detail: 'Sem salvar a mensal, a escala diária perde essa referência e pode precisar de mais ajuste manual.',
  },
];

export function EscalaMensal() {
  const { canManageGlobal, canManageEquipe, equipeEfetiva } = useContextoOperacional();
  const { showAlert } = useGlobalAlert();
  const isGlobal = canManageGlobal;
  const canCreate = canManageGlobal || !!equipeEfetiva;

  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [completas, setCompletas] = useState<EscalaMensalCompleta[]>([]);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'setup' | 'list'>('list');
  const [msg, setMsg] = useState<string | null>(null);

  const [equipe, setEquipe] = useState('');
  const [mes, setMes] = useState(new Date().getMonth() + 1);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [paridade, setParidade] = useState<'par' | 'impar'>('impar');
  const [pessoas, setPessoas] = useState<(Partial<PessoaEscala> | null)[]>(SLOTS.map(() => null));
  const [feriasGozo, setFeriasGozo] = useState<FeriasGozo[]>([]);
  const [faxinaManual, setFaxinaManual] = useState<Record<string, string>>({});
  const [responsabilidadesManual, setResponsabilidadesManual] = useState<Record<string, string>>({});
  const [radioManual, setRadioManual] = useState<RadioManualState>(() => criarRadioManualVazio());
  const [filterListEquipe, setFilterListEquipe] = useState('');
  const [filterListMes] = useState('');
  const [filterListAno] = useState('');
  const [faxinaExpanded, setFaxinaExpanded] = useState(true);
  const [responsabilidadesExpanded, setResponsabilidadesExpanded] = useState(true);
  const [radioExpanded, setRadioExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EscalaMensalCompleta | null>(null);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [autoPreencherSetup, setAutoPreencherSetup] = useState(true);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);
  const tutorialOrigemRef = useRef<{
    mode: 'view' | 'setup' | 'list';
    selecionada: string | null;
    editingId: string | null;
    autoPreencherSetup: boolean;
    scrollX: number;
    scrollY: number;
  } | null>(null);

  function mostrarAlerta(title: string, message: string, variant: GlobalAlertVariant = 'info') {
    showAlert({ title, message, variant });
  }

  function tutorialIndexInicial(): number {
    const setupIndex = ESCALA_MENSAL_TOUR_STEPS.findIndex(step => step.mode === 'setup');
    return mode === 'setup' && setupIndex >= 0 ? setupIndex : 0;
  }

  function abrirTutorialMensal() {
    if (showTutorial || !canCreate) return;
    tutorialOrigemRef.current = {
      mode,
      selecionada,
      editingId,
      autoPreencherSetup,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
    setTutorialStepIndex(tutorialIndexInicial());
    setShowTutorial(true);
  }

  function fecharTutorialMensal() {
    const origem = tutorialOrigemRef.current;
    setShowTutorial(false);
    if (origem) {
      setMode(origem.mode);
      setSelecionada(origem.selecionada);
      setEditingId(origem.editingId);
      setAutoPreencherSetup(origem.autoPreencherSetup);
      window.setTimeout(() => {
        window.scrollTo({ left: origem.scrollX, top: origem.scrollY, behavior: 'smooth' });
      }, 80);
    }
    tutorialOrigemRef.current = null;
  }

  function voltarTutorialMensal() {
    setTutorialStepIndex(index => Math.max(0, index - 1));
  }

  function avancarTutorialMensal() {
    if (tutorialStepIndex >= ESCALA_MENSAL_TOUR_STEPS.length - 1) {
      fecharTutorialMensal();
      return;
    }
    setTutorialStepIndex(tutorialStepIndex + 1);
  }

  useEffect(() => {
    if (!showTutorial) return;
    const tourStep = ESCALA_MENSAL_TOUR_STEPS[tutorialStepIndex] || ESCALA_MENSAL_TOUR_STEPS[0];
    if (mode !== tourStep.mode) {
      setMode(tourStep.mode);
      if (tourStep.mode === 'setup') {
        setEditingId(null);
        setAutoPreencherSetup(false);
      }
    }
    if (tourStep.target === 'mensal-radio') setRadioExpanded(true);
  }, [showTutorial, tutorialStepIndex, mode]);

  function renderBotaoTutorialMensal() {
    if (showTutorial || !canCreate) return null;
    return (
      <button
        type="button"
        onClick={abrirTutorialMensal}
        aria-label="Abrir tutorial animado da Escala Mensal"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-aviation-500 to-aviation-700 text-white shadow-2xl shadow-aviation-500/30 ring-4 ring-white/70 transition-all hover:scale-105 hover:from-aviation-400 hover:to-aviation-600 dark:ring-graphite-900/80"
      >
        <HelpCircle className="h-7 w-7" />
      </button>
    );
  }

  async function handleExportPNG() {
    const el = document.getElementById('print-area');
    if (!el) {
      mostrarAlerta('Escala indisponível', 'Abra uma escala mensal antes de salvar em PNG.', 'warning');
      return;
    }
    let captura: ReturnType<typeof prepararCapturaPng> | null = null;
    try {
      mostrarAlerta('Gerando PNG', 'A escala mensal está sendo preparada para download.', 'info');
      captura = prepararCapturaPng(el);
      await nextFrame();
      const dataUrl = await toPng(el, { 
        quality: 1, 
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: captura.width,
        height: captura.height,
        style: {
          overflow: 'visible',
          width: `${captura.width}px`,
          height: `${captura.height}px`,
          maxWidth: 'none',
        },
      });
      const link = document.createElement('a');
      link.download = `${nomeArquivoEscala()}.png`;
      link.href = dataUrl;
      link.click();
      mostrarAlerta('PNG salvo', 'O arquivo PNG da escala foi gerado com sucesso.', 'success');
    } catch (e) {
      mostrarAlerta('Erro ao gerar PNG', e instanceof Error ? e.message : 'Erro desconhecido.', 'danger');
    } finally {
      captura?.restore();
    }
  }

  const userEquipe = equipeEfetiva;

  const equipesDisponiveis = useMemo(() => {
    if (isGlobal) return ['Alfa', 'Bravo', 'Charlie', 'Delta'];
    return userEquipe ? [userEquipe] : [];
  }, [isGlobal, userEquipe]);

  useEffect(() => {
    if (!equipe && userEquipe && !isGlobal) setEquipe(userEquipe);
  }, [userEquipe, isGlobal, equipe]);

  useEffect(() => {
    listarAtivos().then(setBombeiros).catch(() => {});
    listarCompletas().then(setCompletas).catch(() => {});
    listarFeriasGozo().then(setFeriasGozo).catch(() => {});
  }, []);

  useEffect(() => {
    if (!equipe) return;
    // Auto-definir paridade com base na equipa (Alfa/Bravo = ímpares, Charlie/Delta = pares)
    setParidade(paridadePorSequencia(equipe, mes, ano));
  }, [equipe, mes, ano]);

  useEffect(() => {
    if (!equipe || !bombeiros.length || mode !== 'setup' || editingId || !autoPreencherSetup) return;
    handleAutoFillComEfetivo();
  }, [equipe, mes, ano, mode, bombeiros.length, editingId, autoPreencherSetup]);

  useEffect(() => {
    if (completas.length > 0 && !selecionada) {
      setSelecionada(completas[0].config.id);
    }
  }, [completas, selecionada]);

  const completaAtual = useMemo(() => {
    if (!selecionada) return null;
    return completas.find(c => c.config.id === selecionada) || null;
  }, [selecionada, completas]);

  function nomeArquivoEscala(completa: EscalaMensalCompleta | null = completaAtual): string {
    if (!completa) return 'escala-mensal';
    const equipeArquivo = completa.config.equipe || 'equipe';
    const mesArquivo = MESES[completa.config.mes - 1] || `mes-${completa.config.mes}`;
    return `escala-mensal-${equipeArquivo}-${mesArquivo}-${completa.config.ano}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  function tituloEscala(completa: EscalaMensalCompleta): string {
    return `ESCALA MENSAL EQUIPE ${completa.config.equipe} MES DE ${MESES[completa.config.mes - 1]} ${completa.config.ano}`;
  }

  function handlePrint() {
    if (!completaAtual) return;
    const previousTitle = document.title;
    document.title = tituloEscala(completaAtual);
    setPrintMenuOpen(false);
    mostrarAlerta('Impressão acionada', 'A janela de impressão do navegador será aberta. Se quiser arquivo de imagem, use Imprimir > Salvar PNG.', 'info');
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
    setTimeout(() => window.print(), 80);
    setTimeout(restoreTitle, 1000);
  }

  // Cache de vigências para uso no substituirFerias
  const [vigenciasCache, setVigenciasCache] = useState<VigenciaSubstituicao[]>([]);
  useEffect(() => {
    listarVigencias({ ativa: true }).then(setVigenciasCache).catch(() => {});
  }, []);

  const efetivoMensal = useMemo(() => montarEfetivoMensal({
    bombeiros,
    feriasGozo,
    vigencias: vigenciasCache,
    equipe,
    mes,
    ano,
  }), [bombeiros, feriasGozo, vigenciasCache, equipe, mes, ano]);

  const efetivoOptions = useMemo(
    () => montarOpcoesEfetivo(efetivoMensal, equipe),
    [efetivoMensal, equipe],
  );

  const radioEfetivo = useMemo(
    () => efetivoMensal.filter(podeFazerRadio),
    [efetivoMensal],
  );
  const radioDiurno = equipeRadioDiurna(equipe);
  const radioAntesLabel = radioDiurno ? 'Antes do meio-dia' : 'Antes da meia-noite';
  const radioDepoisLabel = radioDiurno ? 'Depois do meio-dia' : 'Depois da meia-noite';

  useEffect(() => {
    if (!radioEfetivo.length) return;
    const idsValidos = new Set(radioEfetivo.map(entry => entry.bombeiro.id));
    setRadioManual(prev => {
      const comunicanteId = idsValidos.has(prev.comunicanteId) ? prev.comunicanteId : '';
      const antesMeiaNoiteIds = prev.antesMeiaNoiteIds.map(id => idsValidos.has(id) ? id : '');
      const depoisMeiaNoiteIds = prev.depoisMeiaNoiteIds.map(id => idsValidos.has(id) ? id : '');
      const mudou = comunicanteId !== prev.comunicanteId ||
        antesMeiaNoiteIds.some((id, idx) => id !== prev.antesMeiaNoiteIds[idx]) ||
        depoisMeiaNoiteIds.some((id, idx) => id !== prev.depoisMeiaNoiteIds[idx]);
      return mudou ? { comunicanteId, antesMeiaNoiteIds, depoisMeiaNoiteIds } : prev;
    });
  }, [radioEfetivo]);

  const veiculosView = useMemo(() => {
    if (!completaAtual || completaAtual.paradas.length === 0) return null;
    const v = completaAtual.paradas[0].veiculos || {} as any;
    const nomeExibido = (nome: string): string => nome || '-';
    const linha = (label: string, nome: string) => {
      return `${label}: ${nomeExibido(nome)}`;
    };
    return (
      <div className="rounded border-2 border-graphite-300 bg-white/80 p-1 print:border-graphite-500 print:bg-white">
        <div className="mb-0.5 flex items-center gap-1">
          <Shield className="h-3.5 w-3.5 text-aviation-600 print:text-graphite-800" />
          <span className="text-[12px] font-bold text-graphite-800 print:text-graphite-900">Guarnições</span>
        </div>
        <div className="flex gap-2">
          {[
            { nome: 'CRS', cor: 'border-blue-400 print:border-blue-600', itens: [linha('BA-MC', v?.crs?.baMc || '-'), linha('BA-LR', v?.crs?.baLr || '-'), linha('BA-2', v?.crs?.ba2_1 || '-'), linha('BA-2', v?.crs?.ba2_2 || '-')] },
            { nome: 'CCI F2', cor: 'border-amber-400 print:border-amber-600', itens: [linha('BA-MC', v?.cciF2?.baMc || '-'), linha('BA-CE', v?.cciF2?.baCe || '-'), linha('BA-2', v?.cciF2?.ba2 || '-')] },
            { nome: 'CCI F3', cor: 'border-emerald-400 print:border-emerald-600', itens: [linha('BA-MC', v?.cciF3?.baMc || '-'), linha('BA-2', v?.cciF3?.ba2_1 || '-'), linha('BA-2', v?.cciF3?.ba2_2 || '-')] },
          ].map(c => (
            <div key={c.nome} className={`flex-1 rounded border-2 ${c.cor} bg-graphite-50/30 px-2 py-0.5 print:bg-white`}>
              <p className="text-[11px] font-bold uppercase text-graphite-600 print:text-graphite-700">{c.nome}</p>
              {c.itens.map((item, i) => {
                const [label, ...nomeParts] = item.split(': ');
                const nomeKey = (() => {
                  if (!v) return '';
                  if (c.nome === 'CRS') {
                    const keys = ['baMc', 'baLr', 'ba2_1', 'ba2_2'] as const;
                    return v.crs?.[keys[i]] || '';
                  }
                  if (c.nome === 'CCI F2') {
                    const keys = ['baMc', 'baCe', 'ba2'] as const;
                    return v.cciF2?.[keys[i]] || '';
                  }
                  const keys = ['baMc', 'ba2_1', 'ba2_2'] as const;
                  return v.cciF3?.[keys[i]] || '';
                })();
                const nome = nomeParts.join(': ');
                return <p key={i} className="text-[11px] font-semibold leading-snug text-graphite-800 print:font-bold print:text-graphite-900"
                  title={nome !== '-' ? `${nomeKey || nome} · Função: ${label}` : ''}>{item}</p>;
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }, [completaAtual]);
  const slotsRadioView = completaAtual ? getSlotsRadio(completaAtual.config.equipe) : [];

  const qtdPessoas = pessoas.filter(pessoaValida).length;

  const completasFiltradas = useMemo(() => {
    let lista = completas;
    if (filterListEquipe) lista = lista.filter(c => c.config.equipe === filterListEquipe);
    if (filterListMes) lista = lista.filter(c => c.config.mes === Number(filterListMes));
    if (filterListAno) lista = lista.filter(c => c.config.ano === Number(filterListAno));
    return lista;
  }, [completas, filterListEquipe, filterListMes, filterListAno]);

  function notificar(texto: string) {
    setMsg(texto);
    setTimeout(() => setMsg(null), 3000);
  }

  function pessoaValida(p: Partial<PessoaEscala> | null): p is PessoaEscala {
    return !!p?.id && !!p?.nomeGuerra;
  }

  async function montarCompletaParaSalvar(configId: string, createdAt?: string): Promise<EscalaMensalCompleta | null> {
    if (!equipe) {
      mostrarAlerta('Equipe obrigatória', 'Selecione uma equipe antes de gerar ou salvar a escala mensal.', 'warning');
      notificar('Selecione uma equipe antes de gerar.');
      return null;
    }
    if (!canManageEquipe(equipe)) {
      mostrarAlerta('Acesso negado', 'Você só pode salvar escalas mensais da sua equipe efetiva.', 'warning');
      return null;
    }
    const [all, gozos, vigs] = await Promise.all([
      listarAtivos(),
      listarFeriasGozo(),
      listarVigencias({ ativa: true }),
    ]);
    setBombeiros(all);
    setFeriasGozo(gozos);
    setVigenciasCache(vigs);

    const efetivoParaGerar = montarEfetivoMensal({ bombeiros: all, feriasGozo: gozos, vigencias: vigs, equipe, mes, ano });
    let pessoasParaGerar = resolverPessoasSelecionadas(pessoas, efetivoParaGerar);
    if (pessoasParaGerar.every(p => !p)) {
      pessoasParaGerar = montarPessoasPorSlots(efetivoParaGerar);
    }
    setPessoas(pessoasParaGerar);

    const validadas = pessoasParaGerar.filter(pessoaValida);
    if (validadas.length < SLOTS.length) {
      mostrarAlerta('Preenchimento incompleto', `Foram preenchidas ${validadas.length}/${SLOTS.length} funções. Complete as funções faltantes antes de salvar.`, 'warning');
      notificar(`Preenchimento: ${validadas.length}/${SLOTS.length} pessoas. Complete as funções faltantes.`);
      return null;
    }

    const faxinaSelecionada = montarFaxinaSelecionada(faxinaManual, efetivoParaGerar);
    const responsabilidadesSelecionadas = montarResponsabilidadesSelecionadas(responsabilidadesManual, efetivoParaGerar);
    const radioSelecionado = montarRadioSelecionado(radioManual, efetivoParaGerar.filter(podeFazerRadio));

    const cfg: EscalaMensalConfig = {
      id: configId,
      equipe, mes, ano, paridade,
      pessoas: validadas,
      faxinaManual: faxinaSelecionada.length > 0 ? faxinaSelecionada : undefined,
      responsabilidadesManual: responsabilidadesSelecionadas.length > 0 ? responsabilidadesSelecionadas : undefined,
      radioManual: radioSelecionado,
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return gerarEscalaMensal(cfg);
  }

  async function atualizarListaSelecionando(configId: string) {
    const c = await listarCompletas();
    if (!c.some(item => item.config.id === configId)) {
      throw new Error('A escala mensal foi salva, mas não apareceu na listagem recarregada.');
    }
    setCompletas(c);
    setSelecionada(configId);
    setMode('view');
  }

  async function handleGerar() {
    if (salvando) return;
    setSalvando(true);
    mostrarAlerta('Criando escala', 'A escala mensal está sendo gerada e salva.', 'info');
    try {
      const configId = novaConfigId();
      const completa = await montarCompletaParaSalvar(configId);
      if (!completa) return;
      await salvarCompleta(completa);
      await atualizarListaSelecionando(configId);
      setEditingId(null);
      setAutoPreencherSetup(true);
      mostrarAlerta('Escala criada', `A escala de ${MESES[mes - 1]}/${ano} foi gerada e salva com sucesso.`, 'success');
    } catch (err) {
      mostrarAlerta('Erro ao salvar escala', err instanceof Error ? err.message : 'Erro desconhecido.', 'danger');
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarEdicao() {
    if (!editingId || salvando) return;
    setSalvando(true);
    mostrarAlerta('Salvando alterações', 'As alterações da escala mensal estão sendo aplicadas.', 'info');
    try {
      const original = completas.find(c => c.config.id === editingId);
      if (original && !canManageEquipe(original.config.equipe)) {
        mostrarAlerta('Acesso negado', 'Você só pode editar escalas mensais da sua equipe efetiva.', 'warning');
        return;
      }
      const completa = await montarCompletaParaSalvar(editingId, original?.config.createdAt);
      if (!completa) return;
      await salvarCompleta(completa);
      await atualizarListaSelecionando(editingId);
      setEditingId(null);
      setAutoPreencherSetup(true);
      mostrarAlerta('Alterações salvas', 'A escala mensal foi atualizada com sucesso.', 'success');
    } catch (err) {
      mostrarAlerta('Erro ao salvar alterações', err instanceof Error ? err.message : 'Erro desconhecido.', 'danger');
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarEscalaAtual() {
    if (!completaAtual || salvando) return;
    if (!canManageEquipe(completaAtual.config.equipe)) {
      mostrarAlerta('Acesso negado', 'Você só pode salvar escalas mensais da sua equipe efetiva.', 'warning');
      return;
    }
    setSalvando(true);
    mostrarAlerta('Salvando escala', 'A escala mensal atual está sendo salva.', 'info');
    try {
      await salvarCompleta({
        ...completaAtual,
        config: {
          ...completaAtual.config,
          updatedAt: new Date().toISOString(),
        },
      });
      await atualizarListaSelecionando(completaAtual.config.id);
      mostrarAlerta('Escala salva', 'A escala mensal atual foi salva com sucesso.', 'success');
    } catch (err) {
      mostrarAlerta('Erro ao salvar escala', err instanceof Error ? err.message : 'Erro desconhecido.', 'danger');
    } finally {
      setSalvando(false);
    }
  }

  function substituirFerias(p: Partial<PessoaEscala> | null, cargoEfetivo?: string): Partial<PessoaEscala> | null {
    if (!p?.id) return p;
    const slot = SLOTS.find(s =>
      s.cargoFiltro === cargoEfetivo &&
      s.funcao === p.funcao &&
      s.veiculo === p.veiculo &&
      s.funcaoNoVeiculo === p.funcaoNoVeiculo
    );
    if (slot) return resolverPessoaSelecionada(p, slot, efetivoMensal);
    const { inicio, fim } = intervaloMes(mes, ano);
    const jaEstaNoEfetivo = efetivoMensal.some(entry =>
      entry.bombeiro.id === p.id &&
      (!cargoEfetivo || entry.cargoExercido === cargoEfetivo)
    );
    if (jaEstaNoEfetivo) return p;

    // Verificar vigências ativas primeiro (substituições em cascata)
    const vigencia = vigenciasCache.find(v =>
      v.funcionarioOriginalId === p.id &&
      v.substitutoId !== p.id &&
      v.ativa &&
      (bombeiros.find(b => b.id === v.funcionarioOriginalId)?.equipe || v.equipe) === equipe &&
      (!cargoEfetivo || v.cargoExercido === cargoEfetivo) &&
      // Verificar se a vigência cobre o mês atual
      sobrepoePeriodo(v.dataInicio, v.dataFim, inicio, fim)
    );
    if (vigencia) {
      const sub = bombeiros.find(b => b.id === vigencia.substitutoId);
      if (sub) {
        return { id: sub.id, nome: sub.nomeCompleto, nomeGuerra: sub.nomeGuerra, funcao: p.funcao, veiculo: p.veiculo, funcaoNoVeiculo: p.funcaoNoVeiculo, isRadioFixo: p.isRadioFixo || false };
      }
    }

    // Fallback: verificar férias diretamente
    const gozo = feriasGozo.find(g =>
      g.funcionarioId === p.id &&
      g.status !== 'Gozadas' &&
      g.substitutoId &&
      (bombeiros.find(b => b.id === g.funcionarioId)?.equipe || g.equipe) === equipe &&
      (!cargoEfetivo || (g.funcaoSubstituicao || bombeiros.find(b => b.id === g.funcionarioId)?.cargo) === cargoEfetivo) &&
      sobrepoePeriodo(g.dataInicio, g.dataFim, inicio, fim)
    );
    if (!gozo) return p;
    const sub = bombeiros.find(b => b.id === gozo.substitutoId);
    if (!sub) return p;
    return { id: sub.id, nome: sub.nomeCompleto, nomeGuerra: sub.nomeGuerra, funcao: p.funcao, veiculo: p.veiculo, funcaoNoVeiculo: p.funcaoNoVeiculo, isRadioFixo: p.isRadioFixo || false };
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (!canManageEquipe(deleteTarget.config.equipe)) {
      setDeleteTarget(null);
      mostrarAlerta('Acesso negado', 'Você só pode excluir escalas mensais da sua equipe efetiva.', 'warning');
      return;
    }
    try {
      const deletedId = deleteTarget.config.id;
      const deletedLabel = `${MESES[deleteTarget.config.mes - 1]} ${deleteTarget.config.ano} · ${deleteTarget.config.equipe}`;
      await excluirConfig(deletedId);
      const c = await listarCompletas();
      setCompletas(c);
      if (selecionada === deletedId) setSelecionada(null);
      setDeleteTarget(null);
      setMode('list');
      mostrarAlerta('Escala excluída', `A escala ${deletedLabel} foi excluída com sucesso.`, 'success');
    } catch (err) {
      setDeleteTarget(null);
      mostrarAlerta('Erro ao excluir escala', err instanceof Error ? err.message : 'Erro desconhecido.', 'danger');
    }
  }

  async function handleEdit() {
    if (!completaAtual) return;
    if (!canManageEquipe(completaAtual.config.equipe)) {
      mostrarAlerta('Acesso negado', 'Você só pode editar escalas mensais da sua equipe efetiva.', 'warning');
      return;
    }
    try {
      const bombeirosBase = bombeiros.length ? bombeiros : await listarAtivos();
      if (!bombeiros.length) setBombeiros(bombeirosBase);
      const { config: cfg } = completaAtual;
      setSelecionada(cfg.id);
      setEquipe(cfg.equipe);
      setMes(cfg.mes);
      setAno(cfg.ano);
      setParidade(cfg.paridade);
      setPessoas(SLOTS.map((_, idx) => cfg.pessoas[idx] ? { ...cfg.pessoas[idx] } : null));
      setFaxinaManual(faxinaParaState(completaAtual.faxinaMensal, bombeirosBase));
      setResponsabilidadesManual(responsabilidadesParaState(completaAtual.responsabilidades, bombeirosBase));
      setRadioManual(radioParaState(completaAtual, bombeirosBase));
      setEditingId(cfg.id);
      setAutoPreencherSetup(false);
      setMode('setup');
      mostrarAlerta('Modo de edição', 'Edite as informações da escala e clique em Salvar Alterações para gravar no mesmo registro.', 'info');
    } catch (err) {
      mostrarAlerta('Erro ao abrir edição', err instanceof Error ? err.message : 'Erro desconhecido.', 'danger');
    }
  }

  function handleAutoFill() {
    handleAutoFillComEfetivo(true);
  }

  async function handleAutoFillComEfetivo(exibirModal = false) {
    try {
      // ── Carregar os MESMOS dados do Quadro de Efetivos ──
      const [all, gozos, vigs] = await Promise.all([
        listarAtivos(),
        listarFeriasGozo(),
        listarVigencias({ ativa: true }),
      ]);

      // allItems = items de escalas aprovadas com feriasGozoId (exato como o Quadro faz)
      const allItems: any[] = [];
      for (const esc of [] as any[]) {
        if (esc.status !== 'Aprovado') continue;
        const its = await listarItensEscala(esc.id);
        for (const i of its) {
          if (i.mes === mes && !i.rejeitado && i.feriasGozoId) allItems.push(i);
        }
      }

      const mesInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const mesFim = dataLocalISO(new Date(ano, mes, 0));

      // ── isEmGozo (exato como o Quadro) ──
      function isEmGozo(bId: string) {
        return gozos.find((g: any) => {
          if (g.funcionarioId !== bId || g.status === 'Gozadas') return false;
          return periodosSobrepostosISO(g.dataInicio, g.dataFim, mesInicio, mesFim);
        });
      }

      // ── temSubstituto (exato como o Quadro) ──
      function _temSubstituto(bId: string): boolean {
        return !!(
          vigs.find((v: any) => v.funcionarioOriginalId === bId && v.ativa) ||
          allItems.find((i: any) => i.funcionarioId === bId && (i.substitutoId || i.feristaId))
        );
      }

      // ── getSubstituindo (exato como o Quadro) ──
      function _getSubstituindo(bId: string): { id: string; cargo: string } | null {
        // 1. allItems (escala aprovada)
        const item = allItems.find((i: any) => i.substitutoId === bId);
        if (item) {
          const func = all.find((bb: any) => bb.id === item.funcionarioId);
          if (func) return { id: bId, cargo: item.funcaoSubstituicao || func.cargo };
        }
        // 2. Gozo direto
        const gozo = gozos.find((g: any) =>
          g.substitutoId === bId && g.status !== 'Gozadas' &&
          periodosSobrepostosISO(g.dataInicio, g.dataFim, mesInicio, mesFim)
        );
        if (gozo) {
          const func = all.find((bb: any) => bb.id === gozo.funcionarioId);
          if (func) return { id: bId, cargo: gozo.funcaoSubstituicao || func.cargo };
        }
        // 3. Vigência (cascata)
        const vigV = vigs.find((v: any) =>
          v.substitutoId === bId && v.ativa &&
          periodosSobrepostosISO(v.dataInicio, v.dataFim, mesInicio, mesFim)
        );
        if (vigV) {
          const func = all.find((bb: any) => bb.id === vigV.funcionarioOriginalId);
          if (func) return { id: bId, cargo: vigV.cargoExercido || func.cargo };
        }
        return null;
      }

      setBombeiros(all);
      setFeriasGozo(gozos);
      setVigenciasCache(vigs);

      const efetivo = montarEfetivoMensal({ bombeiros: all, feriasGozo: gozos, vigencias: vigs, equipe, mes, ano });
      const _membrosEquipe = all.filter((b: any) => b.equipe === equipe);
      const pool: { bombeiro: Bombeiro; cargo: string }[] = efetivo.map(entry => ({
        bombeiro: entry.bombeiro,
        cargo: entry.cargoExercido,
      }));
      const ocupados = new Set<string>();
      let gozosEncontrados = 0;
      let substitutosEncontrados = 0;
      let semSubstituto: string[] = [];
      let poolInfo: string[] = [];

      for (const m of [] as any[]) {
        if (!isEmGozo(m.id)) {
          pool.push({ bombeiro: m, cargo: m.cargo });
          poolInfo.push(`${m.nomeGuerra} (${m.cargo})`);
          continue;
        }
        gozosEncontrados++;
        const subVig = vigs.find((v: any) => v.funcionarioOriginalId === m.id && v.ativa);
        if (subVig && subVig.substitutoId && !ocupados.has(subVig.substitutoId)) {
          const sub = all.find((bb: any) => bb.id === subVig.substitutoId);
          if (sub) {
            pool.push({ bombeiro: sub, cargo: m.cargo });
            ocupados.add(sub.id);
            substitutosEncontrados++;
            poolInfo.push(`${sub.nomeGuerra} (${m.cargo}) → substitui ${m.nomeGuerra}`);
            continue;
          }
        }
        const subItem = allItems.find((i: any) => i.funcionarioId === m.id && (i.substitutoId || i.feristaId));
        if (subItem) {
          const subId = subItem.substitutoId || subItem.feristaId;
          if (subId && !ocupados.has(subId)) {
            const sub = all.find((bb: any) => bb.id === subId);
            if (sub) {
              pool.push({ bombeiro: sub, cargo: subItem.funcaoSubstituicao || m.cargo });
              ocupados.add(sub.id);
              substitutosEncontrados++;
              poolInfo.push(`${sub.nomeGuerra} (${subItem.funcaoSubstituicao || m.cargo}) → substitui ${m.nomeGuerra}`);
              continue;
            }
          }
        }
        semSubstituto.push(m.nomeGuerra);
      }

      // Substitutos externos (de outras equipas)
      for (const v of [] as any[]) {
        if (v.equipe === equipe && !ocupados.has(v.substitutoId)) {
          const sub = all.find((bb: any) => bb.id === v.substitutoId);
          if (sub) {
            pool.push({ bombeiro: sub, cargo: v.cargoExercido || sub.cargo });
            ocupados.add(sub.id);
          }
        }
      }

      const usado = new Set<string>();
      const buscar = (cargo: string) => {
        const idx = pool.findIndex(p => p.cargo === cargo && !usado.has(p.bombeiro.id));
        if (idx === -1) return null;
        usado.add(pool[idx].bombeiro.id);
        return pool[idx];
      };

      const cargoParaSlot = (slot: typeof SLOTS[0]) =>
        slot.funcao === 'chefe' ? 'BA-CE' : slot.funcao === 'lider' ? 'BA-LR' : slot.funcao === 'ba-mc' ? 'BA-MC' : 'BA-2';

      const novas = SLOTS.map(slot => {
        const cargoSlot = cargoParaSlot(slot);
        let encontrado = buscar(cargoSlot);
        if (encontrado && slot.funcao !== 'ba-2') {
          const veiculoBA = slot.veiculo === 'crs' ? 'crs' as const : 'cci' as const;
          const validacao = validarCursoParaFuncao(encontrado.bombeiro, cargoSlot as 'BA-CE' | 'BA-LR' | 'BA-MC', slot.funcao === 'ba-mc' ? veiculoBA : undefined);
          if (validacao?.nivel === 'bloqueado') encontrado = null;
        }
        if (!encontrado) return null;
        const b = encontrado.bombeiro;
        return {
          id: b.id, nome: b.nome, nomeGuerra: b.nomeGuerra,
          funcao: slot.funcao, veiculo: slot.veiculo,
          funcaoNoVeiculo: slot.funcaoNoVeiculo, isRadioFixo: slot.isRadioFixo,
        } as Partial<PessoaEscala>;
      });

      // ── Pós-processamento: substituir vacationers pelos substitutos ──
      const _novasSubstituidas = novas.map(p => {
        if (!p || !p.id) return p;
        // Verificar se esta pessoa está de férias com substituto (vigência, gozo, item)
        const { inicio, fim } = intervaloMes(mes, ano);
        const gozo = gozos.find((g: any) =>
          g.funcionarioId === p.id &&
          g.substitutoId &&
          g.status !== 'Gozadas' &&
          sobrepoePeriodo(g.dataInicio, g.dataFim, inicio, fim)
        );
        if (gozo) {
          const sub = all.find((bb: any) => bb.id === gozo.substitutoId);
          if (sub) return { ...p, id: sub.id, nome: sub.nome, nomeGuerra: sub.nomeGuerra };
        }
        return p;
      });

      setPessoas(novas);
      const mensagem = `Preenchimento: ${novas.filter(Boolean).length}/${SLOTS.length} funções com o efetivo de ${equipe}.`;
      if (exibirModal) mostrarAlerta('Preenchimento concluído', mensagem, 'success');
      else notificar(mensagem);
    } catch (err) {
      const mensagem = err instanceof Error ? err.message : 'Erro desconhecido';
      if (exibirModal) mostrarAlerta('Erro no preenchimento', mensagem, 'danger');
      else notificar('Erro: ' + mensagem);
    }
  }

  return (
    <div className="space-y-6">
      {renderBotaoTutorialMensal()}
      {/* Header */}
      {mode === 'list' && (
        <div className="flex flex-wrap items-center justify-between gap-3" data-escala-mensal-tour="mensal-lista-topo">
          <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Escala Mensal</h2>
          {canCreate && (
            <button title="Criar uma nova escala mensal" onClick={() => {
              setEquipe(isGlobal ? '' : equipeEfetiva || ''); setMes(new Date().getMonth() + 1); setAno(new Date().getFullYear());
              setParidade('impar'); setPessoas(SLOTS.map(() => null)); setFaxinaManual({}); setResponsabilidadesManual({}); setRadioManual(criarRadioManualVazio()); setMode('setup');
              setEditingId(null); setAutoPreencherSetup(true);
            }}
              data-escala-mensal-tour="mensal-nova"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20">
              <Calendar className="h-4 w-4" /> Nova Escala Mensal
            </button>
          )}
        </div>
      )}
      {mode !== 'list' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button title="Voltar para a listagem de escalas mensais" onClick={() => { setMode('list'); setSelecionada(null); setEditingId(null); setAutoPreencherSetup(true); }}
              className="rounded-xl border border-graphite-300/60 bg-white/80 px-3 py-1.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
              Voltar
            </button>
            <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Escala Mensal</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mode === 'view' && completaAtual && (
              <>
                {canManageEquipe(completaAtual.config.equipe) && (
                  <>
                    <button title="Editar os dados desta escala mensal" onClick={handleEdit}
                      className="flex items-center gap-1 rounded-xl border border-graphite-300/60 bg-white/80 px-3 py-1.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
                      <Pencil className="h-4 w-4" /> Editar
                    </button>
                    <button title="Salvar novamente esta escala mensal" onClick={handleSalvarEscalaAtual} disabled={salvando}
                      className="flex items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                      <Save className="h-4 w-4" /> {salvando ? 'Salvando...' : 'Salvar Escala'}
                    </button>
                  </>
                )}
                <div className="relative">
                  <button title="Abrir opções de impressão e PNG" onClick={() => setPrintMenuOpen(prev => !prev)}
                    className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-3 py-1.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20">
                    <Printer className="h-4 w-4" /> Imprimir
                  </button>
                  {printMenuOpen && (
                    <div className="absolute right-0 z-40 mt-2 w-48 overflow-hidden rounded-xl border border-graphite-200 bg-white shadow-xl dark:border-border-dark dark:bg-surface-elevated">
                      <button type="button" title="Abrir a janela de impressão do navegador" onClick={handlePrint}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-graphite-700 hover:bg-aviation-50 dark:text-graphite-200 dark:hover:bg-aviation-900/20">
                        <Printer className="h-4 w-4" /> Imprimir agora
                      </button>
                      <button type="button" title="Baixar a escala como imagem PNG" onClick={() => { setPrintMenuOpen(false); handleExportPNG(); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20">
                        <Image className="h-4 w-4" /> Salvar PNG
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
            {mode === 'setup' && completas.length > 0 && (
              <button title="Cancelar e voltar para a listagem" onClick={() => { setMode('list'); setSelecionada(null); setEditingId(null); setAutoPreencherSetup(true); }}
                className="rounded-xl border border-graphite-300/60 bg-white/80 px-3 py-1.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Setup mode */}
      {mode === 'setup' && (
    <div className="space-y-6 pb-60">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4" data-escala-mensal-tour="mensal-configuracao">
            <div>
              <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Equipe <span className="text-red-500">*</span></label>
              <select value={equipe} onChange={e => setEquipe(e.target.value)} disabled={!isGlobal}
                className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 disabled:opacity-60">
                <option value="">Selecionar equipe</option>
                {equipesDisponiveis.map(eq => <option key={eq} value={eq}>{eq}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Mês</label>
              <select value={mes} onChange={e => setMes(Number(e.target.value))}
                className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
                {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Ano</label>
              <select value={ano} onChange={e => setAno(Number(e.target.value))}
                className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
                {[2024, 2025, 2026, 2027, 2028].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Plantões em dias</label>
              <select value={paridade} disabled
                className="w-full rounded-xl border border-graphite-300/60 bg-graphite-100/70 px-3 py-2.5 text-sm text-graphite-500 dark:border-border-dark dark:bg-surface-card dark:text-graphite-400">
                <option value="impar">Ímpares (1, 3, 5...)</option>
                <option value="par">Pares (2, 4, 6...)</option>
              </select>
            </div>
          </div>

          <div className="space-y-4" data-escala-mensal-tour="mensal-guarnicoes">
            {[
              { nome: 'CRS', cor: 'border-blue-300 bg-blue-50/30 dark:border-blue-800 dark:bg-blue-900/10', indices: [2, 1, 5, 6] },
              { nome: 'CCI F2', cor: 'border-amber-300 bg-amber-50/30 dark:border-amber-800 dark:bg-amber-900/10', indices: [3, 0, 7] },
              { nome: 'CCI F3', cor: 'border-emerald-300 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-900/10', indices: [4, 8, 9] },
            ].map(veiculo => (
              <div key={veiculo.nome} className={`rounded-2xl border-2 ${veiculo.cor} p-4`}>
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-graphite-700 dark:text-graphite-300">
                  {veiculo.nome}
                </h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {veiculo.indices.map(idx => {
                    const slot = SLOTS[idx];
                    const p = pessoas[idx];
                    const pResolvida = substituirFerias(p, slot.cargoFiltro);
                    const _pNomeGuerra = (() => {
                      if (!p?.nomeGuerra) return '';
                      // Se a pessoa no slot estiver de férias com substituto, mostra o substituto
                      const pId = p.id;
                      const subVig = vigenciasCache.find((v: any) => v.funcionarioOriginalId === pId && v.ativa);
                      if (subVig && subVig.substitutoId) {
                        const sub = bombeiros.find((bb: any) => bb.id === subVig.substitutoId);
                        if (sub) return sub.nomeGuerra;
                      }
                      const gozo = feriasGozo.find((g: any) => g.funcionarioId === pId && g.substitutoId && g.status !== 'Gozadas');
                      if (gozo) {
                        const sub = bombeiros.find((bb: any) => bb.id === gozo.substitutoId);
                        if (sub) return sub.nomeGuerra;
                      }
                      return p.nomeGuerra;
                    })();
                    const _pNomeGuerraEfetivo = pResolvida?.nomeGuerra || _pNomeGuerra;
                    const selectedId = pResolvida?.id || p?.id || '';
                    const b = selectedId ? bombeiros.find(bb => bb.id === selectedId) : null;
                    const cargoReq = slot.funcao === 'chefe' ? 'BA-CE' as const : slot.funcao === 'lider' ? 'BA-LR' as const : slot.funcao === 'ba-mc' ? 'BA-MC' as const : undefined;
                    const veiculoBA = slot.veiculo === 'crs' ? 'crs' as const : 'cci' as const;
                    const aviso = b && cargoReq ? validarCursoParaFuncao(b, cargoReq, slot.funcao === 'ba-mc' ? veiculoBA : undefined) : null;
                    const _mesIni = `${ano}-${String(mes).padStart(2, '0')}-01`;
                    const _mesFim = dataLocalISO(new Date(ano, mes, 0));
                    const _emGozoIds = new Set(
                      feriasGozo
                        .filter(g => {
                          if (!g.funcionarioId || g.status === 'Gozadas') return false;
                          return periodosSobrepostosISO(g.dataInicio, g.dataFim, _mesIni, _mesFim);
                        })
                        .map(g => g.funcionarioId)
                    );
                    const selectedIds = new Set(pessoas
                      .map((p2, i2) => i2 === idx ? null : substituirFerias(p2, SLOTS[i2]?.cargoFiltro))
                      .filter((p2): p2 is Partial<PessoaEscala> => !!p2?.id)
                      .map(p2 => p2.id!));
                    return (
                      <div key={idx} className="rounded-xl border border-graphite-200/60 bg-white/70 p-3 dark:border-border-dark dark:bg-surface-card/70">
                        <p className="mb-1.5 text-xs font-medium text-graphite-500 dark:text-graphite-400">{slot.label} <span className="text-red-500">*</span></p>
                        <div className="flex items-center gap-1 w-full">
                          <SearchSelect value={selectedId} valueField="id" cargo={slot.cargoFiltro} equipe={equipe} options={efetivoOptions} showCargo showEquipe disabledIds={selectedIds} onChange={v => {
                            const found = efetivoMensal.find(entry => entry.bombeiro.id === v && entry.cargoExercido === slot.cargoFiltro);
                            const next = [...pessoas];
                            next[idx] = found ? pessoaEscala(found, slot) : null;
                            setPessoas(next);
                          }} placeholder="Selecione..." />
                          {p && (
                            <button type="button" onClick={() => { const next = [...pessoas]; next[idx] = null; setPessoas(next); }}
                              className="shrink-0 rounded-xl p-1.5 text-alert-red transition-all hover:bg-red-50 dark:hover:bg-red-900/20">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {aviso && (
                          <div className={`mt-1.5 flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-[10px] leading-tight ${aviso.nivel === 'bloqueado' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>{aviso.mensagem}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-graphite-200/60 bg-white/70 p-4 dark:border-border-dark dark:bg-surface-card/70" data-escala-mensal-tour="mensal-radio">
            <button
              type="button"
              onClick={() => setFaxinaExpanded(prev => !prev)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-graphite-700 dark:text-graphite-300">
                <ClipboardList className="h-4 w-4 text-aviation-600" />
                Limpeza
              </span>
              {faxinaExpanded ? <ChevronUp className="h-4 w-4 text-graphite-400" /> : <ChevronDown className="h-4 w-4 text-graphite-400" />}
            </button>
            {faxinaExpanded && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {LOCAIS_FAXINA.map(local => {
                  const selectedId = faxinaManual[local] || '';
                  const usados = new Set(Object.entries(faxinaManual)
                    .filter(([nomeLocal, id]) => nomeLocal !== local && !!id)
                    .map(([, id]) => id));

                  return (
                    <div key={local}>
                      <label className="mb-1 block text-xs font-medium text-graphite-500 dark:text-graphite-400">{local}</label>
                      <select
                        value={selectedId}
                        onChange={e => setFaxinaManual(prev => ({ ...prev, [local]: e.target.value }))}
                        className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100"
                      >
                        <option value="">Automático</option>
                        {efetivoMensal.map(entry => (
                          <option key={`${local}-${entry.bombeiro.id}`} value={entry.bombeiro.id} disabled={usados.has(entry.bombeiro.id)}>
                            {entry.cargoExercido} {entry.bombeiro.nomeGuerra}{entry.bombeiro.equipe !== equipe ? ` (${entry.bombeiro.equipe})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-graphite-200/60 bg-white/70 p-4 dark:border-border-dark dark:bg-surface-card/70">
            <button
              type="button"
              onClick={() => setResponsabilidadesExpanded(prev => !prev)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-graphite-700 dark:text-graphite-300">
                <Users className="h-4 w-4 text-aviation-600" />
                Responsabilidades
              </span>
              {responsabilidadesExpanded ? <ChevronUp className="h-4 w-4 text-graphite-400" /> : <ChevronDown className="h-4 w-4 text-graphite-400" />}
            </button>
            {responsabilidadesExpanded && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {RESPONSABILIDADES_SELECTS.map(grupo => {
                  const selectedId = responsabilidadesManual[grupo.key] || '';
                  const usados = new Set(Object.entries(responsabilidadesManual)
                    .filter(([nome, id]) => nome !== grupo.key && !!id)
                    .map(([, id]) => id));

                  return (
                    <div key={grupo.key}>
                      <label className="mb-1 block text-xs font-medium text-graphite-500 dark:text-graphite-400">{grupo.label}</label>
                      <select
                        value={selectedId}
                        onChange={e => setResponsabilidadesManual(prev => ({ ...prev, [grupo.key]: e.target.value }))}
                        className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100"
                      >
                        <option value="">Automático</option>
                        {efetivoMensal.map(entry => (
                          <option key={`${grupo.key}-${entry.bombeiro.id}`} value={entry.bombeiro.id} disabled={usados.has(entry.bombeiro.id)}>
                            {entry.cargoExercido} {entry.bombeiro.nomeGuerra}{entry.bombeiro.equipe !== equipe ? ` (${entry.bombeiro.equipe})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
                </div>
                <div className="rounded-xl border border-graphite-200/60 bg-graphite-50/70 px-3 py-2 text-sm text-graphite-700 dark:border-border-dark dark:bg-surface-hover/40 dark:text-graphite-200">
                  <span className="font-semibold">Limpeza dos CCI:</span> cada motorista faz o seu carro.
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-graphite-200/60 bg-white/70 p-4 dark:border-border-dark dark:bg-surface-card/70">
            <button
              type="button"
              onClick={() => setRadioExpanded(prev => !prev)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-graphite-700 dark:text-graphite-300">
                <Radio className="h-4 w-4 text-aviation-600" />
                Radio
              </span>
              {radioExpanded ? <ChevronUp className="h-4 w-4 text-graphite-400" /> : <ChevronDown className="h-4 w-4 text-graphite-400" />}
            </button>
            {radioExpanded && (
              <div className="mt-3 space-y-4">
                <div className="max-w-md">
                  <label className="mb-1 block text-xs font-medium text-graphite-500 dark:text-graphite-400">Comunicante</label>
                  <select
                    value={radioManual.comunicanteId}
                    onChange={e => setRadioManual(prev => ({ ...prev, comunicanteId: e.target.value }))}
                    className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100"
                  >
                    <option value="">Automático</option>
                    {radioEfetivo.map(entry => (
                      <option key={`radio-comunicante-${entry.bombeiro.id}`} value={entry.bombeiro.id}>
                        {entry.cargoExercido} {entry.bombeiro.nomeGuerra}{entry.bombeiro.equipe !== equipe ? ` (${entry.bombeiro.equipe})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-graphite-600 dark:text-graphite-400">{radioAntesLabel}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {radioManual.antesMeiaNoiteIds.map((selectedId, pos) => {
                        const usados = new Set([...radioManual.antesMeiaNoiteIds, ...radioManual.depoisMeiaNoiteIds].filter(id => id && id !== selectedId));
                        return (
                          <select
                            key={`radio-antes-${pos}`}
                            value={selectedId}
                            onChange={e => setRadioManual(prev => {
                              const antesMeiaNoiteIds = [...prev.antesMeiaNoiteIds];
                              antesMeiaNoiteIds[pos] = e.target.value;
                              return { ...prev, antesMeiaNoiteIds };
                            })}
                            className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100"
                          >
                            <option value="">Automático</option>
                            {radioEfetivo.map(entry => (
                              <option key={`antes-${pos}-${entry.bombeiro.id}`} value={entry.bombeiro.id} disabled={usados.has(entry.bombeiro.id)}>
                                {pos + 1}. {entry.cargoExercido} {entry.bombeiro.nomeGuerra}{entry.bombeiro.equipe !== equipe ? ` (${entry.bombeiro.equipe})` : ''}
                              </option>
                            ))}
                          </select>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-graphite-600 dark:text-graphite-400">{radioDepoisLabel}</p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {radioManual.depoisMeiaNoiteIds.map((selectedId, pos) => {
                        const usados = new Set([...radioManual.antesMeiaNoiteIds, ...radioManual.depoisMeiaNoiteIds].filter(id => id && id !== selectedId));
                        return (
                          <select
                            key={`radio-depois-${pos}`}
                            value={selectedId}
                            onChange={e => setRadioManual(prev => {
                              const depoisMeiaNoiteIds = [...prev.depoisMeiaNoiteIds];
                              depoisMeiaNoiteIds[pos] = e.target.value;
                              return { ...prev, depoisMeiaNoiteIds };
                            })}
                            className="w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100"
                          >
                            <option value="">Automático</option>
                            {radioEfetivo.map(entry => (
                              <option key={`depois-${pos}-${entry.bombeiro.id}`} value={entry.bombeiro.id} disabled={usados.has(entry.bombeiro.id)}>
                                {pos + 1}. {entry.cargoExercido} {entry.bombeiro.nomeGuerra}{entry.bombeiro.equipe !== equipe ? ` (${entry.bombeiro.equipe})` : ''}
                              </option>
                            ))}
                          </select>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3" data-escala-mensal-tour="mensal-acoes">
            <button title="Preencher automaticamente as funções com base na configuração atual" onClick={handleAutoFill}
              className="flex items-center gap-2 rounded-xl border border-aviation-300 bg-aviation-50 px-4 py-2.5 text-sm font-medium text-aviation-700 transition-all hover:bg-aviation-100 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">
              <Sparkles className="h-4 w-4" /> Auto-Preenchimento
            </button>
            <button title="Preencher usando o efetivo válido da equipe no mês selecionado" onClick={() => handleAutoFillComEfetivo(true)}
              className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              <Users className="h-4 w-4" /> Preencher com Efetivo do Mês
            </button>
            <button title={editingId ? 'Salvar as alterações nesta escala mensal' : 'Gerar e salvar uma nova escala mensal'} onClick={editingId ? handleSalvarEdicao : handleGerar} disabled={salvando}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
              <Save className="h-4 w-4" /> {salvando ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Gerar Escala Mensal'}
            </button>
            <p className="text-xs text-graphite-400">{qtdPessoas}/10 pessoas</p>
          </div>
        </div>
      )}

      {/* View mode */}
      {mode === 'view' && completaAtual && (
        <div id="print-area" className="space-y-0.5" style={{ background: '#ffffff', color: '#1a1a1a', overflow: 'hidden', textTransform: 'uppercase' }}>
          <style>{`
            @media print {
              @page {size: landscape; margin: 0.5cm}
              body * {visibility: hidden !important}
              #print-area, #print-area * {visibility: visible !important}
              #print-area {position: absolute; left: 0; top: 0; width: 100%; text-transform: uppercase !important}
              .print-hide {display: none !important}
            }
            #print-area {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            .escala-radio-mensal {
              border-collapse: collapse;
              font-size: 10px;
              line-height: 1.18;
              table-layout: fixed;
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            .escala-radio-mensal th,
            .escala-radio-mensal td {
              border-bottom: 1px solid #cbd5e1;
              color: #111827 !important;
              height: 20px;
              overflow: hidden;
              padding: 3px 2px;
              print-color-adjust: exact;
              text-overflow: clip;
              -webkit-print-color-adjust: exact;
              white-space: nowrap;
            }
            .escala-radio-mensal thead th {
              color: #374151 !important;
            }
            .escala-radio-mensal tbody td {
              text-align: left;
            }
            .escala-radio-data {
              font-size: 10px;
              line-height: 1;
              text-align: left;
              white-space: nowrap;
            }
            .escala-radio-horario-label {
              font-size: 8px;
            }
            .linha-radio-clara,
            .linha-radio-clara > td {
              background-color: #ffffff !important;
            }
            .linha-radio-escura,
            .linha-radio-escura > td {
              background-color: #e8ebf0 !important;
            }
            @media print {
              .escala-radio-mensal {
                font-size: 9px;
                line-height: 1.14;
              }
              .escala-radio-data {
                font-size: 8.4px;
              }
              .escala-radio-horario-label {
                font-size: 7.4px;
              }
              .escala-radio-mensal th,
              .escala-radio-mensal td {
                border-bottom-color: #94a3b8 !important;
                height: 18px;
                padding-bottom: 3px;
                padding-top: 3px;
              }
              .linha-radio-clara,
              .linha-radio-clara > td {
                background-color: #ffffff !important;
              }
              .linha-radio-escura,
              .linha-radio-escura > td {
                background-color: #dfe3ea !important;
              }
            }
            #print-area.png-exporting,
            #print-area.png-exporting * {
              overflow: visible !important;
              scrollbar-width: none !important;
              -ms-overflow-style: none !important;
            }
            #print-area.png-exporting *::-webkit-scrollbar {
              display: none !important;
              width: 0 !important;
              height: 0 !important;
            }
          `}</style>
          <div className="rounded border-2 border-graphite-300 bg-white/80 px-3 py-1 text-center uppercase">
            <div className="space-x-6 text-[13px] font-bold uppercase text-graphite-700">
              <span>EQUIPE: {completaAtual.config.equipe.toUpperCase()}</span>
              <span>{MESES[completaAtual.config.mes - 1].toUpperCase()} {completaAtual.config.ano}</span>
              <span>{completaAtual.paradas.length} PLANTÕES</span>
            </div>
          </div>

          {veiculosView}

          {/* Rádio */}
          <div className="rounded border-2 border-graphite-300 bg-white/80 p-0.5 print:overflow-visible">
            <div className="mb-px flex items-center gap-0.5">
              <Radio className="h-3 w-3 text-aviation-600" />
              <span className="text-[12px] font-bold text-graphite-800">Rádio</span>
            </div>
            <div className="overflow-x-auto print:overflow-visible">
              <table className="escala-radio-mensal w-full">
                <thead>
                  <tr className="border-b-2 border-graphite-300">
                    <th className="escala-radio-horario-label w-12 bg-white px-0.5 py-0.5 text-left font-bold text-graphite-600 print:text-graphite-800">Horário</th>
                    {completaAtual.paradas.map(plantao => (
                      <th
                        key={plantao.data}
                        className="escala-radio-data px-0.5 py-0.5 text-left font-bold text-graphite-700 print:text-graphite-900"
                        title={formatarDataBR(plantao.data)}
                      >
                        {formatarDataRadioMensal(plantao.data)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slotsRadioView.map((slot, slotIndex) => {
                    const linhaAlternada = slotIndex % 2 === 0 ? 'linha-radio-clara' : 'linha-radio-escura';
                    return (
                    <tr key={`${slot.horario}-${slotIndex}`} className={`border-b border-graphite-300 print:border-graphite-400 ${linhaAlternada}`}>
                      <td className="px-0.5 py-0.5 font-bold text-graphite-600 print:text-graphite-800 whitespace-nowrap">{slot.horario}</td>
                      {completaAtual.paradas.map(plantao => (
                        <td key={`${slot.horario}-${plantao.data}`} className="px-0.5 py-0.5 text-left font-bold text-graphite-900 whitespace-nowrap">
                          {plantao.radio[slotIndex]?.pessoaNomeGuerra || '-'}
                        </td>
                      ))}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Faxina */}
          <div className="rounded border-2 border-graphite-400 bg-white p-1">
            <div className="mb-px flex items-center gap-0.5">
              <ClipboardList className="h-3 w-3 text-aviation-600" />
              <span className="text-[12px] font-bold text-graphite-900">Faxina</span>
            </div>
            <div className="grid grid-cols-5 gap-px text-[10px]">
              {completaAtual.faxinaMensal.map((f, i) => (
                <div key={i} className={`rounded border-2 px-1.5 py-0.5 font-semibold ${
                  f.local === 'Sala e WC Liderança' ? 'border-amber-500 bg-amber-50' :
                  f.local === 'Lixo' ? 'border-red-500 bg-red-50' :
                  'border-graphite-400 bg-graphite-100'
                }`}>
                  <p className="text-graphite-700 font-semibold">{f.local}</p>
                  <p className="font-bold text-graphite-900">{f.pessoaNomeGuerra}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Responsabilidades */}
          <div className="rounded border-2 border-graphite-400 bg-white p-1">
            <div className="mb-px flex items-center gap-0.5">
              <Users className="h-3 w-3 text-aviation-600" />
              <span className="text-[12px] font-bold text-graphite-900">Responsabilidades</span>
            </div>
            <div className="grid grid-cols-2 gap-x-1 gap-y-px text-[10px]">
              {completaAtual.responsabilidades.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded border-2 border-graphite-400 bg-graphite-100 px-1.5 py-0.5 font-semibold">
                  <span className="text-graphite-800 truncate">{r.descricao}</span>
                  <span className="ml-1 font-bold text-graphite-900 shrink-0">{r.pessoaNomeGuerra}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Avisos */}
          <div className="space-y-px">
            <div className="grid gap-1 text-center text-[10px] font-bold leading-tight" style={{ gridTemplateColumns: '0.82fr 2.18fr' }}>
              <div className="grid gap-px">
                <div className="rounded border-2 border-amber-600 bg-amber-100 px-2 py-1 text-center text-amber-900">
                  EXECUTAR A HIGIENIZAÇÃO DAS ÁREAS, APÓS AS 06:00 HORAS
                </div>
                <div className="rounded border-2 border-emerald-600 bg-emerald-100 px-2 py-1 text-center text-emerald-900">
                  HIGIENIZAÇÃO CONFORME POP 006
                </div>
              </div>
              <div className="flex items-center justify-center rounded border-2 border-sky-600 bg-sky-100 px-2 py-1 text-center text-sky-900">
                CCI's podem ser higienizados internamente antes das 06 mas devem ser higienizados por dentro e por fora todos os turnos, e nos para-lamas deve ser passo pano após a varredura da garagem para não ficar pó sobre os mesmos
              </div>
            </div>
            <div className="rounded border-2 border-red-700 bg-red-100 px-2 py-1 text-center text-[7px] font-bold leading-snug text-red-900">
              ATENÇÃO: AS HIGIENIZAÇÕES DEVER SER EXECUTADAS POR TODOS, CASO ESTEJAM PEGANDO SUJO COBREM DO TURNO ANTERIOR ASSIM COMO ESTÁ PREVISTO NO POP, POIS IREMOS COBRAR DA NOSSA EQUIPE, SEM EXCEÇÕES
            </div>
          </div>
        </div>
      )}

      {/* List mode */}
      {mode === 'list' && (
        <>
          <div className="flex items-center gap-2" data-escala-mensal-tour="mensal-lista-filtros">
            <select value={filterListEquipe} onChange={e => setFilterListEquipe(e.target.value)}
              className="rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
              <option value="">Todas as equipes</option>
              {['Alfa','Bravo','Charlie','Delta'].map(eq => <option key={eq} value={eq}>{eq}</option>)}
            </select>
            <span className="text-xs text-graphite-400">{completasFiltradas.length} escala(s)</span>
          </div>
          {completasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
              <Calendar className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
              <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhuma escala mensal</h3>
              <p className="text-sm text-graphite-500 dark:text-graphite-400">Clique em "Nova Escala Mensal" para criar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {completasFiltradas.map(c => (
                <div key={c.config.id}
                  onClick={() => { setSelecionada(c.config.id); setMode('view'); setEditingId(null); setAutoPreencherSetup(true); }}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-graphite-200/60 bg-white/80 p-4 backdrop-blur-sm transition-all hover:bg-aviation-50/50 dark:border-border-dark dark:bg-surface-card dark:hover:bg-aviation-900/20"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-aviation-600 dark:text-aviation-400" />
                    <div>
                      <p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">{MESES[c.config.mes - 1]} {c.config.ano} · Equipe {c.config.equipe}</p>
                      <p className="text-xs text-graphite-500 dark:text-graphite-400">
                        {c.paradas.length} plantões · {c.config.paridade === 'impar' ? 'Ímpares' : 'Pares'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageEquipe(c.config.equipe) && (
                      <button
                        type="button"
                        title="Excluir esta escala mensal"
                        onClick={event => {
                          event.stopPropagation();
                          setDeleteTarget(c);
                        }}
                        className="flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-all hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </button>
                    )}
                    <Eye className="h-4 w-4 text-graphite-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state (view mode, no data) */}
      {mode === 'view' && !completaAtual && completas.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Calendar className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhuma escala mensal</h3>
          <p className="text-sm text-graphite-500">Clique em "Nova Escala" para configurar.</p>
        </div>
      )}

      <AlertModal
        open={!!deleteTarget}
        title="Excluir escala mensal"
        message={deleteTarget ? `Deseja excluir a escala de ${MESES[deleteTarget.config.mes - 1]} ${deleteTarget.config.ano} da equipe ${deleteTarget.config.equipe}? Esta ação não pode ser desfeita.` : undefined}
        variant="danger"
        confirmLabel="Excluir"
        loadingLabel="Excluindo..."
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />

      {msg && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-graphite-900 px-5 py-3 text-sm font-medium text-white shadow-xl dark:bg-graphite-100 dark:text-graphite-900">
          {msg}
        </div>
      )}
      <AnimatedPageTour
        open={showTutorial}
        steps={ESCALA_MENSAL_TOUR_STEPS}
        stepIndex={tutorialStepIndex}
        targetAttribute="data-escala-mensal-tour"
        onBack={voltarTutorialMensal}
        onNext={avancarTutorialMensal}
        onClose={fecharTutorialMensal}
      />
    </div>
  );
}

export default EscalaMensal;
