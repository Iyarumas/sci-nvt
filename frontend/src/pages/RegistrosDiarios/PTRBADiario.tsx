import { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileText, Plus, Trash2, Save, Eye, Pencil, Copy, Printer,
  ChevronDown, ChevronUp, Image, Lock,
} from 'lucide-react';
import { SearchSelect, type AtivoItem } from '../../components/ui/SearchSelect';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarPTRBs, criarPTRB, atualizarPTRB, excluirPTRB } from '../../services/ptrbService';
import { listarBombeiros } from '../../services/bombeiroService';
import { listarFeriasGozo } from '../../services/feriasService';
import { listarSubstituicoesTemporarias } from '../../services/substituicaoTemporariaService';
import { listarVigencias } from '../../services/vigenciaSubstituicaoService';
import { listarDocumentos, listarPreenchimentos } from '../../services/documentoService';
import { listarAPOCs } from '../../services/apocService';
import { CARGO_OPTIONS } from '../../types/bombeiro';
import type { Bombeiro, Equipe } from '../../types/bombeiro';
import type { FeriasGozo } from '../../types/ferias';
import type { SubstituicaoTemporaria } from '../../types/substituicaoTemporaria';
import type { APOC } from '../../types/apoc';
import type { PTRB, PTRBParticipante } from '../../types/ptrb';
import { EQUIPES, SITUACOES, ASSUNTOS, SITUACAO_DESCRICOES } from '../../types/ptrb';
import { horarioPlantaoPorEquipe } from '../../utils/equipes';
import { formatarDataArquivo, formatarDataBR, hojeLocalISO } from '../../utils/datas';
import {
  canCriarRegistrosDiarios,
  canEditarRegistroDiario,
  canEscolherEquipeRegistrosDiarios,
  canExcluirRegistroDiario,
  equipePadraoRegistrosDiarios,
} from '../../utils/permissoes';
import { montarEfetivoOperacional, montarOpcoesEfetivoOperacional } from '../../utils/efetivoOperacional';
import { PageTour } from '../../components/ui/PageTour';
import { resumoAuditoria } from '../../utils/auditoria';

const EQUIPES_FILTRO = EQUIPES.filter(eq => eq !== 'Ferista');
const SITUACOES_TOOLTIP = SITUACOES
  .map(situacao => `${situacao} = ${SITUACAO_DESCRICOES[situacao] || situacao}`)
  .join('\n');

const PTRBA_INSTRUCAO_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'PTR-BA por instrução',
    body: 'Esta página registra um PTR-BA ligado a uma instrução específica do plantão.',
    detail: 'Ele guarda data, horários, equipe, participantes, situações de presença, instrutor, assunto ministrado, descrição, informações complementares e fotos.',
  },
  {
    selector: 'main select',
    title: 'Filtros da lista',
    body: 'Filtre por ano, mês e equipe para localizar registros antigos.',
    detail: 'Use esses filtros antes de editar, clonar, imprimir ou excluir um PTR-BA já lançado.',
  },
  {
    selector: 'main button',
    title: 'Novo PTR-BA por instrução',
    body: 'O botão abre o formulário para lançar uma nova instrução.',
    detail: 'A equipe e o horário ajudam o sistema a puxar o efetivo correto. Férias, trocas, substituições temporárias e APOC entram conforme os dados existentes no sistema.',
  },
  {
    selector: 'main .space-y-3',
    title: 'Cards de registros',
    body: 'Cada card mostra o resumo do PTR-BA por instrução e permite visualizar, editar, clonar, imprimir ou excluir conforme permissão.',
    detail: 'Clonar reaproveita o registro para economizar tempo, mas revise data, equipe, participantes e fotos antes de salvar.',
  },
  {
    selector: 'main input, main textarea, main [role="combobox"]',
    title: 'Campos do formulário',
    body: 'No formulário, preencha data, horário, equipe, instrutor, assunto, descrição, participantes e evidências.',
    detail: 'As situações dos participantes indicam presença, ausência, férias, troca, substituição ou outras condições. Esse preenchimento influencia relatórios e conferência do dia.',
  },
  {
    selector: 'main button',
    title: 'Salvar e imprimir',
    body: 'Depois de conferir tudo, salve o registro. Na visualização, use impressão quando precisar do documento físico ou PDF.',
    detail: 'Antes de imprimir, confira se fotos e informações complementares representam corretamente a instrução realizada.',
  },
];

function formatDate(d: string) {
  return formatarDataBR(d);
}

function calcDuracao(inicio: string, termino: string): string {
  if (!inicio || !termino) return '';
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = termino.split(':').map(Number);
  let inicioMin = h1 * 60 + m1;
  let terminoMin = h2 * 60 + m2;
  if (terminoMin <= inicioMin) terminoMin += 24 * 60;
  const diff = terminoMin - inicioMin;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

const FUNCAO_OPTIONS = [...CARGO_OPTIONS.map(c => c.value), 'APOC'];
const HIERARQUIA_EQUIPE = ['BA-CE', 'BA-LR', 'BA-MC', 'BA-MC', 'BA-MC', 'BA-2', 'BA-2', 'BA-2', 'BA-2', 'BA-2'];

function calcHorasFromDuracao(duracao: string): number {
  if (!duracao) return 0;
  const [h, m] = duracao.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h + m / 60;
}

function emptyPTRB(): Omit<PTRB, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> {
  return {
    data: hojeLocalISO(),
    horaInicio: '',
    horaTermino: '',
    duracao: '',
    horas: 0,
    equipe: '',
    turno: '',
    participantes: HIERARQUIA_EQUIPE.map(funcao => ({ funcao, nomeCompleto: '', situacao: 'P' })),
    observacoes: '',
    instrutor: '',
    assuntoMinistrado: '',
    descricao: '',
    informacoesComplementares: '',
    fotos: ['', '', ''],
  };
}

// ─── FORM ────────────────────────────────────────────────
function montarPTRBInicial(equipePadrao?: string | null): Omit<PTRB, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'> {
  const base = emptyPTRB();
  if (!equipePadrao || !EQUIPES_FILTRO.includes(equipePadrao as any)) return base;
  const horario = horarioPlantaoPorEquipe(equipePadrao);
  const duracao = calcDuracao(horario.horarioInicio, horario.horarioTermino);
  return {
    ...base,
    equipe: equipePadrao as Equipe,
    turno: horario.turno,
    horaInicio: horario.horarioInicio,
    horaTermino: horario.horarioTermino,
    duracao,
    horas: calcHorasFromDuracao(duracao),
  };
}

function PTRBAForm({
  ptrb,
  onSave,
  onCancel,
  bombeiros,
  feriasGozo,
  substituicoesTemporarias,
  trocaFills,
  vigencias,
  apocs,
  canEscolherEquipe,
  equipeEfetiva,
}: {
  ptrb?: PTRB;
  onSave: (data: Omit<PTRB, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>) => void;
  onCancel: () => void;
  bombeiros: Bombeiro[];
  feriasGozo: FeriasGozo[];
  substituicoesTemporarias: SubstituicaoTemporaria[];
  trocaFills: any[];
  vigencias: any[];
  apocs: APOC[];
  canEscolherEquipe: boolean;
  equipeEfetiva: string | null;
}) {
  const [form, setForm] = useState(() => montarPTRBInicial(canEscolherEquipe ? null : equipeEfetiva));

  useEffect(() => {
    if (ptrb) {
      setForm({
        data: ptrb.data,
        horaInicio: ptrb.horaInicio,
        horaTermino: ptrb.horaTermino,
        duracao: ptrb.duracao,
        horas: ptrb.horas || calcHorasFromDuracao(ptrb.duracao),
        equipe: ptrb.equipe,
        turno: ptrb.turno,
        participantes: ptrb.participantes,
        observacoes: ptrb.observacoes,
        instrutor: ptrb.instrutor,
        assuntoMinistrado: ptrb.assuntoMinistrado,
        descricao: ptrb.descricao,
        informacoesComplementares: ptrb.informacoesComplementares,
        fotos: ptrb.fotos.length ? ptrb.fotos : ['', '', ''],
      });
    } else if (!canEscolherEquipe && equipeEfetiva) {
      setForm(montarPTRBInicial(equipeEfetiva));
    }
  }, [ptrb, canEscolherEquipe, equipeEfetiva]);

  function updateEquipe(equipe: string) {
    if (!canEscolherEquipe) return;
    if (!equipe) {
      setForm(f => ({
        ...f,
        equipe: '',
        turno: '',
        horaInicio: '',
        horaTermino: '',
        duracao: '',
        horas: 0,
        participantes: HIERARQUIA_EQUIPE.map(funcao => ({ funcao, nomeCompleto: '', situacao: 'P' })),
        instrutor: '',
      }));
      return;
    }
    const horario = horarioPlantaoPorEquipe(equipe);
    const duracao = calcDuracao(horario.horarioInicio, horario.horarioTermino);
    setForm(f => ({
      ...f,
      equipe,
      turno: horario.turno,
      horaInicio: horario.horarioInicio,
      horaTermino: horario.horarioTermino,
      duracao,
      horas: calcHorasFromDuracao(duracao),
    }));
  }

  function updateHoraInicio(val: string) {
    setForm(f => {
      const duracao = calcDuracao(val, f.horaTermino);
      return { ...f, horaInicio: val, duracao, horas: calcHorasFromDuracao(duracao) };
    });
  }

  function updateHoraTermino(val: string) {
    setForm(f => {
      const duracao = calcDuracao(f.horaInicio, val);
      return { ...f, horaTermino: val, duracao, horas: calcHorasFromDuracao(duracao) };
    });
  }

  function updateParticipante(idx: number, field: keyof PTRBParticipante, value: string) {
    setForm(f => {
      const next = [...f.participantes];
      next[idx] = { ...next[idx], [field]: value };

      const instrutorIdx = next.findIndex(p => p.situacao === 'INSTR');
      const instrutor = instrutorIdx >= 0 ? next[instrutorIdx].nomeCompleto : '';

      return { ...f, participantes: next, instrutor };
    });
  }

  function addParticipante() {
    setForm(f => ({
      ...f,
      participantes: [...f.participantes, { funcao: '', nomeCompleto: '', situacao: 'P' }],
    }));
  }

  function removeParticipante(idx: number) {
    setForm(f => {
      const next = f.participantes.filter((_, i) => i !== idx);
      const instrutorIdx = next.findIndex(p => p.situacao === 'INSTR');
      const instrutor = instrutorIdx >= 0 ? next[instrutorIdx].nomeCompleto : '';
      return { ...f, participantes: next, instrutor };
    });
  }

  function handleFotoUpload(idx: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm(f => {
        const fotos = [...f.fotos];
        fotos[idx] = reader.result as string;
        return { ...f, fotos };
      });
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.equipe) {
      alert('Selecione a equipe.');
      return;
    }
    onSave(form);
  }

  const efetivoOperacional = useMemo(() => montarEfetivoOperacional({
    bombeiros,
    feriasGozo,
    vigencias,
    trocaFills,
    substituicoesTemporarias,
    equipe: form.equipe,
    dataPlantao: form.data,
  }), [bombeiros, feriasGozo, vigencias, trocaFills, substituicoesTemporarias, form.equipe, form.data]);

  const opcoesParticipantes: AtivoItem[] = useMemo(() => {
    const bombeirosList = montarOpcoesEfetivoOperacional(efetivoOperacional, form.equipe);
    const apocsList = apocs.map(a => ({
      id: a.id,
      nomeGuerra: a.nomeGuerra,
      nomeCompleto: a.nomeCompleto,
      cargo: 'APOC' as string,
      equipe: a.equipe,
    }));
    return [...bombeirosList, ...apocsList];
  }, [efetivoOperacional, form.equipe, apocs]);

  const ultimaAutoFill = useRef('');

  useEffect(() => {
    if (ptrb) return;
    const chave = `${form.equipe}-${form.data}`;
    if (ultimaAutoFill.current === chave) return;
    if (efetivoOperacional.length === 0) return;
    ultimaAutoFill.current = chave;

    const pool = efetivoOperacional.map(entry => ({
      nomeCompleto: entry.bombeiro.nomeCompleto,
      cargo: entry.cargoExercido,
    }));
    const novos = HIERARQUIA_EQUIPE.map(funcao => {
      const idx = pool.findIndex(p => p.cargo === funcao);
      if (idx >= 0) {
        const pessoa = pool[idx];
        pool.splice(idx, 1);
        return { funcao, nomeCompleto: pessoa.nomeCompleto, situacao: 'P' as const };
      }
      return { funcao, nomeCompleto: '', situacao: 'P' as const };
    });

    setForm(f => ({ ...f, participantes: novos }));
  }, [form.equipe, form.data, efetivoOperacional, ptrb]);

  const input = 'w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated';
  const inputDisabled = 'w-full rounded-xl border border-graphite-200/60 bg-graphite-100/50 px-3 py-2.5 text-sm text-graphite-400 dark:border-border-dark dark:bg-surface-card/50 dark:text-graphite-500';
  const label = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';
  const card = 'rounded-2xl border border-graphite-200/60 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-border-dark dark:bg-surface-card/80';
  const cardTitle = 'mb-5 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-aviation-600 dark:text-aviation-400';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Card 1: Informações Gerais */}
      <div className={card}>
        <h2 className={cardTitle}><FileText className="h-4 w-4" /> Informações Gerais</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className={label}>Data</label>
            <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className={input} />
          </div>
          <div>
            <label className={label}>Hora Início</label>
            <input type="time" value={form.horaInicio} onChange={e => updateHoraInicio(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Hora Término</label>
            <input type="time" value={form.horaTermino} onChange={e => updateHoraTermino(e.target.value)} className={input} />
          </div>
          <div>
            <label className={label}>Duração</label>
            <input value={form.duracao} disabled className={inputDisabled} />
          </div>
          <div>
            <label className={label}>Equipe</label>
            <select value={form.equipe} onChange={e => updateEquipe(e.target.value)} className={input} disabled={!canEscolherEquipe}>
              <option value="">Selecione equipe</option>
              {EQUIPES_FILTRO.filter(eq => canEscolherEquipe || eq === equipeEfetiva).map(eq => <option key={eq} value={eq}>{eq}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Turno</label>
            <input value={form.turno} disabled className={inputDisabled} />
          </div>
        </div>
      </div>

      {/* Card 2: Participantes e Instrutor */}
      <div className={card}>
        <h2 className={cardTitle}><Plus className="h-4 w-4" /> Participantes</h2>
        <div className="space-y-3">
          {form.participantes.map((p, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 rounded-xl border border-graphite-200/60 bg-graphite-50/50 p-3 dark:border-border-dark dark:bg-surface-card/50">
              <div className="min-w-0 flex-1 sm:min-w-36">
                <label className={label}>Função</label>
                <select value={p.funcao} onChange={e => updateParticipante(i, 'funcao', e.target.value)} className={input}>
                  <option value="">Selecione</option>
                  {FUNCAO_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="min-w-0 flex-[2] sm:min-w-48">
                <label className={label}>Nome Completo</label>
                <SearchSelect
                  value={p.nomeCompleto}
                  onChange={v => updateParticipante(i, 'nomeCompleto', v)}
                  placeholder="Selecione o nome"
                  cargo={p.funcao || undefined}
                  valueField="nomeCompleto"
                  options={opcoesParticipantes}
                />
              </div>
              <div className="min-w-0 flex-1 sm:min-w-28">
                <label className={label}>Situação</label>
                <select
                  value={p.situacao}
                  onChange={e => updateParticipante(i, 'situacao', e.target.value)}
                  className={input}
                  title={SITUACOES_TOOLTIP}
                >
                  {SITUACOES.map(s => (
                    <option key={s} value={s} title={SITUACAO_DESCRICOES[s] || s}>{s}</option>
                  ))}
                </select>
              </div>
              {i >= HIERARQUIA_EQUIPE.length && (
                <button type="button" onClick={() => removeParticipante(i)}
                  className="mb-0.5 rounded-xl p-2 text-alert-red transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addParticipante}
          className="mt-3 flex items-center gap-1 text-sm font-medium text-aviation-600 transition-colors hover:text-aviation-700 dark:text-aviation-400">
          <Plus className="h-4 w-4" /> Adicionar participante
        </button>
        <div className="mt-4 max-w-xs">
          <label className={label}>Instrutor</label>
          <input value={form.instrutor} readOnly className={inputDisabled} />
        </div>
      </div>

      {/* Card 3: Atividades */}
      <div className={card}>
        <h2 className={cardTitle}><FileText className="h-4 w-4" /> Atividades</h2>
        <div className="space-y-5">
          <div>
            <label className={label}>Assunto Ministrado</label>
            <select value={form.assuntoMinistrado} onChange={e => setForm(f => ({ ...f, assuntoMinistrado: e.target.value }))} className={input}>
              <option value="">Selecione</option>
              {ASSUNTOS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>ATIVIDADES DESENVOLVIDAS</label>
            <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={5} className={input + ' resize-y'} />
          </div>
          <div>
            <label className={label}>Informações Complementares</label>
            <textarea value={form.informacoesComplementares} onChange={e => setForm(f => ({ ...f, informacoesComplementares: e.target.value }))} rows={4} className={input + ' resize-y'} />
          </div>
        </div>
      </div>

      {/* Card 4: Fotos */}
      <div className={card}>
        <h2 className={cardTitle}><Image className="h-4 w-4" /> EVIDÊNCIAS</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map(idx => (
            <div key={idx}
              className="flex aspect-video cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-graphite-300/60 bg-graphite-100/30 backdrop-blur-sm transition-all duration-200 hover:border-aviation-400/50 dark:border-border-dark dark:bg-surface-card/30"
              onClick={() => document.getElementById(`foto-${idx}`)?.click()}>
              {form.fotos[idx] ? (
                <img src={form.fotos[idx]} alt={`Foto ${idx + 1}`} className="h-full w-full rounded-lg object-cover" />
              ) : (
                <div className="text-center">
                  <Image className="mx-auto h-8 w-8 text-graphite-400" />
                  <p className="mt-1 text-xs text-graphite-400">Clique para adicionar</p>
                </div>
              )}
              <input id={`foto-${idx}`} type="file" accept="image/*" className="hidden" onChange={e => handleFotoUpload(idx, e)} />
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-graphite-200 pt-6 dark:border-border-dark">
        <button type="button" onClick={onCancel}
          className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2 text-sm font-medium text-graphite-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-graphite-50 hover:border-graphite-300 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200 dark:hover:bg-surface-hover/50">
          Cancelar
        </button>
        <button type="submit"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
          <Save className="h-4 w-4" />
          {ptrb ? 'Salvar Alterações' : 'Criar PTR-BA por Instrução'}
        </button>
      </div>
    </form>
  );
}

// ─── LIST VIEW ──────────────────────────────────────────────
function PTRBCard({ ptrb, onView, onEdit, onDelete, onClone, canEdit, canClone, canDelete, auditoriaPessoas }: {
  ptrb: PTRB;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClone: () => void;
  canEdit: boolean;
  canClone: boolean;
  canDelete: boolean;
  auditoriaPessoas: Bombeiro[];
}) {
  const [expanded, setExpanded] = useState(false);
  const auditoria = resumoAuditoria(ptrb, auditoriaPessoas);

  return (
    <div className="rounded-2xl border border-graphite-200/60 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-aviation-50 to-aviation-100 dark:from-aviation-900/30 dark:to-aviation-800/20">
            <FileText className="h-5 w-5 text-aviation-600 dark:text-aviation-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">
              PTR-BA por Instrução - {ptrb.equipe} - {formatDate(ptrb.data)}
            </p>
            <p className="text-xs text-graphite-500 dark:text-graphite-400">
              {ptrb.turno} · {ptrb.horaInicio} às {ptrb.horaTermino} ({ptrb.duracao}h)
            </p>
            <p className="text-xs text-graphite-500 dark:text-graphite-400">{auditoria}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onView} title="Visualizar"
            className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
            <Eye className="h-4 w-4" />
          </button>
          {canEdit && (
            <>
              <button onClick={onEdit} title="Editar"
                className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
                <Pencil className="h-4 w-4" />
              </button>
              {canClone && (
                <button onClick={onClone} title="Clonar"
                  className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
                  <Copy className="h-4 w-4" />
                </button>
              )}
              {canDelete && (
                <button onClick={onDelete} title="Excluir"
                  className="rounded-xl p-1.5 text-alert-red transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </>
          )}
          <button onClick={() => setExpanded(!expanded)}
            className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-graphite-200 pt-4 dark:border-border-dark">
          {ptrb.participantes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-aviation-600 dark:text-aviation-400">Participantes</p>
              <div className="mt-1 space-y-1">
                {ptrb.participantes.map((p, i) => (
                  <p key={i} className="text-sm">{p.funcao || '-'}: {p.nomeCompleto || '-'} ({p.situacao})</p>
                ))}
              </div>
            </div>
          )}
          {ptrb.observacoes && (
            <div>
              <p className="text-xs font-semibold text-aviation-600 dark:text-aviation-400">Observações</p>
              <p className="text-sm dark:text-graphite-100">{ptrb.observacoes}</p>
            </div>
          )}
          {ptrb.instrutor && (
            <div>
              <p className="text-xs font-semibold text-aviation-600 dark:text-aviation-400">Instrutor</p>
              <p className="text-sm dark:text-graphite-100">{ptrb.instrutor}</p>
            </div>
          )}
          {ptrb.assuntoMinistrado && (
            <div>
              <p className="text-xs font-semibold text-aviation-600 dark:text-aviation-400">Assunto Ministrado</p>
              <p className="text-sm dark:text-graphite-100">{ptrb.assuntoMinistrado}</p>
            </div>
          )}
          {ptrb.descricao && (
            <div>
              <p className="text-xs font-semibold text-aviation-600 dark:text-aviation-400">Descrição</p>
              <p className="text-sm whitespace-pre-wrap dark:text-graphite-100">{ptrb.descricao}</p>
            </div>
          )}
          {ptrb.informacoesComplementares && (
            <div>
              <p className="text-xs font-semibold text-aviation-600 dark:text-aviation-400">Informações Complementares</p>
              <p className="text-sm whitespace-pre-wrap dark:text-graphite-100">{ptrb.informacoesComplementares}</p>
            </div>
          )}
          {ptrb.fotos.some(f => f) && (
            <div>
              <p className="text-xs font-semibold text-aviation-600 dark:text-aviation-400">Fotos</p>
              <div className="mt-1 flex gap-2">
                {ptrb.fotos.filter(f => f).map((f, i) => (
                  <img key={i} src={f} alt={`Foto ${i + 1}`} className="h-20 w-20 rounded-lg object-cover" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── VIEW MODE ──────────────────────────────────────────────
function ViewMode({ ptrb, onBack, auditoriaPessoas }: { ptrb: PTRB; onBack: () => void; auditoriaPessoas: Bombeiro[] }) {
  const auditoria = resumoAuditoria(ptrb, auditoriaPessoas);
  return (
    <div>
      <div className="mb-6 flex items-center justify-between print-hidden">
        <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">
          PTR-BA por Instrução - {ptrb.equipe} - {formatDate(ptrb.data)}
        </h3>
        <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">{auditoria}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => {
            if (ptrb.data) {
              document.title = `${formatarDataArquivo(ptrb.data)} NVT PTRBA ${String(ptrb.equipe).toLocaleUpperCase('pt-BR')}`;
            }
            window.print();
          }}
            className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-3 py-1.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
            <Printer className="h-4 w-4" /> Imprimir
          </button>
          <button onClick={onBack}
            className="rounded-xl border border-graphite-300/60 bg-white/80 px-3 py-1.5 text-sm font-medium text-graphite-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-graphite-50 hover:border-graphite-300 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200 dark:hover:bg-surface-hover/50">
            Fechar
          </button>
        </div>
      </div>
      <div id="print-area" className="rounded-2xl border border-graphite-200/60 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-border-dark dark:bg-surface-card print:border-none print:shadow-none">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs text-graphite-400">Data</p>
            <p className="text-sm font-medium dark:text-graphite-100">{formatDate(ptrb.data)}</p>
          </div>
          <div>
            <p className="text-xs text-graphite-400">Equipe</p>
            <p className="text-sm font-medium dark:text-graphite-100">{ptrb.equipe}</p>
          </div>
          <div>
            <p className="text-xs text-graphite-400">Horário</p>
            <p className="text-sm font-medium dark:text-graphite-100">{ptrb.horaInicio} às {ptrb.horaTermino} ({ptrb.duracao}h)</p>
          </div>
          <div>
            <p className="text-xs text-graphite-400">Turno</p>
            <p className="text-sm font-medium dark:text-graphite-100">{ptrb.turno}</p>
          </div>
        </div>

        {ptrb.participantes.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 text-xs font-semibold text-aviation-600 dark:text-aviation-400">Participantes</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-graphite-200 dark:border-border-dark">
                  <th className="px-3 py-1.5 text-left text-xs text-graphite-500 dark:text-graphite-400">Função</th>
                  <th className="px-3 py-1.5 text-left text-xs text-graphite-500 dark:text-graphite-400">Nome</th>
                  <th className="px-3 py-1.5 text-left text-xs text-graphite-500 dark:text-graphite-400">Situação</th>
                </tr>
              </thead>
              <tbody>
                {ptrb.participantes.map((p, i) => (
                  <tr key={i} className="border-b border-graphite-100 dark:border-border-dark">
                    <td className="px-3 py-1.5 dark:text-graphite-100">{p.funcao || '-'}</td>
                    <td className="px-3 py-1.5 dark:text-graphite-100">{p.nomeCompleto || '-'}</td>
                    <td className="px-3 py-1.5 dark:text-graphite-100">{p.situacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {ptrb.observacoes && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-semibold text-aviation-600 dark:text-aviation-400">Observações</p>
            <p className="text-sm whitespace-pre-wrap dark:text-graphite-100">{ptrb.observacoes}</p>
          </div>
        )}

        {ptrb.instrutor && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-semibold text-aviation-600 dark:text-aviation-400">Instrutor</p>
            <p className="text-sm dark:text-graphite-100">{ptrb.instrutor}</p>
          </div>
        )}

        {ptrb.assuntoMinistrado && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-semibold text-aviation-600 dark:text-aviation-400">Assunto Ministrado</p>
            <p className="text-sm dark:text-graphite-100">{ptrb.assuntoMinistrado}</p>
          </div>
        )}

        {ptrb.descricao && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-semibold text-aviation-600 dark:text-aviation-400">Descrição</p>
            <p className="text-sm whitespace-pre-wrap dark:text-graphite-100">{ptrb.descricao}</p>
          </div>
        )}

        {ptrb.informacoesComplementares && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-semibold text-aviation-600 dark:text-aviation-400">Informações Complementares</p>
            <p className="text-sm whitespace-pre-wrap dark:text-graphite-100">{ptrb.informacoesComplementares}</p>
          </div>
        )}

        {ptrb.fotos.some(f => f) && (
          <div>
            <p className="mb-1 text-xs font-semibold text-aviation-600 dark:text-aviation-400">Fotos</p>
            <div className="grid grid-cols-3 gap-4">
              {ptrb.fotos.filter(f => f).map((f, i) => (
                <img key={i} src={f} alt={`Foto ${i + 1}`} className="w-full rounded-lg object-cover" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────
export function PTRBADiario() {
  const { user, contexto, equipeEfetiva } = useContextoOperacional();
  const username = user?.username || '';
  const podeCriar = canCriarRegistrosDiarios(contexto);
  const canCreate = podeCriar;
  const canEscolherEquipe = canEscolherEquipeRegistrosDiarios(contexto);
  const equipePadrao = equipePadraoRegistrosDiarios(contexto) || equipeEfetiva;
  const [ptrbs, setPtrbs] = useState<PTRB[]>([]);
  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [feriasGozo, setFeriasGozo] = useState<FeriasGozo[]>([]);
  const [substituicoesTemporarias, setSubstituicoesTemporarias] = useState<SubstituicaoTemporaria[]>([]);
  const [trocaFills, setTrocaFills] = useState<any[]>([]);
  const [vigencias, setVigencias] = useState<any[]>([]);
  const [apocs, setApocs] = useState<APOC[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'list' | 'form' | 'view'>('list');
  const [editando, setEditando] = useState<PTRB | null>(null);
  const [visualizando, setVisualizando] = useState<PTRB | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const ANOS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
  const inputClass = 'rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated';

  const ptrbsFiltradas = ptrbs.filter(e => {
    if (filtroEquipe && e.equipe !== filtroEquipe) return false;
    if (filtroMes) {
      const d = new Date(e.data);
      if ((d.getMonth() + 1).toString() !== filtroMes) return false;
    }
    if (filtroAno && !e.data.startsWith(filtroAno)) return false;
    return true;
  });

  async function carregar() {
    try {
      const todas = await listarPTRBs();
      setPtrbs(todas);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao carregar PTR-BAs');
    }
  }

  async function carregarApoio() {
    try {
      const [b, f, subs, docs, a, vigs] = await Promise.all([
        listarBombeiros(),
        listarFeriasGozo(),
        listarSubstituicoesTemporarias(),
        listarDocumentos(),
        listarAPOCs(),
        listarVigencias({ ativa: true }),
      ]);
      setBombeiros(b);
      setFeriasGozo(f);
      setSubstituicoesTemporarias(subs);
      setApocs(a);
      setVigencias(vigs);
      const trocaDoc = docs.find((d: any) => d.name?.includes('TROCA') || d.source_module === 'trocas');
      if (trocaDoc) {
        const fills = await listarPreenchimentos(trocaDoc.id);
        setTrocaFills(fills.filter((fl: any) => fl.status === 'signed'));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao carregar dados de apoio');
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      await carregar();
      await carregarApoio();
      if (!cancelled) setLoading(false);
    }
    init();
    return () => { cancelled = true; };
  }, [username]);

  async function handleSave(data: Omit<PTRB, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>) {
    try {
      if (editando?.id) {
        if (!canEditarRegistroDiario(contexto, editando, username, bombeiros)) {
          alert('Você só pode editar PTR-BA que você criou, que foi criado pelo chefe no caso de BA-LR, ou que pertence à sua equipe fixa autorizada.');
          return;
        }
      } else if (!canCriarRegistrosDiarios(contexto)) {
        alert('Você não tem permissão para criar PTR-BA por Instrução.');
        return;
      }
      const equipeAlvo = canEscolherEquipe ? data.equipe : equipePadrao || data.equipe;
      const payload = { ...data, equipe: equipeAlvo as Equipe };
      let saved: PTRB | null;
      if (editando && editando.id) {
        saved = await atualizarPTRB(editando.id, { ...payload, updatedBy: username });
      } else {
        saved = await criarPTRB({ ...payload, createdBy: username });
      }
      setEditando(null);
      await carregar();
      if (saved) {
        setVisualizando(saved);
        setMode('view');
      } else {
        setMode('list');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar PTR-BA');
    }
  }

  function handleClone(e: PTRB) {
    if (!canCriarRegistrosDiarios(contexto)) {
      alert('Você não tem permissão para criar um novo PTR-BA por Instrução.');
      return;
    }
    if (!canEditarRegistroDiario(contexto, e, username, bombeiros)) {
      alert('Você só pode clonar PTR-BA que você criou (ou que seu chefe de equipe criou, no caso de BA-LR).');
      return;
    }
    setEditando({
      ...e,
      id: '',
      createdAt: '',
      updatedAt: '',
      createdBy: '',
      updatedBy: '',
      data: hojeLocalISO(),
      observacoes: '',
      instrutor: '',
      assuntoMinistrado: '',
      descricao: '',
      informacoesComplementares: '',
      fotos: ['', '', ''],
    });
    setMode('form');
  }

  async function handleDelete(id: string) {
    try {
      const alvo = ptrbs.find(e => e.id === id);
      if (!alvo || !canExcluirRegistroDiario(contexto, alvo, username, bombeiros)) {
        alert('Você só pode excluir PTR-BA que você criou (ou que seu chefe de equipe criou, no caso de BA-LR).');
        setConfirmDelete(null);
        return;
      }
      await excluirPTRB(id);
      setConfirmDelete(null);
      await carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir PTR-BA');
    }
  }

  if (!podeCriar) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Lock className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Acesso restrito</h3>
          <p className="text-sm text-graphite-400 dark:text-graphite-500">Esta tela está disponível apenas para administradores, desenvolvedores e chefes de equipe (BA-CE/BA-LR) do sistema.</p>
        </div>
      </PageContainer>
    );
  }

  if (mode === 'form') {
    return (
      <PageContainer>
        <PageTitle icon={FileText} title={`PTR-BA por Instrução - ${editando?.id ? 'Editar' : editando && !editando.id ? 'Clonar' : 'Novo'} Registro`} />
        <PTRBAForm
          ptrb={editando || undefined}
          onSave={handleSave}
          onCancel={() => { setMode('list'); setEditando(null); }}
          bombeiros={bombeiros}
          feriasGozo={feriasGozo}
          substituicoesTemporarias={substituicoesTemporarias}
          trocaFills={trocaFills}
          vigencias={vigencias}
          apocs={apocs}
          canEscolherEquipe={canEscolherEquipe}
          equipeEfetiva={equipePadrao}
        />
      </PageContainer>
    );
  }

  if (mode === 'view' && visualizando) {
    return (
      <PageContainer>
        <ViewMode ptrb={visualizando} auditoriaPessoas={bombeiros} onBack={() => setMode('list')} />
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <PageTitle icon={FileText} title="PTR-BA por Instrução" />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle icon={FileText} title="PTR-BA por Instrução" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={inputClass}>
            <option value="">Todos os anos</option>
            {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className={inputClass}>
            <option value="">Todos os meses</option>
            {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)} className={inputClass}>
            <option value="">Todas as equipes</option>
            {EQUIPES_FILTRO.map(eq => <option key={eq} value={eq}>{eq}</option>)}
          </select>
          <p className="text-sm text-graphite-500 dark:text-graphite-400">
            {ptrbsFiltradas.length} registro(s)
          </p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditando(null); setMode('form'); }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
            <Plus className="h-4 w-4" /> Novo PTR-BA por Instrução
          </button>
        )}
      </div>

      {ptrbsFiltradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
          <FileText className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum registro encontrado</h3>
          <p className="text-sm text-graphite-400">{canCreate ? 'Clique em "Novo PTR-BA por Instrução" para criar o primeiro.' : 'Nenhum registro disponível.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ptrbsFiltradas.map(e => {
            const podeAlterar = canEditarRegistroDiario(contexto, e, username, bombeiros);
            const podeExcluir = canExcluirRegistroDiario(contexto, e, username, bombeiros);
            return (
              <PTRBCard
                key={e.id}
                ptrb={e}
                canEdit={podeAlterar}
                canClone={podeAlterar && canCriarRegistrosDiarios(contexto)}
                canDelete={podeExcluir}
                auditoriaPessoas={bombeiros}
                onView={() => { setVisualizando(e); setMode('view'); }}
                onEdit={() => { setEditando(e); setMode('form'); }}
                onClone={() => handleClone(e)}
                onDelete={() => setConfirmDelete(e.id)}
              />
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white/95 p-6 shadow-xl shadow-black/5 backdrop-blur-sm dark:bg-surface-elevated/95 dark:shadow-black/20">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            <p className="mb-6 text-sm text-graphite-500 dark:text-graphite-400">Tem certeza que deseja excluir este PTR-BA por Instrução?</p>
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
      <PageTour
        steps={PTRBA_INSTRUCAO_TOUR_STEPS}
        targetAttribute="data-ptrba-instrucao-tour"
        title="Abrir tutorial de PTR-BA por Instrução"
        detailLabel="Registro"
      />
    </PageContainer>
  );
}

export default PTRBADiario;
