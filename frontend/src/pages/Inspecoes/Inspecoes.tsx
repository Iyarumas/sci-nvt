import { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, Plus, ArrowLeft, Clock, CalendarDays, Users, FileText, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { atualizarConferencia, criarConferencia, excluirConferencia, listarConferencias } from '../../services/conferenciaService';
import type { Conferencia } from '../../types/conferencia';
import type { Equipe } from '../../types/bombeiro';
import { EQUIPE_OPTIONS } from '../../types/bombeiro';
import { dataLocalISO, formatarDataBR, formatarDataHoraBR, hojeLocalISO, parseDataLocalISO } from '../../utils/datas';
import { PageTour } from '../../components/ui/PageTour';

const EQUIPES_INSPECAO = EQUIPE_OPTIONS.filter(eq => eq !== 'Ferista' && eq !== 'Embaixador');

const inputClass = 'rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:placeholder:text-graphite-500 dark:scheme-dark';

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ANOS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

const INPUT_CLASS = "w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark";

const INSPECOES_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'Inspeções operacionais',
    body: 'Esta tela registra inspeções gerais do plantão, diferentes da inspeção rápida de extintor/hidrante.',
    detail: 'Use para registrar verificações operacionais, condições encontradas, ações feitas e observações que devem ficar no histórico e podem alimentar o LRO.',
  },
  {
    selector: 'main button',
    title: 'Nova inspeção',
    body: 'O botão Nova Inspeção abre o formulário.',
    detail: 'Preencha data, data do turno, hora, equipe, tipo e uma descrição detalhada do que foi verificado.',
  },
  {
    selector: 'main input, main select, main textarea',
    title: 'Campos do formulário',
    body: 'A data é o momento do registro e a data do turno indica em qual plantão a inspeção deve ser considerada.',
    detail: 'A equipe fica limitada à equipe efetiva quando o usuário não tem permissão global. A descrição deve explicar o que foi inspecionado e o resultado.',
  },
  {
    selector: 'main select, main input',
    title: 'Filtros',
    body: 'Na lista, filtre por mês/ano ou por período e por equipe.',
    detail: 'Use os filtros para conferir inspeções de um fechamento de plantão, mês ou equipe específica.',
  },
  {
    selector: 'main .space-y-2',
    title: 'Registros da lista',
    body: 'Cada card mostra tipo, equipe, data/hora, turno e responsável.',
    detail: 'Clique para expandir e ver a descrição completa. Usuários com permissão da equipe podem editar ou excluir.',
  },
];

export function Inspecoes() {
  const { user, canManageGlobal, canManageEquipe, equipeEfetiva } = useContextoOperacional();

  const [modo, setModo] = useState<'lista' | 'form'>('lista');
  const [data, setData] = useState(hojeLocalISO());
  const [dataTurno, setDataTurno] = useState(hojeLocalISO());
  const [hora, setHora] = useState(new Date().toTimeString().split(':').slice(0, 2).join(':'));
  const [equipe, setEquipe] = useState<Equipe | ''>('');
  const [tipoInspecao, setTipoInspecao] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editando, setEditando] = useState<Conferencia | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [registros, setRegistros] = useState<any[]>([]);
  const [filtroEquipe, setFiltroEquipe] = useState<Equipe | ''>('');
  const [filterMode, setFilterMode] = useState<'mes-ano' | 'periodo'>('mes-ano');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (!canManageGlobal && equipeEfetiva) setEquipe(equipeEfetiva);
  }, [canManageGlobal, equipeEfetiva]);

  async function carregar() {
    const c = await listarConferencias();
    setRegistros(c.filter(r => r.tipo === 'Inspeção Operacional'));
  }

  const filtrados = useMemo(() => {
    let lista = registros;

    if (filtroEquipe) {
      lista = lista.filter(r => r.equipe === filtroEquipe);
    }

    if (filterMode === 'mes-ano') {
      if (filtroMes) {
        lista = lista.filter(r => {
          const d = parseDataLocalISO(r.dataConferencia);
          return (d.getMonth() + 1).toString() === filtroMes;
        });
      }
      if (filtroAno) {
        lista = lista.filter(r => r.dataConferencia?.startsWith(filtroAno));
      }
    } else {
      if (dataInicio) lista = lista.filter(r => r.dataConferencia >= dataInicio);
      if (dataFinal) lista = lista.filter(r => r.dataConferencia <= dataFinal + 'T23:59:59');
    }

    return lista.sort((a, b) => (b.dataConferencia || '').localeCompare(a.dataConferencia || ''));
  }, [registros, filtroEquipe, filterMode, filtroMes, filtroAno, dataInicio, dataFinal]);

  async function handleSalvar(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !data || !dataTurno || !hora || !equipe || !tipoInspecao.trim() || !descricao.trim()) return;
    const equipeAlvo = canManageGlobal ? equipe : equipeEfetiva;
    if (!canManageEquipe(equipeAlvo)) {
      alert('Você só pode registrar inspeções para sua equipe efetiva.');
      return;
    }
    if (editando?.id && !canManageEquipe(editando.equipe)) {
      alert('Você só pode editar inspeções da sua equipe efetiva.');
      return;
    }
    setSaving(true);
    try {
      const dataHora = `${data}T${hora}:00`;
      if (editando?.id) {
        await atualizarConferencia(editando.id, {
          itemNome: tipoInspecao.trim(),
          dataConferencia: dataHora,
          equipe: equipeAlvo as Equipe,
          observacoes: descricao.trim(),
          dataProximaInspecao: dataTurno,
        });
      } else {
        await criarConferencia({
          tipo: 'Inspeção Operacional',
          itemId: '',
          itemNome: tipoInspecao.trim(),
          itemNumero: '',
          itemLocalizacao: '',
          dataConferencia: dataHora,
          inspetorUsername: user.username || '',
          inspetorNomeGuerra: user.username || '',
          inspetorCargo: '',
          equipe: equipeAlvo as Equipe,
          itens: [],
          resultadoFinal: 'Aprovado',
          observacoes: descricao.trim(),
          dataProximaInspecao: dataTurno,
          createdBy: user.username || '',
        });
      }
      setTipoInspecao('');
      setDescricao('');
      setEditando(null);
      setModo('lista');
      carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function iniciarEdicao(r: any) {
    setEditando(r);
    setTipoInspecao(r.itemNome || '');
    setDescricao(r.observacoes || '');
    const d = r.dataConferencia ? new Date(r.dataConferencia) : new Date();
    setData(dataLocalISO(d));
    setHora(d.toTimeString().slice(0, 5));
    setDataTurno(r.dataProximaInspecao || dataLocalISO(d));
    setEquipe(r.equipe || equipeEfetiva || '');
    setModo('form');
  }

  async function handleDelete(id: string) {
    const alvo = registros.find(r => r.id === id);
    if (!alvo || !canManageEquipe(alvo.equipe)) {
      alert('Você só pode excluir inspeções da sua equipe efetiva.');
      setConfirmDelete(null);
      return;
    }
    setDeleting(true);
    try {
      await excluirConferencia(id);
      setConfirmDelete(null);
      carregar();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  }

  function podeGerenciar(r: any): boolean {
    return canManageEquipe(r.equipe);
  }

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle icon={ShieldCheck} title="Inspeções" />
        {modo === 'lista' && (canManageGlobal || equipeEfetiva) && (
          <button onClick={() => { setEditando(null); setTipoInspecao(''); setDescricao(''); setModo('form'); }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl active:scale-[0.98]">
            <Plus className="h-4 w-4" /> Nova Inspeção
          </button>
        )}
      </div>

      {modo === 'form' ? (
        <form onSubmit={handleSalvar} className="max-w-4xl mx-auto space-y-5">
          <div className="mb-4 flex items-center gap-3">
            <button type="button" onClick={() => { setEditando(null); setModo('lista'); }}
              className="flex items-center gap-1 rounded-xl border border-graphite-300/60 bg-white/80 px-3 py-2 text-sm font-medium text-graphite-700 shadow-sm transition-all duration-200 hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <span className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{editando ? 'Editar Inspeção Operacional' : 'Nova Inspeção Operacional'}</span>
          </div>

          <div className="rounded-2xl border border-graphite-200/60 bg-white/80 p-8 shadow-sm dark:border-border-dark dark:bg-surface-card">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-graphite-500 dark:text-graphite-400">
                  <CalendarDays className="h-3.5 w-3.5" /> Data
                </label>
                <input type="date" value={data} onChange={e => {
                  const value = e.target.value;
                  setDataTurno(prev => prev === data ? value : prev);
                  setData(value);
                }} className={INPUT_CLASS} required />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-graphite-500 dark:text-graphite-400">
                  <CalendarDays className="h-3.5 w-3.5" /> Data do Turno
                </label>
                <input type="date" value={dataTurno} onChange={e => setDataTurno(e.target.value)} className={INPUT_CLASS} required />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-graphite-500 dark:text-graphite-400">
                  <Clock className="h-3.5 w-3.5" /> Hora
                </label>
                <input type="time" value={hora} onChange={e => setHora(e.target.value)} className={INPUT_CLASS} required />
              </div>
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-graphite-500 dark:text-graphite-400">
                  <Users className="h-3.5 w-3.5" /> Equipe
                </label>
                <select value={equipe} onChange={e => setEquipe(e.target.value as Equipe)} className={INPUT_CLASS} disabled={!canManageGlobal} required>
                  <option value="">Selecione a equipe</option>
                  {EQUIPES_INSPECAO.filter(eq => canManageGlobal || eq === equipeEfetiva).map(eq => <option key={eq} value={eq}>{eq}</option>)}
                </select>
              </div>
            </div>

            <div className="mb-6">
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-graphite-500 dark:text-graphite-400">
                <FileText className="h-3.5 w-3.5" /> Tipo
              </label>
              <input value={tipoInspecao} onChange={e => setTipoInspecao(e.target.value)} className={INPUT_CLASS} placeholder="Tipo da inspeção" required />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-graphite-700 dark:text-graphite-300">
                <FileText className="h-4 w-4" /> Descrição da Inspeção
              </label>
              <textarea value={descricao} onChange={e => setDescricao(e.target.value)}
                className={INPUT_CLASS + ' min-h-[200px] resize-y'} rows={8}
                placeholder="Descreva detalhadamente o que foi inspecionado, condições encontradas, equipamentos verificados, ações realizadas, não conformidades identificadas..."
                required />
            </div>
          </div>

          <div className="flex items-center gap-3 justify-end">
            <button type="button" onClick={() => { setEditando(null); setModo('lista'); }}
              className="rounded-xl border border-graphite-300/60 bg-white/80 px-5 py-2.5 text-sm font-medium text-graphite-700 transition-colors hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">
              Cancelar
            </button>
            <button type="submit" disabled={saving || !data || !dataTurno || !hora || !equipe || !tipoInspecao.trim() || !descricao.trim()}
              className="rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none">
              {saving ? 'Salvando...' : (editando ? 'Salvar Alterações' : 'Registrar Inspeção')}
            </button>
          </div>
        </form>
      ) : (
        <>
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
                <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputClass} placeholder="Data início" />
                <span className="text-xs text-graphite-400">a</span>
                <input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)} className={inputClass} placeholder="Data fim" />
              </>
            )}
            <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value as Equipe)} className={inputClass}>
              <option value="">Todas equipes</option>
              {EQUIPES_INSPECAO.map(eq => <option key={eq} value={eq}>{eq}</option>)}
            </select>
            <span className="text-xs text-graphite-400">{filtrados.length} registro(s)</span>
          </div>

          {filtrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
              <ShieldCheck className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
              <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhuma inspeção encontrada</h3>
              <p className="text-sm text-graphite-400">Clique em "Nova Inspeção" para registrar.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtrados.map(r => (
                <div key={r.id} className="rounded-2xl border border-graphite-200/60 bg-white/80 shadow-sm dark:border-border-dark dark:bg-surface-card">
                  <button onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aviation-500 to-aviation-700 text-sm font-bold text-white">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">
                        {r.itemNome || 'Inspeção Operacional'} — Equipe {r.equipe}
                      </p>
                      <p className="text-xs text-graphite-500">
                        {r.dataConferencia ? formatarDataBR(r.dataConferencia) + ' às ' + new Date(r.dataConferencia).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                        {r.dataProximaInspecao && <> {' · '}Turno {formatarDataBR(r.dataProximaInspecao)}</>}
                        {' · '}<span className="font-medium text-graphite-700 dark:text-graphite-300">{r.createdBy || r.inspetorNomeGuerra || '—'}</span>
                      </p>
                    </div>
                    {expandedId === r.id ? <ChevronUp className="h-4 w-4 text-graphite-400" /> : <ChevronDown className="h-4 w-4 text-graphite-400" />}
                  </button>
                  {expandedId === r.id && (
                    <div className="border-t border-graphite-200 px-5 py-4 dark:border-border-dark">
                      <p className="whitespace-pre-wrap text-sm text-graphite-700 dark:text-graphite-300">{r.observacoes || 'Sem descrição'}</p>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-graphite-500">
                        <span className="rounded-full bg-graphite-100 px-2 py-0.5 dark:bg-surface-hover dark:text-graphite-400">Registrado por: {r.createdBy}</span>
                        {r.dataConferencia && <span className="rounded-full bg-graphite-100 px-2 py-0.5 dark:bg-surface-hover dark:text-graphite-400">{formatarDataHoraBR(r.dataConferencia)}</span>}
                      </div>
                      {podeGerenciar(r) && (
                        <div className="mt-4 flex items-center gap-2">
                          <button onClick={() => iniciarEdicao(r)} className="flex items-center gap-1 rounded-lg bg-graphite-100 px-3 py-1.5 text-xs font-medium text-graphite-700 transition-colors hover:bg-graphite-200 dark:bg-surface-hover dark:text-graphite-300 dark:hover:bg-surface-hover">
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </button>
                          <button onClick={() => setConfirmDelete(r.id)} className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-alert-red transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30">
                            <Trash2 className="h-3.5 w-3.5" /> Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white/95 p-6 shadow-xl shadow-black/5 backdrop-blur-sm dark:bg-surface-elevated/95 dark:shadow-black/20">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            <p className="mb-6 text-sm text-graphite-500 dark:text-graphite-400">Tem certeza que deseja excluir esta inspeção? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={deleting}
                className="rounded-xl bg-gradient-to-r from-alert-red to-red-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all hover:shadow-xl hover:shadow-red-500/30 active:scale-[0.98] disabled:opacity-50">
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
      <PageTour
        steps={INSPECOES_TOUR_STEPS}
        targetAttribute="data-inspecoes-tour"
        title="Abrir tutorial de Inspeções"
        detailLabel="Registro operacional"
      />
    </PageContainer>
  );
}

export default Inspecoes;
