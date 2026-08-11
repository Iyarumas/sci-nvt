import { useState } from 'react';
import { ChevronDown, ChevronUp, Download, Pencil, Trash2 } from 'lucide-react';
import type { ReaRegistro } from '../../types/rea';

function fmtDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

export function ReaCard({
  rea,
  canEdit,
  downloading,
  onEdit,
  onDelete,
  onDownload,
}: {
  rea: ReaRegistro;
  canEdit: boolean;
  downloading: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusColor: Record<string, string> = {
    Aberta: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    Fechada: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  };

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
            {rea.horaAcidente && <span>as {rea.horaAcidente}</span>}
            {rea.aerodromo && <span>{rea.aerodromo}</span>}
            {rea.cidade && <span>{rea.cidade}</span>}
          </div>
        </div>
        {expanded ? <ChevronUp className="ml-2 h-4 w-4 shrink-0 text-graphite-400" /> : <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-graphite-400" />}
      </button>

      {expanded && (
        <div className="border-t border-graphite-200 px-5 py-4 dark:border-border-dark">
          <p className="mb-3 text-sm font-semibold text-graphite-700 dark:text-graphite-300">Relatorio de Registro de Emergencias Aeronauticas</p>
          <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-4">
            <div><span className="font-semibold text-graphite-500">Aerodromo:</span> <span className="text-graphite-700 dark:text-graphite-200">{rea.aerodromo || '-'}</span></div>
            <div><span className="font-semibold text-graphite-500">Cidade:</span> <span className="text-graphite-700 dark:text-graphite-200">{rea.cidade || '-'}</span></div>
            <div><span className="font-semibold text-graphite-500">Empresa:</span> <span className="text-graphite-700 dark:text-graphite-200">{rea.empresa || '-'}</span></div>
            <div><span className="font-semibold text-graphite-500">Equipe:</span> <span className="text-graphite-700 dark:text-graphite-200">{rea.equipe || '-'}</span></div>
          </div>
          {rea.dados.descricaoEmergencia && (
            <p className="mt-3 text-sm text-graphite-700 dark:text-graphite-300">{rea.dados.descricaoEmergencia}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={onDownload}
              disabled={downloading}
              className="flex items-center gap-1 rounded-lg bg-aviation-50 px-3 py-1.5 text-xs font-medium text-aviation-700 transition-colors hover:bg-aviation-100 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-aviation-900/30 dark:text-aviation-300 dark:hover:bg-aviation-900/50"
            >
              <Download className="h-3.5 w-3.5" /> {downloading ? 'Gerando...' : 'Download'}
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

