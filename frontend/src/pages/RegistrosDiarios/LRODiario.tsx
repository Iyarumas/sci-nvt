import { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet, Plus, Save, Eye, Pencil, Copy, Printer, Trash2, ChevronDown, ChevronUp, Truck,
} from 'lucide-react';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useAuth } from '../../context/AuthContext';
import { listarLROs, criarLRO, atualizarLRO, excluirLRO } from '../../services/lroService';
import { listarBombeiros, listarAtivos } from '../../services/bombeiroService';
import { listarViaturas } from '../../services/viaturaService';
import { listarAPOCs } from '../../services/apocService';
import type { AtivoItem } from '../../components/ui/SearchSelect';
import type { Viatura } from '../../types/viatura';
import { EQUIPES, EPR_OPTIONS, CRS_SITUACOES, FUNCOES_CARGO } from '../../types/lro';
import type { LRO, VeiculoState, VeiculoRTState, CRSState } from '../../types/lro';
import { dataSaidaPlantao, horarioPlantaoPorEquipe } from '../../utils/equipes';

function formatDate(d: string) {
  if (!d) return '-';
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

function emptyVeiculo(): VeiculoState {
  return { cci319: '', cci320: '', cci333: '', kmInicial: '', kmFinal: '', combustivelInicial: '', combustivelFinal: '', nitrogenio: '', epr: '' };
}

function emptyVeiculoRT(): VeiculoRTState {
  return { cci319Reserva: '', cci320Reserva: '', cci333Reserva: '', cci319Baixado: '', cci320Baixado: '', cci333Baixado: '', kmInicial: '', kmFinal: '', combustivelInicial: '', combustivelFinal: '', nitrogenio: '', epr: '' };
}

function emptyCRS(): CRSState {
  return { situacao: '', kmOdoInicial: '', kmOdoFinal: '', kmTacInicial: '', kmTacFinal: '', combustivelInicial: '', combustivelFinal: '', epr: '' };
}

function emptyLRO(): Omit<LRO, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> {
  const horario = horarioPlantaoPorEquipe('Alfa');
  const hoje = new Date().toISOString().split('T')[0];
  return {
    equipe: 'Alfa', turno: horario.turno,
    dataEntrada: hoje,
    dataSaida: dataSaidaPlantao('Alfa', hoje),
    chefeEquipe: '', apoc: '',
    cci02Slots: [], cci03Slots: [], crsSlots: [], apoioOutrosSlots: [],
    substituicoesAtivo: false, substituicoes: [],
    instrucoes: '',
    faisca2: emptyVeiculo(), faisca3: emptyVeiculo(), faiscaRT: emptyVeiculoRT(), crs: emptyCRS(),
    situacaoCentralFaisca: 'SEM ALTERAÇÕES',
    situacaoComunicacao: 'SEM ALTERAÇÕES',
    situacaoTPEPR: 'SEM ALTERAÇÕES',
    situacaoAgentesExtintores: 'SEM ALTERAÇÕES',
    situacaoEquipamentos: 'SEM ALTERAÇÕES',
    situacaoEdificacoes: 'SEM ALTERAÇÕES',
    inspecoesTecnicas: '', emergenciasAeronauticas: '', outrasOcorrencias: '',
    assinatura: '',
  };
}

function ViaturasCCISection({ viaturas }: { viaturas: Viatura[] }) {
  const [expanded, setExpanded] = useState(false);

  if (viaturas.length === 0) return null;

  return (
    <fieldset className="rounded-xl border border-aviation-200/50 bg-aviation-50/30 p-4 dark:border-aviation-700/30 dark:bg-aviation-900/10">
      <legend
        onClick={() => setExpanded(!expanded)}
        className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400"
      >
        <Truck className="h-4 w-4" />
        Viaturas CCI Cadastradas ({viaturas.length})
        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </legend>
      {expanded && (
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
          {viaturas.map((v: Viatura) => (
            <div key={v.id} className="flex items-center gap-3 rounded-xl border border-graphite-200/60 bg-white/70 px-3 py-2 dark:border-border-dark dark:bg-surface-card">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aviation-100 text-xs font-bold text-aviation-700 dark:bg-aviation-900/40 dark:text-aviation-300">
                {v.prefixo.slice(-2)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-graphite-900 dark:text-graphite-100">{v.prefixo}</p>
                <p className="truncate text-xs text-graphite-500 dark:text-graphite-400">{v.marca} {v.modelo} · {v.placa}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                v.status === 'Operacional' || (v.situacao as string) === 'Ativa' ? 'bg-status-green/10 text-status-green' :
                v.status === 'Em manutenção' || (v.situacao as string) === 'Em Manutenção' ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' :
                'bg-red-50 text-alert-red dark:bg-red-900/20 dark:text-red-400'
              }`}>
                {v.situacao || v.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function autoPreencher(equipe: string) {
  return { turno: horarioPlantaoPorEquipe(equipe).turno };
}

function autoDataSaida(equipe: string, dataEntrada: string) {
  return dataSaidaPlantao(equipe, dataEntrada);
}

// ─── FORM ───────────────────────────
function LROForm({ lro, onSave, onSaveDraft, onCancel }: {
  lro?: LRO;
  onSave: (data: Omit<LRO, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => void;
  onSaveDraft: (data: Omit<LRO, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(emptyLRO());
  const [viaturas, setViaturas] = useState<Viatura[]>([]);
  useEffect(() => { listarViaturas().then(setViaturas); }, []);
  const [pessoas, setPessoas] = useState<AtivoItem[]>([]);
  useEffect(() => {
    async function load() {
      const [bbs, apocs] = await Promise.all([listarAtivos(), listarAPOCs()]);
      setPessoas([
        ...bbs.map(b => ({ id: b.id, nomeGuerra: b.nomeGuerra, nomeCompleto: b.nomeCompleto, cargo: b.cargo, equipe: b.equipe })),
        ...apocs.map(a => ({ id: a.id, nomeGuerra: a.nomeGuerra, nomeCompleto: a.nomeCompleto, equipe: a.equipe })),
      ]);
    }
    load();
  }, []);

  useEffect(() => {
    if (lro) {
      setForm({
        equipe: lro.equipe, turno: lro.turno,
        dataEntrada: lro.dataEntrada, dataSaida: lro.dataSaida,
        chefeEquipe: lro.chefeEquipe, apoc: lro.apoc,
        cci02Slots: lro.cci02Slots, cci03Slots: lro.cci03Slots, crsSlots: lro.crsSlots, apoioOutrosSlots: lro.apoioOutrosSlots,
        substituicoesAtivo: lro.substituicoesAtivo, substituicoes: lro.substituicoes,
        instrucoes: lro.instrucoes,
        faisca2: lro.faisca2, faisca3: lro.faisca3, faiscaRT: lro.faiscaRT, crs: lro.crs,
        situacaoCentralFaisca: lro.situacaoCentralFaisca,
        situacaoComunicacao: lro.situacaoComunicacao,
        situacaoTPEPR: lro.situacaoTPEPR,
        situacaoAgentesExtintores: lro.situacaoAgentesExtintores,
        situacaoEquipamentos: lro.situacaoEquipamentos,
        situacaoEdificacoes: lro.situacaoEdificacoes,
        inspecoesTecnicas: lro.inspecoesTecnicas,
        emergenciasAeronauticas: lro.emergenciasAeronauticas,
        outrasOcorrencias: lro.outrasOcorrencias,
        assinatura: lro.assinatura,
      });
    }
  }, [lro]);

  function upd(field: string, value: any) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleEquipe(equipe: string) {
    const auto = autoPreencher(equipe);
    setForm(f => ({ ...f, equipe, ...auto, dataSaida: autoDataSaida(equipe, f.dataEntrada) }));
  }

  function handleDataEntrada(data: string) {
    setForm(f => ({ ...f, dataEntrada: data, dataSaida: autoDataSaida(f.equipe, data) }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <form onSubmit={submit} className="space-y-8">
      {/* Cabeçalho */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Equipe de Serviço</label>
          <select value={form.equipe} onChange={e => handleEquipe(e.target.value)}
            className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated">
            {EQUIPES.map(eq => <option key={eq} value={eq}>{eq}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Turno</label>
          <input value={form.turno} disabled
            className="w-full rounded-xl border border-graphite-200/60 bg-graphite-100/50 px-3 py-2.5 text-sm text-graphite-400 dark:border-border-dark dark:bg-surface-card/50 dark:text-graphite-500" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Data de Entrada</label>
          <input type="date" value={form.dataEntrada} onChange={e => handleDataEntrada(e.target.value)}
            className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Data de Saída</label>
          <input type="date" value={form.dataSaida} onChange={e => upd('dataSaida', e.target.value)}
            className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" />
        </div>
      </div>

      {/* Cabeçalho: Chefe de Equipe + APOC */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Chefe de Equipe</label>
          <SearchSelect value={form.chefeEquipe} onChange={v => upd('chefeEquipe', v)} placeholder="Chefe de Equipe" options={pessoas} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">APOC</label>
          <SearchSelect value={form.apoc} onChange={v => upd('apoc', v)} placeholder="APOC" cargo="APOC" options={pessoas} />
        </div>
      </div>

      {/* Escala Equipes CCI's */}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">Escala Equipes CCI's</legend>
        <div className="space-y-6">
          {/* CCI 02 */}
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">CCI 02</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-graphite-200 dark:border-border-dark">
                    <th className="px-3 py-2 text-left text-xs font-medium text-graphite-500 dark:text-graphite-400">Função</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-graphite-500 dark:text-graphite-400">Nome</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {form.cci02Slots.map((s, i) => (
                    <tr key={i} className="border-b border-graphite-100 dark:border-border-dark">
                      <td className="px-3 py-2 min-w-40">
                        <select value={s.funcao} onChange={e => { const next = [...form.cci02Slots]; next[i] = { ...next[i], funcao: e.target.value }; upd('cci02Slots', next); }}
                          className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated">
                          <option value="">Selecione</option>
                          {FUNCOES_CARGO.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 min-w-56">
                        <SearchSelect value={s.nome} onChange={v => { const next = [...form.cci02Slots]; next[i] = { ...next[i], nome: v }; upd('cci02Slots', next); }} placeholder="Selecione o nome" cargo={s.funcao || undefined} options={pessoas} />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => upd('cci02Slots', form.cci02Slots.filter((_, j) => j !== i))}
                          className="rounded-xl p-1.5 text-alert-red transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => upd('cci02Slots', [...form.cci02Slots, { funcao: '', nome: '' }])}
              className="mt-2 flex items-center gap-1 text-sm text-aviation-600 hover:text-aviation-700 dark:text-aviation-400">
              <Plus className="h-4 w-4" /> Adicionar função no CCI 02
            </button>
          </div>
          {/* CCI 03 */}
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">CCI 03</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-graphite-200 dark:border-border-dark">
                    <th className="px-3 py-2 text-left text-xs font-medium text-graphite-500 dark:text-graphite-400">Função</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-graphite-500 dark:text-graphite-400">Nome</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {form.cci03Slots.map((s, i) => (
                    <tr key={i} className="border-b border-graphite-100 dark:border-border-dark">
                      <td className="px-3 py-2 min-w-40">
                        <select value={s.funcao} onChange={e => { const next = [...form.cci03Slots]; next[i] = { ...next[i], funcao: e.target.value }; upd('cci03Slots', next); }}
                          className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated">
                          <option value="">Selecione</option>
                          {FUNCOES_CARGO.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 min-w-56">
                        <SearchSelect value={s.nome} onChange={v => { const next = [...form.cci03Slots]; next[i] = { ...next[i], nome: v }; upd('cci03Slots', next); }} placeholder="Selecione o nome" cargo={s.funcao || undefined} options={pessoas} />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => upd('cci03Slots', form.cci03Slots.filter((_, j) => j !== i))}
                          className="rounded-xl p-1.5 text-alert-red transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => upd('cci03Slots', [...form.cci03Slots, { funcao: '', nome: '' }])}
              className="mt-2 flex items-center gap-1 text-sm text-aviation-600 hover:text-aviation-700 dark:text-aviation-400">
              <Plus className="h-4 w-4" /> Adicionar função no CCI 03
            </button>
          </div>
        </div>
      </fieldset>

      {/* Escala Equipes de Apoio */}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">Escala Equipes de Apoio</legend>
        <div className="space-y-6">
          {/* CRS */}
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">CRS</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-graphite-200 dark:border-border-dark">
                    <th className="px-3 py-2 text-left text-xs font-medium text-graphite-500 dark:text-graphite-400">Função</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-graphite-500 dark:text-graphite-400">Nome</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {form.crsSlots.map((s, i) => (
                    <tr key={i} className="border-b border-graphite-100 dark:border-border-dark">
                      <td className="px-3 py-2 min-w-40">
                        <select value={s.funcao} onChange={e => { const next = [...form.crsSlots]; next[i] = { ...next[i], funcao: e.target.value }; upd('crsSlots', next); }}
                          className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated">
                          <option value="">Selecione</option>
                          {FUNCOES_CARGO.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 min-w-56">
                        <SearchSelect value={s.nome} onChange={v => { const next = [...form.crsSlots]; next[i] = { ...next[i], nome: v }; upd('crsSlots', next); }} placeholder="Selecione o nome" cargo={s.funcao || undefined} options={pessoas} />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => upd('crsSlots', form.crsSlots.filter((_, j) => j !== i))}
                          className="rounded-xl p-1.5 text-alert-red transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => upd('crsSlots', [...form.crsSlots, { funcao: '', nome: '' }])}
              className="mt-2 flex items-center gap-1 text-sm text-aviation-600 hover:text-aviation-700 dark:text-aviation-400">
              <Plus className="h-4 w-4" /> Adicionar função no CRS
            </button>
          </div>
          {/* Outros (Extras, Férias, etc.) */}
          <div>
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Outros (Extras, Férias, Compondo Equipe)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-graphite-200 dark:border-border-dark">
                    <th className="px-3 py-2 text-left text-xs font-medium text-graphite-500 dark:text-graphite-400">Função</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-graphite-500 dark:text-graphite-400">Nome</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {form.apoioOutrosSlots.map((s, i) => (
                    <tr key={i} className="border-b border-graphite-100 dark:border-border-dark">
                      <td className="px-3 py-2 min-w-40">
                        <select value={s.funcao} onChange={e => { const next = [...form.apoioOutrosSlots]; next[i] = { ...next[i], funcao: e.target.value }; upd('apoioOutrosSlots', next); }}
                          className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated">
                          <option value="">Selecione</option>
                          {[...FUNCOES_CARGO, 'Extras', 'Férias', 'Outros'].map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2 min-w-56">
                        <SearchSelect value={s.nome} onChange={v => { const next = [...form.apoioOutrosSlots]; next[i] = { ...next[i], nome: v }; upd('apoioOutrosSlots', next); }} placeholder="Selecione o nome" cargo={s.funcao || undefined} options={pessoas} />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => upd('apoioOutrosSlots', form.apoioOutrosSlots.filter((_, j) => j !== i))}
                          className="rounded-xl p-1.5 text-alert-red transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={() => upd('apoioOutrosSlots', [...form.apoioOutrosSlots, { funcao: '', nome: '' }])}
              className="mt-2 flex items-center gap-1 text-sm text-aviation-600 hover:text-aviation-700 dark:text-aviation-400">
              <Plus className="h-4 w-4" /> Adicionar função
            </button>
          </div>
        </div>
      </fieldset>

      {/* Substituições */}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">Substituições</legend>
        <div className="mb-3 flex items-center gap-2">
          <span className="text-sm text-graphite-700 dark:text-graphite-300">Possui substituições?</span>
          <select value={form.substituicoesAtivo ? 'sim' : 'nao'} onChange={e => upd('substituicoesAtivo', e.target.value === 'sim')}
            className="rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-1.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated">
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        </div>
        {form.substituicoesAtivo && (
          <div className="space-y-2">
            {form.substituicoes.map((s, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2 rounded-xl border border-graphite-200/50 bg-white/50 p-3 backdrop-blur-sm dark:border-border-dark dark:bg-surface-card/30">
                <div className="flex-1 min-w-32">
                  <label className="mb-1 block text-xs text-graphite-500 dark:text-graphite-400">Função</label>
                  <input value={s.funcao} onChange={e => {
                    const next = [...form.substituicoes]; next[i] = { ...next[i], funcao: e.target.value };
                    upd('substituicoes', next);
                  }} placeholder="Função" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" />
                </div>
                <div className="flex-1 min-w-32">
                  <label className="mb-1 block text-xs text-graphite-500 dark:text-graphite-400">Nome</label>
                  <SearchSelect value={s.nome} onChange={v => {
                    const next = [...form.substituicoes]; next[i] = { ...next[i], nome: v };
upd('substituicoes', next);
                    }} placeholder="Nome" options={pessoas} />
                </div>
                <div className="flex-1 min-w-32">
                  <label className="mb-1 block text-xs text-graphite-500 dark:text-graphite-400">Função Substituto</label>
                  <input value={s.funcaoSubstituto} onChange={e => {
                    const next = [...form.substituicoes]; next[i] = { ...next[i], funcaoSubstituto: e.target.value };
                    upd('substituicoes', next);
                  }} placeholder="Função substituto" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" />
                </div>
                <div className="flex-1 min-w-32">
                  <label className="mb-1 block text-xs text-graphite-500 dark:text-graphite-400">Nome Substituto</label>
                  <SearchSelect value={s.nomeSubstituto} onChange={v => {
                    const next = [...form.substituicoes]; next[i] = { ...next[i], nomeSubstituto: v };
upd('substituicoes', next);
                    }} placeholder="Nome substituto" options={pessoas} />
                </div>
                <button type="button" onClick={() => upd('substituicoes', form.substituicoes.filter((_, j) => j !== i))}
                  className="rounded-xl p-1.5 text-alert-red transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
            <button type="button" onClick={() => upd('substituicoes', [...form.substituicoes, { funcao: '', nome: '', funcaoSubstituto: '', nomeSubstituto: '' }])}
              className="flex items-center gap-1 text-sm text-aviation-600 hover:text-aviation-700 dark:text-aviation-400">
              <Plus className="h-4 w-4" /> Adicionar substituição
            </button>
          </div>
        )}
      </fieldset>

      {/* Instruções */}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">Instruções</legend>
        <textarea value={form.instrucoes} onChange={e => upd('instrucoes', e.target.value)} rows={3}
          placeholder="Instruções do dia (preenchidas automaticamente com PTR-BA)..."
          className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" />
      </fieldset>

      {/* Viaturas CCI Cadastradas */}
      <ViaturasCCISection viaturas={viaturas.filter(v => v.tipo === 'CCI')} />

      {/* 4 colunas de viaturas */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* FAISCA 2 */}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">FAISCA 2</legend>
          <div className="space-y-2 text-sm">
            <div><input value={form.faisca2.cci319} onChange={e => upd('faisca2', { ...form.faisca2, cci319: e.target.value })} placeholder="CCI 319" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faisca2.cci320} onChange={e => upd('faisca2', { ...form.faisca2, cci320: e.target.value })} placeholder="CCI 320" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faisca2.cci333} onChange={e => upd('faisca2', { ...form.faisca2, cci333: e.target.value })} placeholder="CCI 333" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faisca2.kmInicial} onChange={e => upd('faisca2', { ...form.faisca2, kmInicial: e.target.value })} placeholder="Km Inicial" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faisca2.kmFinal} onChange={e => upd('faisca2', { ...form.faisca2, kmFinal: e.target.value })} placeholder="Km Final" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faisca2.combustivelInicial} onChange={e => upd('faisca2', { ...form.faisca2, combustivelInicial: e.target.value })} placeholder="Combustível Inicial" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faisca2.combustivelFinal} onChange={e => upd('faisca2', { ...form.faisca2, combustivelFinal: e.target.value })} placeholder="Combustível Final" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faisca2.nitrogenio} onChange={e => upd('faisca2', { ...form.faisca2, nitrogenio: e.target.value })} placeholder="Nitrogênio" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div>
              <label className="mb-1 block text-xs text-graphite-500 dark:text-graphite-400">EPR's</label>
              <select value={form.faisca2.epr} onChange={e => upd('faisca2', { ...form.faisca2, epr: e.target.value })}
                className="w-full rounded border border-graphite-300/60 bg-white/70 px-2 py-1.5 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
                <option value="">Selecione</option>
                {EPR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </fieldset>

        {/* FAISCA 3 */}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">FAISCA 3</legend>
          <div className="space-y-2 text-sm">
            <div><input value={form.faisca3.cci319} onChange={e => upd('faisca3', { ...form.faisca3, cci319: e.target.value })} placeholder="CCI 319" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faisca3.cci320} onChange={e => upd('faisca3', { ...form.faisca3, cci320: e.target.value })} placeholder="CCI 320" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faisca3.cci333} onChange={e => upd('faisca3', { ...form.faisca3, cci333: e.target.value })} placeholder="CCI 333" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faisca3.kmInicial} onChange={e => upd('faisca3', { ...form.faisca3, kmInicial: e.target.value })} placeholder="Km Inicial" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faisca3.kmFinal} onChange={e => upd('faisca3', { ...form.faisca3, kmFinal: e.target.value })} placeholder="Km Final" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faisca3.combustivelInicial} onChange={e => upd('faisca3', { ...form.faisca3, combustivelInicial: e.target.value })} placeholder="Combustível Inicial" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faisca3.combustivelFinal} onChange={e => upd('faisca3', { ...form.faisca3, combustivelFinal: e.target.value })} placeholder="Combustível Final" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faisca3.nitrogenio} onChange={e => upd('faisca3', { ...form.faisca3, nitrogenio: e.target.value })} placeholder="Nitrogênio" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div>
              <label className="mb-1 block text-xs text-graphite-500 dark:text-graphite-400">EPR's</label>
              <select value={form.faisca3.epr} onChange={e => upd('faisca3', { ...form.faisca3, epr: e.target.value })}
                className="w-full rounded border border-graphite-300/60 bg-white/70 px-2 py-1.5 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
                <option value="">Selecione</option>
                {EPR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </fieldset>

        {/* FAISCA RT */}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">FAISCA RT</legend>
          <div className="space-y-2 text-sm">
            <div><input value={form.faiscaRT.cci319Reserva} onChange={e => upd('faiscaRT', { ...form.faiscaRT, cci319Reserva: e.target.value })} placeholder="CCI 319 RESERVA" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faiscaRT.cci320Reserva} onChange={e => upd('faiscaRT', { ...form.faiscaRT, cci320Reserva: e.target.value })} placeholder="CCI 320 RESERVA" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faiscaRT.cci333Reserva} onChange={e => upd('faiscaRT', { ...form.faiscaRT, cci333Reserva: e.target.value })} placeholder="CCI 333 RESERVA" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faiscaRT.cci319Baixado} onChange={e => upd('faiscaRT', { ...form.faiscaRT, cci319Baixado: e.target.value })} placeholder="CCI 319 BAIXADO" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faiscaRT.cci320Baixado} onChange={e => upd('faiscaRT', { ...form.faiscaRT, cci320Baixado: e.target.value })} placeholder="CCI 320 BAIXADO" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faiscaRT.cci333Baixado} onChange={e => upd('faiscaRT', { ...form.faiscaRT, cci333Baixado: e.target.value })} placeholder="CCI 333 BAIXADO" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faiscaRT.kmInicial} onChange={e => upd('faiscaRT', { ...form.faiscaRT, kmInicial: e.target.value })} placeholder="Km Inicial" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faiscaRT.kmFinal} onChange={e => upd('faiscaRT', { ...form.faiscaRT, kmFinal: e.target.value })} placeholder="Km Final" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faiscaRT.combustivelInicial} onChange={e => upd('faiscaRT', { ...form.faiscaRT, combustivelInicial: e.target.value })} placeholder="Combustível Inicial" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faiscaRT.combustivelFinal} onChange={e => upd('faiscaRT', { ...form.faiscaRT, combustivelFinal: e.target.value })} placeholder="Combustível Final" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.faiscaRT.nitrogenio} onChange={e => upd('faiscaRT', { ...form.faiscaRT, nitrogenio: e.target.value })} placeholder="Nitrogênio" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div>
              <label className="mb-1 block text-xs text-graphite-500 dark:text-graphite-400">EPR's</label>
              <select value={form.faiscaRT.epr} onChange={e => upd('faiscaRT', { ...form.faiscaRT, epr: e.target.value })}
                className="w-full rounded border border-graphite-300/60 bg-white/70 px-2 py-1.5 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
                <option value="">Selecione</option>
                {EPR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </fieldset>

        {/* CRS */}
        <fieldset>
          <legend className="mb-3 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">CRS</legend>
          <div className="space-y-2 text-sm">
            <div>
              <label className="mb-1 block text-xs text-graphite-500 dark:text-graphite-400">Situação</label>
              <select value={form.crs.situacao} onChange={e => upd('crs', { ...form.crs, situacao: e.target.value })}
                className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated">
                <option value="">Selecione</option>
                {CRS_SITUACOES.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div><input value={form.crs.kmOdoInicial} onChange={e => upd('crs', { ...form.crs, kmOdoInicial: e.target.value })} placeholder="Km Odômetro Inicial" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.crs.kmOdoFinal} onChange={e => upd('crs', { ...form.crs, kmOdoFinal: e.target.value })} placeholder="Km Odômetro Final" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.crs.kmTacInicial} onChange={e => upd('crs', { ...form.crs, kmTacInicial: e.target.value })} placeholder="Km Tacógrafo Inicial" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.crs.kmTacFinal} onChange={e => upd('crs', { ...form.crs, kmTacFinal: e.target.value })} placeholder="Km Tacógrafo Final" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.crs.combustivelInicial} onChange={e => upd('crs', { ...form.crs, combustivelInicial: e.target.value })} placeholder="Combustível Inicial" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div><input value={form.crs.combustivelFinal} onChange={e => upd('crs', { ...form.crs, combustivelFinal: e.target.value })} placeholder="Combustível Final" className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-2.5 py-1.5 backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" /></div>
            <div>
              <label className="mb-1 block text-xs text-graphite-500 dark:text-graphite-400">EPR's</label>
              <select value={form.crs.epr} onChange={e => upd('crs', { ...form.crs, epr: e.target.value })}
                className="w-full rounded border border-graphite-300/60 bg-white/70 px-2 py-1.5 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
                <option value="">Selecione</option>
                {EPR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </fieldset>
      </div>

      {/* Situações */}
      {([
        { key: 'situacaoCentralFaisca', label: 'Situação Operacional da Central Faisca' },
        { key: 'situacaoComunicacao', label: 'Rádios, Hotline, Sistema de Alarme Sonoro e Ramais' },
        { key: 'situacaoTPEPR', label: 'Situação Operacional dos TP, EPR em Linha e em Estoque' },
        { key: 'situacaoAgentesExtintores', label: 'Situação Operacional dos Agentes Extintores (LGE, PQ) e Nitrogênio em Linha e em Estoque' },
        { key: 'situacaoEquipamentos', label: 'Situação Operacional dos Equipamentos e Materiais do SCI NVT' },
        { key: 'situacaoEdificacoes', label: 'Situação Operacional das Edificações/Instalações da SCI' },
      ] as const).map(({ key, label }) => (
        <fieldset key={key}>
          <legend className="mb-3 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">{label}</legend>
          <textarea value={(form as any)[key]} onChange={e => upd(key, e.target.value)} rows={2}
            className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" />
        </fieldset>
      ))}

      {/* Auto-filled sections */}
      {([
        { key: 'inspecoesTecnicas', label: 'Inspeções Técnicas e Vistorias' },
        { key: 'emergenciasAeronauticas', label: 'Emergências Aeronáuticas' },
        { key: 'outrasOcorrencias', label: 'Outras Ocorrências' },
      ] as const).map(({ key, label }) => (
        <fieldset key={key}>
          <legend className="mb-3 text-sm font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">{label}</legend>
          <textarea value={(form as any)[key]} onChange={e => upd(key, e.target.value)} rows={2}
            placeholder="Preenchido automaticamente..."
            className="w-full rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated" />
        </fieldset>
      ))}

      <div className="flex items-center justify-end gap-3 border-t border-graphite-200 pt-6 dark:border-border-dark">
        <button type="button" onClick={onCancel}
          className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2.5 text-sm font-medium text-graphite-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-graphite-50 hover:border-graphite-300 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200 dark:hover:bg-surface-hover/50">Cancelar</button>
        <button type="button" onClick={() => onSaveDraft(form)}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
          <Save className="h-4 w-4" /> {lro?.id ? 'Salvar e Continuar' : 'Criar e Continuar'}
        </button>
        <button type="submit"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
          <Save className="h-4 w-4" /> {lro ? 'Salvar Alterações' : 'Criar LRO'}
        </button>
      </div>
    </form>
  );
}

// ─── LIST VIEW ───────────────────────────
function LROCard({ lro, onView, onEdit, onClone, onDelete, canEdit }: {
  lro: LRO; onView: () => void; onEdit: () => void; onClone: () => void; onDelete: () => void; canEdit: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-2xl border border-graphite-200/60 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-aviation-50 to-aviation-100 dark:from-aviation-900/30 dark:to-aviation-800/20">
            <FileSpreadsheet className="h-5 w-5 text-aviation-600 dark:text-aviation-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">{lro.equipe} - {formatDate(lro.dataEntrada)}</p>
            <p className="text-xs text-graphite-500 dark:text-graphite-400">{lro.turno} · {formatDate(lro.dataEntrada)} a {formatDate(lro.dataSaida)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onView} title="Visualizar" className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300"><Eye className="h-4 w-4" /></button>
          {canEdit && (
            <>
              <button onClick={onEdit} title="Editar" className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300"><Pencil className="h-4 w-4" /></button>
              <button onClick={onClone} title="Copiar" className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300"><Copy className="h-4 w-4" /></button>
              <button onClick={onDelete} title="Excluir" className="rounded-xl p-1.5 text-alert-red transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
            </>
          )}
          <button onClick={() => setExpanded(!expanded)} className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-4 space-y-3 border-t border-graphite-200 pt-4 dark:border-border-dark">
          <p className="text-xs text-graphite-500 dark:text-graphite-400">Chefe: {lro.chefeEquipe || '-'} · APOC: {lro.apoc || '-'}</p>
          {lro.cci02Slots.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-aviation-600 dark:text-aviation-400">CCI 02</p>
              <div className="mt-1 space-y-1">{lro.cci02Slots.map((s, i) => <p key={i} className="text-sm">{s.funcao || '-'}: {s.nome || '-'}</p>)}</div>
            </div>
          )}
          {lro.cci03Slots.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-aviation-600 dark:text-aviation-400">CCI 03</p>
              <div className="mt-1 space-y-1">{lro.cci03Slots.map((s, i) => <p key={i} className="text-sm">{s.funcao || '-'}: {s.nome || '-'}</p>)}</div>
            </div>
          )}
          {lro.crsSlots.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-aviation-600 dark:text-aviation-400">CRS</p>
              <div className="mt-1 space-y-1">{lro.crsSlots.map((s, i) => <p key={i} className="text-sm">{s.funcao || '-'}: {s.nome || '-'}</p>)}</div>
            </div>
          )}
          {lro.apoioOutrosSlots.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-aviation-600 dark:text-aviation-400">Outros</p>
              <div className="mt-1 space-y-1">{lro.apoioOutrosSlots.map((s, i) => <p key={i} className="text-sm">{s.funcao || '-'}: {s.nome || '-'}</p>)}</div>
            </div>
          )}
          <p className="text-xs text-graphite-500 dark:text-graphite-400">Central Faisca: {lro.situacaoCentralFaisca}</p>
        </div>
      )}
    </div>
  );
}

// ─── VIEW MODE ───────────────────────────
function ViewModeLRO({ lro, onBack }: { lro: LRO; onBack: () => void }) {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between print-hidden">
        <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">LRO - {lro.equipe} - {formatDate(lro.dataEntrada)}</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-3 py-1.5 text-sm font-medium text-white shadow-md shadow-aviation-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
            <Printer className="h-4 w-4" /> Imprimir
          </button>
          <button onClick={onBack} className="rounded-xl border border-graphite-300/60 bg-white/80 px-3.5 py-1.5 text-sm text-graphite-700 backdrop-blur-sm transition-all duration-200 hover:bg-graphite-50 hover:border-graphite-300 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200 dark:hover:bg-surface-hover/50">Fechar</button>
        </div>
      </div>
      <div id="print-area" className="rounded-2xl border border-graphite-200/60 bg-white/80 p-4 backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div><p className="text-xs text-graphite-400">Equipe</p><p className="text-sm font-medium dark:text-graphite-100">{lro.equipe}</p></div>
          <div><p className="text-xs text-graphite-400">Turno</p><p className="text-sm font-medium dark:text-graphite-100">{lro.turno}</p></div>
          <div><p className="text-xs text-graphite-400">Entrada</p><p className="text-sm font-medium dark:text-graphite-100">{formatDate(lro.dataEntrada)}</p></div>
          <div><p className="text-xs text-graphite-400">Saída</p><p className="text-sm font-medium dark:text-graphite-100">{formatDate(lro.dataSaida)}</p></div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs text-graphite-400">Chefe de Equipe</p>
            <p className="text-sm font-medium dark:text-graphite-100">{lro.chefeEquipe || '-'}</p>
          </div>
          <div>
            <p className="text-xs text-graphite-400">APOC</p>
            <p className="text-sm font-medium dark:text-graphite-100">{lro.apoc || '-'}</p>
          </div>
        </div>

        {lro.cci02Slots.length > 0 && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-semibold text-aviation-600 dark:text-aviation-400">CCI 02</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-graphite-200 dark:border-border-dark">
                  <th className="px-3 py-1.5 text-left text-xs text-graphite-500 dark:text-graphite-400">Função</th>
                  <th className="px-3 py-1.5 text-left text-xs text-graphite-500 dark:text-graphite-400">Nome</th>
                </tr>
              </thead>
              <tbody>
                {lro.cci02Slots.map((s, i) => (
                  <tr key={i} className="border-b border-graphite-100 dark:border-border-dark">
                    <td className="px-3 py-1.5">{s.funcao || '-'}</td>
                    <td className="px-3 py-1.5">{s.nome || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lro.cci03Slots.length > 0 && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-semibold text-aviation-600 dark:text-aviation-400">CCI 03</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-graphite-200 dark:border-border-dark">
                  <th className="px-3 py-1.5 text-left text-xs text-graphite-500 dark:text-graphite-400">Função</th>
                  <th className="px-3 py-1.5 text-left text-xs text-graphite-500 dark:text-graphite-400">Nome</th>
                </tr>
              </thead>
              <tbody>
                {lro.cci03Slots.map((s, i) => (
                  <tr key={i} className="border-b border-graphite-100 dark:border-border-dark">
                    <td className="px-3 py-1.5">{s.funcao || '-'}</td>
                    <td className="px-3 py-1.5">{s.nome || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lro.crsSlots.length > 0 && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-semibold text-aviation-600 dark:text-aviation-400">CRS</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-graphite-200 dark:border-border-dark">
                  <th className="px-3 py-1.5 text-left text-xs text-graphite-500 dark:text-graphite-400">Função</th>
                  <th className="px-3 py-1.5 text-left text-xs text-graphite-500 dark:text-graphite-400">Nome</th>
                </tr>
              </thead>
              <tbody>
                {lro.crsSlots.map((s, i) => (
                  <tr key={i} className="border-b border-graphite-100 dark:border-border-dark">
                    <td className="px-3 py-1.5">{s.funcao || '-'}</td>
                    <td className="px-3 py-1.5">{s.nome || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {lro.apoioOutrosSlots.length > 0 && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-semibold text-aviation-600 dark:text-aviation-400">Outros</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-graphite-200 dark:border-border-dark">
                  <th className="px-3 py-1.5 text-left text-xs text-graphite-500 dark:text-graphite-400">Função</th>
                  <th className="px-3 py-1.5 text-left text-xs text-graphite-500 dark:text-graphite-400">Nome</th>
                </tr>
              </thead>
              <tbody>
                {lro.apoioOutrosSlots.map((s, i) => (
                  <tr key={i} className="border-b border-graphite-100 dark:border-border-dark">
                    <td className="px-3 py-1.5">{s.funcao || '-'}</td>
                    <td className="px-3 py-1.5">{s.nome || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-xs text-graphite-500 dark:text-graphite-400">Demais informações disponíveis na edição/visualização expandida.</div>
      </div>
    </div>
  );
}

// ─── MAIN ───────────────────────────
export function LRODiario() {
  const { user } = useAuth();
  const username = user?.username || '';
  const [role, setRole] = useState<'admin' | 'gerente' | 'chefe'>('chefe');
  const [userEquipe, setUserEquipe] = useState('');
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let r: 'admin' | 'gerente' | 'chefe' = 'chefe';
      let eq = '';
      if (username === 'admin') {
        r = 'admin';
      } else {
        const users = JSON.parse(localStorage.getItem('sescinc-users') || '{}');
        const stored = users[username];
        if (stored?.role === 'desenvolvedor' || stored?.role === 'admin') {
          r = 'admin';
        } else {
          const bombeiros = await listarBombeiros();
          if (cancelled) return;
          const b = bombeiros.find(
            x => x.nomeGuerra.toLowerCase() === username.toLowerCase() ||
                 x.nomeCompleto.toLowerCase().includes(username.toLowerCase()),
          );
          if (b?.cargo === 'GS' || b?.equipe === 'Embaixador') r = 'gerente';
          else if (b?.cargo === 'BA-CE' || b?.cargo === 'BA-LR') r = 'chefe';
          eq = b?.equipe || '';
        }
      }
      setRole(r);
      setUserEquipe(eq);
    }
    load();
    return () => { cancelled = true; };
  }, [username]);
  const isAdmin = role === 'admin';
  const isGerente = role === 'gerente';
  const canFilterTeam = isAdmin || isGerente;
  const canEdit = isAdmin || role === 'chefe';

  const [lros, setLros] = useState<LRO[]>([]);
  const [mode, setMode] = useState<'list' | 'form' | 'view'>('list');
  const [editando, setEditando] = useState<LRO | null>(null);
  const [visualizando, setVisualizando] = useState<LRO | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const ANOS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
  const inputClass = 'rounded-xl border border-graphite-300/70 bg-white/70 px-3 py-2.5 text-sm backdrop-blur-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated';

  async function carregar() {
    try {
      const atuais = await listarLROs();
      if (isAdmin || isGerente) {
        setLros(atuais);
      } else if (userEquipe) {
        setLros(atuais.filter(e => e.equipe === userEquipe));
      } else {
        setLros(atuais.filter(e => e.createdBy === username));
      }
    } catch (err) {
      console.error('Erro ao carregar LROs:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, [isAdmin, isGerente, username, userEquipe]);

  let filtradas = lros;
  if (filtroMes) {
    filtradas = filtradas.filter(e => {
      const d = new Date(e.dataEntrada);
      return (d.getMonth() + 1).toString() === filtroMes;
    });
  }
  if (filtroAno) {
    filtradas = filtradas.filter(e => e.dataEntrada.startsWith(filtroAno));
  }
  if (canFilterTeam && filtroEquipe) {
    filtradas = filtradas.filter(e => e.equipe === filtroEquipe);
  }

  async function handleSave(data: Omit<LRO, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>, stayInForm = false) {
    try {
      let saved: LRO | null;
      if (editando && editando.id) {
        saved = await atualizarLRO(editando.id, data);
      } else {
        saved = await criarLRO({ ...data, createdBy: username });
      }
      await carregar();
      if (saved && stayInForm) {
        setEditando(saved);
      } else if (saved) {
        setEditando(null);
        setVisualizando(saved);
        setMode('view');
      } else {
        setMode('list');
      }
    } catch (err) {
      console.error('Erro ao salvar LRO:', err);
    }
  }

  function handleSaveAndView(data: Omit<LRO, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) {
    handleSave(data, false);
  }

  function handleSaveAndContinue(data: Omit<LRO, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) {
    handleSave(data, true);
  }

  function handleClone(lro: LRO) {
    setEditando({ ...lro, id: '', createdAt: '', updatedAt: '', createdBy: '' });
    setMode('form');
  }

  async function handleDelete(id: string) {
    try {
      await excluirLRO(id);
      setConfirmDelete(null);
      await carregar();
    } catch (err) {
      console.error('Erro ao excluir LRO:', err);
    }
  }

  if (mode === 'form') {
    return (
      <PageContainer>
        <PageTitle icon={FileSpreadsheet} title={editando?.id ? 'Editar LRO' : 'Novo LRO'} />
        <LROForm lro={editando || undefined} onSave={handleSaveAndView} onSaveDraft={handleSaveAndContinue} onCancel={() => { setMode('list'); setEditando(null); }} />
      </PageContainer>
    );
  }

  if (mode === 'view' && visualizando) {
    return (
      <PageContainer>
        <ViewModeLRO lro={visualizando} onBack={() => setMode('list')} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle icon={FileSpreadsheet} title="LRO - Registro Diário" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" />
        </div>
      ) : (
        <>
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
              {canFilterTeam && (
                <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)}
                  className={inputClass}>
                  <option value="">Todas as equipes</option>
                  {EQUIPES.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                </select>
              )}
              <p className="text-sm text-graphite-500 dark:text-graphite-400">{filtradas.length} LRO(s)</p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <>
                  <button onClick={() => {
                    const sorted = [...lros].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                    if (sorted.length > 0) handleClone(sorted[0]);
                    else { setEditando(null); setMode('form'); }
                  }} className="flex items-center gap-1.5 rounded-xl border border-graphite-300/60 bg-white/80 px-3.5 py-2.5 text-sm font-medium text-graphite-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-graphite-50 hover:border-graphite-300 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200 dark:hover:bg-surface-hover/50">
                    <Copy className="h-4 w-4" /> Copiar Último
                  </button>
                  <button onClick={() => { setEditando(null); setMode('form'); }}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
                    <Plus className="h-4 w-4" /> Criar LRO
                  </button>
                </>
              )}
            </div>
          </div>

          {filtradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300/60 bg-white/50 p-12 text-center backdrop-blur-sm dark:border-border-dark dark:bg-surface-card">
              <FileSpreadsheet className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
              <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum LRO encontrado</h3>
              <p className="text-sm text-graphite-500 dark:text-graphite-400">Clique em "Criar LRO" para começar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtradas.map(lro => (
                <LROCard key={lro.id} lro={lro} canEdit={canEdit}
                  onView={() => { setVisualizando(lro); setMode('view'); }}
                  onEdit={() => { setEditando(lro); setMode('form'); }}
                  onClone={() => handleClone(lro)}
                  onDelete={() => setConfirmDelete(lro.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white/95 p-6 shadow-xl shadow-black/5 backdrop-blur-sm dark:bg-surface-elevated/95 dark:shadow-black/20">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            <p className="mb-6 text-sm text-graphite-500 dark:text-graphite-400">Tem certeza que deseja excluir este LRO?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2.5 text-sm font-medium text-graphite-700 shadow-sm backdrop-blur-sm transition-all duration-200 hover:bg-graphite-50 hover:border-graphite-300 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200 dark:hover:bg-surface-hover/50">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="rounded-xl bg-gradient-to-r from-alert-red to-red-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-red-500/30 active:scale-[0.98]">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default LRODiario;
