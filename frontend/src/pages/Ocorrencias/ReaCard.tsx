import { useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, Download, Eye, Pencil, Trash2 } from 'lucide-react';
import type { ReaRegistro } from '../../types/rea';
import { formatarDataBR } from '../../utils/datas';

function fmtDate(value?: string): string {
  return formatarDataBR(value);
}

export function ReaCard({
  rea,
  canEdit,
  downloading,
  processing,
  approving,
  onEdit,
  onDelete,
  onPreview,
  onApprove,
  onDownload,
}: {
  rea: ReaRegistro;
  canEdit: boolean;
  downloading: boolean;
  processing: boolean;
  approving: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPreview: () => void;
  onApprove: () => void;
  onDownload: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusColor: Record<string, string> = {
    Aberta: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    Fechada: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  };
  const isFechada = rea.status === 'Fechada';
  const cardCls = 'rounded-xl border border-graphite-200/60 bg-graphite-50/70 p-3 dark:border-border-dark dark:bg-surface-hover/70';
  const labelCls = 'text-[10px] font-black uppercase tracking-wider text-graphite-500 dark:text-graphite-400';
  const valueCls = 'mt-1 text-sm font-semibold text-graphite-900 dark:text-graphite-100';
  const detalhe = (label: string, value?: string) => (
    <div className={cardCls}>
      <p className={labelCls}>{label}</p>
      <p className={valueCls}>{value || '-'}</p>
    </div>
  );

  return (
    <div className="rounded-2xl border border-graphite-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between px-5 py-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-900/20 dark:text-red-400">REA</span>
            <span className="shrink-0 text-xs font-semibold text-graphite-500 dark:text-graphite-400">{rea.numero}</span>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusColor[rea.status] || ''}`}>{rea.status}</span>
            {rea.matricula && <span className="shrink-0 rounded-full bg-aviation-50 px-2.5 py-0.5 text-[10px] font-medium text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">{rea.matricula}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-graphite-500 dark:text-graphite-400">
            <span>{fmtDate(rea.dataAcidente)}</span>
            {rea.horaAcidente && <span>às {rea.horaAcidente}</span>}
            {rea.aerodromo && <span>{rea.aerodromo}</span>}
            {rea.cidade && <span>{rea.cidade}</span>}
          </div>
        </div>
        {expanded ? <ChevronUp className="ml-2 h-4 w-4 shrink-0 text-graphite-400" /> : <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-graphite-400" />}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-graphite-200 px-5 py-4 dark:border-border-dark">
          <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-4">
            {detalhe('Data', fmtDate(rea.dataAcidente))}
            {detalhe('Hora', rea.horaAcidente)}
            {detalhe('Aerodromo', rea.aerodromo)}
            {detalhe('Cidade', rea.cidade)}
            {detalhe('Empresa', rea.empresa)}
            {detalhe('Matricula', rea.matricula)}
            {detalhe('Equipe', rea.equipe)}
            {detalhe('Status', rea.status)}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {detalhe('Tipo da aeronave', rea.dados.tipoAeronave)}
            {detalhe('Fase da operacao', rea.dados.faseOperacao)}
            {detalhe('Periodo', rea.dados.acidentePeriodo)}
            {detalhe('Visibilidade', rea.dados.visibilidade)}
            {detalhe('Teto', rea.dados.teto)}
            {detalhe('Vento', [rea.dados.direcaoVento, rea.dados.velocidadeVento].filter(Boolean).join(' / '))}
          </div>

          {rea.dados.descricaoEmergencia && (
            <div className={cardCls}>
              <p className={labelCls}>Descricao da emergencia</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-graphite-800 dark:text-graphite-100">{rea.dados.descricaoEmergencia}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 border-t border-graphite-200/60 pt-3 dark:border-border-dark">
            {!isFechada && canEdit && (
              <button
                type="button"
                onClick={onApprove}
                disabled={approving}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle className="h-4 w-4" /> {approving ? 'Aprovando...' : 'Aprovar'}
              </button>
            )}
            <button
              type="button"
              onClick={onPreview}
              disabled={processing}
              className="flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-3 py-2 text-xs font-semibold text-aviation-700 transition-all hover:bg-aviation-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300"
            >
              <Eye className="h-4 w-4" /> {processing ? 'Gerando...' : 'Ver documento'}
            </button>
            {isFechada && (
              <button
                onClick={onDownload}
                disabled={downloading}
                className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
              >
                <Download className="h-4 w-4" /> {downloading ? 'Gerando...' : 'PDF'}
              </button>
            )}
            {canEdit && (
              <>
                <button onClick={onEdit} className="flex items-center gap-2 rounded-xl bg-graphite-100 px-3 py-2 text-xs font-medium text-graphite-700 transition-colors hover:bg-graphite-200 dark:bg-surface-hover dark:text-graphite-300 dark:hover:bg-surface-hover">
                  <Pencil className="h-4 w-4" /> Editar
                </button>
                <button onClick={onDelete} className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-alert-red transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30">
                  <Trash2 className="h-4 w-4" /> Excluir
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
