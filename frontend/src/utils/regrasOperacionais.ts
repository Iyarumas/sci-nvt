import type { Bombeiro, Cargo, Equipe } from '../types/bombeiro';
import type { EscalaDiaria, RadioSlot } from '../types/escala';
import type { EscalaFeriasItem, FeriasGozo } from '../types/ferias';
import type { SubstituicaoTemporaria } from '../types/substituicaoTemporaria';
import {
  getCargosPermitidosSubstituto,
  isSubstitutoObrigatorio,
} from '../types/ferias';
import { equipeEstaNoPlantao } from './equipes';

type BombeiroOperacional = Pick<
  Bombeiro,
  'id' | 'nomeCompleto' | 'nomeGuerra' | 'cargo' | 'equipe' | 'dataDesligamento'
>;

export interface EloCadeiaValidacao {
  pessoaId: string;
  pessoaNome?: string;
  pessoaCargo?: Cargo | '';
  pessoaEquipe?: Equipe | '';
  cargoOriginal?: Cargo | '';
  cargoVacante?: string;
  substituindoNome?: string;
}

export class RegraNegocioError extends Error {
  errors: string[];

  constructor(errors: string[]) {
    super(errors.join('\n'));
    this.name = 'RegraNegocioError';
    this.errors = errors;
  }
}

export function assertSemErros(errors: string[]): void {
  if (errors.length > 0) throw new RegraNegocioError(errors);
}

function dataEhValida(data: string | undefined): data is string {
  if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const parsed = new Date(`${data}T12:00:00`);
  return !Number.isNaN(parsed.getTime());
}

function parseData(data: string): Date {
  return new Date(`${data}T12:00:00`);
}

export function diasInclusivos(dataInicio: string, dataFim: string): number {
  if (!dataEhValida(dataInicio) || !dataEhValida(dataFim)) return 0;
  const diffMs = parseData(dataFim).getTime() - parseData(dataInicio).getTime();
  return Math.floor(diffMs / 86400000) + 1;
}

export function intervalosSobrepostos(
  inicioA: string,
  fimA: string,
  inicioB: string,
  fimB: string,
): boolean {
  if (!dataEhValida(inicioA) || !dataEhValida(fimA) || !dataEhValida(inicioB) || !dataEhValida(fimB)) {
    return false;
  }
  return inicioA <= fimB && fimA >= inicioB;
}

export function isEquipeFerista(pessoa?: Pick<Bombeiro, 'equipe'> | null): boolean {
  return pessoa?.equipe === 'Ferista';
}

function nomePessoa(pessoa?: Pick<Bombeiro, 'nomeCompleto' | 'nomeGuerra'> | null): string {
  return pessoa?.nomeCompleto || pessoa?.nomeGuerra || 'Funcionario';
}

function validarPeriodoBasico(
  dataInicio: string | undefined,
  dataFim: string | undefined,
  dias: number | undefined,
  contexto: string,
): string[] {
  const errors: string[] = [];
  if (!dataEhValida(dataInicio)) errors.push(`${contexto}: informe uma data inicial valida.`);
  if (!dataEhValida(dataFim)) errors.push(`${contexto}: informe uma data final valida.`);
  if (dataEhValida(dataInicio) && dataEhValida(dataFim)) {
    if (dataFim < dataInicio) errors.push(`${contexto}: a data final nao pode ser anterior a inicial.`);
    const diasCalculados = diasInclusivos(dataInicio, dataFim);
    if (dias !== undefined && dias > 0 && dias !== diasCalculados) {
      errors.push(`${contexto}: quantidade de dias (${dias}) nao confere com o periodo (${diasCalculados}).`);
    }
  }
  return errors;
}

function pessoaPorId(bombeiros: BombeiroOperacional[] | undefined, id: string | undefined): BombeiroOperacional | undefined {
  if (!id) return undefined;
  return bombeiros?.find(b => b.id === id);
}

function statusGozoBloqueiaAgenda(status: FeriasGozo['status'] | undefined): boolean {
  return status !== 'Gozadas';
}

function validarDisponibilidadePessoaEmFerias(
  pessoaId: string,
  pessoaNome: string,
  dataInicio: string,
  dataFim: string,
  gozosExistentes: FeriasGozo[] | undefined,
  ignoreGozoId?: string,
): string[] {
  const conflito = gozosExistentes?.find(g =>
    g.id !== ignoreGozoId &&
    g.funcionarioId === pessoaId &&
    statusGozoBloqueiaAgenda(g.status) &&
    intervalosSobrepostos(dataInicio, dataFim, g.dataInicio, g.dataFim)
  );
  return conflito
    ? [`${pessoaNome} ja possui ferias no periodo ${conflito.dataInicio} a ${conflito.dataFim}.`]
    : [];
}

function validarPessoaNaoRepetida(ids: Array<{ id: string; papel: string }>): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  for (const item of ids) {
    if (!item.id) continue;
    const anterior = seen.get(item.id);
    if (anterior) {
      errors.push(`A mesma pessoa nao pode aparecer como ${anterior} e ${item.papel} na mesma cadeia.`);
    } else {
      seen.set(item.id, item.papel);
    }
  }
  return errors;
}

function validarSubstitutoPermitido(
  cargoVacante: Cargo,
  substituto: BombeiroOperacional | undefined,
): string[] {
  if (!substituto) return ['Selecione um substituto valido.'];
  const permitidos = getCargosPermitidosSubstituto(cargoVacante);
  const cargoPermitido = permitidos.includes(substituto.cargo);
  const feristaPermitido = permitidos.includes('Ferista') && substituto.equipe === 'Ferista';
  if (!cargoPermitido && !feristaPermitido) {
    return [`${nomePessoa(substituto)} (${substituto.cargo}/${substituto.equipe}) nao pode substituir ${cargoVacante}.`];
  }
  return [];
}

function validarCadeiaObrigatoria(params: {
  funcionario: BombeiroOperacional;
  substituto: BombeiroOperacional | undefined;
  cadeia?: EloCadeiaValidacao[];
  bombeiros?: BombeiroOperacional[];
}): string[] {
  const { funcionario, substituto, cadeia, bombeiros } = params;
  const errors: string[] = [];
  if (!substituto || isEquipeFerista(substituto)) return errors;
  if (!isSubstitutoObrigatorio(funcionario.cargo)) return errors;

  const elos = (cadeia || []).filter(e => e.pessoaId);
  if (elos.length === 0) {
    errors.push('Informe a cadeia de substituicao ate uma pessoa da equipe Ferista.');
    return errors;
  }

  const ultimo = elos[elos.length - 1];
  const ultimoPessoa = pessoaPorId(bombeiros, ultimo.pessoaId);
  const ultimoEquipe = ultimo.pessoaEquipe || ultimoPessoa?.equipe || '';
  if (ultimoEquipe !== 'Ferista') {
    errors.push('A cadeia de substituicao deve terminar com alguem da equipe Ferista.');
  }

  const ids = [
    { id: funcionario.id, papel: 'funcionario em ferias' },
    { id: substituto.id, papel: 'substituto direto' },
    ...elos.map((elo, index) => ({ id: elo.pessoaId, papel: `elo ${index + 2}` })),
  ];
  errors.push(...validarPessoaNaoRepetida(ids));

  return errors;
}

export function validarFeriasGozo(params: {
  gozo: Omit<FeriasGozo, 'id' | 'createdAt' | 'updatedAt'> | FeriasGozo;
  funcionario?: BombeiroOperacional;
  substituto?: BombeiroOperacional;
  bombeiros?: BombeiroOperacional[];
  gozosExistentes?: FeriasGozo[];
  cadeia?: EloCadeiaValidacao[];
  ignoreGozoId?: string;
  exigirCadeiaCompleta?: boolean;
}): string[] {
  const { gozo, funcionario, substituto, bombeiros, gozosExistentes, cadeia, ignoreGozoId, exigirCadeiaCompleta } = params;
  const errors = validarPeriodoBasico(gozo.dataInicio, gozo.dataFim, gozo.dias, 'Ferias');

  if (!funcionario) {
    errors.push('Funcionario de ferias nao encontrado no cadastro ativo.');
    return errors;
  }

  if (funcionario.dataDesligamento) {
    errors.push(`${nomePessoa(funcionario)} esta desligado e nao pode ter ferias programadas.`);
  }

  const duplicidadePeriodo = gozosExistentes?.find(g =>
    g.id !== ignoreGozoId &&
    g.funcionarioId === gozo.funcionarioId &&
    g.periodoNumero === gozo.periodoNumero
  );
  if (duplicidadePeriodo) {
    errors.push(`${nomePessoa(funcionario)} ja possui ferias cadastradas para o periodo ${gozo.periodoNumero}.`);
  }

  const conflitoPeriodo = gozosExistentes?.find(g =>
    g.id !== ignoreGozoId &&
    g.funcionarioId === gozo.funcionarioId &&
    intervalosSobrepostos(gozo.dataInicio, gozo.dataFim, g.dataInicio, g.dataFim)
  );
  if (conflitoPeriodo) {
    errors.push(`${nomePessoa(funcionario)} ja possui ferias no periodo ${conflitoPeriodo.dataInicio} a ${conflitoPeriodo.dataFim}.`);
  }

  const precisaSubstituto = !isEquipeFerista(funcionario) && isSubstitutoObrigatorio(funcionario.cargo) && gozo.status !== 'Gozadas';
  if (precisaSubstituto && !gozo.substitutoId) {
    errors.push(`${funcionario.cargo} precisa de substituto para ferias programadas ou em gozo.`);
  }

  if (gozo.substitutoId) {
    if (gozo.substitutoId === funcionario.id) {
      errors.push('O substituto nao pode ser o proprio funcionario em ferias.');
    }
    errors.push(...validarSubstitutoPermitido(funcionario.cargo, substituto));
    if (substituto) {
      errors.push(...validarDisponibilidadePessoaEmFerias(
        substituto.id,
        nomePessoa(substituto),
        gozo.dataInicio,
        gozo.dataFim,
        gozosExistentes,
        ignoreGozoId,
      ));
    }
    if (exigirCadeiaCompleta !== false) {
      errors.push(...validarCadeiaObrigatoria({ funcionario, substituto, cadeia, bombeiros }));
    }
  }

  for (const elo of cadeia || []) {
    if (!elo.pessoaId) continue;
    const pessoa = pessoaPorId(bombeiros, elo.pessoaId);
    if (!pessoa) {
      errors.push(`Pessoa da cadeia nao encontrada: ${elo.pessoaNome || elo.pessoaId}.`);
      continue;
    }
    errors.push(...validarDisponibilidadePessoaEmFerias(
      pessoa.id,
      nomePessoa(pessoa),
      gozo.dataInicio,
      gozo.dataFim,
      gozosExistentes,
      ignoreGozoId,
    ));
  }

  return errors;
}

export function extrairCadeiaObservacoes(observacoes?: string): EloCadeiaValidacao[] {
  if (!observacoes?.startsWith('cad_sup:')) return [];
  try {
    const parsed = JSON.parse(observacoes.slice('cad_sup:'.length));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((e: Record<string, unknown>) => ({
      pessoaId: String(e.pessoaId || ''),
      pessoaNome: String(e.pessoaNome || ''),
      pessoaCargo: (e.pessoaCargo || e.cargoOriginal || '') as Cargo | '',
      pessoaEquipe: (e.pessoaEquipe || '') as Equipe | '',
      cargoOriginal: (e.cargoOriginal || e.pessoaCargo || '') as Cargo | '',
      cargoVacante: String(e.cargoVacante || ''),
      substituindoNome: String(e.substituindoNome || ''),
    }));
  } catch {
    return [];
  }
}

export function validarItemEscalaFerias(params: {
  item: Omit<EscalaFeriasItem, 'id' | 'createdAt'> | EscalaFeriasItem;
  funcionario?: BombeiroOperacional;
  substituto?: BombeiroOperacional;
  ferista?: BombeiroOperacional;
  bombeiros?: BombeiroOperacional[];
  itensExistentes?: EscalaFeriasItem[];
  gozosExistentes?: FeriasGozo[];
  ignoreItemId?: string;
}): string[] {
  const { item, funcionario, substituto, ferista, bombeiros, itensExistentes, gozosExistentes, ignoreItemId } = params;
  const errors = validarPeriodoBasico(item.dataInicio, item.dataFim, item.dias, 'Item da escala anual');

  if (!funcionario) {
    errors.push('Funcionario da escala anual nao encontrado no cadastro ativo.');
    return errors;
  }

  const itemDuplicado = itensExistentes?.find(i =>
    i.id !== ignoreItemId &&
    !i.rejeitado &&
    i.funcionarioId === item.funcionarioId &&
    i.periodoNumero === item.periodoNumero
  );
  if (itemDuplicado) {
    errors.push(`${nomePessoa(funcionario)} ja esta na escala anual para o periodo ${item.periodoNumero}.`);
  }

  const itemSobreposto = itensExistentes?.find(i =>
    i.id !== ignoreItemId &&
    !i.rejeitado &&
    i.funcionarioId === item.funcionarioId &&
    intervalosSobrepostos(item.dataInicio, item.dataFim, i.dataInicio, i.dataFim)
  );
  if (itemSobreposto) {
    errors.push(`${nomePessoa(funcionario)} ja possui item de escala no periodo ${itemSobreposto.dataInicio} a ${itemSobreposto.dataFim}.`);
  }

  const gozoDuplicado = gozosExistentes?.find(g =>
    g.funcionarioId === item.funcionarioId &&
    g.periodoNumero === item.periodoNumero
  );
  if (gozoDuplicado && !item.feriasGozoId) {
    errors.push(`${nomePessoa(funcionario)} ja possui gozo gerado para o periodo ${item.periodoNumero}.`);
  }

  const precisaSubstituto = !isEquipeFerista(funcionario) && isSubstitutoObrigatorio(funcionario.cargo);
  if (precisaSubstituto && !item.substitutoId && !item.feristaId) {
    errors.push(`${funcionario.cargo} precisa de substituto ou ferista na escala anual.`);
  }

  if (item.substitutoId) {
    if (item.substitutoId === funcionario.id) errors.push('O substituto nao pode ser o proprio funcionario.');
    errors.push(...validarSubstitutoPermitido(funcionario.cargo, substituto));
  }
  if (item.feristaId) {
    if (item.feristaId === funcionario.id) errors.push('O ferista nao pode ser o proprio funcionario.');
    if (ferista && !isEquipeFerista(ferista)) errors.push(`${nomePessoa(ferista)} nao pertence a equipe Ferista.`);
  }

  const cadeia = extrairCadeiaObservacoes(item.observacoes);
  if (item.substitutoId) {
    errors.push(...validarCadeiaObrigatoria({ funcionario, substituto, cadeia, bombeiros }));
  }

  return errors;
}

function normalizarNome(nome: string | undefined): string {
  return (nome || '').trim().toLowerCase();
}

function adicionarSlot(
  slots: Array<{ nome: string; label: string; isentoDuplicado?: boolean }>,
  nome: string | undefined,
  label: string,
  isentoDuplicado = false,
): void {
  const normalizado = normalizarNome(nome);
  if (normalizado) slots.push({ nome: normalizado, label, isentoDuplicado });
}

function horariosSobrepostos(a: RadioSlot, b: RadioSlot): boolean {
  if (!a.horarioInicio || !a.horarioFim || !b.horarioInicio || !b.horarioFim) return true;
  return a.horarioInicio < b.horarioFim && a.horarioFim > b.horarioInicio;
}

export function validarEscalaDiaria(params: {
  escala: Omit<EscalaDiaria, 'id' | 'createdAt' | 'updatedAt'> | EscalaDiaria;
  escalasExistentes?: EscalaDiaria[];
  ignoreEscalaId?: string;
}): string[] {
  const { escala, escalasExistentes, ignoreEscalaId } = params;
  const errors: string[] = [];

  if (!escala.equipe) errors.push('Informe a equipe da escala diaria.');
  if (!dataEhValida(escala.dataPlantao)) errors.push('Informe uma data de plantao valida.');

  if (escala.equipe && dataEhValida(escala.dataPlantao)) {
    if (!equipeEstaNoPlantao(escala.equipe, parseData(escala.dataPlantao))) {
      errors.push(`${escala.equipe} nao esta prevista para o plantao de ${escala.dataPlantao}.`);
    }
  }

  const duplicada = escalasExistentes?.find(e =>
    e.id !== ignoreEscalaId &&
    e.equipe === escala.equipe &&
    e.dataPlantao === escala.dataPlantao
  );
  if (duplicada) {
    errors.push(`Ja existe escala diaria para ${escala.equipe} em ${escala.dataPlantao}.`);
  }

  const slots: Array<{ nome: string; label: string; isentoDuplicado?: boolean }> = [];
  adicionarSlot(slots, escala.guarnicoes?.cci02?.baMc, 'CCI 02 BA-MC');
  adicionarSlot(slots, escala.guarnicoes?.cci02?.baCe, 'CCI 02 BA-CE');
  adicionarSlot(slots, escala.guarnicoes?.cci02?.ba2, 'CCI 02 BA-2');
  adicionarSlot(slots, escala.guarnicoes?.cci03?.baMc, 'CCI 03 BA-MC');
  adicionarSlot(slots, escala.guarnicoes?.cci03?.ba2_1, 'CCI 03 BA-2 1');
  adicionarSlot(slots, escala.guarnicoes?.cci03?.ba2_2, 'CCI 03 BA-2 2');
  adicionarSlot(slots, escala.guarnicoes?.crs?.baMc, 'CRS BA-MC');
  adicionarSlot(slots, escala.guarnicoes?.crs?.baLr, 'CRS BA-LR');
  adicionarSlot(slots, escala.guarnicoes?.crs?.baRe1, 'CRS BA-RE 1');
  adicionarSlot(slots, escala.guarnicoes?.crs?.baRe2, 'CRS BA-RE 2');
  adicionarSlot(slots, escala.bds?.nomeGuerra, 'BDS', true);
  adicionarSlot(slots, escala.ptr1?.nomeGuerra, 'PTR 1', true);
  adicionarSlot(slots, escala.ptr2?.nomeGuerra, 'PTR 2', true);
  adicionarSlot(slots, escala.ptr3?.nomeGuerra, 'PTR 3', true);

  const seen = new Map<string, string>();
  for (const slot of slots) {
    if (slot.isentoDuplicado) continue;
    const anterior = seen.get(slot.nome);
    if (anterior) {
      errors.push(`A mesma pessoa nao pode ocupar ${anterior} e ${slot.label} na mesma escala diaria.`);
    } else {
      seen.set(slot.nome, slot.label);
    }
  }

  for (let i = 0; i < (escala.radio || []).length; i++) {
    const atual = escala.radio[i];
    if (!normalizarNome(atual.nomeGuerra)) continue;
    for (let j = i + 1; j < escala.radio.length; j++) {
      const proximo = escala.radio[j];
      if (
        normalizarNome(atual.nomeGuerra) === normalizarNome(proximo.nomeGuerra) &&
        horariosSobrepostos(atual, proximo)
      ) {
        errors.push(`${atual.nomeGuerra} possui horarios sobrepostos no radio.`);
      }
    }
  }

  return errors;
}

export function validarSubstituicaoTemporaria(params: {
  substituicao: Omit<SubstituicaoTemporaria, 'id' | 'createdAt' | 'updatedAt'> | SubstituicaoTemporaria;
  substituicoesExistentes?: SubstituicaoTemporaria[];
  funcionario?: BombeiroOperacional;
  substituto?: BombeiroOperacional;
  bombeiros?: BombeiroOperacional[];
  ignoreSubstituicaoId?: string;
}): string[] {
  const { substituicao, substituicoesExistentes, funcionario, substituto, bombeiros, ignoreSubstituicaoId } = params;
  const errors = validarPeriodoBasico(substituicao.dataInicio, substituicao.dataFim, substituicao.dias, 'Substituicao temporaria');

  if (!substituicao.funcionarioId) errors.push('Informe o funcionario substituido.');
  if (!substituicao.substitutoId) errors.push('Informe o substituto.');
  if (substituicao.funcionarioId && substituicao.funcionarioId === substituicao.substitutoId) {
    errors.push('O substituto nao pode ser o proprio funcionario.');
  }
  if (substituicao.motivo === 'Outro' && !substituicao.motivoOutro?.trim()) {
    errors.push('Descreva o motivo quando selecionar Outro.');
  }
  if (substituicao.tipo === 'Extra' && !substituicao.plantaoExtra) {
    errors.push('Informe se havera plantao extra.');
  }

  if (substituicao.tipo === 'Afastamento') {
    if (!funcionario) {
      errors.push('Funcionario afastado nao encontrado no cadastro ativo.');
    } else if (funcionario.dataDesligamento) {
      errors.push(`${nomePessoa(funcionario)} esta desligado e nao pode ser afastado.`);
    }

    if (!substituto) {
      errors.push('Substituto do afastamento nao encontrado no cadastro ativo.');
    } else if (substituto.dataDesligamento) {
      errors.push(`${nomePessoa(substituto)} esta desligado e nao pode substituir.`);
    }

    if (funcionario && substituto) {
      const cadeiaValidacao: EloCadeiaValidacao[] = (substituicao.cadeiaSubstituicao || []).map(elo => ({
        pessoaId: elo.pessoaId,
        pessoaNome: elo.pessoaNome,
        pessoaCargo: (elo.pessoaCargo || elo.cargoOriginal || '') as Cargo | '',
        pessoaEquipe: (elo.pessoaEquipe || '') as Equipe | '',
        cargoOriginal: (elo.cargoOriginal || elo.pessoaCargo || '') as Cargo | '',
        cargoVacante: elo.cargoVacante,
        substituindoNome: elo.substituindoNome,
      }));

      errors.push(...validarSubstitutoPermitido(funcionario.cargo, substituto));
      errors.push(...validarCadeiaObrigatoria({
        funcionario,
        substituto,
        cadeia: cadeiaValidacao,
        bombeiros,
      }));

      const cadeia = cadeiaValidacao;
      for (let i = 0; i < cadeia.length; i++) {
        const elo = cadeia[i];
        if (!elo.pessoaId) continue;
        const pessoa = pessoaPorId(bombeiros, elo.pessoaId);
        if (!pessoa) {
          errors.push(`Pessoa da cadeia nao encontrada: ${elo.pessoaNome || elo.pessoaId}.`);
          continue;
        }
        const cargoVacante = (i === 0 ? substituto.cargo : (cadeia[i - 1].pessoaCargo || pessoaPorId(bombeiros, cadeia[i - 1].pessoaId)?.cargo)) as Cargo | undefined;
        if (cargoVacante) {
          errors.push(...validarSubstitutoPermitido(cargoVacante, pessoa));
        }
      }
    }
  }

  const idsSubstituicao = (s: SubstituicaoTemporaria | Omit<SubstituicaoTemporaria, 'id' | 'createdAt' | 'updatedAt'>): Set<string> => {
    const ids = new Set<string>();
    if (s.funcionarioId) ids.add(s.funcionarioId);
    if (s.substitutoId) ids.add(s.substitutoId);
    for (const elo of s.cadeiaSubstituicao || []) {
      if (elo.pessoaId) ids.add(elo.pessoaId);
    }
    return ids;
  };

  const idsAtuais = idsSubstituicao(substituicao);
  const conflito = substituicoesExistentes?.find(s =>
    s.id !== ignoreSubstituicaoId &&
    (s.status === 'Pendente' || s.status === 'Aprovada') &&
    intervalosSobrepostos(substituicao.dataInicio, substituicao.dataFim, s.dataInicio, s.dataFim) &&
    [...idsSubstituicao(s)].some(id => idsAtuais.has(id))
  );
  if (conflito) {
    errors.push(`Existe substituicao pendente/aprovada conflitante no periodo ${conflito.dataInicio} a ${conflito.dataFim}.`);
  }

  return errors;
}
