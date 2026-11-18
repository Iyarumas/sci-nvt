import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { FileText, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useAuth } from '../../context/AuthContext';
import {
  atualizarPrePreenchimento,
  criarPrePreenchimento,
  excluirPrePreenchimento,
  listarPrePreenchimentos,
} from '../../services/prePreenchimentoService';
import { TELAS_PRE_PREENCHIMENTO, type PrePreenchimento, type TelaPrePreenchimento } from '../../types/prePreenchimento';

const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:scheme-dark';
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

interface Rascunho { tela: TelaPrePreenchimento; tipo: string; descricao: string }

/**
 * Administrador cadastra modelos de Tipo e Descrição para padronizar os registros.
 * Cada modelo aparece em uma tela só: LRO/Ocorrências, Inspeções ou Solicitações.
 */
export default function PrePreenchimentos() {
  const { user } = useAuth();
  const [modelos, setModelos] = useState<PrePreenchimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [secao, setSecao] = useState<TelaPrePreenchimento>('ocorrencias');
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function carregar() {
    setLoading(true);
    setErro('');
    try {
      setModelos(await listarPrePreenchimentos());
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar os pré-preenchimentos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void carregar(); }, []);

  const contagem = useMemo(() => {
    const total: Record<TelaPrePreenchimento, number> = { ocorrencias: 0, inspecoes: 0, solicitacoes: 0 };
    for (const m of modelos) total[m.tela] += 1;
    return total;
  }, [modelos]);
  const daSecao = modelos.filter(m => m.tela === secao);

  function novo() {
    setEditandoId(null);
    setRascunho({ tela: secao, tipo: '', descricao: '' });
  }

  function editar(m: PrePreenchimento) {
    setEditandoId(m.id);
    setRascunho({ tela: m.tela, tipo: m.tipo, descricao: m.descricao });
  }

  function fechar() {
    setEditandoId(null);
    setRascunho(null);
  }

  async function salvar(event: FormEvent) {
    event.preventDefault();
    if (!rascunho || !rascunho.tipo.trim() || !rascunho.descricao.trim()) return;
    setSaving(true);
    setErro('');
    try {
      if (editandoId) await atualizarPrePreenchimento(editandoId, rascunho);
      else await criarPrePreenchimento(rascunho, user?.username || '');
      setSecao(rascunho.tela);
      fechar();
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar o pré-preenchimento.');
    } finally {
      setSaving(false);
    }
  }

  async function excluir(m: PrePreenchimento) {
    if (!window.confirm(`Excluir o pré-preenchimento "${m.tipo}"? Os registros já feitos com ele não mudam.`)) return;
    setErro('');
    try {
      await excluirPrePreenchimento(m.id);
      if (editandoId === m.id) fechar();
      await carregar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível excluir o pré-preenchimento.');
    }
  }

  return (
    <PageContainer>
      <PageTitle
        icon={Sparkles}
        title="Pré-preenchimentos"
        subtitle="Modelos de Tipo e Descrição para padronizar os registros. A pessoa escolhe o modelo e completa o que for preciso."
      />

      {erro && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{erro}</div>}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Seção" className="inline-flex flex-wrap gap-1 rounded-xl border border-graphite-200/70 bg-white/80 p-1 dark:border-border-dark dark:bg-surface-card">
          {TELAS_PRE_PREENCHIMENTO.map(t => (
            <button
              key={t.value}
              role="tab"
              aria-selected={secao === t.value}
              onClick={() => setSecao(t.value)}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${secao === t.value
                ? 'bg-aviation-600 text-white shadow-sm'
                : 'text-graphite-600 hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover'}`}
            >
              {t.label}
              <span className={`ml-2 rounded-md px-1.5 py-0.5 text-xs tabular-nums ${secao === t.value ? 'bg-white/20' : 'bg-graphite-100 dark:bg-surface-hover'}`}>{contagem[t.value]}</span>
            </button>
          ))}
        </div>
        <button onClick={novo} disabled={saving} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50">
          <Plus className="h-4 w-4" /> Novo pré-preenchimento
        </button>
      </div>

      {/* Novo modelo: formulário em cima da lista. Editar abre o formulário no lugar do próprio card. */}
      {!editandoId && formulario('mb-6')}

      {lista()}
    </PageContainer>
  );

  function formulario(classeExtra: string) {
    if (!rascunho) return null;
    return (
        <form onSubmit={salvar} className={`${classeExtra} rounded-2xl border border-aviation-200/70 bg-white/90 p-5 shadow-sm dark:border-aviation-800/40 dark:bg-surface-card`}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-graphite-900 dark:text-graphite-100">{editandoId ? 'Editar pré-preenchimento' : 'Novo pré-preenchimento'}</h2>
            <button type="button" onClick={fechar} aria-label="Fechar" className="rounded-lg p-1.5 text-graphite-400 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label>
              <span className={labelCls}>Onde aparece *</span>
              <select value={rascunho.tela} onChange={e => setRascunho({ ...rascunho, tela: e.target.value as TelaPrePreenchimento })} className={inputCls}>
                {TELAS_PRE_PREENCHIMENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className={labelCls}>Título (vai no campo Tipo) *</span>
              <input value={rascunho.tipo} maxLength={150} onChange={e => setRascunho({ ...rascunho, tipo: e.target.value })} className={inputCls} placeholder="Ex.: Ausência da Central" required />
            </label>
            <label className="sm:col-span-3">
              <span className={labelCls}>Descrição *</span>
              <textarea value={rascunho.descricao} onChange={e => setRascunho({ ...rascunho, descricao: e.target.value })} rows={5} className={inputCls + ' resize-y'}
                placeholder='Ex.: Informado TWR e APOC .... sobre ausência da central devido atividades internas.' required />
              <span className="mt-1 block text-xs text-graphite-500 dark:text-graphite-400">Use "...." nos trechos que a pessoa deve completar (nomes, empresa, status).</span>
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={fechar} className="rounded-xl border border-graphite-300/60 bg-white/80 px-5 py-2.5 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200">Cancelar</button>
            <button type="submit" disabled={saving || !rascunho.tipo.trim() || !rascunho.descricao.trim()}
              className="rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 hover:from-aviation-500 hover:to-aviation-600 disabled:pointer-events-none disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
    );
  }

  function lista() {
    return loading ? (
        <div role="status" className="flex items-center justify-center gap-3 py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" /><span>Carregando...</span></div>
      ) : daSecao.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-graphite-300 p-12 text-center dark:border-border-dark">
          <FileText className="mx-auto mb-3 h-10 w-10 text-graphite-400" />
          <h2 className="font-semibold text-graphite-800 dark:text-graphite-100">Nenhum pré-preenchimento nesta seção</h2>
          <p className="mt-1 text-sm text-graphite-500">Enquanto não houver modelos, a tela de registro continua só com o preenchimento manual.</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {daSecao.map(m => m.id === editandoId ? (
            <li key={m.id} className="lg:col-span-2">{formulario('')}</li>
          ) : (
            <li key={m.id} className="rounded-2xl border border-graphite-200/60 bg-white/80 p-4 shadow-sm dark:border-border-dark dark:bg-surface-card">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-graphite-900 dark:text-graphite-100">{m.tipo}</h3>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => editar(m)} aria-label={`Editar ${m.tipo}`} className="rounded-lg p-1.5 text-graphite-500 hover:bg-graphite-100 hover:text-aviation-600 dark:hover:bg-surface-hover"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => excluir(m)} aria-label={`Excluir ${m.tipo}`} className="rounded-lg p-1.5 text-graphite-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-graphite-600 dark:text-graphite-300">{m.descricao}</p>
            </li>
          ))}
        </ul>
      );
  }
}
