import type { EscalaMensalConfig, EscalaMensalCompleta, FaxinaMensalItem, PessoaEscala, PessoaReferenciaMensal, PlantaoGerado, ResponsabilidadeMensalItem, VeiculosPlantao, RadioSlot } from '../types/escalaMensal';
import { LOCAIS_FAXINA, RESPONSABILIDADES_MENSAIS, getRadioSplitIndex, getSlotsRadio } from '../types/escalaMensal';
import { equipesNoDia } from '../utils/equipes';

function buildVeiculos(pessoas: PessoaEscala[]): VeiculosPlantao {
  const g = (v: string, f: string) => pessoas.find(p => p.veiculo === v && p.funcaoNoVeiculo === f)?.nomeGuerra || '-';
  return {
    crs: { baMc: g('crs','BaMc'), baLr: g('crs','BaLr'), ba2_1: g('crs','Ba2-1'), ba2_2: g('crs','Ba2-2') },
    cciF2: { baMc: g('cciF2','BaMc'), baCe: g('cciF2','BaCe'), ba2: g('cciF2','Ba2') },
    cciF3: { baMc: g('cciF3','BaMc'), ba2_1: g('cciF3','Ba2-1'), ba2_2: g('cciF3','Ba2-2') },
  };
}

function diasPlantao(mes: number, ano: number, equipe: string, paridade: 'par' | 'impar'): number[] {
  const dias: number[] = [];
  const total = new Date(ano, mes, 0).getDate();
  if (equipe) {
    for (let d = 1; d <= total; d++) {
      const equipes = equipesNoDia(new Date(ano, mes - 1, d, 12));
      if (equipes.some(eq => eq === equipe)) dias.push(d);
    }
    return dias;
  }

  const inicio = paridade === 'impar' ? 1 : 2;
  for (let d = inicio; d <= total; d += 2) dias.push(d);
  return dias;
}

function fmtDate(dia: number, mes: number, ano: number) {
  return `${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
}

function rotateArray<T>(arr: T[], shift: number): T[] {
  if (arr.length === 0) return [];
  const s = shift % arr.length;
  return [...arr.slice(s), ...arr.slice(0, s)];
}

type RadioPessoa = { id?: string; nome: string; nomeGuerra: string; isRadioFixo?: boolean };

function radioPessoaKey(p: RadioPessoa): string {
  return p.id || p.nomeGuerra;
}

function pessoaParaRadio(p: PessoaEscala): RadioPessoa {
  return { id: p.id, nome: p.nome, nomeGuerra: p.nomeGuerra, isRadioFixo: p.isRadioFixo };
}

function refParaRadio(ref?: PessoaReferenciaMensal): RadioPessoa | null {
  if (!ref?.pessoaNomeGuerra) return null;
  return { id: ref.id, nome: ref.pessoaNome || ref.pessoaNomeGuerra, nomeGuerra: ref.pessoaNomeGuerra };
}

function slotRadio(slot: { horario: string; horarioFim: string; fixo: boolean }, pessoa: RadioPessoa | null, fixo: boolean): RadioSlot {
  return {
    horario: slot.horario,
    horarioFim: slot.horarioFim,
    pessoaNome: pessoa?.nome || '',
    pessoaNomeGuerra: pessoa?.nomeGuerra || '-',
    fixo,
  };
}

function completarGrupo(selecionados: RadioPessoa[], quantidade: number, pool: RadioPessoa[], fallback: RadioPessoa | null): RadioPessoa[] {
  const result: RadioPessoa[] = [];
  const usados = new Set<string>();
  const add = (p: RadioPessoa | null) => {
    if (!p) return;
    const key = radioPessoaKey(p);
    if (usados.has(key)) return;
    usados.add(key);
    result.push(p);
  };

  selecionados.forEach(add);
  pool.forEach(add);
  while (result.length < quantidade && fallback) result.push(fallback);
  return result.slice(0, quantidade);
}

function gerarRadioAutomatico(pessoas: PessoaEscala[], idxPlantao: number, equipe: string): RadioSlot[] {
  const slots = getSlotsRadio(equipe);
  const pool = pessoas.filter(p => p.funcao !== 'chefe' && p.funcao !== 'lider');
  const bookendIdx = pool.findIndex(p => p.isRadioFixo);
  const bookend = pool[bookendIdx] || pool[0] || pessoas[0];
  if (!bookend) return slots.map(slot => slotRadio(slot, null, slot.fixo));
  const poolSemBookend = pool.filter((_, i) => i !== bookendIdx);
  const rotSem = rotateArray(poolSemBookend, idxPlantao - 1);
  const bookendNaNoite = idxPlantao % 2 === 1;
  const posNoite = Math.floor((idxPlantao + 3) / 2) % 4;
  const posMadrugada = Math.floor(idxPlantao / 2) % 4;
  const pos = bookendNaNoite ? posNoite : posMadrugada;
  const metade = Math.floor((slots.length - 2) / 2);
  let grupo20: PessoaEscala[], grupo06: PessoaEscala[];
  if (bookendNaNoite) {
    grupo20 = rotSem.slice(0, metade - 1); grupo20.splice(pos, 0, bookend);
    grupo06 = rotSem.slice(metade - 1, slots.length - 2);
  } else {
    grupo20 = rotSem.slice(0, metade);
    grupo06 = rotSem.slice(metade, slots.length - 2); grupo06.splice(pos, 0, bookend);
  }
  const result: RadioSlot[] = [];
  let i20 = 0, i06 = 0;
  const primeiroFixo = slots[0].horario;
  const ultimoFixo = slots[slots.length - 1].horario;
  for (const slot of slots) {
    if (slot.horario === primeiroFixo || slot.horario === ultimoFixo) {
      result.push({ horario: slot.horario, horarioFim: slot.horarioFim, pessoaNome: bookend.nome, pessoaNomeGuerra: bookend.nomeGuerra, fixo: true });
    } else {
      const is20 = i20 < metade;
      const p = is20 ? grupo20[i20++] : grupo06[i06++];
      result.push({ horario: slot.horario, horarioFim: slot.horarioFim, pessoaNome: p?.nome || '', pessoaNomeGuerra: p?.nomeGuerra || '-', fixo: false });
    }
  }
  return result;
}

export function gerarRadioPlantao(pessoas: PessoaEscala[], idxPlantao: number, equipe: string, radioManual?: EscalaMensalConfig['radioManual']): RadioSlot[] {
  const temManual = !!radioManual?.comunicante ||
    !!radioManual?.antesMeiaNoite?.length ||
    !!radioManual?.depoisMeiaNoite?.length;
  if (!temManual) return gerarRadioAutomatico(pessoas, idxPlantao, equipe);

  const slots = getSlotsRadio(equipe);
  const poolOperacional = pessoas.filter(p => p.funcao !== 'chefe' && p.funcao !== 'lider').map(pessoaParaRadio);
  const pool = poolOperacional.length > 0 ? poolOperacional : pessoas.map(pessoaParaRadio);
  const comunicante = refParaRadio(radioManual?.comunicante) ||
    pool.find(p => p.isRadioFixo) ||
    pool[0] ||
    null;

  const dinamicos = slots.filter(slot => !slot.fixo);
  const split = getRadioSplitIndex(slots);
  const antesCount = split;
  const depoisCount = dinamicos.length - split;
  const antesSelecionados = (radioManual?.antesMeiaNoite || []).map(refParaRadio).filter((p): p is RadioPessoa => !!p);
  const depoisSelecionados = (radioManual?.depoisMeiaNoite || []).map(refParaRadio).filter((p): p is RadioPessoa => !!p);
  const comunicanteKey = comunicante ? radioPessoaKey(comunicante) : '';
  const depoisSelecionadosKeys = new Set(depoisSelecionados.map(radioPessoaKey));
  const poolSemComunicante = pool.filter(p => radioPessoaKey(p) !== comunicanteKey);
  const poolAntes = poolSemComunicante.filter(p => !depoisSelecionadosKeys.has(radioPessoaKey(p)));
  const antesBase = completarGrupo(antesSelecionados, antesCount, poolAntes, comunicante);
  const antesKeys = new Set(antesBase.map(radioPessoaKey));
  const poolDepois = poolSemComunicante.filter(p => !antesKeys.has(radioPessoaKey(p)));
  const depoisBase = completarGrupo(depoisSelecionados, depoisCount, poolDepois, comunicante);
  const trocaBloco = (idxPlantao - 1) % 2 === 1;
  const deslocamento = Math.floor((idxPlantao - 1) / 2);
  const antesHoje = rotateArray(trocaBloco ? depoisBase : antesBase, -deslocamento);
  const depoisHoje = rotateArray(trocaBloco ? antesBase : depoisBase, -deslocamento);

  let idxAntes = 0;
  let idxDepois = 0;
  let idxDinamico = 0;
  return slots.map(slot => {
    if (slot.fixo) return slotRadio(slot, comunicante, true);
    const pessoa = idxDinamico < antesCount ? antesHoje[idxAntes++] : depoisHoje[idxDepois++];
    idxDinamico++;
    return slotRadio(slot, pessoa || comunicante, false);
  });
}

function gerarFaxinaMensal(pessoas: PessoaEscala[], mes: number, faxinaManual?: FaxinaMensalItem[]) {
  const faxineiros = pessoas.filter(p => p.funcao !== 'chefe' && p.funcao !== 'lider');
  if (faxineiros.length === 0) return [];
  const locais = LOCAIS_FAXINA.filter(l => l !== 'Sala e WC Liderança' && l !== 'Lixo');
  const offset = (mes - 1) % faxineiros.length;
  const rotacionados = rotateArray(faxineiros, offset);
  const result: FaxinaMensalItem[] = [];
  for (let i = 0; i < locais.length; i++) {
    const p = rotacionados[i % rotacionados.length];
    result.push({ local: locais[i], pessoaNome: p.nome, pessoaNomeGuerra: p.nomeGuerra });
  }
  const chefe = pessoas.find(p => p.funcao === 'chefe');
  const lider = pessoas.find(p => p.funcao === 'lider');
  if (chefe) result.push({ local: 'Sala e WC Liderança', pessoaNome: chefe.nome, pessoaNomeGuerra: chefe.nomeGuerra });
  if (lider) result.push({ local: 'Lixo', pessoaNome: lider.nome, pessoaNomeGuerra: lider.nomeGuerra });
  if (faxinaManual?.length) {
    const manualPorLocal = new Map(faxinaManual.map(item => [item.local, item]));
    return result.map(item => manualPorLocal.get(item.local) || item);
  }
  return result;
}

function gerarResponsabilidades(pessoas: PessoaEscala[], faxina: { local: string; pessoaNome: string; pessoaNomeGuerra: string }[], responsabilidadesManual?: ResponsabilidadeMensalItem[]): ResponsabilidadeMensalItem[] {
  const corredor = faxina.find(f => f.local === 'Corredores / Academia');
  const cozinha = faxina.find(f => f.local === 'Cozinha / Refeitório');
  const lixo = faxina.find(f => f.local === 'Lixo');
  const lider = pessoas.find(p => p.funcao === 'lider');
  const responsavelAlmoxarifado = lixo || (lider ? { pessoaNome: lider.nome, pessoaNomeGuerra: lider.nomeGuerra } : undefined);
  const limpezaCci = 'Cada motorista faz o seu carro';
  const automaticas: ResponsabilidadeMensalItem[] = [
    { descricao: RESPONSABILIDADES_MENSAIS[0], pessoaNome: corredor?.pessoaNome || '', pessoaNomeGuerra: corredor?.pessoaNomeGuerra || '-' },
    { descricao: RESPONSABILIDADES_MENSAIS[1], pessoaNome: cozinha?.pessoaNome || '', pessoaNomeGuerra: cozinha?.pessoaNomeGuerra || '-' },
    { descricao: RESPONSABILIDADES_MENSAIS[2], pessoaNome: responsavelAlmoxarifado?.pessoaNome || '', pessoaNomeGuerra: responsavelAlmoxarifado?.pessoaNomeGuerra || '-' },
    { descricao: RESPONSABILIDADES_MENSAIS[3], pessoaNome: responsavelAlmoxarifado?.pessoaNome || '', pessoaNomeGuerra: responsavelAlmoxarifado?.pessoaNomeGuerra || '-' },
    { descricao: RESPONSABILIDADES_MENSAIS[4], pessoaNome: limpezaCci, pessoaNomeGuerra: limpezaCci },
  ];
  if (!responsabilidadesManual?.length) return automaticas;
  const manualPorDescricao = new Map(responsabilidadesManual.map(item => [item.descricao, item]));
  const manualAlmoxarifado = manualPorDescricao.get(RESPONSABILIDADES_MENSAIS[2]) || manualPorDescricao.get(RESPONSABILIDADES_MENSAIS[3]);
  return automaticas.map(item => {
    if (item.descricao === RESPONSABILIDADES_MENSAIS[4]) return item;
    if ((item.descricao === RESPONSABILIDADES_MENSAIS[2] || item.descricao === RESPONSABILIDADES_MENSAIS[3]) && manualAlmoxarifado) {
      return { ...manualAlmoxarifado, descricao: item.descricao };
    }
    const manual = manualPorDescricao.get(item.descricao);
    return manual ? { ...manual, descricao: item.descricao } : item;
  });
}

export function gerarEscalaMensal(config: EscalaMensalConfig): EscalaMensalCompleta {
  const { mes, ano, paridade, pessoas, equipe } = config;
  const dias = diasPlantao(mes, ano, equipe, paridade);
  const faxinaMensal = gerarFaxinaMensal(pessoas, mes, config.faxinaManual);
  const responsabilidades = gerarResponsabilidades(pessoas, faxinaMensal, config.responsabilidadesManual);
  const paradas: PlantaoGerado[] = dias.map((dia, idx) => ({
    dia,
    data: fmtDate(dia, mes, ano),
    veiculos: buildVeiculos(pessoas),
    radio: gerarRadioPlantao(pessoas, idx + 1, equipe, config.radioManual),
  }));
  return { config, paradas, faxinaMensal, responsabilidades };
}
