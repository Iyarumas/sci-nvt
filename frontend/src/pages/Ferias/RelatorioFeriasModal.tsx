import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Download, FileText, Printer, X } from 'lucide-react';
import { MESES } from '../../types/ferias';
import type { FiltrosRelatorioFerias } from '../../types/relatorioFerias';
import { carregarRelatorioFerias } from '../../services/feriasRelatorioService';
import { gerarRelatorioFeriasPdf, nomeArquivoRelatorioFerias } from '../../services/feriasRelatorioPdfService';
import { downloadPdf } from '../../services/pdfService';
import { imprimirPdfBlob } from '../../utils/pdfPrint';

const PdfPreview = lazy(() => import('../../components/documentos/PdfPreview').then(module => ({ default: module.PdfPreview })));
const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:scheme-dark';
const secondaryCls = 'rounded-xl border border-graphite-300 px-4 py-2.5 text-sm font-medium text-graphite-700 hover:bg-graphite-50 disabled:opacity-50 dark:border-border-dark dark:text-graphite-200 dark:hover:bg-surface-hover';
const primaryCls = 'flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 disabled:opacity-50';

export function RelatorioFeriasModal({ onClose }: { onClose: () => void }) {
  const [filtros, setFiltros] = useState<FiltrosRelatorioFerias>(() => ({ mes: new Date().getMonth() + 1, ano: new Date().getFullYear(), incluirAfastados: false }));
  const [gerando, setGerando] = useState(false);
  const [imprimindo, setImprimindo] = useState(false);
  const [erro, setErro] = useState('');
  const [preview, setPreview] = useState<{ blob: Blob; data: ArrayBuffer; nome: string; titulo: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const ocupado = gerando || imprimindo;

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      anterior?.focus();
    };
  }, []);

  async function gerar(event: React.FormEvent) {
    event.preventDefault();
    if (gerando) return;
    setGerando(true);
    setErro('');
    try {
      const relatorio = await carregarRelatorioFerias(filtros);
      const blob = await gerarRelatorioFeriasPdf(relatorio);
      setPreview({ blob, data: await blob.arrayBuffer(), nome: nomeArquivoRelatorioFerias(filtros), titulo: `${MESES[filtros.mes - 1]} / ${filtros.ano}` });
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível gerar o relatório de férias.');
    } finally {
      setGerando(false);
    }
  }

  async function imprimir() {
    if (!preview || imprimindo) return;
    setImprimindo(true);
    setErro('');
    try { await imprimirPdfBlob(preview.blob); }
    catch (error) { setErro(error instanceof Error ? error.message : 'Não foi possível imprimir o relatório.'); }
    finally { setImprimindo(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="relatorio-ferias-title" tabIndex={-1}
        onKeyDown={event => {
          if (event.key === 'Escape' && !ocupado) { event.stopPropagation(); onClose(); }
          if (event.key !== 'Tab') return;
          const controles = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex="0"]');
          if (!controles?.length) return;
          const primeiro = controles[0];
          const ultimo = controles[controles.length - 1];
          if (event.shiftKey && (document.activeElement === primeiro || document.activeElement === dialogRef.current)) { event.preventDefault(); ultimo.focus(); }
          else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primeiro.focus(); }
        }}
        className={`flex max-h-[94vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl outline-none dark:bg-surface-elevated ${preview ? 'h-[94vh] max-w-7xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between gap-3 border-b border-graphite-200 px-5 py-4 dark:border-border-dark">
          <div className="min-w-0">
            <h2 id="relatorio-ferias-title" className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{preview ? 'Prévia do Relatório de Férias' : 'Gerar Relatório de Férias'}</h2>
            {preview && <p className="text-sm text-graphite-500 dark:text-graphite-400">{preview.titulo}</p>}
          </div>
          <button type="button" aria-label="Fechar relatório de férias" onClick={onClose} disabled={ocupado} className="shrink-0 rounded-xl p-2 text-graphite-500 hover:bg-graphite-100 disabled:opacity-50 dark:text-graphite-300 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
        </div>
        {erro && <p role="alert" className="mx-5 mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{erro}</p>}
        {preview ? (
          <>
            <div className="min-h-0 flex-1 overflow-auto bg-graphite-100 p-3 dark:bg-surface-card sm:p-4">
              <Suspense fallback={<p className="py-10 text-center text-sm text-graphite-500">Carregando documento...</p>}>
                <PdfPreview pdfData={preview.data} fields={[]} />
              </Suspense>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-graphite-200 p-4 dark:border-border-dark">
              <button type="button" onClick={() => { setPreview(null); setErro(''); }} disabled={imprimindo} className={secondaryCls}>Alterar filtros</button>
              <button type="button" onClick={onClose} disabled={imprimindo} className={secondaryCls}>Fechar</button>
              <button type="button" onClick={imprimir} disabled={imprimindo} className={secondaryCls}><span className="flex items-center gap-2"><Printer className="h-4 w-4" /> {imprimindo ? 'Abrindo impressão...' : 'Imprimir'}</span></button>
              <button type="button" onClick={() => downloadPdf(preview.blob, preview.nome)} className={primaryCls}><Download className="h-4 w-4" /> Salvar em PDF</button>
            </div>
          </>
        ) : (
          <form onSubmit={gerar} className="space-y-5 overflow-y-auto p-5">
            <p className="text-sm text-graphite-500 dark:text-graphite-400">Férias iniciadas no mês selecionado, conforme o Quadro de Efetivos, com períodos de gozo, aquisitivos e substituições separados por equipe.</p>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1.5 text-sm font-medium text-graphite-700 dark:text-graphite-200">Mês
                <select aria-label="Mês" value={filtros.mes} onChange={event => setFiltros(f => ({ ...f, mes: Number(event.target.value) }))} disabled={gerando} className={inputCls}>
                  {MESES.map((mes, index) => <option key={mes} value={index + 1}>{mes}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium text-graphite-700 dark:text-graphite-200">Ano
                <input aria-label="Ano" type="number" min={1900} max={9998} required value={filtros.ano} onChange={event => setFiltros(f => ({ ...f, ano: Number(event.target.value) }))} disabled={gerando} className={inputCls} />
              </label>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-graphite-200 p-3 text-sm text-graphite-700 dark:border-border-dark dark:text-graphite-200">
              <input type="checkbox" checked={filtros.incluirAfastados} onChange={event => setFiltros(f => ({ ...f, incluirAfastados: event.target.checked }))} disabled={gerando} className="mt-0.5 h-4 w-4 accent-aviation-600" />
              <span>Incluir pessoas afastadas<span className="mt-1 block text-xs text-graphite-500 dark:text-graphite-400">Exibe ao final os afastamentos aprovados que abrangem o mês selecionado.</span></span>
            </label>
            <div className="flex justify-end gap-3 border-t border-graphite-200 pt-4 dark:border-border-dark">
              <button type="button" onClick={onClose} disabled={gerando} className={secondaryCls}>Cancelar</button>
              <button type="submit" disabled={gerando} className={primaryCls}><FileText className="h-4 w-4" /> {gerando ? 'Gerando...' : 'Gerar'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
