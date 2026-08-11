import { useState, useEffect, useMemo } from 'react';
import { Truck, Search, Check, X, Trash2, Wrench, AlertTriangle, CheckCircle2, ClipboardList } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useAuth } from '../../context/AuthContext';
import { listarViaturas } from '../../services/viaturaService';
import { listarPanes, criarPane, atualizarPane, excluirPane } from '../../services/viaturaPaneService';
import type { Viatura, ViaturaPane, StatusViatura } from '../../types/viatura';
import { STATUS_VIATURA_OPTIONS } from '../../types/viatura';

function statusColor(s: StatusViatura) {
  return STATUS_VIATURA_OPTIONS.find(o => o.value === s)?.color || '';
}

const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400 dark:focus:ring-aviation-400/10 dark:scheme-dark';
const labelCls = 'mb-1 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

function fmtData(d: string) {
  if (!d) return '-';
  return new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleDateString('pt-BR');
}

function fmtDataHora(d: string) {
  if (!d) return '-';
  return new Date(d + (d.includes('T') ? '' : 'T12:00:00')).toLocaleString('pt-BR');
}

export function ViaturasCCI() {
  const { user } = useAuth();
  const username = user?.username || '';

  const [viaturas, setViaturas] = useState<Viatura[]>([]);
  const [viaturaId, setViaturaId] = useState('');
  const [panes, setPanes] = useState<ViaturaPane[]>([]);
  const [loadingPanes, setLoadingPanes] = useState(false);

  const [descricaoPane, setDescricaoPane] = useState('');
  const [saving, setSaving] = useState(false);

  const [resolvendoId, setResolvendoId] = useState<string | null>(null);
  const [relatoConserto, setRelatoConserto] = useState('');
  const [resolvendo, setResolvendo] = useState(false);

  const [confirmDeletePane, setConfirmDeletePane] = useState<string | null>(null);

  const [termoViatura, setTermoViatura] = useState('');

  useEffect(() => {
    listarViaturas()
      .then(setViaturas)
      .catch(() => {});
  }, []);

  const viaturasFiltradas = useMemo(() => {
    if (!termoViatura.trim()) return viaturas;
    const t = termoViatura.toLowerCase();
    return viaturas.filter(v =>
      v.prefixo.toLowerCase().includes(t) ||
      v.placa.toLowerCase().includes(t) ||
      v.marca.toLowerCase().includes(t) ||
      v.modelo.toLowerCase().includes(t)
    );
  }, [viaturas, termoViatura]);

  const viaturaSelecionada = useMemo(() => viaturas.find(v => v.id === viaturaId) || null, [viaturas, viaturaId]);

  useEffect(() => {
    if (!viaturaId) {
      setPanes([]);
      return;
    }
    setLoadingPanes(true);
    listarPanes(viaturaId)
      .then(setPanes)
      .catch(() => alert('Erro ao carregar panes.'))
      .finally(() => setLoadingPanes(false));
  }, [viaturaId]);

  const panesAtivas = useMemo(() =>
    panes.filter(p => p.status === 'Aberta').sort((a, b) => (b.dataRegistro || '').localeCompare(a.dataRegistro || '')),
    [panes],
  );

  const historico = useMemo(() =>
    panes.filter(p => p.status === 'Resolvida').sort((a, b) => (b.resolvidaEm || b.dataRegistro || '').localeCompare(a.resolvidaEm || a.dataRegistro || '')),
    [panes],
  );

  async function handleRegistrarPane() {
    if (!viaturaId || !descricaoPane.trim()) return;
    setSaving(true);
    try {
      await criarPane({
        viaturaId,
        descricao: descricaoPane.trim(),
        dataRegistro: new Date().toISOString(),
        registradoPor: username,
        status: 'Aberta',
      });
      const panes = await listarPanes(viaturaId);
      setPanes(panes);
      setDescricaoPane('');
    } catch {
      alert('Erro ao registrar pane.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmarResolucao() {
    if (!resolvendoId) return;
    setResolvendo(true);
    try {
      await atualizarPane(resolvendoId, {
        status: 'Resolvida',
        resolvidaEm: new Date().toISOString(),
        resolvidaPor: username,
        relatoConserto: relatoConserto.trim(),
      });
      const panes = await listarPanes(viaturaId);
      setPanes(panes);
      setResolvendoId(null);
      setRelatoConserto('');
    } catch {
      alert('Erro ao marcar como resolvida.');
    } finally {
      setResolvendo(false);
    }
  }

  async function handleExcluirPane() {
    if (!confirmDeletePane) return;
    try {
      await excluirPane(confirmDeletePane);
      const panes = await listarPanes(viaturaId);
      setPanes(panes);
    } catch {
      alert('Erro ao excluir pane.');
    } finally {
      setConfirmDeletePane(null);
    }
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <PageTitle icon={Truck} title="Viaturas CCI" subtitle="Gerenciador de panes e histórico de manutenção das viaturas" />
      </div>

      {/* Seleção da viatura */}
      <div className="mb-6 rounded-2xl border border-graphite-200 bg-white/80 p-5 shadow-sm dark:border-border-dark dark:bg-surface-card">
        <label className={labelCls}>Selecione a viatura *</label>
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
            <input
              value={termoViatura}
              onChange={e => setTermoViatura(e.target.value)}
              placeholder="Filtrar por prefixo, placa, marca..."
              className={inputCls + ' pl-10'}
            />
          </div>
          <select
            value={viaturaId}
            onChange={e => setViaturaId(e.target.value)}
            className={inputCls + ' md:max-w-md'}
          >
            <option value="">— Selecione uma viatura —</option>
            {viaturasFiltradas.map(v => (
              <option key={v.id} value={v.id}>
                {v.prefixo} · {v.marca} {v.modelo} {v.placa ? `· ${v.placa}` : ''}
              </option>
            ))}
          </select>
        </div>

        {viaturaSelecionada && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-graphite-200 bg-graphite-50/50 p-4 dark:border-border-dark dark:bg-surface-hover/20">
            {viaturaSelecionada.fotoUrl ? (
              <img src={viaturaSelecionada.fotoUrl} alt={viaturaSelecionada.prefixo} className="h-14 w-14 rounded-xl object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-graphite-100 to-graphite-200 dark:from-graphite-700 dark:to-graphite-800">
                <Truck className="h-7 w-7 text-graphite-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{viaturaSelecionada.prefixo}</h3>
                <span className="rounded-full bg-aviation-50 px-2 py-0.5 text-xs font-medium text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">{viaturaSelecionada.tipo}</span>
                {viaturaSelecionada.tipo === 'CCI' && viaturaSelecionada.tipoCCI && (
                  <span className="rounded-full bg-graphite-100 px-2 py-0.5 text-xs font-medium dark:bg-graphite-700 dark:text-graphite-300">{viaturaSelecionada.tipoCCI}</span>
                )}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(viaturaSelecionada.status)}`}>{viaturaSelecionada.status}</span>
              </div>
              <p className="mt-0.5 text-sm text-graphite-500 dark:text-graphite-400">
                {viaturaSelecionada.placa ? `Placa: ${viaturaSelecionada.placa}` : ''}
                {viaturaSelecionada.ano ? ` · Ano: ${viaturaSelecionada.ano}` : ''}
              </p>
            </div>
            {panesAtivas.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
                <Wrench className="h-3.5 w-3.5" /> {panesAtivas.length} pane(s) ativa(s)
              </span>
            )}
          </div>
        )}
      </div>

      {!viaturaId ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Truck className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Selecione uma viatura</h3>
          <p className="text-sm text-graphite-400 dark:text-graphite-500">Escolha um veículo acima para ver as panes e o histórico de manutenção.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Coluna esquerda: registrar pane + panes ativas */}
          <div className="space-y-6">
            {/* Formulário de lançamento de pane */}
            <div className="rounded-2xl border border-graphite-200 bg-white/80 p-5 shadow-sm dark:border-border-dark dark:bg-surface-card">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-100">
                <AlertTriangle className="h-4 w-4 text-red-500" /> Registrar Nova Pane
              </h3>
              <label className={labelCls}>Descrição da pane *</label>
              <textarea
                value={descricaoPane}
                onChange={e => setDescricaoPane(e.target.value)}
                rows={4}
                placeholder="Ex.: Falha na bomba de água, pneu furado..."
                className={inputCls + ' resize-none'}
              />
              <button
                onClick={handleRegistrarPane}
                disabled={saving || !descricaoPane.trim()}
                className="mt-3 flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Wrench className="h-4 w-4" /> {saving ? 'Registrando...' : 'Registrar Pane'}
              </button>
            </div>

            {/* Panes ativas */}
            <div className="rounded-2xl border border-graphite-200 bg-white/80 p-5 shadow-sm dark:border-border-dark dark:bg-surface-card">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-100">
                <AlertTriangle className="h-4 w-4 text-red-500" /> Problemas Atuais ({panesAtivas.length})
              </h3>
              {loadingPanes ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" />
                </div>
              ) : panesAtivas.length === 0 ? (
                <p className="py-6 text-center text-sm text-graphite-400 dark:text-graphite-500">Nenhuma pane ativa. Viatura operante!</p>
              ) : (
                <div className="space-y-3">
                  {panesAtivas.map(p => (
                    <div key={p.id} className="rounded-xl border border-red-200 bg-red-50/50 p-3 dark:border-red-900/40 dark:bg-red-900/10">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">ATIVA</span>
                            <span className="text-[10px] text-graphite-500 dark:text-graphite-400">{fmtDataHora(p.dataRegistro)}</span>
                            {p.registradoPor && <span className="text-[10px] text-graphite-400">· por {p.registradoPor}</span>}
                          </div>
                          <p className="mt-1 text-sm text-graphite-800 dark:text-graphite-200 whitespace-pre-wrap">{p.descricao}</p>
                        </div>
                        <button
                          onClick={() => { setResolvendoId(p.id); setRelatoConserto(''); }}
                          title="Marcar como resolvido"
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white transition-all hover:bg-green-700"
                        >
                          <Check className="h-3.5 w-3.5" /> Marcar como Resolvido
                        </button>
                      </div>

                      {resolvendoId === p.id && (
                        <div className="mt-3 border-t border-red-200 pt-3 dark:border-red-900/40">
                          <label className={labelCls}>Relato do Conserto *</label>
                          <textarea
                            value={relatoConserto}
                            onChange={e => setRelatoConserto(e.target.value)}
                            rows={2}
                            placeholder="Descreva como foi resolvido..."
                            className={inputCls + ' resize-none'}
                          />
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={handleConfirmarResolucao}
                              disabled={resolvendo || !relatoConserto.trim()}
                              className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-green-700 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> {resolvendo ? 'Salvando...' : 'Confirmar Resolução'}
                            </button>
                            <button
                              onClick={() => { setResolvendoId(null); setRelatoConserto(''); }}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium text-graphite-500 hover:bg-graphite-100 dark:hover:bg-surface-hover"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Coluna direita: histórico completo */}
          <div className="rounded-2xl border border-graphite-200 bg-white/80 p-5 shadow-sm dark:border-border-dark dark:bg-surface-card">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-100">
              <ClipboardList className="h-4 w-4 text-aviation-600" /> Histórico de Manutenção ({historico.length})
            </h3>
            {loadingPanes ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" />
              </div>
            ) : historico.length === 0 ? (
              <p className="py-6 text-center text-sm text-graphite-400 dark:text-graphite-500">Nenhum conserto registrado ainda.</p>
            ) : (
              <div className="relative space-y-4 before:absolute before:left-[7px] before:top-2 before:h-[calc(100%-16px)] before:w-0.5 before:bg-graphite-200 dark:before:bg-graphite-700">
                {historico.map(p => (
                  <div key={p.id} className="relative pl-7">
                    <span className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-4 border-white bg-green-500 dark:border-surface-card" />
                    <div className="rounded-xl border border-graphite-200 bg-graphite-50/50 p-3 dark:border-border-dark dark:bg-surface-hover/20">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100 whitespace-pre-wrap">{p.descricao}</p>
                        <button
                          onClick={() => setConfirmDeletePane(p.id)}
                          title="Excluir registro"
                          className="shrink-0 rounded-lg p-1.5 text-graphite-300 transition-all hover:bg-red-50 hover:text-red-500 dark:text-graphite-600 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="mt-1.5 space-y-0.5 text-[11px] text-graphite-500 dark:text-graphite-400">
                        <p><strong className="text-graphite-600 dark:text-graphite-300">Relato:</strong> {fmtData(p.dataRegistro)} {p.registradoPor ? `por ${p.registradoPor}` : ''}</p>
                        <p>
                          <strong className="text-green-600 dark:text-green-400">Conserto:</strong> {fmtData(p.resolvidaEm || '')}
                          {p.resolvidaPor ? ` por ${p.resolvidaPor}` : ''}
                        </p>
                      </div>
                      {p.relatoConserto && (
                        <p className="mt-1.5 text-xs text-graphite-700 dark:text-graphite-300 whitespace-pre-wrap">
                          <strong className="text-graphite-600 dark:text-graphite-300">Como resolveu:</strong> {p.relatoConserto}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {confirmDeletePane && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Excluir registro</h3>
            <p className="mb-6 text-sm text-graphite-500">Tem certeza que deseja excluir este registro de pane?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeletePane(null)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
              <button onClick={handleExcluirPane} className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-alert-red to-red-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg"><X className="h-4 w-4" /> Excluir</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default ViaturasCCI;
