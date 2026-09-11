import type { AtivoItem } from '../components/ui/SearchSelect';
import type { Bombeiro } from '../types/bombeiro';
import type { DocumentFill } from '../types/document';
import type { EscalaMensalCompleta } from '../types/escalaMensal';
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
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function textoTrocaKey(value: unknown): string {
  return nomeKey(value);
}

export function campoTrocaServico(data: Record<string, any> | undefined, ...keys: string[]): unknown {
  if (!data) return '';
  for (const key of keys) {
    const value = data[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

export function trocaServicoAprovada(fill: DocumentFill): boolean {
  const status = String(fill?.status || '').toLocaleLowerCase('pt-BR');
  if (status === 'signed') return true;
  if (status === 'cancelled') return false;

  const fd = fill?.filled_data || {};
  const parecer = textoTrocaKey(campoTrocaServico(
    fd,
    'deferido_indeferido',
    'parecer',
    'status_aprovacao',
    'statusAprovacao',
    'status_troca',
    'statusTroca',
  ));
  return parecer === 'deferido' || parecer === 'aprovada' || parecer === 'aprovado';
}

export function trocaServicoTemCamposBasicos(fill: DocumentFill): boolean {
  const fd = fill?.filled_data || {};
  const nomeSolicitante = campoTrocaServico(fd, 'nome_solicitante', 'nomeSolicitante', 'solicitante_nome', 'solicitanteNome');
  const nomeSolicitado = campoTrocaServico(fd, 'nome_solicitado', 'nomeSolicitado', 'solicitado_nome', 'solicitadoNome');
  const dataSolicitada = campoTrocaServico(fd, 'data_solicitada', 'dataSolicitada', 'data_plantao_solicitante', 'dataPlantaoSolicitante');
  const dataFolgaSolicitado = campoTrocaServico(fd, 'data_folga_solicitado', 'dataFolgaSolicitado', 'data_folga_solicitado_iso', 'dataFolgaSolicitadoIso');
  return !!(nomeSolicitante && nomeSolicitado && (dataSolicitada || dataFolgaSolicitado));
}

function cargoCampo(value: unknown): string {
  return String(value || '').split(' - ')[0].trim();
}

function pessoaPorNome(porNome: Map<string, Bombeiro>, nome: unknown, pessoas: Bombeiro[]): Bombeiro | undefined {
  const alvo = nomeKey(nome);
  if (!alvo) return undefined;

  const exato = porNome.get(alvo);
  if (exato) return exato;

  const tokens = alvo.split(' ').filter(token => token.length > 1);
  return [...pessoas]
    .filter(pessoa => {
      const completo = nomeKey(pessoa.nomeCompleto);
      const guerra = nomeKey(pessoa.nomeGuerra);
      if (completo && (alvo === completo || alvo.includes(completo))) return true;
      if (completo && tokens.length >= 2 && (completo.includes(alvo) || tokens.every(token => completo.includes(token)))) return true;
      if (guerra && (alvo === guerra || alvo.startsWith(`${guerra} `) || alvo.endsWith(` ${guerra}`))) return true;
      return false;
    })
    .sort((a, b) => nomeKey(b.nomeCompleto).length - nomeKey(a.nomeCompleto).length)[0];
}

const CARGO_POR_FUNCAO_MENSAL: Record<string, string> = {
  BaCe: 'BA-CE',
  BaLr: 'BA-LR',
  BaMc: 'BA-MC',
  Ba2: 'BA-2',
  'Ba2-1': 'BA-2',
  'Ba2-2': 'BA-2',
};

function cargoPorFuncaoMensal(funcaoNoVeiculo: unknown): string {
  return CARGO_POR_FUNCAO_MENSAL[String(funcaoNoVeiculo || '')] || '';
}

function pessoaCorrespondeReferencia(pessoa: Bombeiro, id?: unknown, ...nomes: unknown[]): boolean {
  const idRef = String(id || '').trim();
  if (idRef && pessoa.id === idRef) return true;
  const nomesPessoa = [pessoa.nomeCompleto, pessoa.nomeGuerra].map(nomeKey).filter(Boolean);
  return nomes
    .map(nomeKey)
    .filter(Boolean)
    .some(nome => nomesPessoa.includes(nome));
}

function escalaMensalDoPlantao(
  escalasCompletas: EscalaMensalCompleta[] | undefined,
  equipe: string,
  dataPlantao: string,
): EscalaMensalCompleta | undefined {
  const data = parseDataLocalISO(dataPlantao);
  if (Number.isNaN(data.getTime())) return undefined;
  return (escalasCompletas || []).find(completa =>
    completa.config?.equipe === equipe &&
    completa.config?.mes === data.getMonth() + 1 &&
    completa.config?.ano === data.getFullYear()
  );
}

function referenciasMensaisDoPlantao(completa: EscalaMensalCompleta | undefined, dataPlantao: string) {
  if (!completa) return [];
  const data = parseDataLocalISO(dataPlantao);
  const dia = Number.isNaN(data.getTime()) ? 0 : data.getDate();
  const parada = completa.paradas?.find(p => mesmoDiaISO(p.data, dataPlantao) || p.dia === dia);
  const refs: Array<{ id?: string; nome?: string; nomeGuerra?: string; cargo: string }> = [];
  const addNome = (nome: unknown, cargo: string) => {
    const texto = String(nome || '').trim();
    if (!texto || texto === '-') return;
    refs.push({ nome: texto, nomeGuerra: texto, cargo });
  };

  addNome(parada?.veiculos?.cciF2?.baCe, 'BA-CE');
  addNome(parada?.veiculos?.cciF2?.baMc, 'BA-MC');
  addNome(parada?.veiculos?.cciF2?.ba2, 'BA-2');
  addNome(parada?.veiculos?.cciF3?.baMc, 'BA-MC');
  addNome(parada?.veiculos?.cciF3?.ba2_1, 'BA-2');
  addNome(parada?.veiculos?.cciF3?.ba2_2, 'BA-2');
  addNome(parada?.veiculos?.crs?.baMc, 'BA-MC');
  addNome(parada?.veiculos?.crs?.baLr, 'BA-LR');
  addNome(parada?.veiculos?.crs?.ba2_1, 'BA-2');
  addNome(parada?.veiculos?.crs?.ba2_2, 'BA-2');

  for (const pessoa of completa.config?.pessoas || []) {
    refs.push({
      id: pessoa.id,
      nome: pessoa.nome,
      nomeGuerra: pessoa.nomeGuerra,
      cargo: cargoPorFuncaoMensal(pessoa.funcaoNoVeiculo) || '',
    });
  }

  return refs;
}

export function montarMembrosEscalaMensalPlantao(params: {
  bombeiros: Bombeiro[];
  escalasCompletas?: EscalaMensalCompleta[];
  equipe: string;
  dataPlantao: string;
}): Array<{ bombeiro: Bombeiro; cargoExercido: string }> {
  const { bombeiros, escalasCompletas, equipe, dataPlantao } = params;
  const completa = escalaMensalDoPlantao(escalasCompletas, equipe, dataPlantao);
  const ativos = bombeiros.filter(b => !b.dataDesligamento);
  const usados = new Set<string>();
  const membros: Array<{ bombeiro: Bombeiro; cargoExercido: string }> = [];

  for (const ref of referenciasMensaisDoPlantao(completa, dataPlantao)) {
    const bombeiro = ativos.find(b => pessoaCorrespondeReferencia(b, ref.id, ref.nome, ref.nomeGuerra));
    if (!bombeiro || usados.has(bombeiro.id)) continue;
    membros.push({ bombeiro, cargoExercido: ref.cargo || bombeiro.cargo });
    usados.add(bombeiro.id);
  }

  return membros;
}

export function resolverPessoaNoPlantaoOperacional(params: {
  pessoa?: Bombeiro;
  bombeiros: Bombeiro[];
  vigencias?: VigenciaSubstituicao[];
  escalasCompletas?: EscalaMensalCompleta[];
  equipe: string;
  dataPlantao: string;
}): { pertence: boolean; cargoExercido?: string } {
  const { pessoa, bombeiros, vigencias = [], escalasCompletas, equipe, dataPlantao } = params;
  if (!pessoa || !equipe || !dataPlantao) return { pertence: false };
  const ativos = bombeiros.filter(b => !b.dataDesligamento);
  const porId = new Map(ativos.map(b => [b.id, b]));
  const vigencia = vigencias.find(v => {
    if (!v.ativa || v.substitutoId !== pessoa.id) return false;
    if (!estaNoPeriodoISO(dataPlantao, v.dataInicio, v.dataFim)) return false;
    const original = porId.get(v.funcionarioOriginalId);
    return (original?.equipe || v.equipe) === equipe;
  });
  if (vigencia) return { pertence: true, cargoExercido: vigencia.cargoExercido || pessoa.cargo };

  const membroMensal = montarMembrosEscalaMensalPlantao({ bombeiros, escalasCompletas, equipe, dataPlantao })
    .find(membro => membro.bombeiro.id === pessoa.id);
  if (membroMensal) return { pertence: true, cargoExercido: membroMensal.cargoExercido };

  if (pessoa.equipe === equipe) return { pertence: true, cargoExercido: pessoa.cargo };
  return { pertence: false };
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
  vigencias?: VigenciaSubstituicao[];
  escalasCompletas?: EscalaMensalCompleta[];
  equipe: string;
  dataPlantao: string;
}): TrocaServicoResolvida[] {
  const { bombeiros, trocaFills, vigencias = [], escalasCompletas, equipe, dataPlantao } = params;
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
    if (!trocaServicoAprovada(fill)) continue;
    if (!trocaServicoTemCamposBasicos(fill)) continue;

    const fd = fill.filled_data || {};
    const nomeSolicitante = campoTrocaServico(fd, 'nome_solicitante', 'nomeSolicitante', 'solicitante_nome', 'solicitanteNome');
    const nomeSolicitado = campoTrocaServico(fd, 'nome_solicitado', 'nomeSolicitado', 'solicitado_nome', 'solicitadoNome');
    const dataSolicitada = campoTrocaServico(fd, 'data_solicitada', 'dataSolicitada', 'data_plantao_solicitante', 'dataPlantaoSolicitante');
    const dataFolgaSolicitado = campoTrocaServico(fd, 'data_folga_solicitado', 'dataFolgaSolicitado', 'data_folga_solicitado_iso', 'dataFolgaSolicitadoIso');
    const solicitante = pessoaPorNome(porNome, nomeSolicitante, ativos);
    const solicitado = pessoaPorNome(porNome, nomeSolicitado, ativos);
    if (!solicitante || !solicitado) continue;

    const add = (saindo: Bombeiro, entrando: Bombeiro, funcaoSaindo: unknown, funcaoEntrando: unknown) => {
      const contextoSaindo = resolverPessoaNoPlantaoOperacional({
        pessoa: saindo,
        bombeiros: ativos,
        vigencias,
        escalasCompletas,
        equipe,
        dataPlantao,
      });
      if (!contextoSaindo.pertence) return;
      const chave = `${fill.id}:${saindo.id}:${entrando.id}`;
      if (usados.has(chave)) return;
      usados.add(chave);
      result.push({
        saindo,
        entrando,
        funcaoSaindo: contextoSaindo.cargoExercido || cargoCampo(funcaoSaindo) || saindo.cargo,
        funcaoEntrando: cargoCampo(funcaoEntrando) || entrando.cargo,
      });
    };

    if (mesmoDiaISO(dataSolicitada, dataPlantao)) {
      add(
        solicitante,
        solicitado,
        campoTrocaServico(fd, 'funcao_solicitante', 'funcaoSolicitante', 'cargo_solicitante', 'cargoSolicitante'),
        campoTrocaServico(fd, 'funcao_solicitado', 'funcaoSolicitado', 'cargo_solicitado', 'cargoSolicitado'),
      );
    }
    if (mesmoDiaISO(dataFolgaSolicitado, dataPlantao)) {
      add(
        solicitado,
        solicitante,
        campoTrocaServico(fd, 'funcao_solicitado', 'funcaoSolicitado', 'cargo_solicitado', 'cargoSolicitado'),
        campoTrocaServico(fd, 'funcao_solicitante', 'funcaoSolicitante', 'cargo_solicitante', 'cargoSolicitante'),
      );
    }
  }

  return result;
}

export function montarTrocasServicoDoDia(params: {
  bombeiros: Bombeiro[];
  trocaFills: DocumentFill[];
  vigencias?: VigenciaSubstituicao[];
  escalasCompletas?: EscalaMensalCompleta[];
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
  escalasCompletas?: EscalaMensalCompleta[];
  substituicoesTemporarias?: SubstituicaoTemporaria[];
  equipe: string;
  dataPlantao: string;
  aplicarTrocas?: boolean;
}): EfetivoOperacionalEntry[] {
  const {
    bombeiros,
    feriasGozo,
    vigencias,
    trocaFills,
    escalasCompletas,
    substituicoesTemporarias = [],
    equipe,
    dataPlantao,
    aplicarTrocas = true,
  } = params;
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
  const trocasResolvidas = aplicarTrocas
    ? montarTrocasServicoResolvidas({ bombeiros: ativos, trocaFills, vigencias, escalasCompletas, equipe, dataPlantao })
    : [];
  for (const troca of trocasResolvidas) {
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

  for (const membroMensal of montarMembrosEscalaMensalPlantao({ bombeiros: ativos, escalasCompletas, equipe, dataPlantao })) {
    const membro = membroMensal.bombeiro;
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
      adicionar(membro, substitui.cargoExercido || membroMensal.cargoExercido || membro.cargo, {
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
    adicionar(membro, membroMensal.cargoExercido || membro.cargo);
  }

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
    nomeCompleto: entry.bombeiro.nomeCompleto,
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
