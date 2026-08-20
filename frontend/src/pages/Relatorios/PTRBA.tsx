import { useState, useEffect, useMemo } from 'react';
import {
  FileText, ChevronDown, ChevronUp, Eye, Printer, ArrowLeft, Users, Lock, User, SlidersHorizontal,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { listarPTRBs } from '../../services/ptrbService';
import { listarBombeiros } from '../../services/bombeiroService';
import { listarAPOCs } from '../../services/apocService';
import { listarPTRBACompletos } from '../../services/ptrbaCompletoService';
import type { PTRB } from '../../types/ptrb';
import { EQUIPES, ASSUNTOS } from '../../types/ptrb';
import { PTRBA_COMPLETO_EVIDENCIA_PARES } from '../../types/ptrbaCompleto';
import type { PTRBACompleto } from '../../types/ptrbaCompleto';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { formatarDataBR, formatarDataHoraBR } from '../../utils/datas';

function formatDate(d: string) {
  return formatarDataBR(d);
}

const fmt = formatDate;

function calcHoras(inicio: string, termino: string): number {
  if (!inicio || !termino) return 0;
  const numsI = inicio.trim().match(/\d+/g);
  const numsT = termino.trim().match(/\d+/g);
  if (!numsI || !numsT) return 0;
  const h1 = Number(numsI[0]), m1 = Number(numsI[1] ?? 0);
  const h2 = Number(numsT[0]), m2 = Number(numsT[1] ?? 0);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
  let diff = h2 * 60 + m2 - (h1 * 60 + m1);
  if (diff <= 0) diff += 24 * 60;
  return diff / 60;
}

function parseDuracao(d: string): number {
  if (!d) return 0;
  const nums = d.trim().match(/\d+/g);
  if (!nums) return 0;
  const h = Number(nums[0]), m = Number(nums[1] ?? 0);
  if (isNaN(h) || isNaN(m)) return 0;
  return h + m / 60;
}

function horasDe(p: PTRB): number {
  return p.horas || calcHoras(p.horaInicio, p.horaTermino) || parseDuracao(p.duracao);
}

function duracaoDe(p: PTRB): string {
  return horasStr(horasDe(p));
}

function horasStr(h: number): string {
  const minTotal = Math.round(h * 60);
  const horas = Math.floor(minTotal / 60);
  const min = minTotal % 60;
  if (min === 0) return `${horas}h`;
  return `${horas}h${min.toString().padStart(2, '0')}min`;
}

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const inputClass = 'rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated';

const HIERARQUIA = ['BA-CE', 'BA-LR', 'BA-MC', 'BA-RE', 'BA-2', 'GS', 'OC', 'APOC', ''];
const EQUIPE_ORDER = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Ferista'];

// APOCs só participam/contam horas nestes assuntos
const ASSUNTOS_APOC = ['01', '02', '06', '12', '13', '14', '17'];

function apocParticipaDoAssunto(assunto: string): boolean {
  const t = (assunto || '').trim();
  if (!t) return false;
  return ASSUNTOS_APOC.some(num => t === num || t.startsWith(num + '.'));
}

function normalizarNome(nome: string): string {
  return (nome || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface PessoaInfo {
  nomeGuerra: string;
  cargo: string;
  equipe: string;
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-center gap-3 border-b border-graphite-200/80 pb-3 dark:border-border-dark">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aviation-600 to-aviation-700 text-white shadow-sm">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-graphite-900 dark:text-graphite-100">{title}</h2>
        {subtitle && <p className="text-xs text-graphite-500 dark:text-graphite-400">{subtitle}</p>}
      </div>
    </div>
  );
}

function EquipeBand({ equipe, extras, onClick }: { equipe: string; extras?: React.ReactNode; onClick?: () => void }) {
  const clickable = !!onClick;
  return (
    <button type="button" onClick={onClick}
      className={`mb-3 flex w-full flex-wrap items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-white shadow-sm ${clickable ? 'cursor-pointer transition-opacity hover:opacity-90' : 'cursor-default'}`}>
      <p className="flex items-center gap-2 text-sm font-bold">
        <Users className="h-4 w-4" /> Equipe {equipe}
        {clickable && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase">ver horas de todos</span>}
      </p>
      <p className="text-xs font-medium text-white/85">{extras}</p>
    </button>
  );
}

function PrintButton({ onClick, children, primary, icon: Icon = Printer }: { onClick: () => void; children: React.ReactNode; primary?: boolean; icon?: React.ElementType }) {
  const cls = primary
    ? 'flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-3 py-2 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 active:scale-[0.98]'
    : 'flex items-center gap-1.5 rounded-xl border border-graphite-300/60 bg-white/80 px-3 py-2 text-sm font-medium text-graphite-700 transition-all duration-200 hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200';
  return <button onClick={onClick} className={cls}><Icon className="h-4 w-4" /> {children}</button>;
}

type ViewLevel = 'summary' | 'person' | 'detail' | 'view-ptrb';

interface ExpandedPTRB {
  ptrb: PTRB;
  nome: string;
  funcao: string;
  horas: number;
}

function expandParticipants(ptrbs: PTRB[]): ExpandedPTRB[] {
  const result: ExpandedPTRB[] = [];
  for (const p of ptrbs) {
    const h = p.horas || calcHoras(p.horaInicio, p.horaTermino) || parseDuracao(p.duracao);
    if (p.participantes.length === 0) {
      result.push({ ptrb: p, nome: '(sem participantes)', funcao: '', horas: h });
    } else {
      for (const part of p.participantes) {
        // APOCs só contam horas em assuntos dos quais participam
        const isApoc = (part.funcao || '').toUpperCase() === 'APOC';
        if (isApoc && !apocParticipaDoAssunto(p.assuntoMinistrado)) continue;
        result.push({ ptrb: p, nome: part.nomeCompleto || '(sem nome)', funcao: part.funcao || '', horas: h });
      }
    }
  }
  return result;
}

// Converte um registro PTR-BA Completo em registros de instrução (uma por assunto/par de evidências)
function converterCompletoParaPTRBs(c: PTRBACompleto): PTRB[] {
  const participantes = (c.participantes || []).filter(p => p.nomeCompleto && p.nomeCompleto.trim());
  if (participantes.length === 0) return [];
  const base = {
    createdBy: c.createdBy,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    data: c.data,
    equipe: c.equipe,
    turno: '',
    participantes,
    observacoes: c.observacoes || '',
    instrutor: c.chefeEquipe || '',
    descricao: '',
    informacoesComplementares: '',
    fotos: [],
  };
  const evidencias = c.evidencias || [];
  const resultado: PTRB[] = [];
  // Cada assunto tem 2 evidências (pares [0,1], [2,3], [4,5]) → uma instrução por par
  for (const [i, j] of PTRBA_COMPLETO_EVIDENCIA_PARES) {
    const a = evidencias[i];
    const b = evidencias[j];
    const ev = a?.assunto ? a : b;
    if (!ev || !ev.assunto || !ev.assunto.trim()) continue;
    resultado.push({
      ...base,
      id: `completo-${c.id}-${i}`,
      horaInicio: ev.horaInicio || '',
      horaTermino: ev.horaTermino || '',
      duracao: '',
      horas: calcHoras(ev.horaInicio || '', ev.horaTermino || ''),
      assuntoMinistrado: ev.assunto,
      descricao: ev.descricao || '',
    });
  }
  if (resultado.length === 0) {
    return [{ ...base, id: `completo-${c.id}`, horaInicio: '', horaTermino: '', duracao: '', horas: 0, assuntoMinistrado: 'PTR-BA Completo' }];
  }
  return resultado;
}

type SortKey = 'label' | 'assunto' | 'horas' | 'qtd';

function gerarHTMLImpressao(titulo: string, colunas: string[], linhas: string[][]): string {
  const colLabels = colunas.map(abreviarLabel);
  const colsHtml = colLabels.map((c, i) => `<th${i === 0 ? ' style="width:16%;text-align:left;"' : ''} title="${c}">${c}</th>`).join('');
  const rowsHtml = linhas.map(row => `<tr>${row.map(c => `<td>${c}</td>`).join('')}</tr>`).join('\n');
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>${titulo}</title>
    <style>
      @page { margin: 8mm; size: landscape; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 8px; }
      h1 { font-size: 14px; margin-bottom: 4px; }
      p.filtros { font-size: 10px; color: #555; margin-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: auto; }
      th, td { border: 1px solid #000; padding: 2px 4px; font-size: 11px; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      th { background: #4472C4; color: #fff; font-weight: bold; text-align: center; }
      .footer { margin-top: 8px; font-size: 9px; color: #888; }
      .legenda { margin-top: 10px; }
      .legenda td { border: none; padding: 1px 3px; font-size: 9px; }
      .legenda td:first-child { width: 22px; }
    </style>
    </head>
    <body>
      <h1>${titulo}</h1>
      <p class="filtros">Gerado em ${formatarDataHoraBR(new Date())}</p>
      <table><thead><tr>${colsHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>
      <div class="legenda">
        <p><strong>Legenda — Assuntos Ministrados:</strong></p>
        <table style="table-layout:auto;">${ASSUNTOS.map((a, i) => { const txt = a.replace(/^\d+\.\s*/, ''); return '<tr><td>' + (i + 1) + '.</td><td>' + txt + '</td></tr>'; }).join('\n')}</table>
      </div>
      <p class="footer">Relatório PTR-BA - Seção de Instrução</p>
    </body>
    </html>
  `;
}

function imprimirHTML(titulo: string, colunas: string[], linhas: string[][]) {
  const html = gerarHTMLImpressao(titulo, colunas, linhas);
  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}

function abreviarLabel(a: string): string {
  const num = a.match(/^(\d+)\.\s*/);
  if (num) return num[1];
  return a.length > 10 ? a.substring(0, 10) + '\u2026' : a;
}

function imprimirHTMLEfetivo(titulo: string, allAssuntos: string[], equipes: { equipe: string; pessoas: { num: number; funcao: string; nome: string; valores: string[]; totalHoras: string; registros: number }[] }[]) {
  const colLabels = allAssuntos.map(abreviarLabel);
  const colsHtml = '<th style="width:3%">N\u00ba</th><th style="width:7%">Fun\u00e7\u00e3o</th><th style="width:14%">Nome</th>' + colLabels.map(c => '<th title="' + c + '">' + c + '</th>').join('') + '<th style="width:6%">Total</th><th style="width:3%">Reg.</th>';

  function renderEquipeTable(eq: typeof equipes[0]) {
    const pessoasRows = eq.pessoas.map(p =>
      '<tr' + (p.funcao === 'BA-CE' ? ' style="background:#e8f0fe;"' : '') + '>' +
      '<td>' + p.num + '</td>' +
      '<td style="font-weight:' + (p.funcao === 'BA-CE' ? 'bold' : 'normal') + ';">' + p.funcao + '</td>' +
      '<td style="text-align:left;">' + p.nome + '</td>' +
      p.valores.map(v => '<td>' + v + '</td>').join('') +
      '<td style="font-weight:bold;">' + p.totalHoras + '</td>' +
      '<td>' + p.registros + '</td>' +
      '</tr>'
    ).join('\n');
    const headerRow = '<tr class="eq-header"><td colspan="' + (allAssuntos.length + 4) + '">Equipe ' + eq.equipe + '</td></tr>';
    return '<table><thead><tr>' + colsHtml + '</tr></thead><tbody>' + headerRow + '\n' + pessoasRows + '</tbody></table>';
  }

  const chunks: typeof equipes[] = [];
  for (let i = 0; i < equipes.length; i += 3) {
    chunks.push(equipes.slice(i, i + 3));
  }

  let html = '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>' + titulo + '</title>\n<style>\n';
  html += '  @page { margin: 8mm; size: landscape; }\n';
  html += '  body { font-family: Arial, sans-serif; margin: 0; padding: 8px; }\n';
  html += '  h1 { font-size: 14px; margin-bottom: 4px; }\n';
  html += '  p.filtros { font-size: 10px; color: #555; margin-bottom: 6px; }\n';
  html += '  .chunk { page-break-after: always; }\n';
  html += '  table { width: 100%; border-collapse: collapse; table-layout: fixed; page-break-inside: avoid; margin-bottom: 4px; }\n';
  html += '  th, td { border: 1px solid #000; padding: 2px 4px; font-size: 11px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n';
  html += '  th { background: #4472C4; color: #fff; font-weight: bold; }\n';
  html += '  .eq-header td { background: #2b5797; color: #fff; font-weight: bold; font-size: 11px; text-align: left; padding: 3px 6px; }\n';
  html += '  .footer { margin-top: 8px; font-size: 9px; color: #888; }\n';
  html += '  .legenda { margin-top: 10px; }\n';
  html += '  .legenda td { border: none; padding: 1px 3px; font-size: 9px; text-align: left; }\n';
  html += '  .legenda td:first-child { width: 22px; }\n';
  html += '</style></head><body>\n';
  html += '  <h1>' + titulo + '</h1>\n';
  html += '  <p class="filtros">Gerado em ' + formatarDataHoraBR(new Date()) + ' \u00b7 Total de pessoas: ' + equipes.reduce(function(s, e) { return s + e.pessoas.length; }, 0) + '</p>\n';
  for (let i = 0; i < chunks.length; i++) {
    html += '  <div class="chunk">\n';
    for (const eq of chunks[i]) {
      html += '    ' + renderEquipeTable(eq) + '\n';
    }
    html += '  </div>\n';
  }
  html += '  <div class="legenda">\n';
  html += '    <p><strong>Legenda \u2014 Assuntos Ministrados:</strong></p>\n';
  html += '    <table style="table-layout:auto;">' + ASSUNTOS.map((a, i) => { const txt = a.replace(/^\d+\.\s*/, ''); return '<tr><td>' + (i + 1) + '.</td><td>' + txt + '</td></tr>'; }).join('\n') + '</table>\n';
  html += '  </div>\n';
  html += '  <p class="footer">Relat\u00f3rio PTR-BA - Se\u00e7\u00e3o de Instru\u00e7\u00e3o</p>\n';
  html += '</body></html>';
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(function() { printWindow.print(); }, 700);
  }
}

export function PTRBA() {
  const { canVisualizarRelatoriosPtrBa, loadingContexto } = useContextoOperacional();
  const [ptrbs, setPtrbs] = useState<PTRB[]>([]);
  const [bombeiros, setBombeiros] = useState<Map<string, { nomeGuerra: string; cargo: string; equipe: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewLevel>('summary');
  const [filterMode, setFilterMode] = useState<'mes-ano' | 'periodo'>('mes-ano');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [filtroAssunto, setFiltroAssunto] = useState('');
  const [filtroPessoa, setFiltroPessoa] = useState('');
  const [selectedEquipe, setSelectedEquipe] = useState('');
  const [selectedPessoa, setSelectedPessoa] = useState('');
  const [selectedPTRB, setSelectedPTRB] = useState<PTRB | null>(null);
  const [visualizandoPtrb, setVisualizandoPtrb] = useState<PTRB | null>(null);
  const [expandedPTRB, setExpandedPTRB] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('label');
  const [sortAsc, setSortAsc] = useState(true);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printModo, setPrintModo] = useState<'geral' | 'individual' | 'por-equipe' | 'equipe'>('geral');
  const [printLegenda, setPrintLegenda] = useState(true);
  const [printPessoa, setPrintPessoa] = useState('');
  const [printEquipe, setPrintEquipe] = useState('');
  const [secaoAtiva, setSecaoAtiva] = useState<'geral' | 'individual'>('geral');

  const ANOS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  function carregarDados() {
    if (!canVisualizarRelatoriosPtrBa) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([listarPTRBs(), listarPTRBACompletos(), listarBombeiros(), listarAPOCs()]).then(([p, c, b, a]) => {
      const completos = (c || []).flatMap(converterCompletoParaPTRBs);
      setPtrbs([...p, ...completos]);
      const map = new Map<string, PessoaInfo>();
      const indexar = (nome: string, info: PessoaInfo) => {
        const chave = normalizarNome(nome);
        if (chave && !map.has(chave)) map.set(chave, info);
      };
      for (const bom of b) {
        const info = { nomeGuerra: bom.nomeGuerra, cargo: bom.cargo, equipe: bom.equipe };
        indexar(bom.nomeCompleto, info);
        indexar(bom.nomeGuerra, info);
      }
      for (const ap of a || []) {
        const info = { nomeGuerra: ap.nomeGuerra, cargo: ap.funcao || '', equipe: ap.equipe || '' };
        indexar(ap.nomeCompleto, info);
        indexar(ap.nomeGuerra, info);
      }
      setBombeiros(map);
    }).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    if (loadingContexto) return;
    carregarDados();
  }, [canVisualizarRelatoriosPtrBa, loadingContexto]);

  useEffect(() => {
    if (loadingContexto || !canVisualizarRelatoriosPtrBa) return;
    const onFocus = () => carregarDados();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [canVisualizarRelatoriosPtrBa, loadingContexto]);

  function applyPeriodFilter(lista: PTRB[]): PTRB[] {
    if (filterMode === 'mes-ano') {
      if (filtroMes) {
        lista = lista.filter(p => {
          const d = new Date(p.data + 'T12:00:00');
          return (d.getMonth() + 1).toString() === filtroMes;
        });
      }
      if (filtroAno) {
        lista = lista.filter(p => p.data?.startsWith(filtroAno));
      }
    } else {
      if (dataInicio) {
        lista = lista.filter(p => p.data >= dataInicio);
      }
      if (dataFinal) {
        lista = lista.filter(p => p.data <= dataFinal);
      }
    }
    return lista;
  }

  const filtered = useMemo(() => {
    let lista = ptrbs;
    if (filtroEquipe) lista = lista.filter(p => p.equipe?.trim() === filtroEquipe);
    if (filtroAssunto) lista = lista.filter(p => p.assuntoMinistrado?.trim() === filtroAssunto);
  if (filtroPessoa) {
    const nomeBusca = filtroPessoa.trim().toLowerCase();
    lista = lista.filter(p =>
      p.participantes.some(part => part.nomeCompleto.trim().toLowerCase() === nomeBusca)
    );
  }
    lista = applyPeriodFilter(lista);
  if (view === 'detail' && selectedPessoa) {
    const nomeBusca = selectedPessoa.trim().toLowerCase();
    lista = lista.filter(p =>
      p.participantes.some(part => part.nomeCompleto.trim().toLowerCase() === nomeBusca)
    );
  }
    return lista.sort((a, b) => new Date(b.data || '').getTime() - new Date(a.data || '').getTime());
  }, [ptrbs, filtroMes, filtroAno, dataInicio, dataFinal, filterMode, filtroEquipe, filtroAssunto, filtroPessoa, view, selectedPessoa]);

  const expanded = useMemo(() => expandParticipants(filtered), [filtered]);

  const pessoasFiltro = useMemo(() => {
    const nomes = new Set<string>();
    for (const [nome, info] of bombeiros) {
      if (filtroEquipe && info.equipe !== filtroEquipe) continue;
      nomes.add(nome);
    }
    return [...nomes].sort();
  }, [bombeiros, filtroEquipe]);

  const assuntosDisponiveis = useMemo(() => {
    const set = new Set<string>(ASSUNTOS);
    for (const p of ptrbs) {
      const a = p.assuntoMinistrado?.trim();
      if (a) set.add(a);
    }
    return [...set].sort();
  }, [ptrbs]);

  function lookupPessoa(nome: string): PessoaInfo | undefined {
    const chave = normalizarNome(nome);
    if (!chave) return undefined;
    return bombeiros.get(chave);
  }

  function getNomeGuerra(nomeCompleto: string): string {
    return lookupPessoa(nomeCompleto)?.nomeGuerra || nomeCompleto;
  }

  function getEquipe(nomeCompleto: string): string {
    return lookupPessoa(nomeCompleto)?.equipe || '';
  }

  function goToSummary() {
    setView('summary');
    setSelectedEquipe('');
    setSelectedPessoa('');
    setSelectedPTRB(null);
  }

  function goToPerson(equipe: string) {
    setSelectedEquipe(equipe);
    setFiltroEquipe(equipe);
    setView('person');
    setSelectedPessoa('');
    setFiltroPessoa('');
    setSelectedPTRB(null);
  }

  function goToDetail(pessoa: string) {
    setSelectedPessoa(pessoa);
    setView('detail');
    setSelectedPTRB(null);
  }

  function goToViewPTRB(ptrb: PTRB) {
    setSelectedPTRB(ptrb);
    setView('view-ptrb');
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  // Horas das ATIVIDADES (nível PTR-BA): cada atividade conta uma vez por equipe/assunto,
  // independentemente do número de participantes — evita somar horas × pessoas.
  const horasAtividades = useMemo(() => {
    const porEquipeAssunto = new Map<string, Map<string, number>>();
    const totalPorEquipe: Record<string, number> = {};
    const totalPorAssunto: Record<string, number> = {};
    const registrosPorEquipe: Record<string, number> = {};
    let totalGeral = 0;
    for (const p of filtered) {
      const eq = p.equipe || '(sem equipe)';
      const as = (p.assuntoMinistrado || '(sem assunto)').trim();
      const h = horasDe(p);
      if (!porEquipeAssunto.has(eq)) porEquipeAssunto.set(eq, new Map());
      const sub = porEquipeAssunto.get(eq)!;
      sub.set(as, (sub.get(as) || 0) + h);
      totalPorEquipe[eq] = (totalPorEquipe[eq] || 0) + h;
      totalPorAssunto[as] = (totalPorAssunto[as] || 0) + h;
      registrosPorEquipe[eq] = (registrosPorEquipe[eq] || 0) + 1;
      totalGeral += h;
    }
    return { porEquipeAssunto, totalPorEquipe, totalPorAssunto, registrosPorEquipe, totalGeral };
  }, [filtered]);

  const statsFiltered = useMemo(() => {
    const nomes = new Set<string>();
    const equipes = new Set<string>();
    for (const e of expanded) {
      nomes.add(e.nome);
      equipes.add(e.ptrb.equipe || '(sem equipe)');
    }
    const totalBombeiros = filtroEquipe
      ? [...bombeiros.values()].filter(b => b.equipe === filtroEquipe).length
      : bombeiros.size;
    return {
      registros: filtered.length,
      horas: horasAtividades.totalGeral,
      pessoas: nomes.size,
      totalBombeiros,
      equipes: equipes.size,
    };
  }, [expanded, filtered, horasAtividades.totalGeral, bombeiros, filtroEquipe]);

  const equipePessoasMatriz = useMemo(() => {
    const assuntos = filtroAssunto ? [filtroAssunto] : assuntosDisponiveis;
    const eqMap = new Map<string, Map<string, Map<string, { horas: number; qtd: number; funcao: string }>>>();
    for (const e of expanded) {
      // Equipe de CADASTRO da pessoa (troca/substituição não muda a equipe dela)
      const eq = getEquipe(e.nome) || e.ptrb.equipe || '(sem equipe)';
      const as = (e.ptrb.assuntoMinistrado || '(sem assunto)').trim();
      if (!eqMap.has(eq)) eqMap.set(eq, new Map());
      const pesMap = eqMap.get(eq)!;
      if (!pesMap.has(e.nome)) pesMap.set(e.nome, new Map());
      const asMap = pesMap.get(e.nome)!;
      const cur = asMap.get(as) || { horas: 0, qtd: 0, funcao: e.funcao };
      cur.horas += e.horas;
      cur.qtd += 1;
      asMap.set(as, cur);
    }
    const grupos = [...eqMap.entries()].map(([equipe, pesMap]) => {
      const pessoas = [...pesMap.entries()].map(([nome, asMap]) => {
        let totalHoras = 0;
        let totalQtd = 0;
        for (const v of asMap.values()) { totalHoras += v.horas; totalQtd += v.qtd; }
        const funcao = [...asMap.values()].sort((a, b) => b.qtd - a.qtd)[0]?.funcao || '';
        return { nome, nomeGuerra: getNomeGuerra(nome), funcao, valores: asMap, totalHoras, totalQtd };
      });
      pessoas.sort((a, b) => HIERARQUIA.indexOf(a.funcao) - HIERARQUIA.indexOf(b.funcao) || a.nomeGuerra.localeCompare(b.nomeGuerra));
      return { equipe, pessoas };
    });
    grupos.sort((a, b) => EQUIPE_ORDER.indexOf(a.equipe) - EQUIPE_ORDER.indexOf(b.equipe));
    return { assuntos, grupos };
  }, [expanded, assuntosDisponiveis, filtroAssunto, bombeiros]);

  const pessoaAssuntoData = useMemo(() => {
    const map = new Map<string, Map<string, { horas: number; qtd: number; funcao: string; equipe: string }>>();
    const pessoaFuncoes = new Map<string, Map<string, number>>();
    for (const e of expanded) {
      const as = e.ptrb.assuntoMinistrado || '(sem assunto)';
      if (!map.has(e.nome)) map.set(e.nome, new Map());
      const sub = map.get(e.nome)!;
      const homeEquipe = getEquipe(e.nome) || e.ptrb.equipe;
      if (!sub.has(as)) sub.set(as, { horas: 0, qtd: 0, funcao: e.funcao, equipe: homeEquipe });
      const item = sub.get(as)!;
      item.horas += e.horas;
      item.qtd++;
      if (e.funcao) {
        if (!pessoaFuncoes.has(e.nome)) pessoaFuncoes.set(e.nome, new Map());
        const fc = pessoaFuncoes.get(e.nome)!;
        fc.set(e.funcao, (fc.get(e.funcao) || 0) + 1);
      }
    }

    const rows: { pessoa: string; assunto: string; horas: number; qtd: number; funcao: string; equipe: string }[] = [];
    for (const [pessoa, assuntos] of map) {
      const funcaoMaisComum = [...(pessoaFuncoes.get(pessoa)?.entries() || [])]
        .sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      for (const [assunto, data] of assuntos) {
        rows.push({ pessoa, assunto, horas: data.horas, qtd: data.qtd, funcao: funcaoMaisComum || data.funcao, equipe: data.equipe });
      }
    }
    return rows;
  }, [expanded]);

  // Visão Individual: cada pessoa com a lista detalhada das atividades que frequentou
  const individuos = useMemo(() => {
    type Reg = { data: string; assunto: string; horaInicio: string; horaTermino: string; duracao: string; horas: number; instrutor: string };
    const map = new Map<string, { pessoa: string; funcao: string; equipe: string; registros: Reg[] }>();
    for (const e of expanded) {
      const it = map.get(e.nome) || {
        pessoa: e.nome,
        funcao: e.funcao,
        equipe: getEquipe(e.nome) || e.ptrb.equipe || '(sem equipe)',
        registros: [],
      };
      it.registros.push({
        data: e.ptrb.data,
        assunto: e.ptrb.assuntoMinistrado || '(sem assunto)',
        horaInicio: e.ptrb.horaInicio || '',
        horaTermino: e.ptrb.horaTermino || '',
        duracao: e.ptrb.duracao || '',
        horas: e.horas,
        instrutor: e.ptrb.instrutor || '',
      });
      map.set(e.nome, it);
    }
    const list = [...map.values()];
    for (const it of list) {
      it.registros.sort((a, b) => (b.data || '').localeCompare(a.data || '') || (b.horaInicio || '').localeCompare(a.horaInicio || ''));
    }
    list.sort((a, b) => {
      const eqCmp = EQUIPE_ORDER.indexOf(a.equipe) - EQUIPE_ORDER.indexOf(b.equipe);
      if (eqCmp !== 0) return eqCmp;
      const hCmp = HIERARQUIA.indexOf(a.funcao) - HIERARQUIA.indexOf(b.funcao);
      if (hCmp !== 0) return hCmp;
      return a.pessoa.localeCompare(b.pessoa);
    });
    const grupos = new Map<string, typeof list>();
    for (const it of list) {
      if (!grupos.has(it.equipe)) grupos.set(it.equipe, []);
      grupos.get(it.equipe)!.push(it);
    }
    return [...grupos.entries()];
  }, [expanded, bombeiros]);

  const sortedPessoaRows = useMemo(() => {
    const sorted = [...pessoaAssuntoData];
    sorted.sort((a, b) => {
      if (sortKey === 'label') {
        const eqCmp = EQUIPE_ORDER.indexOf(a.equipe) - EQUIPE_ORDER.indexOf(b.equipe);
        if (eqCmp !== 0) return eqCmp;
        const hCmp = HIERARQUIA.indexOf(a.funcao) - HIERARQUIA.indexOf(b.funcao);
        if (hCmp !== 0) return hCmp;
        const nCmp = a.pessoa.localeCompare(b.pessoa);
        if (nCmp !== 0) return nCmp;
        return a.assunto.localeCompare(b.assunto);
      }
      let cmp = 0;
      if (sortKey === 'assunto') cmp = a.assunto.localeCompare(b.assunto);
      else if (sortKey === 'horas') cmp = a.horas - b.horas;
      else if (sortKey === 'qtd') cmp = a.qtd - b.qtd;
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [pessoaAssuntoData, sortKey, sortAsc]);

  const detailPTRBs = useMemo(() => filtered, [filtered]);

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <span className="ml-1 text-graphite-300">↕</span>;
    return <span className="ml-1 text-aviation-600">{sortAsc ? '↑' : '↓'}</span>;
  }

  function SortHeader({ column, children }: { column: SortKey; children: React.ReactNode }) {
    return (
      <th
        className="cursor-pointer px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-graphite-500 hover:text-graphite-700 dark:text-graphite-400 dark:hover:text-graphite-200"
        onClick={() => handleSort(column)}
      >
        {children} <SortIcon column={column} />
      </th>
    );
  }

  function handlePrintPerson() {
    const allAssuntos = filtroAssunto ? [filtroAssunto] : assuntosDisponiveis;
    const pesMap = new Map<string, { funcao: string; equipe: string; valores: Map<string, number> }>();
    const funcaoCount = new Map<string, Map<string, number>>();
    for (const e of expanded) {
      const as = (e.ptrb.assuntoMinistrado || '(sem assunto)').trim();
      if (filtroAssunto && as !== filtroAssunto) continue;
      if (!pesMap.has(e.nome)) pesMap.set(e.nome, { funcao: e.funcao, equipe: e.ptrb.equipe, valores: new Map() });
      const item = pesMap.get(e.nome)!;
      item.valores.set(as, (item.valores.get(as) || 0) + e.horas);
      item.equipe = e.ptrb.equipe || item.equipe;
      if (e.funcao) {
        if (!funcaoCount.has(e.nome)) funcaoCount.set(e.nome, new Map());
        const fc = funcaoCount.get(e.nome)!;
        fc.set(e.funcao, (fc.get(e.funcao) || 0) + 1);
      }
    }
    const pesEntries = [...pesMap.entries()].map(([nome, item]) => {
      const funcao = [...(funcaoCount.get(nome)?.entries() || [])].sort((a, b) => b[1] - a[1])[0]?.[0] || item.funcao;
      const homeEquipe = getEquipe(nome) || item.equipe;
      const valores = allAssuntos.map(a => { const v = item.valores.get(a.trim()); return v != null ? horasStr(v) : '-'; });
      const total = [...item.valores.values()].reduce((s, v) => s + v, 0);
      return { nome, funcao, equipe: homeEquipe, valores, totalHoras: horasStr(total), registros: [...item.valores.values()].reduce((s, v) => s + (v > 0 ? 1 : 0), 0) };
    });
    pesEntries.sort((a, b) => {
      if (a.equipe !== b.equipe) return EQUIPE_ORDER.indexOf(a.equipe) - EQUIPE_ORDER.indexOf(b.equipe);
      const hA = HIERARQUIA.indexOf(a.funcao);
      const hB = HIERARQUIA.indexOf(b.funcao);
      if (hA !== hB) return hA - hB;
      return a.nome.localeCompare(b.nome);
    });
    const grupos = new Map<string, typeof pesEntries>();
    for (const p of pesEntries) {
      if (!grupos.has(p.equipe)) grupos.set(p.equipe, []);
      grupos.get(p.equipe)!.push(p);
    }
    const equipesArr = EQUIPE_ORDER.filter(eq => grupos.has(eq)).map(eq => ({
      equipe: eq,
      pessoas: grupos.get(eq)!.map((p, i) => ({ num: i + 1, funcao: p.funcao, nome: getNomeGuerra(p.nome), valores: p.valores, totalHoras: p.totalHoras, registros: p.registros })),
    }));
    imprimirHTMLEfetivo(`Relatório PTR-BA${filtrosAtivos}${filtroEquipeLabel}${filtroAssuntoLabel}`, allAssuntos, equipesArr);
  }

  function handlePrintDetail() {
    const colunas = ['Data', 'Equipe', 'Assunto', 'Horário', 'Duração', 'Instrutor'];
    const linhas = detailPTRBs.map(p => [
      formatDate(p.data),
      p.equipe,
      p.assuntoMinistrado || '-',
      `${p.horaInicio || '-'} às ${p.horaTermino || '-'}`,
      duracaoDe(p),
      p.instrutor || '-',
    ]);
    imprimirHTML(`Relatório PTR-BA - Registros de ${selectedPessoa}`, colunas, linhas);
  }

  function cellHorasPrint(v: number): string {
    return v > 0 ? horasStr(v) : '—';
  }

  function gerarHTMLRelatorioCompleto(opts: { modo: 'geral' | 'individual' | 'por-equipe' | 'equipe'; legenda: boolean; pessoa: string; equipe: string }): string {
    const titulo = 'Relatório PTR-BA — Instrução e Tempo em Segurança do Trabalho';
    const filtros = `Período: ${filtroPeriodoLabel}${filtroEquipe ? ' · Equipe: ' + filtroEquipe : ''}${filtroAssunto ? ' · Assunto: ' + filtroAssunto : ''} · Gerado em ${formatarDataHoraBR(new Date())}`;

    const thAssunto = (a: string) => '<th title="' + a + '">' + abreviarLabel(a) + '</th>';

    // MODO GERAL — todas as equipes, todos os membros e o tempo de cada um (1 folha, sem quebra entre equipes)
    const geralHTML = equipePessoasMatriz.grupos.map((g, gi) => {
      const rows = g.pessoas.map((p, i) =>
        '<tr' + (p.funcao === 'BA-CE' ? ' class="bace"' : '') + '>' +
        '<td>' + (i + 1) + '</td>' +
        '<td style="font-weight:' + (p.funcao === 'BA-CE' ? 'bold' : 'normal') + ';">' + (p.funcao || '—') + '</td>' +
        '<td class="l">' + p.nomeGuerra + '</td>' +
        equipePessoasMatriz.assuntos.map(a => '<td>' + cellHorasPrint(p.valores.get(a)?.horas || 0) + '</td>').join('') +
        '<td style="font-weight:bold;">' + horasStr(p.totalHoras) + '</td>' +
        '<td>' + p.totalQtd + '</td>' +
        '</tr>'
      ).join('\n');
      const equipeAssuntos = horasAtividades.porEquipeAssunto.get(g.equipe) || new Map<string, number>();
      const totalEquipe = horasAtividades.totalPorEquipe[g.equipe] || 0;
      const registrosEquipe = horasAtividades.registrosPorEquipe[g.equipe] || 0;
      const totalRow = '<tr class="total">' +
        '<td colspan="3" class="l">TOTAL EQUIPE</td>' +
        equipePessoasMatriz.assuntos.map(a => '<td>' + cellHorasPrint(equipeAssuntos.get(a) || 0) + '</td>').join('') +
        '<td>' + horasStr(totalEquipe) + '</td>' +
        '<td>' + registrosEquipe + '</td>' +
        '</tr>';
      return '<div>' +
        (gi === 0 ? '<h2>Geral — Todas as equipes, membros e horas</h2>' : '') +
        '<table><tr class="eq-header"><td colspan="' + (equipePessoasMatriz.assuntos.length + 5) + '">EQUIPE ' + g.equipe.toUpperCase() + ' — ' + g.pessoas.length + ' militares · Atividade da equipe: ' + horasStr(totalEquipe) + '</td></tr></table>' +
        '<table><thead><tr>' + '<th style="width:3%">Nº</th><th style="width:7%">Função</th><th class="l" style="width:14%;">Nome</th>' +
        equipePessoasMatriz.assuntos.map(thAssunto).join('') +
        '<th style="width:6%">Total</th><th style="width:3%">Reg.</th></tr></thead><tbody>' + rows + '\n' + totalRow + '</tbody></table>' +
        '</div>';
    }).join('\n');

    // MODO EQUIPE — todos os membros de 1 equipe com o tempo de cada um (1 folha)
    const grupoAlvo = equipePessoasMatriz.grupos.find(g => g.equipe === opts.equipe);
    const equipeHTML = grupoAlvo ? (() => {
      const rows = grupoAlvo.pessoas.map((p, i) =>
        '<tr' + (p.funcao === 'BA-CE' ? ' class="bace"' : '') + '>' +
        '<td>' + (i + 1) + '</td>' +
        '<td style="font-weight:' + (p.funcao === 'BA-CE' ? 'bold' : 'normal') + ';">' + (p.funcao || '—') + '</td>' +
        '<td class="l">' + p.nomeGuerra + '</td>' +
        equipePessoasMatriz.assuntos.map(a => '<td>' + cellHorasPrint(p.valores.get(a)?.horas || 0) + '</td>').join('') +
        '<td style="font-weight:bold;">' + horasStr(p.totalHoras) + '</td>' +
        '<td>' + p.totalQtd + '</td>' +
        '</tr>'
      ).join('\n');
      const equipeAssuntos = horasAtividades.porEquipeAssunto.get(grupoAlvo.equipe) || new Map<string, number>();
      const totalEquipe = horasAtividades.totalPorEquipe[grupoAlvo.equipe] || 0;
      const registrosEquipe = horasAtividades.registrosPorEquipe[grupoAlvo.equipe] || 0;
      const totalRow = '<tr class="total">' +
        '<td colspan="3" class="l">TOTAL EQUIPE</td>' +
        equipePessoasMatriz.assuntos.map(a => '<td>' + cellHorasPrint(equipeAssuntos.get(a) || 0) + '</td>').join('') +
        '<td>' + horasStr(totalEquipe) + '</td>' +
        '<td>' + registrosEquipe + '</td>' +
        '</tr>';
      return '<div>' +
        '<h2>Equipe ' + grupoAlvo.equipe.toUpperCase() + ' — membros e horas</h2>' +
        '<table><tr class="eq-header"><td colspan="' + (equipePessoasMatriz.assuntos.length + 5) + '">EQUIPE ' + grupoAlvo.equipe.toUpperCase() + ' — ' + grupoAlvo.pessoas.length + ' militares · Atividade da equipe: ' + horasStr(totalEquipe) + '</td></tr></table>' +
        '<table><thead><tr>' + '<th style="width:3%">Nº</th><th style="width:7%">Função</th><th class="l" style="width:14%;">Nome</th>' +
        equipePessoasMatriz.assuntos.map(thAssunto).join('') +
        '<th style="width:6%">Total</th><th style="width:3%">Reg.</th></tr></thead><tbody>' + rows + '\n' + totalRow + '</tbody></table>' +
        '</div>';
    })() : '';

    // MODO POR EQUIPE — as instruções que cada equipe fez, quantidade POR EQUIPE (não por pessoa)
    const equipesComRegistros = [...EQUIPE_ORDER.filter(eq => horasAtividades.registrosPorEquipe[eq]), ...Object.keys(horasAtividades.registrosPorEquipe).filter(eq => !EQUIPE_ORDER.includes(eq))];
    const porEquipeRows = equipesComRegistros.map(eq => {
      const equipeAssuntos = horasAtividades.porEquipeAssunto.get(eq) || new Map<string, number>();
      return '<tr>' +
        '<td class="l" style="font-weight:bold;">' + eq + '</td>' +
        equipePessoasMatriz.assuntos.map(a => '<td>' + cellHorasPrint(equipeAssuntos.get(a) || 0) + '</td>').join('') +
        '<td style="font-weight:bold;">' + horasStr(horasAtividades.totalPorEquipe[eq] || 0) + '</td>' +
        '<td>' + (horasAtividades.registrosPorEquipe[eq] || 0) + '</td>' +
        '</tr>';
    }).join('\n');
    const qtdTotal = equipesComRegistros.reduce((s, eq) => s + (horasAtividades.registrosPorEquipe[eq] || 0), 0);
    const porEquipeHTML = '<div>' +
      '<h2>Por Equipe — Instruções e quantidade por equipe</h2>' +
      '<table><thead><tr><th class="l" style="width:12%;">Equipe</th>' +
      equipePessoasMatriz.assuntos.map(thAssunto).join('') +
      '<th style="width:7%;">Total Horas</th><th style="width:7%;">PTR-BAs</th></tr></thead><tbody>' + porEquipeRows +
      '<tr class="total"><td class="l">TOTAL</td>' +
      equipePessoasMatriz.assuntos.map(a => '<td>' + cellHorasPrint(horasAtividades.totalPorAssunto[a] || 0) + '</td>').join('') +
      '<td>' + horasStr(horasAtividades.totalGeral) + '</td>' +
      '<td>' + qtdTotal + '</td></tr>' +
      '</tbody></table></div>';

    // MODO INDIVIDUAL — 1 pessoa com todas as instruções que ela fez
    const individuosAlvo = opts.pessoa
      ? individuos.map(([equipe, pessoas]) => [equipe, pessoas.filter(p => p.pessoa === opts.pessoa)] as const).filter(([, pessoas]) => pessoas.length > 0)
      : individuos;
    const individualHTML = individuosAlvo.map(([, pessoas]) => {
      const cards = pessoas.map(p => {
        const total = p.registros.reduce((s, r) => s + r.horas, 0);
        const rows = p.registros.map(r =>
          '<tr>' +
          '<td>' + formatDate(r.data) + '</td>' +
          '<td class="l">' + r.assunto + '</td>' +
          '<td>' + (r.horaInicio ? r.horaInicio + ' às ' + r.horaTermino : '—') + '</td>' +
          '<td style="font-weight:bold;">' + horasStr(r.horas) + '</td>' +
          '<td class="l">' + (r.instrutor || '—') + '</td>' +
          '</tr>'
        ).join('\n');
        return '<div class="pessoa">' +
          '<table><tr class="pes-header"><td colspan="5">' +
          (p.funcao ? p.funcao + ' · ' : '') + getNomeGuerra(p.pessoa) +
          ' — Total ' + horasStr(total) + ' · ' + p.registros.length + ' registro(s)</td></tr></table>' +
          '<table><thead><tr><th style="width:10%">Data</th><th class="l">Assunto</th><th style="width:14%">Horário</th><th style="width:9%">Duração</th><th class="l" style="width:18%">Instrutor</th></tr></thead><tbody>' + rows + '</tbody></table>' +
          '</div>';
      }).join('\n');
      return '<div>' + cards + '</div>';
    }).join('\n');

    const legenda = ASSUNTOS.map((a, i) => '<tr><td>' + String(i + 1).padStart(2, '0') + '.</td><td>' + a.replace(/^\d+\.\s*/, '') + '</td></tr>').join('\n');

    const corpo =
      opts.modo === 'geral' ? geralHTML :
      opts.modo === 'equipe' ? (equipeHTML || geralHTML) :
      opts.modo === 'por-equipe' ? porEquipeHTML :
      opts.modo === 'individual' && opts.pessoa ? individualHTML :
      geralHTML;

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${titulo}</title>
<style>
@page { margin: 8mm; size: landscape; }
body { font-family: Arial, sans-serif; margin: 0; padding: 8px; font-size: 11px; color: #000; }
h1 { font-size: 16px; margin: 0 0 2px; }
h2 { font-size: 13px; margin: 14px 0 4px; }
p.filtros { font-size: 10px; color: #555; margin: 0 0 10px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 6px; }
th, td { border: 1px solid #000; padding: 2px 4px; font-size: 10px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
th { background: #4472C4; color: #fff; font-weight: bold; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
.eq-header td { background: #2b5797; color: #fff; font-weight: bold; text-align: left; padding: 3px 6px; font-size: 11px; }
.pes-header td { background: #d9e2f3; font-weight: bold; text-align: left; padding: 2px 6px; font-size: 10px; }
.bace td { background: #e8f0fe; }
.total td { background: #f2f2f2; font-weight: bold; }
td.l, th.l { text-align: left; }
.legenda { margin-top: 10px; }
.legenda td { border: none; padding: 1px 3px; text-align: left; font-size: 9px; }
.footer { margin-top: 10px; font-size: 9px; color: #888; }
</style></head><body>
<h1>${titulo}</h1>
<p class="filtros">${filtros}</p>

${corpo}

${opts.legenda ? `<div class="legenda">
<p><strong>Legenda — Assuntos Ministrados:</strong></p>
<table style="table-layout:auto;">${legenda}</table>
</div>` : ''}
<p class="footer">Relatório PTR-BA - Seção de Instrução · ${formatarDataHoraBR(new Date())}</p>
</body></html>`;
  }

  function imprimirRelatorioCompleto(opts?: { modo: 'geral' | 'individual' | 'por-equipe' | 'equipe'; legenda: boolean; pessoa: string; equipe: string }) {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(gerarHTMLRelatorioCompleto(opts || { modo: 'geral', legenda: true, pessoa: '', equipe: '' }));
      win.document.close();
      setTimeout(() => win.print(), 700);
    }
  }

  const filtroPeriodoLabel = filterMode === 'mes-ano'
    ? `${filtroMes ? MESES[Number(filtroMes)] : ''} ${filtroAno || ''}`.trim() || 'Todo período'
    : `${dataInicio ? formatarDataBR(dataInicio) : '...'} a ${dataFinal ? formatarDataBR(dataFinal) : '...'}`;
  const filtrosAtivos = (filterMode === 'mes-ano' && (filtroMes || filtroAno)) || (filterMode === 'periodo' && (dataInicio || dataFinal))
    ? ` · ${filtroPeriodoLabel}`
    : '';
  const filtroEquipeLabel = filtroEquipe ? ` · Equipe ${filtroEquipe}` : '';
  const filtroAssuntoLabel = filtroAssunto ? ` · ${filtroAssunto}` : '';

  function FilterBar() {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-2">
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
              {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className={inputClass}>
              <option value="">Todos os meses</option>
              {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </>
        ) : (
          <>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              className={inputClass} placeholder="Data início" />
            <span className="text-xs text-graphite-400">a</span>
            <input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)}
              className={inputClass} placeholder="Data fim" />
          </>
        )}

        <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)} className={inputClass}>
          <option value="">Todas as equipes</option>
          {EQUIPES.map(eq => <option key={eq} value={eq}>{eq}</option>)}
        </select>
        <select value={filtroAssunto} onChange={e => setFiltroAssunto(e.target.value)} className={inputClass}>
          <option value="">Todos os assuntos</option>
          {assuntosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filtroPessoa} onChange={e => setFiltroPessoa(e.target.value)} className={inputClass}>
          <option value="">Todas as pessoas</option>
          {pessoasFiltro.map(n => <option key={n} value={n}>{getNomeGuerra(n)}</option>)}
        </select>
        <span className="text-xs text-graphite-400">{filtered.length} registro(s)</span>
      </div>
    );
  }

  if (loading || loadingContexto) {
    return (
      <PageContainer>
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" />
        </div>
      </PageContainer>
    );
  }

  if (!canVisualizarRelatoriosPtrBa) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Lock className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Acesso restrito</h3>
          <p className="text-sm text-graphite-400 dark:text-graphite-500">O relatório PTR-BA está disponível para Admin, GS, BA-CE, BA-LR e equipe Embaixador.</p>
        </div>
      </PageContainer>
    );
  }

  if (view === 'view-ptrb' && selectedPTRB) {
    return (
      <PageContainer>
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => goToDetail(selectedPessoa)}
            className="flex items-center gap-1 rounded-xl border border-graphite-300/60 bg-white/80 px-3 py-2 text-sm font-medium text-graphite-700 shadow-sm transition-all duration-200 hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        </div>
        <div className="mb-4 flex items-center justify-between">
          <PageTitle icon={FileText} title={`PTR-BA - ${selectedPTRB.equipe} - ${formatDate(selectedPTRB.data)}`} />
          <button onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
            <Printer className="h-4 w-4" /> Imprimir
          </button>
        </div>
        <div id="ptrb-print-area" className="rounded-2xl border border-graphite-200/60 bg-white/80 p-6 shadow-sm dark:border-border-dark dark:bg-surface-card print:border-none print:shadow-none">
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div><p className="text-xs text-graphite-400">Data</p><p className="text-sm font-medium dark:text-graphite-100">{formatDate(selectedPTRB.data)}</p></div>
            <div><p className="text-xs text-graphite-400">Equipe</p><p className="text-sm font-medium dark:text-graphite-100">{selectedPTRB.equipe}</p></div>
            <div><p className="text-xs text-graphite-400">Horário</p><p className="text-sm font-medium dark:text-graphite-100">{selectedPTRB.horaInicio} às {selectedPTRB.horaTermino} ({duracaoDe(selectedPTRB)})</p></div>
            <div><p className="text-xs text-graphite-400">Turno</p><p className="text-sm font-medium dark:text-graphite-100">{selectedPTRB.turno}</p></div>
          </div>
          {selectedPTRB.participantes.length > 0 && (
            <div className="mb-6">
              <p className="mb-2 text-xs font-semibold text-aviation-600 dark:text-aviation-400">Participantes</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-graphite-200 dark:border-border-dark">
                    <th className="px-3 py-1.5 text-left text-xs text-graphite-500">Função</th>
                    <th className="px-3 py-1.5 text-left text-xs text-graphite-500">Nome</th>
                    <th className="px-3 py-1.5 text-left text-xs text-graphite-500">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPTRB.participantes.map((part, i) => (
                    <tr key={i} className="border-b border-graphite-100 dark:border-border-dark">
                      <td className="px-3 py-1.5 dark:text-graphite-100">{part.funcao || '-'}</td>
                      <td className="px-3 py-1.5 dark:text-graphite-100">{part.nomeCompleto || '-'}</td>
                      <td className="px-3 py-1.5 dark:text-graphite-100">{part.situacao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {selectedPTRB.observacoes && <div className="mb-4"><p className="mb-1 text-xs font-semibold text-aviation-600">Observações</p><p className="text-sm whitespace-pre-wrap dark:text-graphite-100">{selectedPTRB.observacoes}</p></div>}
          {selectedPTRB.instrutor && <div className="mb-4"><p className="mb-1 text-xs font-semibold text-aviation-600">Instrutor</p><p className="text-sm dark:text-graphite-100">{selectedPTRB.instrutor}</p></div>}
          {selectedPTRB.assuntoMinistrado && <div className="mb-4"><p className="mb-1 text-xs font-semibold text-aviation-600">Assunto Ministrado</p><p className="text-sm dark:text-graphite-100">{selectedPTRB.assuntoMinistrado}</p></div>}
          {selectedPTRB.descricao && <div className="mb-4"><p className="mb-1 text-xs font-semibold text-aviation-600">Descrição</p><p className="text-sm whitespace-pre-wrap dark:text-graphite-100">{selectedPTRB.descricao}</p></div>}
          {selectedPTRB.informacoesComplementares && <div className="mb-4"><p className="mb-1 text-xs font-semibold text-aviation-600">Informações Complementares</p><p className="text-sm whitespace-pre-wrap dark:text-graphite-100">{selectedPTRB.informacoesComplementares}</p></div>}
          {selectedPTRB.fotos.some(f => f) && (
            <div>
              <p className="mb-1 text-xs font-semibold text-aviation-600">Fotos</p>
              <div className="grid grid-cols-3 gap-4">
                {selectedPTRB.fotos.filter(f => f).map((f, i) => (
                  <img key={i} src={f} alt={`Foto ${i + 1}`} className="w-full rounded-lg object-cover" />
                ))}
              </div>
            </div>
          )}
        </div>
      </PageContainer>
    );
  }

  if (view === 'summary') {
    return (
      <PageContainer>
        <PageTitle icon={FileText} title={`Relatório PTR-BA${filtrosAtivos}${filtroEquipeLabel}${filtroAssuntoLabel}`}
          subtitle="Instruções e tempo em segurança do trabalho" />
        <FilterBar />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex overflow-hidden rounded-xl border border-graphite-300/60 bg-white/70 text-xs font-medium dark:border-border-dark dark:bg-surface-card">
            <button onClick={() => setSecaoAtiva('geral')}
              className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${secaoAtiva === 'geral' ? 'bg-aviation-600 text-white' : 'text-graphite-600 hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover'}`}>
              <Users className="h-3.5 w-3.5" /> Visão Geral
            </button>
            <button onClick={() => setSecaoAtiva('individual')}
              className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${secaoAtiva === 'individual' ? 'bg-aviation-600 text-white' : 'text-graphite-600 hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover'}`}>
              <User className="h-3.5 w-3.5" /> Visão Individual
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrintButton onClick={() => imprimirRelatorioCompleto({ modo: 'geral', legenda: true, pessoa: '', equipe: '' })} primary>Imprimir Relatório</PrintButton>
            <PrintButton onClick={() => setShowPrintModal(true)} icon={SlidersHorizontal}>
              Opções de Impressão
            </PrintButton>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
            <FileText className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
            <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum PTR-BA encontrado</h3>
            <p className="text-sm text-graphite-400 dark:text-graphite-500">Nenhum registro com os filtros atuais.</p>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm font-medium text-graphite-700 dark:text-graphite-200">
              {horasStr(horasAtividades.totalGeral)}
              <span className="ml-1 text-xs font-normal text-graphite-500">de atividade · {filtered.length} registro(s) · {statsFiltered.pessoas} militar(es)</span>
            </p>
            {secaoAtiva === 'geral' ? (
              <>
            {/* 1 — Visão Geral */}
            <section className="mb-12">
              <SectionHeader icon={Users} title="Visão Geral" subtitle="Pessoas com atividade no período e suas horas por assunto" />
              <div className="space-y-8">
                {equipePessoasMatriz.grupos.map(g => (
                  <div key={g.equipe}>
                    <EquipeBand equipe={g.equipe} onClick={() => goToPerson(g.equipe)}
                      extras={<>{g.pessoas.length} militar(es) · atividade da equipe: {horasStr(horasAtividades.totalPorEquipe[g.equipe] || 0)}</>} />
                    <div className="overflow-x-auto rounded-2xl border border-graphite-200/60 bg-white/80 shadow-sm dark:border-border-dark dark:bg-surface-card">
                      <table className="w-full text-xs" style={{ minWidth: 1000 }}>
                        <thead>
                          <tr className="border-b border-graphite-200 dark:border-border-dark">
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Nº</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Função</th>
                            <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Nome</th>
                            {equipePessoasMatriz.assuntos.map(a => (
                              <th key={a} title={a} className="px-1.5 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">{abreviarLabel(a)}</th>
                            ))}
                            <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Total</th>
                            <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Reg.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.pessoas.map((p, i) => (
                            <tr key={p.nome} onClick={() => goToDetail(p.nome)}
                              className={`cursor-pointer border-b border-graphite-100 transition-colors hover:bg-aviation-50/50 dark:border-border-dark dark:hover:bg-aviation-900/10 ${p.funcao === 'BA-CE' ? 'bg-aviation-50/60 dark:bg-aviation-900/10' : ''}`}>
                              <td className="px-3 py-2 text-graphite-400">{i + 1}</td>
                              <td className={`px-3 py-2 ${p.funcao === 'BA-CE' ? 'font-bold text-aviation-800 dark:text-aviation-300' : 'text-graphite-600 dark:text-graphite-400'}`}>{p.funcao || '—'}</td>
                              <td className="px-3 py-2 font-medium text-graphite-900 dark:text-graphite-100">{p.nomeGuerra}</td>
                              {equipePessoasMatriz.assuntos.map(a => {
                                const v = p.valores.get(a);
                                return <td key={a} className="px-1.5 py-2 text-center">
                                  {v && v.horas > 0 ? <span className="font-semibold text-emerald-700 dark:text-emerald-400">{horasStr(v.horas)}</span> : <span className="text-graphite-300 dark:text-graphite-600">—</span>}
                                </td>;
                              })}
                              <td className="px-3 py-2 text-center font-bold text-graphite-900 dark:text-graphite-100">{horasStr(p.totalHoras)}</td>
                              <td className="px-3 py-2 text-center text-graphite-600 dark:text-graphite-400">{p.totalQtd}x</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </section>
              </>
            ) : (
              <>
            {/* 2 — Visão Individual */}
            <section>
              <SectionHeader icon={User} title="Visão Individual" subtitle="Atividades de cada militar no período" />
              <div className="space-y-8">
                {individuos.map(([equipe, pessoas]) => (
                  <div key={equipe}>
                    <EquipeBand equipe={equipe} extras={<>{pessoas.length} militar(es)</>} />
                    <div className="grid gap-4 lg:grid-cols-2">
                      {pessoas.map(p => {
                        const total = p.registros.reduce((s, r) => s + r.horas, 0);
                        return (
                          <div key={p.pessoa} className="overflow-hidden rounded-2xl border border-graphite-200/60 bg-white/80 shadow-sm dark:border-border-dark dark:bg-surface-card">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-graphite-200 bg-graphite-50/70 px-4 py-3 transition-colors hover:bg-graphite-100/70 dark:border-border-dark dark:bg-surface-hover dark:hover:bg-surface-elevated">
                              <button type="button" onClick={() => goToDetail(p.pessoa)}
                                className="flex items-center gap-2 text-sm font-bold text-graphite-900 hover:text-aviation-700 dark:text-graphite-100 dark:hover:text-aviation-300">
                                {p.funcao && <span className="rounded bg-aviation-100 px-1.5 py-0.5 text-xs font-semibold text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">{p.funcao}</span>}
                                {getNomeGuerra(p.pessoa)}
                              </button>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-graphite-500 dark:text-graphite-400">{horasStr(total)} · {p.registros.length} registro(s)</span>
                                <button onClick={() => goToDetail(p.pessoa)}
                                  className="inline-flex items-center gap-1 rounded-lg bg-aviation-100 px-2 py-1 text-xs font-medium text-aviation-700 transition-colors hover:bg-aviation-200 dark:bg-aviation-900/30 dark:text-aviation-300 dark:hover:bg-aviation-900/50">
                                  <Eye className="h-3 w-3" /> Ver horas
                                </button>
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-graphite-200 dark:border-border-dark">
                                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Data</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Assunto</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Horário</th>
                                    <th className="px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Duração</th>
                                    <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Instrutor</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {p.registros.map((r, i) => (
                                    <tr key={i} className="border-b border-graphite-100 dark:border-border-dark">
                                      <td className="px-3 py-2 text-graphite-600 dark:text-graphite-400">{formatDate(r.data)}</td>
                                      <td className="px-3 py-2 font-medium text-graphite-900 dark:text-graphite-100">{r.assunto}</td>
                                      <td className="px-3 py-2 text-graphite-600 dark:text-graphite-400">{r.horaInicio ? `${r.horaInicio} às ${r.horaTermino}` : '—'}</td>
                                      <td className="px-3 py-2 text-center font-semibold text-emerald-700 dark:text-emerald-400">{horasStr(r.horas)}</td>
                                      <td className="px-3 py-2 text-graphite-600 dark:text-graphite-400">{r.instrutor || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
              </>
            )}
          </>
        )}

        {showPrintModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPrintModal(false)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated" onClick={e => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Opções de Impressão</h3>
                <button onClick={() => setShowPrintModal(false)} className="rounded-lg p-1 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover">✕</button>
              </div>
              <p className="mb-4 text-xs text-graphite-500 dark:text-graphite-400">
                Escolha o tipo de relatório para imprimir (cada um sai em 1 folha):
              </p>
              <div className="space-y-3">
                <label className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${printModo === 'geral' ? 'border-aviation-400 bg-aviation-50/60 dark:border-aviation-600 dark:bg-aviation-900/20' : 'border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card'}`}>
                  <span>
                    <span className="block text-sm font-semibold text-graphite-900 dark:text-graphite-100">Geral — todas as equipes e membros</span>
                    <span className="block text-xs text-graphite-500">Todos os membros de cada equipe com o tempo que cada um fez</span>
                  </span>
                  <input type="radio" name="printModo" checked={printModo === 'geral'} onChange={() => setPrintModo('geral')} className="h-4 w-4 accent-aviation-600" />
                </label>
                <label className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${printModo === 'por-equipe' ? 'border-aviation-400 bg-aviation-50/60 dark:border-aviation-600 dark:bg-aviation-900/20' : 'border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card'}`}>
                  <span>
                    <span className="block text-sm font-semibold text-graphite-900 dark:text-graphite-100">Equipes — quantidade de PTR-BAs</span>
                    <span className="block text-xs text-graphite-500">As equipes e a quantidade de PTR-BAs que cada uma fez</span>
                  </span>
                  <input type="radio" name="printModo" checked={printModo === 'por-equipe'} onChange={() => setPrintModo('por-equipe')} className="h-4 w-4 accent-aviation-600" />
                </label>
                <label className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${printModo === 'equipe' ? 'border-aviation-400 bg-aviation-50/60 dark:border-aviation-600 dark:bg-aviation-900/20' : 'border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card'}`}>
                  <span>
                    <span className="block text-sm font-semibold text-graphite-900 dark:text-graphite-100">Equipe — todos os membros de 1 equipe</span>
                    <span className="block text-xs text-graphite-500">Todos os membros de uma equipe com o tempo que cada um fez</span>
                  </span>
                  <input type="radio" name="printModo" checked={printModo === 'equipe'} onChange={() => setPrintModo('equipe')} className="h-4 w-4 accent-aviation-600" />
                </label>
                {printModo === 'equipe' && (
                  <div className="rounded-xl border border-graphite-200 bg-white px-4 py-3 dark:border-border-dark dark:bg-surface-card">
                    <span className="block text-xs font-semibold text-graphite-500 dark:text-graphite-400">Selecione a equipe</span>
                    <select value={printEquipe} onChange={e => setPrintEquipe(e.target.value)} className="mt-2 w-full rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm text-graphite-900 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
                      <option value="">Selecione...</option>
                      {equipePessoasMatriz.grupos.map(g => (
                        <option key={g.equipe} value={g.equipe}>{g.equipe.toUpperCase()} — {g.pessoas.length} militares</option>
                      ))}
                    </select>
                  </div>
                )}
                <label className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${printModo === 'individual' ? 'border-aviation-400 bg-aviation-50/60 dark:border-aviation-600 dark:bg-aviation-900/20' : 'border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card'}`}>
                  <span>
                    <span className="block text-sm font-semibold text-graphite-900 dark:text-graphite-100">Individual — 1 pessoa</span>
                    <span className="block text-xs text-graphite-500">Uma pessoa com todas as instruções que ela fez</span>
                  </span>
                  <input type="radio" name="printModo" checked={printModo === 'individual'} onChange={() => setPrintModo('individual')} className="h-4 w-4 accent-aviation-600" />
                </label>
                {printModo === 'individual' && (
                  <div className="rounded-xl border border-graphite-200 bg-white px-4 py-3 dark:border-border-dark dark:bg-surface-card">
                    <span className="block text-xs font-semibold text-graphite-500 dark:text-graphite-400">Selecione a pessoa</span>
                    <select value={printPessoa} onChange={e => setPrintPessoa(e.target.value)} className="mt-2 w-full rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm text-graphite-900 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
                      <option value="">Selecione...</option>
                      {individuos.flatMap(([, pessoas]) => pessoas).map(p => (
                        <option key={p.pessoa} value={p.pessoa}>{getNomeGuerra(p.pessoa)}</option>
                      ))}
                    </select>
                  </div>
                )}
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-graphite-200 bg-white px-4 py-3 dark:border-border-dark dark:bg-surface-card">
                  <span>
                    <span className="block text-sm font-semibold text-graphite-900 dark:text-graphite-100">Legenda</span>
                    <span className="block text-xs text-graphite-500">Lista dos assuntos ministrados (PTR-BA)</span>
                  </span>
                  <input type="checkbox" checked={printLegenda} onChange={e => setPrintLegenda(e.target.checked)} className="h-4 w-4 accent-aviation-600" />
                </label>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setShowPrintModal(false)}
                  className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
                  Cancelar
                </button>
                <button onClick={() => {
                  if (printModo === 'individual' && !printPessoa) return;
                  if (printModo === 'equipe' && !printEquipe) return;
                  setShowPrintModal(false);
                  imprimirRelatorioCompleto({ modo: printModo, legenda: printLegenda, pessoa: printModo === 'individual' ? printPessoa : '', equipe: printModo === 'equipe' ? printEquipe : '' });
                }}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-aviation-500/20">
                  <Printer className="h-4 w-4" /> Imprimir
                </button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    );
  }

  if (view === 'person') {
    return (
      <PageContainer>
        <div className="mb-4 flex items-center gap-3">
          <button onClick={goToSummary}
            className="flex items-center gap-1 rounded-xl border border-graphite-300/60 bg-white/80 px-3 py-2 text-sm font-medium text-graphite-700 shadow-sm transition-all duration-200 hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <PageTitle icon={FileText} title={`PTR-BA · Equipe ${selectedEquipe}${filtrosAtivos}`} subtitle="Horas por pessoa e assunto" />
        </div>
        <FilterBar />
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-graphite-200 bg-white p-3 text-center dark:border-border-dark dark:bg-surface-card">
            <p className="text-xl font-black text-graphite-900 dark:text-graphite-100">{statsFiltered.pessoas}</p>
            <p className="text-[10px] font-medium text-graphite-500">Pessoas</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
            <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{horasStr(statsFiltered.horas)}</p>
            <p className="text-[10px] font-medium text-emerald-500">Horas totais</p>
          </div>
          <div className="rounded-xl border border-aviation-200 bg-aviation-50 p-3 text-center dark:border-aviation-800 dark:bg-aviation-900/20">
            <p className="text-xl font-black text-aviation-700 dark:text-aviation-300">{statsFiltered.registros}</p>
            <p className="text-[10px] font-medium text-aviation-500">Registros</p>
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex overflow-hidden rounded-xl border border-graphite-300/60 bg-white/70 text-xs font-medium dark:border-border-dark dark:bg-surface-card">
            <button onClick={() => { goToSummary(); setSecaoAtiva('geral'); }}
              className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${secaoAtiva === 'geral' ? 'bg-aviation-600 text-white' : 'text-graphite-600 hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover'}`}>
              <Users className="h-3.5 w-3.5" /> Visão Geral
            </button>
            <button onClick={() => { goToSummary(); setSecaoAtiva('individual'); }}
              className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${secaoAtiva === 'individual' ? 'bg-aviation-600 text-white' : 'text-graphite-600 hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover'}`}>
              <User className="h-3.5 w-3.5" /> Visão Individual
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {sortedPessoaRows.length > 0 && (
              <PrintButton onClick={handlePrintPerson} primary>Imprimir Equipe</PrintButton>
            )}
            <PrintButton onClick={() => setShowPrintModal(true)} icon={SlidersHorizontal}>
              Opções de Impressão
            </PrintButton>
          </div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-graphite-200/60 bg-white/80 shadow-sm dark:border-border-dark dark:bg-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-200 dark:border-border-dark">
                <SortHeader column="label">Militar</SortHeader>
                <SortHeader column="assunto">Assunto</SortHeader>
                <SortHeader column="horas">Horas</SortHeader>
                <SortHeader column="qtd">Registros</SortHeader>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-graphite-500">Ações</th>
              </tr>
            </thead>
            <tbody>
              {sortedPessoaRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-graphite-400">
                    Nenhum PTR-BA encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : (
                sortedPessoaRows.map((r, i) => (
                  <tr
                    key={`${r.pessoa}-${r.assunto}-${i}`}
                    className="border-b border-graphite-100 transition-colors hover:bg-aviation-50/50 dark:border-border-dark dark:hover:bg-aviation-900/10"
                  >
                    <td className="px-4 py-3 font-medium text-graphite-900 dark:text-graphite-100">
                      {r.funcao && <span className="rounded bg-aviation-100 px-1.5 py-0.5 text-xs font-semibold text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300 mr-1.5">{r.funcao}</span>}
                      {getNomeGuerra(r.pessoa)}
                      <span className="ml-2 rounded bg-graphite-100 px-1.5 py-0.5 text-[10px] font-medium text-graphite-500 dark:bg-surface-hover dark:text-graphite-400">{r.equipe}</span>
                    </td>
                    <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{r.assunto}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700 dark:text-emerald-400">{horasStr(r.horas)}</td>
                    <td className="px-4 py-3 text-graphite-600 dark:text-graphite-400">{r.qtd}x</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => goToDetail(r.pessoa)}
                        className="inline-flex items-center gap-1 rounded-lg bg-aviation-100 px-2 py-1 text-xs font-medium text-aviation-700 transition-colors hover:bg-aviation-200 dark:bg-aviation-900/30 dark:text-aviation-300 dark:hover:bg-aviation-900/50"
                      >
                        <Eye className="h-3 w-3" /> Ver PTR-BAs
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => goToPerson(selectedEquipe)}
          className="flex items-center gap-1 rounded-xl border border-graphite-300/60 bg-white/80 px-3 py-2 text-sm font-medium text-graphite-700 shadow-sm transition-all duration-200 hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <PageTitle icon={FileText} title={`PTR-BA · ${selectedPessoa}${filtrosAtivos}`} subtitle={`Equipe ${selectedEquipe}`} />
      </div>

      <FilterBar />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-graphite-200 bg-white p-3 text-center dark:border-border-dark dark:bg-surface-card">
          <p className="text-xl font-black text-graphite-900 dark:text-graphite-100">{detailPTRBs.length}</p>
          <p className="text-[10px] font-medium text-graphite-500">Registros</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center dark:border-emerald-800 dark:bg-emerald-900/20">
          <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">
            {horasStr(detailPTRBs.reduce((s, p) => s + calcHoras(p.horaInicio, p.horaTermino), 0))}
          </p>
          <p className="text-[10px] font-medium text-emerald-500">Horas totais</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex overflow-hidden rounded-xl border border-graphite-300/60 bg-white/70 text-xs font-medium dark:border-border-dark dark:bg-surface-card">
          <button onClick={() => { goToSummary(); setSecaoAtiva('geral'); }}
            className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${secaoAtiva === 'geral' ? 'bg-aviation-600 text-white' : 'text-graphite-600 hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover'}`}>
            <Users className="h-3.5 w-3.5" /> Visão Geral
          </button>
          <button onClick={() => { goToSummary(); setSecaoAtiva('individual'); }}
            className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${secaoAtiva === 'individual' ? 'bg-aviation-600 text-white' : 'text-graphite-600 hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover'}`}>
            <User className="h-3.5 w-3.5" /> Visão Individual
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {detailPTRBs.length > 0 && (
            <PrintButton onClick={handlePrintDetail} primary>Imprimir Pessoa</PrintButton>
          )}
          <PrintButton onClick={() => setShowPrintModal(true)} icon={SlidersHorizontal}>
            Opções de Impressão
          </PrintButton>
        </div>
      </div>

      {detailPTRBs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <FileText className="mb-4 h-12 w-12 text-graphite-300" />
          <h3 className="text-lg font-semibold text-graphite-700">Nenhum PTR-BA encontrado</h3>
          <p className="text-sm text-graphite-400">{selectedPessoa} não possui registros com os filtros atuais.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {detailPTRBs.map(p => (
            <div key={p.id} className="rounded-2xl border border-graphite-200 bg-white shadow-sm dark:border-border-dark dark:bg-surface-card">
              <button
                onClick={() => setExpandedPTRB(expandedPTRB === p.id ? null : p.id)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{p.assuntoMinistrado || 'PTR-BA'}</p>
                  <p className="text-xs text-graphite-500">{formatDate(p.data)} · Equipe {p.equipe} · {p.instrutor || 'N/A'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); goToViewPTRB(p); }}
                    className="rounded-lg border border-graphite-200 bg-white px-2 py-1 text-xs font-medium text-graphite-600 transition-colors hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-300 dark:hover:bg-surface-hover"
                    title="Visualizar detalhes"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-xs text-graphite-400">{p.horaInicio}-{p.horaTermino}</span>
                  {expandedPTRB === p.id ? <ChevronUp className="h-4 w-4 text-graphite-400" /> : <ChevronDown className="h-4 w-4 text-graphite-400" />}
                </div>
              </button>
              {expandedPTRB === p.id && (
                <div className="border-t border-graphite-200 px-5 py-4 dark:border-border-dark">
                  <p className="text-sm text-graphite-700 dark:text-graphite-300 whitespace-pre-wrap">{p.descricao || p.observacoes || 'Sem descrição'}</p>
                  {p.participantes?.length > 0 && (
                    <div className="mt-3 border-t border-graphite-100 pt-3 dark:border-border-dark">
                      <p className="mb-2 text-xs font-semibold text-aviation-600 dark:text-aviation-400">Participantes</p>
                      <div className="flex flex-wrap gap-1">
                        {p.participantes.map((part, i) => (
                          <span key={i}
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              part.nomeCompleto === selectedPessoa
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 ring-1 ring-emerald-400'
                                : 'bg-graphite-100 text-graphite-700 dark:bg-surface-hover dark:text-graphite-300'
                            }`}
                          >
                            {part.nomeCompleto || part.nomeGuerra || '(sem nome)'} ({part.situacao})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          </div>
        )}

      {visualizandoPtrb && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8 sm:pt-16" onClick={() => setVisualizandoPtrb(null)}>
          <div className="w-full max-w-2xl rounded-2xl bg-white/95 p-6 shadow-2xl shadow-black/10 backdrop-blur-sm dark:bg-surface-elevated/95" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">PTR-BA — {fmt(visualizandoPtrb.data)}</h3>
              <button onClick={() => setVisualizandoPtrb(null)} className="rounded-lg p-1 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover">✕</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-graphite-500">Data</p>
                  <p className="text-sm font-medium text-graphite-900 dark:text-graphite-100">{fmt(visualizandoPtrb.data)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-graphite-500">Horário</p>
                  <p className="text-sm font-medium text-graphite-900 dark:text-graphite-100">{visualizandoPtrb.horaInicio} às {visualizandoPtrb.horaTermino} ({duracaoDe(visualizandoPtrb)})</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-graphite-500">Equipe</p>
                  <p className="text-sm font-medium text-graphite-900 dark:text-graphite-100">{visualizandoPtrb.equipe}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-graphite-500">Turno</p>
                  <p className="text-sm font-medium text-graphite-900 dark:text-graphite-100">{visualizandoPtrb.turno}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-graphite-500">Assunto Ministrado</p>
                <p className="text-sm text-graphite-900 dark:text-graphite-100">{visualizandoPtrb.assuntoMinistrado}</p>
              </div>
              {visualizandoPtrb.instrutor && (
                <div>
                  <p className="text-[10px] font-semibold uppercase text-graphite-500">Instrutor</p>
                  <p className="text-sm text-graphite-900 dark:text-graphite-100">{visualizandoPtrb.instrutor}</p>
                </div>
              )}
              {visualizandoPtrb.participantes?.length > 0 && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase text-graphite-500">Participantes</p>
                  <div className="flex flex-wrap gap-1">
                    {visualizandoPtrb.participantes.map((part: any, i: number) => (
                      <span key={i} className="rounded-full bg-graphite-100 px-2 py-0.5 text-[10px] font-medium text-graphite-700 dark:bg-surface-hover dark:text-graphite-300">
                        {part.nomeCompleto || part.nome} ({part.funcao || '—'})
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {visualizandoPtrb.descricao && (
                <div>
                  <p className="text-[10px] font-semibold uppercase text-graphite-500">Atividades Desenvolvidas</p>
                  <p className="text-sm whitespace-pre-wrap text-graphite-700 dark:text-graphite-300">{visualizandoPtrb.descricao}</p>
                </div>
              )}
              {visualizandoPtrb.informacoesComplementares && (
                <div>
                  <p className="text-[10px] font-semibold uppercase text-graphite-500">Informações Complementares</p>
                  <p className="text-sm whitespace-pre-wrap text-graphite-700 dark:text-graphite-300">{visualizandoPtrb.informacoesComplementares}</p>
                </div>
              )}
              {visualizandoPtrb.fotos?.some((f: string) => f) && (
                <div className="grid grid-cols-3 gap-3">
                  {visualizandoPtrb.fotos.filter((f: string) => f).map((f: string, i: number) => (
                    <img key={i} src={f} alt={`Foto ${i + 1}`} className="w-full rounded-lg object-cover" />
                  ))}
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setVisualizandoPtrb(null)}
                className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default PTRBA;
