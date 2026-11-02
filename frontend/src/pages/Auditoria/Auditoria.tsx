import { useEffect, useState } from 'react';
import { History, RefreshCw, Search } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { ROLE_LABELS, type UserRole } from '../../context/AuthContext';
import { listarExclusoes, nomeModuloAuditoria } from '../../services/auditoriaService';
import type { FiltrosAuditoria, ListaExclusoes } from '../../types/auditoria';

const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:scheme-dark';
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';
const buttonCls = 'rounded-xl border border-aviation-300 bg-white px-4 py-2.5 text-sm font-medium text-aviation-700 disabled:opacity-50 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300';
const formatarData = (data: string) => new Date(data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

export default function Auditoria() {
  const [form, setForm] = useState({ termo: '', tabela: '', inicio: '', fim: '' });
  const [filtros, setFiltros] = useState<FiltrosAuditoria>({ pagina: 1 });
  const [resultado, setResultado] = useState<ListaExclusoes | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setErro('');
    listarExclusoes(filtros, controller.signal)
      .then(data => { if (!controller.signal.aborted) setResultado(data); })
      .catch(err => { if (!controller.signal.aborted) setErro(err instanceof Error ? err.message : 'Não foi possível carregar a auditoria.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filtros, refresh]);

  const pagina = filtros.pagina || 1;
  const totalPaginas = Math.max(1, Math.ceil((resultado?.total || 0) / (resultado?.porPagina || 50)));

  return (
    <PageContainer>
      <PageTitle icon={History} title="Auditoria de exclusões" subtitle="Consulte quem excluiu cada registro e quando a exclusão aconteceu." />
      <div className="mb-6 rounded-xl border border-aviation-200 bg-aviation-50 p-4 text-sm text-aviation-900 dark:border-aviation-800 dark:bg-aviation-900/20 dark:text-aviation-200">
        {resultado?.inicioAuditoria ? `Registro automático ativo desde ${formatarData(resultado.inicioAuditoria)}.` : 'O histórico registra exclusões a partir da ativação da auditoria.'}
        {' '}Exclusões anteriores não têm autoria recuperada. Os horários seguem Brasília.
      </div>
      <form className="mb-6 flex flex-wrap items-end gap-3 rounded-2xl border border-graphite-200/60 bg-white/80 p-4 dark:border-border-dark dark:bg-surface-card" onSubmit={event => {
        event.preventDefault();
        if (form.inicio && form.fim && form.inicio > form.fim) { setErro('A data final deve ser igual ou posterior à inicial.'); return; }
        setFiltros({ ...form, pagina: 1 });
      }}>
        <label className="min-w-48 flex-1"><span className={labelCls}>Pesquisar</span><input className={inputCls} value={form.termo} maxLength={100} placeholder="Registro, usuário ou identificador" onChange={event => setForm({ ...form, termo: event.target.value })} /></label>
        <label className="min-w-48 flex-1"><span className={labelCls}>Módulo</span><select aria-label="Módulo" className={inputCls} value={form.tabela} onChange={event => setForm({ ...form, tabela: event.target.value })}>
          <option value="">Todos os módulos</option>
          {[...(resultado?.tabelas || [])].sort((a, b) => nomeModuloAuditoria(a).localeCompare(nomeModuloAuditoria(b), 'pt-BR')).map(tabela => <option key={tabela} value={tabela}>{nomeModuloAuditoria(tabela)}</option>)}
        </select></label>
        <label><span className={labelCls}>Data inicial</span><input type="date" className={inputCls} value={form.inicio} onChange={event => setForm({ ...form, inicio: event.target.value })} /></label>
        <label><span className={labelCls}>Data final</span><input type="date" className={inputCls} min={form.inicio || undefined} value={form.fim} onChange={event => setForm({ ...form, fim: event.target.value })} /></label>
        <button type="submit" className={buttonCls} disabled={loading}><Search className="mr-2 inline h-4 w-4" />Filtrar</button>
        <button type="button" className={buttonCls} disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw className="mr-2 inline h-4 w-4" />Atualizar</button>
      </form>
      {erro && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{erro}</div>}
      {loading ? <div role="status" className="flex items-center justify-center gap-3 py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" /><span>Carregando auditoria...</span></div>
        : !erro && resultado?.registros.length === 0 ? <div className="rounded-2xl border border-dashed border-graphite-300 p-12 text-center dark:border-border-dark"><History className="mx-auto mb-4 h-12 w-12 text-graphite-400" /><h2 className="font-semibold">Nenhuma exclusão encontrada</h2><p className="mt-2 text-sm text-graphite-500">Não há exclusões registradas para os filtros selecionados.</p></div>
          : !erro && resultado ? <>
            <p className="mb-3 text-sm text-graphite-500 dark:text-graphite-400">{resultado.total} exclusão(ões) encontrada(s)</p>
            <div className="overflow-x-auto rounded-2xl border border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-graphite-50 text-graphite-500 dark:bg-surface-hover dark:text-graphite-400"><tr>{['Data e hora', 'Quem excluiu', 'Módulo', 'Registro excluído'].map(label => <th key={label} className="whitespace-nowrap p-4 font-semibold">{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-graphite-200 dark:divide-border-dark">{resultado.registros.map(registro => <tr key={registro.id}>
                  <td className="whitespace-nowrap p-4"><time dateTime={registro.createdAt}>{formatarData(registro.createdAt)}</time></td>
                  <td className="p-4"><span className="font-semibold">{registro.usuarioLogin || 'Usuário não identificado'}</span><p className="mt-1 text-xs text-graphite-500">{registro.origem === 'sistema' ? ROLE_LABELS[registro.usuarioFuncao as UserRole] || registro.usuarioFuncao : 'Operação sem sessão identificada do sistema'}</p></td>
                  <td className="p-4">{nomeModuloAuditoria(registro.tabela)}</td>
                  <td className="p-4"><span className="font-semibold break-words">{registro.identificacao}</span><p className="mt-1 break-all text-xs text-graphite-500">ID: {registro.registroId || 'Não disponível'}</p></td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-graphite-500">Página {pagina} de {totalPaginas}</span><div className="flex gap-2"><button className={buttonCls} disabled={pagina <= 1} onClick={() => setFiltros({ ...filtros, pagina: pagina - 1 })}>Anterior</button><button className={buttonCls} disabled={pagina >= totalPaginas} onClick={() => setFiltros({ ...filtros, pagina: pagina + 1 })}>Próxima</button></div></div>
          </> : null}
    </PageContainer>
  );
}
