import { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle, Plus, Save, Eye, Pencil, Trash2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarOcorrencias, criarOcorrencia, atualizarOcorrencia, excluirOcorrencia } from '../../services/ocorrenciaService';
import { STATUS_OCORRENCIA, EQUIPES } from '../../types/ocorrencia';
import type { Ocorrencia } from '../../types/ocorrencia';
import { hojeLocalISO } from '../../utils/datas';
import { PageTour } from '../../components/ui/PageTour';

const MENSAGEM_OCORRENCIA_LRO_FINALIZADO = 'Esta ocorrência já foi incluída em um LRO finalizado e não pode ser alterada.';
const MENSAGEM_EXCLUIR_OCORRENCIA_LRO_FINALIZADO = 'Esta ocorrência já foi incluída em um LRO finalizado e não pode ser excluída.';

const LRO_OCORRENCIAS_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'LRO/Ocorrências',
    body: 'Esta tela registra ocorrências simples que entram na seção de ocorrências do LRO.',
    detail: 'Use para informações do plantão que precisam aparecer no Livro de Registro Operacional, mas não são BONA/REA formais.',
  },
  {
    selector: 'main select',
    title: 'Filtros de período, equipe e status',
    body: 'Filtre por ano, mês, status e equipe para localizar registros do plantão ou conferir o que já foi fechado.',
    detail: 'Ocorrências fechadas por LRO finalizado ficam bloqueadas para edição e exclusão, preservando o documento já emitido.',
  },
  {
    selector: 'main button',
    title: 'Nova ocorrência',
    body: 'O botão Nova Ocorrência abre o formulário de registro.',
    detail: 'Informe data, data do turno, hora, equipe, tipo e descrição. A data do turno é importante para o LRO puxar o registro no plantão correto.',
  },
  {
    selector: 'main .space-y-3',
    title: 'Cards das ocorrências',
    body: 'Os cards mostram tipo, data, hora, equipe, turno e status. Clique no card para expandir.',
    detail: 'Ao expandir, você pode ver detalhes, editar ou excluir quando tem permissão e quando a ocorrência ainda não foi fechada por um LRO finalizado.',
  },
  {
    selector: 'main textarea, main input',
    title: 'Descrição do registro',
    body: 'No formulário, descreva a ocorrência com linguagem clara e objetiva.',
    detail: 'Evite deixar informação vaga: quem lê o LRO depois precisa entender o que aconteceu, quando aconteceu e qual equipe registrou.',
  },
];

function ocorrenciaBloqueadaPorLRO(ocorrencia?: Pick<Ocorrencia, 'status'> | null): boolean {
  return ocorrencia?.status === 'Fechada';
}

function ocorrenciaPertenceAoLRO(ocorrencia: Pick<Ocorrencia, 'numero'>): boolean {
  return !ocorrencia.numero?.trim();
}



function emptyOcorrencia(): Omit<Ocorrencia, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> {
  const hoje = hojeLocalISO();
  return {
    tipoDocumento: 'BONA',
    numero: '',
    data: hoje,
    hora: new Date().toTimeString().split(':').slice(0, 2).join(':'),
    equipe: '',
    turno: '',
    categoria: 'Outros',
    titulo: '',
    descricao: '',
    local: hoje,
    envolvidos: '',
    acoesTomadas: '',
    status: 'Aberta',
    fotos: [],
  };
}

/* ───────── Formulário ───────── */

function OcorrenciaForm({
  ocorrencia,
  userEquipe,
  canManageGlobal,
  onSave,
  onCancel,
}: {
  ocorrencia?: Ocorrencia;
  userEquipe: string;
  canManageGlobal: boolean;
  onSave: (data: Omit<Ocorrencia, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(ocorrencia ? {
    tipoDocumento: ocorrencia.tipoDocumento, numero: ocorrencia.numero,
    data: ocorrencia.data, hora: ocorrencia.hora, equipe: ocorrencia.equipe,
    turno: ocorrencia.turno, categoria: ocorrencia.categoria, titulo: ocorrencia.titulo,
    descricao: ocorrencia.descricao, local: ocorrencia.local || ocorrencia.data, envolvidos: ocorrencia.envolvidos,
    acoesTomadas: ocorrencia.acoesTomadas, status: ocorrencia.status, fotos: ocorrencia.fotos,
  } : { ...emptyOcorrencia(), equipe: userEquipe });

  const input = 'w-full rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:placeholder:text-graphite-500 dark:scheme-dark';
  const select = input;
  const label = 'block mb-1.5 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

  function handleDataChange(value: string) {
    setForm(f => ({ ...f, data: value, local: f.local === f.data ? value : f.local }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-8 sm:pt-16">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white/95 shadow-2xl shadow-black/10 backdrop-blur-sm dark:bg-surface-elevated/95">
        <div className="flex items-center justify-between border-b border-graphite-200/60 px-6 py-4 dark:border-border-dark">
          <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{ocorrencia ? 'Editar Ocorrência' : 'Nova Ocorrência'}</h2>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-graphite-400 transition-colors hover:bg-graphite-100 hover:text-graphite-600 dark:text-graphite-500 dark:hover:bg-surface-hover dark:hover:text-graphite-300">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={label}>Data *</label>
              <input type="date" value={form.data} onChange={e => handleDataChange(e.target.value)} className={input} />
            </div>
            <div>
              <label className={label}>Data do Turno *</label>
              <input type="date" value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} className={input} />
            </div>
            <div>
              <label className={label}>Hora *</label>
              <input type="time" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} className={input} />
            </div>
            <div>
              <label className={label}>Equipe *</label>
              <select value={form.equipe} onChange={e => setForm(f => ({ ...f, equipe: e.target.value }))} className={select} disabled={!canManageGlobal}>
                <option value="">Selecione</option>
                {EQUIPES.filter(eq => canManageGlobal || eq === userEquipe).map(eq => <option key={eq} value={eq}>{eq}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className={label}>Tipo *</label>
              <input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} className={input} placeholder="Tipo da ocorrência" />
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <label className={label}>Descrição</label>
              <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={5} className={input + ' resize-y'} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-graphite-200/60 px-6 py-4 dark:border-border-dark">
          <button onClick={onCancel} className="rounded-xl border border-graphite-300/60 bg-white/80 px-5 py-2.5 text-sm font-medium text-graphite-700 transition-colors hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200 dark:hover:bg-surface-hover">Cancelar</button>
          <button onClick={() => onSave(form)} disabled={!form.data || !form.local || !form.hora || !form.equipe || !form.titulo.trim() || !form.descricao.trim()}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl hover:from-aviation-500 hover:to-aviation-600 disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="h-4 w-4" /> Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Visualização ───────── */

function OcorrenciaView({ ocorrencia, onBack }: { ocorrencia: Ocorrencia; onBack: () => void }) {
  const label = 'text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';
  const value = 'text-sm text-graphite-900 dark:text-graphite-100';

  const statusColor: Record<string, string> = {
    'Aberta': 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    'Em Andamento': 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    'Fechada': 'bg-status-green/10 text-status-green',
  };

  return (
    <div className="rounded-2xl border border-graphite-200/60 bg-white/80 p-6 shadow-sm backdrop-blur-sm dark:border-border-dark dark:bg-surface-card/80">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{ocorrencia.titulo || 'Ocorrência'}</h3>
          <p className="mt-1 text-sm text-graphite-500 dark:text-graphite-400">{ocorrencia.data} {ocorrencia.hora && `às ${ocorrencia.hora}`}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor[ocorrencia.status] || ''}`}>{ocorrencia.status}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div><p className={label}>Equipe</p><p className={value}>{ocorrencia.equipe}</p></div>
        <div><p className={label}>Data do Turno</p><p className={value}>{ocorrencia.local || '—'}</p></div>
        <div><p className={label}>Tipo</p><p className={value}>{ocorrencia.titulo || '—'}</p></div>
      </div>

      {ocorrencia.descricao && (
        <div className="mt-4"><p className={label}>Descrição</p><p className={value + ' mt-1 whitespace-pre-wrap'}>{ocorrencia.descricao}</p></div>
      )}

      <div className="mt-6 flex justify-end">
        <button onClick={onBack} className="rounded-xl border border-graphite-300/60 bg-white/80 px-5 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">Voltar</button>
      </div>
    </div>
  );
}

/* ───────── Card ───────── */

function OcorrenciaCard({
  o, canEdit, onView, onEdit, onDelete,
}: {
  o: Ocorrencia; canEdit: boolean;
  onView: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusColor: Record<string, string> = {
    'Aberta': 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    'Em Andamento': 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    'Fechada': 'bg-status-green/10 text-status-green',
  };

  return (
    <div className="rounded-2xl border border-graphite-200/60 bg-white/80 shadow-sm backdrop-blur-sm transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card/80">
      <button onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h4 className="truncate text-sm font-bold text-graphite-900 dark:text-graphite-100">{o.titulo || 'Ocorrência'}</h4>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${statusColor[o.status] || ''}`}>{o.status}</span>
            <span className="shrink-0 rounded-full bg-aviation-50 px-2.5 py-0.5 text-[10px] font-medium text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">{o.titulo || o.categoria}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-graphite-500 dark:text-graphite-400">
            <span>{o.data}</span>
            {o.hora && <span>às {o.hora}</span>}
            <span>Equipe {o.equipe}</span>
            {o.local && <span>· Turno {o.local}</span>}
          </div>
        </div>
        {expanded ? <ChevronUp className="ml-2 h-4 w-4 shrink-0 text-graphite-400" /> : <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-graphite-400" />}
      </button>

      {expanded && (
        <div className="border-t border-graphite-200/60 px-5 py-4 dark:border-border-dark">
          {o.descricao && <p className="mb-2 text-sm text-graphite-700 dark:text-graphite-300 whitespace-pre-wrap">{o.descricao}</p>}
          <div className="mt-4 flex items-center gap-2">
            <button onClick={onView} className="flex items-center gap-1 rounded-lg bg-aviation-50 px-3 py-1.5 text-xs font-medium text-aviation-700 transition-colors hover:bg-aviation-100 dark:bg-aviation-900/30 dark:text-aviation-300 dark:hover:bg-aviation-900/50">
              <Eye className="h-3.5 w-3.5" /> Ver
            </button>
            {canEdit && (
              <>
                <button onClick={onEdit} className="flex items-center gap-1 rounded-lg bg-graphite-100 px-3 py-1.5 text-xs font-medium text-graphite-700 transition-colors hover:bg-graphite-200 dark:bg-surface-hover dark:text-graphite-300 dark:hover:bg-surface-hover">
                  <Pencil className="h-3.5 w-3.5" /> Editar
                </button>
                <button onClick={onDelete} className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-alert-red transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30">
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Página principal ───────── */

export function LROOcorrencias() {
  const { user, canManageGlobal, canManageEquipe, equipeEfetiva } = useContextoOperacional();
  const username = user?.username || '';
  const canCreate = canManageGlobal || !!equipeEfetiva;

  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [mode, setMode] = useState<'list' | 'form' | 'view'>('list');
  const [editando, setEditando] = useState<Ocorrencia | null>(null);
  const [visualizando, setVisualizando] = useState<Ocorrencia | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [filtroMes, setFiltroMes] = useState((new Date().getMonth() + 1).toString());
  const [filtroEquipe, setFiltroEquipe] = useState('');

  const [filtroStatus, setFiltroStatus] = useState('');
  const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const ANOS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
  const inputClass = 'rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark';

  async function carregar() {
    const registros = await listarOcorrencias();
    setOcorrencias(registros.filter(ocorrenciaPertenceAoLRO));
  }
  useEffect(() => { carregar(); }, []);

  const filtradas = useMemo(() => {
    let list = ocorrencias.filter(ocorrenciaPertenceAoLRO);
    if (filtroEquipe) {
      list = list.filter(o => o.equipe === filtroEquipe);
    }
    if (filtroStatus) {
      list = list.filter(o => o.status === filtroStatus);
    }
    if (filtroAno) {
      list = list.filter(o => o.data.startsWith(filtroAno));
    }
    if (filtroMes) {
      list = list.filter(o => {
        const d = new Date(o.data);
        return (d.getMonth() + 1).toString() === filtroMes;
      });
    }
    return list;
  }, [ocorrencias, filtroEquipe, filtroStatus, filtroAno, filtroMes]);

  async function handleSave(data: Omit<Ocorrencia, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) {
    if (editando?.id && ocorrenciaBloqueadaPorLRO(editando)) {
      alert(MENSAGEM_OCORRENCIA_LRO_FINALIZADO);
      return;
    }
    const equipeAlvo = canManageGlobal ? data.equipe : equipeEfetiva || data.equipe;
    if (!canManageEquipe(equipeAlvo)) {
      alert('Você só pode salvar ocorrências da sua equipe efetiva.');
      return;
    }
    if (editando?.id && !canManageEquipe(editando.equipe)) {
      alert('Você só pode editar ocorrências da sua equipe efetiva.');
      return;
    }
    const payload = { ...data, equipe: equipeAlvo as string, numero: '' };
    if (editando && editando.id) {
      await atualizarOcorrencia(editando.id, payload);
    } else {
      await criarOcorrencia({ ...payload, createdBy: username });
    }
    carregar();
    setEditando(null);
    setMode('list');
  }

  async function handleDelete(id: string) {
    const alvo = ocorrencias.find(o => o.id === id);
    if (!alvo || !canManageEquipe(alvo.equipe)) {
      alert('Você só pode excluir ocorrências da sua equipe efetiva.');
      setConfirmDelete(null);
      return;
    }
    if (ocorrenciaBloqueadaPorLRO(alvo)) {
      alert(MENSAGEM_EXCLUIR_OCORRENCIA_LRO_FINALIZADO);
      setConfirmDelete(null);
      return;
    }
    await excluirOcorrencia(id);
    setConfirmDelete(null);
    carregar();
  }

  function handleEdit(ocorrencia: Ocorrencia) {
    if (ocorrenciaBloqueadaPorLRO(ocorrencia)) {
      alert(MENSAGEM_OCORRENCIA_LRO_FINALIZADO);
      return;
    }
    setEditando(ocorrencia);
    setMode('form');
  }

  function handleConfirmDelete(ocorrencia: Ocorrencia) {
    if (ocorrenciaBloqueadaPorLRO(ocorrencia)) {
      alert(MENSAGEM_EXCLUIR_OCORRENCIA_LRO_FINALIZADO);
      return;
    }
    setConfirmDelete(ocorrencia.id);
  }

  if (mode === 'form') {
    return (
      <PageContainer>
        <PageTitle icon={AlertCircle} title={editando ? 'Editar Ocorrência' : 'Nova Ocorrência'} />
        <OcorrenciaForm
          ocorrencia={editando || undefined}
          userEquipe={equipeEfetiva || ''}
          canManageGlobal={canManageGlobal}
          onSave={handleSave}
          onCancel={() => { setMode('list'); setEditando(null); }}
        />
        <PageTour
          steps={LRO_OCORRENCIAS_TOUR_STEPS}
          targetAttribute="data-lro-ocorrencias-tour"
          title="Abrir tutorial de LRO/Ocorrências"
          detailLabel="Entrada no LRO"
        />
      </PageContainer>
    );
  }

  if (mode === 'view' && visualizando) {
    return (
      <PageContainer>
        <PageTitle icon={AlertCircle} title="Ocorrência" />
        <OcorrenciaView ocorrencia={visualizando} onBack={() => setMode('list')} />
        <PageTour
          steps={LRO_OCORRENCIAS_TOUR_STEPS}
          targetAttribute="data-lro-ocorrencias-tour"
          title="Abrir tutorial de LRO/Ocorrências"
          detailLabel="Entrada no LRO"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle icon={AlertCircle} title="LRO/Ocorrências" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={inputClass}>
            <option value="">Todos os anos</option>
            {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className={inputClass}>
            <option value="">Todos os meses</option>
            {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className={inputClass}>
            <option value="">Todos os status</option>
            {STATUS_OCORRENCIA.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)} className={inputClass}>
            <option value="">Todas as equipes</option>
            {EQUIPES.map(eq => <option key={eq} value={eq}>{eq}</option>)}
          </select>
          <p className="text-sm text-graphite-500 dark:text-graphite-400">{filtradas.length} ocorrência(s)</p>
        </div>
        {canCreate && (
          <button onClick={() => { setEditando(null); setMode('form'); }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
            <Plus className="h-4 w-4" /> Nova Ocorrência
          </button>
        )}
      </div>

      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
          <AlertCircle className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhuma ocorrência encontrada</h3>
          <p className="text-sm text-graphite-400">{canCreate ? 'Clique em "Nova Ocorrência" para registrar.' : 'Nenhuma ocorrência disponível.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map(o => (
            <OcorrenciaCard key={o.id} o={o} canEdit={canManageEquipe(o.equipe) && !ocorrenciaBloqueadaPorLRO(o)}
              onView={() => { setVisualizando(o); setMode('view'); }}
              onEdit={() => handleEdit(o)}
              onDelete={() => handleConfirmDelete(o)}
            />
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white/95 p-6 shadow-xl shadow-black/5 backdrop-blur-sm dark:bg-surface-elevated/95 dark:shadow-black/20">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            <p className="mb-6 text-sm text-graphite-500 dark:text-graphite-400">Tem certeza que deseja excluir esta ocorrência?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="rounded-xl bg-gradient-to-r from-alert-red to-red-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all hover:shadow-xl hover:shadow-red-500/30 active:scale-[0.98]">Excluir</button>
            </div>
          </div>
        </div>
      )}
      <PageTour
        steps={LRO_OCORRENCIAS_TOUR_STEPS}
        targetAttribute="data-lro-ocorrencias-tour"
        title="Abrir tutorial de LRO/Ocorrências"
        detailLabel="Entrada no LRO"
      />
    </PageContainer>
  );
}

export default LROOcorrencias;
