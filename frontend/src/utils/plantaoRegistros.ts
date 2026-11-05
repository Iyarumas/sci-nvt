import type { Conferencia } from '../types/conferencia';
import type { HorarioRadio, MovimentacaoPlantao } from '../types/fimPlantao';
import type { Ocorrencia } from '../types/ocorrencia';
import { dataSaidaPlantao, horarioPlantaoPorEquipe } from './equipes';

function dataISO(valor: string | undefined): string {
  const m = String(valor || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function horaCurta(valor: string | undefined): string {
  const m = String(valor || '').match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : '';
}

/** Mesma regra do Gerar LRO: a data do turno vale se informada; senão, data e hora dentro do plantão. */
export function registroNoPlantao(params: {
  data: string;
  hora: string;
  equipeRegistro: string;
  equipe: string;
  dataPlantao: string;
  dataTurno?: string;
}): boolean {
  const { equipe, dataPlantao } = params;
  if (!equipe || !dataPlantao || params.equipeRegistro !== equipe) return false;
  const turno = dataISO(params.dataTurno);
  if (turno) return turno === dataPlantao;
  const data = dataISO(params.data);
  const hora = horaCurta(params.hora);
  if (!data) return false;
  const horario = horarioPlantaoPorEquipe(equipe);
  if (horario.turno === 'Noturno') {
    if (data === dataPlantao && (!hora || hora >= horario.horarioInicio)) return true;
    return data === dataSaidaPlantao(equipe, dataPlantao) && (!hora || hora < horario.horarioTermino);
  }
  if (data !== dataPlantao) return false;
  return !hora || (hora >= horario.horarioInicio && hora < horario.horarioTermino);
}

/** Minutos desde o início do plantão: quem é da noite vê 19:00…23:59 antes de 00:00…06:59. */
export function ordemNoPlantao(hora: string, equipe: string): number {
  const m = horaCurta(hora).match(/^(\d{2}):(\d{2})$/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const [hi, mi] = horarioPlantaoPorEquipe(equipe).horarioInicio.split(':').map(Number);
  const minutos = Number(m[1]) * 60 + Number(m[2]);
  return (minutos - (hi * 60 + mi) + 1440) % 1440;
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Ocorrência que o comunicante usa para lançar a escala de rádio do plantão. */
export function ehEscalaDeRadio(ocorrencia: Pick<Ocorrencia, 'titulo' | 'categoria'>): boolean {
  const titulo = normalizar(`${ocorrencia.titulo || ''}`);
  return titulo.includes('escala') && titulo.includes('radio');
}

/** "19", "19h", "19:00", "19h30", "1900", "19.00" → "19:00". */
function lerHora(texto: string): string | null {
  const t = texto.trim().toLowerCase();
  let m = t.match(/^(\d{1,2})\s*(?:[:h.]\s*(\d{2})?)?$/);
  if (!m) m = t.match(/^(\d{2})(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 24 || min > 59) return null;
  return `${String(h % 24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * Lê a escala de rádio escrita à mão, uma linha por horário, em qualquer um destes jeitos:
 * "19:00/20:00 : Montanaro", "19h/20h Montanaro", "19h às 20h - Montanaro", "1900-2000 Montanaro".
 */
export function interpretarEscalaRadio(texto: string): HorarioRadio[] {
  const hora = String.raw`\d{1,2}(?:\s*[:h.]\s*\d{2}|\s*h|\d{2})?`;
  const linha = new RegExp(String.raw`^\s*(${hora})\s*(?:\/|-|–|às|as|a|até|ate)\s*(${hora})\s*[:\-–]?\s*(.*)$`, 'i');
  return texto
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .flatMap(l => {
      const m = l.match(linha);
      if (!m) return [];
      const inicio = lerHora(m[1]);
      const fim = lerHora(m[2]);
      if (!inicio || !fim) return [];
      return [{ inicio, fim, nome: m[3].trim() }];
    });
}

export interface MovimentacaoAutomatica extends MovimentacaoPlantao {
  origem: 'Ocorrência' | 'Inspeção' | 'Solicitação';
}

/** Ocorrências do LRO, inspeções e solicitações do plantão, viram linhas de movimentação. */
export function movimentacoesDoPlantao(params: {
  ocorrencias: Ocorrencia[];
  conferencias: Conferencia[];
  equipe: string;
  dataPlantao: string;
}): MovimentacaoAutomatica[] {
  const { equipe, dataPlantao } = params;
  const doPlantao = params.ocorrencias
    .filter(o => !ehEscalaDeRadio(o))
    .filter(o => registroNoPlantao({ data: o.data, hora: o.hora, equipeRegistro: o.equipe, equipe, dataPlantao, dataTurno: o.local }))
    .map(o => ({
      origem: 'Ocorrência' as const,
      hora: horaCurta(o.hora),
      descricao: [o.titulo?.trim(), o.descricao?.trim()].filter(Boolean).join(' - '),
    }));
  const conferencias = params.conferencias
    .filter(c => /^(inspe|solicita)/i.test(String(c.tipo || '')))
    .filter(c => registroNoPlantao({
      data: c.dataConferencia,
      hora: horaCurta(c.dataConferencia),
      equipeRegistro: c.equipe,
      equipe,
      dataPlantao,
      dataTurno: c.dataProximaInspecao,
    }))
    .map(c => {
      const solicitacao = /^solicita/i.test(String(c.tipo || ''));
      const titulo = c.itemNome?.trim() || (solicitacao ? 'Solicitação' : 'Inspeção operacional');
      return {
        origem: solicitacao ? 'Solicitação' as const : 'Inspeção' as const,
        hora: horaCurta(c.dataConferencia),
        descricao: [titulo, c.observacoes?.trim()].filter(Boolean).join(' - '),
      };
    });
  return [...doPlantao, ...conferencias].filter(m => m.descricao);
}

/** Escala de rádio lançada nas ocorrências do plantão (a última, se houver mais de uma). */
export function escalaRadioDasOcorrencias(params: {
  ocorrencias: Ocorrencia[];
  equipe: string;
  dataPlantao: string;
}): HorarioRadio[] {
  const lancadas = params.ocorrencias
    .filter(ehEscalaDeRadio)
    .filter(o => registroNoPlantao({ data: o.data, hora: o.hora, equipeRegistro: o.equipe, equipe: params.equipe, dataPlantao: params.dataPlantao, dataTurno: o.local }))
    .sort((a, b) => (a.updatedAt || a.createdAt || '').localeCompare(b.updatedAt || b.createdAt || ''));
  const ultima = lancadas.at(-1);
  return ultima ? interpretarEscalaRadio(ultima.descricao || '') : [];
}

/**
 * Data do plantão em andamento. Para quem trabalha à noite (19:00 às 07:00), de madrugada
 * o plantão ainda é o do dia anterior.
 */
export function dataDoPlantaoAtual(equipe: string, agora: Date = new Date()): string {
  const horario = horarioPlantaoPorEquipe(equipe);
  const hora = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
  const dia = new Date(agora);
  if (horario.turno === 'Noturno' && hora < horario.horarioTermino) dia.setDate(dia.getDate() - 1);
  return `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
}
