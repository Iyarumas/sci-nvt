import { useEffect, useState } from 'react';
import { Printer, ClipboardList, ArrowLeft } from 'lucide-react';
import { listarOrdensServico } from '../../services/ordemServicoService';
import type { OrdemServico } from '../../types/ordemServico';

const PRIORIDADE_CORES: Record<string, string> = {
  'Baixa': 'bg-sky-100 text-sky-700',
  'Média': 'bg-amber-100 text-amber-700',
  'Alta': 'bg-orange-100 text-orange-700',
  'Urgente': 'bg-red-100 text-red-700',
};

const STATUS_CORES: Record<string, string> = {
  'Aberta': 'bg-blue-100 text-blue-700',
  'Manutenção': 'bg-yellow-100 text-yellow-700',
  'Concluída': 'bg-green-100 text-green-700',
  'Cancelada': 'bg-red-100 text-red-700',
};

function fmt(d: string) {
  if (!d) return '-';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00') : new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('pt-BR');
}

export function OrdemServicoPublica() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionada, setSelecionada] = useState<OrdemServico | null>(null);

  useEffect(() => {
    let active = true;
    listarOrdensServico()
      .then(lista => {
        if (active) setOrdens(lista);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-graphite-50 p-4 dark:bg-[#0d1117]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" />
      </div>
    );
  }

  if (selecionada) {
    return (
      <div className="min-h-screen bg-graphite-50 p-4 dark:bg-[#0d1117]">
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setSelecionada(null)}
              className="flex items-center gap-1 rounded-xl border border-graphite-300 bg-white px-3 py-1.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <button onClick={() => window.print()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2 text-sm font-medium text-white shadow-lg">
              <Printer className="h-4 w-4" /> Imprimir
            </button>
          </div>

          <style>{`
            @media print {
              @page { size: A4; margin: 7mm 10mm; }
              body * { visibility: hidden; }
              #print-area, #print-area * { visibility: visible; }
              #print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                box-shadow: none !important;
              }
              .no-print { display: none !important; }
              #print-area { font-size: 10pt; padding: 0 !important; }
              #print-area h1 { font-size: 13pt !important; }
              #print-area p { font-size: 9pt !important; margin: 1.5pt 0 !important; }
              #print-area .grid { gap: 2pt 10pt !important; }
              #print-area .grid > * { font-size: 9pt !important; }
              #print-area .rounded-lg { padding: 4pt 6pt !important; }
              #print-area img { max-height: 60mm !important; }
              #print-area .border-b-2 { padding-bottom: 4pt !important; margin-bottom: 5pt !important; }
            }
          `}</style>
          <div id="print-area" className="rounded-2xl bg-white p-6 shadow-sm dark:border-border-dark dark:bg-surface-card">
            <div className="border-b-2 border-graphite-800 pb-3 text-center">
              <h1 className="text-xl font-black uppercase text-graphite-900 dark:text-graphite-100">Ordem de Serviço</h1>
              <p className="text-sm text-graphite-500 dark:text-graphite-400">{selecionada.numero}</p>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <div className="dark:text-graphite-200"><span className="font-bold text-graphite-600 dark:text-graphite-300">Número:</span> {selecionada.numero}</div>
              <div className="dark:text-graphite-200"><span className="font-bold text-graphite-600 dark:text-graphite-300">Solicitante:</span> {selecionada.solicitanteNome}{selecionada.solicitanteCargo ? ` (${selecionada.solicitanteCargo})` : ''}</div>
              <div className="dark:text-graphite-200"><span className="font-bold text-graphite-600 dark:text-graphite-300">Equipe:</span> {selecionada.equipe || 'N/A'}</div>
              <div className="dark:text-graphite-200"><span className="font-bold text-graphite-600 dark:text-graphite-300">Emissão:</span> {fmt(selecionada.dataEmissao)}</div>
              <div className="dark:text-graphite-200"><span className="font-bold text-graphite-600 dark:text-graphite-300">Prioridade:</span> {selecionada.prioridade}</div>
              <div className="dark:text-graphite-200"><span className="font-bold text-graphite-600 dark:text-graphite-300">Status:</span> {selecionada.status}</div>
              {selecionada.local && <div className="dark:text-graphite-200"><span className="font-bold text-graphite-600 dark:text-graphite-300">Local:</span> {selecionada.local}</div>}
              {selecionada.dataConclusao && <div className="dark:text-graphite-200"><span className="font-bold text-graphite-600 dark:text-graphite-300">Conclusão:</span> {fmt(selecionada.dataConclusao)}</div>}
            </div>

            {selecionada.motivoManutencao && (
              <div className="mt-4 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300">
                <p className="mb-1 font-bold">Manutenção não concluída</p>
                <p className="whitespace-pre-wrap">{selecionada.motivoManutencao}</p>
                {selecionada.manutencaoPor && <p className="mt-2 text-xs opacity-80">Em manutenção por: {selecionada.manutencaoPor}{selecionada.manutencaoPorCargo ? ` (${selecionada.manutencaoPorCargo})` : ''}{selecionada.manutencaoEmpresaPessoa ? ` · ${selecionada.manutencaoEmpresaPessoa}` : ''}{selecionada.manutencaoEmpresa ? ` · ${selecionada.manutencaoEmpresa}` : ''}</p>}
              </div>
            )}
            {selecionada.finalizacaoDescricao && (
              <div className="mt-4 rounded-lg border border-green-300 bg-green-50 p-4 text-sm text-green-800 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300">
                <p className="mb-1 font-bold">Descrição da finalização</p>
                <p className="whitespace-pre-wrap">{selecionada.finalizacaoDescricao}</p>
                {selecionada.finalizadoPor && <p className="mt-2 text-xs opacity-80">Finalizado por: {selecionada.finalizadoPor}{selecionada.finalizadoPorCargo ? ` (${selecionada.finalizadoPorCargo})` : ''}{selecionada.finalizacaoEmpresaPessoa ? ` · ${selecionada.finalizacaoEmpresaPessoa}` : ''}{selecionada.empresaFinalizacao ? ` · ${selecionada.empresaFinalizacao}` : ''}</p>}
              </div>
            )}
            {selecionada.motivoCancelamento && (
              <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
                <p className="mb-1 font-bold">Motivo do cancelamento</p>
                <p className="whitespace-pre-wrap">{selecionada.motivoCancelamento}</p>
                {selecionada.canceladoPor && <p className="mt-2 text-xs opacity-80">Cancelado por: {selecionada.canceladoPor}{selecionada.canceladoPorCargo ? ` (${selecionada.canceladoPorCargo})` : ''}</p>}
              </div>
            )}

            <div className="mt-4">
              <h2 className="mb-1 text-xs font-bold uppercase text-graphite-500 dark:text-graphite-400">Descrição</h2>
              <div className="rounded-lg border border-graphite-300 bg-graphite-50 p-4 text-sm whitespace-pre-wrap dark:border-border-dark dark:bg-surface-hover dark:text-graphite-100">{selecionada.descricao}</div>
            </div>

            {selecionada.imagem && (
              <div className="mt-4">
                <h2 className="mb-1 text-xs font-bold uppercase text-graphite-500 dark:text-graphite-400">Imagem do Problema</h2>
                <img src={selecionada.imagem} alt="Imagem da OS" className="max-h-72 w-full rounded-lg border border-graphite-300 object-contain dark:border-border-dark" />
              </div>
            )}

            {selecionada.observacoes && (
              <div className="mt-4">
                <h2 className="mb-1 text-xs font-bold uppercase text-graphite-500 dark:text-graphite-400">Observações</h2>
                <div className="rounded-lg border border-graphite-300 bg-graphite-50 p-4 text-sm whitespace-pre-wrap dark:border-border-dark dark:bg-surface-hover dark:text-graphite-100">{selecionada.observacoes}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-graphite-50 p-4 dark:bg-[#0d1117]">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-black uppercase text-graphite-900 dark:text-graphite-100">Ordens de Serviço</h1>
          <p className="mt-1 text-sm text-graphite-500 dark:text-graphite-400">Acompanhamento público das ordens de serviço</p>
        </div>

        {ordens.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card">
            <ClipboardList className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
            <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhuma OS encontrada</h3>
          </div>
        ) : (
          <div className="space-y-2">
            {ordens.map(os => (
              <button key={os.id} onClick={() => setSelecionada(os)}
                className="block w-full rounded-2xl border border-graphite-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{os.numero}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${PRIORIDADE_CORES[os.prioridade] || ''}`}>{os.prioridade}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${STATUS_CORES[os.status] || ''}`}>{os.status}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-graphite-500 dark:text-graphite-400">{os.descricao}</p>
                    <p className="text-[10px] text-graphite-400 dark:text-graphite-500">{os.solicitanteNome}{os.solicitanteCargo ? ` · ${os.solicitanteCargo}` : ''} · {fmt(os.dataEmissao)} · {os.equipe}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OrdemServicoPublica;
