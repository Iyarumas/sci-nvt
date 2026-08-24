import { useEffect, useMemo, useState } from 'react';
import { Printer, ClipboardList, ArrowLeft } from 'lucide-react';
import { PageTour } from '../../components/ui/PageTour';
import { listarOrdensServico } from '../../services/ordemServicoService';
import type { OrdemServico } from '../../types/ordemServico';
import { formatarDataBR } from '../../utils/datas';
import { parseOrdemServicoImagens } from '../../utils/ordemServicoImagens';

const PRIORIDADE_CORES: Record<string, string> = {
  'Baixa': 'bg-sky-100 text-sky-700',
  'Média': 'bg-amber-100 text-amber-700',
  'Alta': 'bg-orange-100 text-orange-700',
  'Urgente': 'bg-red-100 text-red-700',
};

const PRIORIDADE_BADGE_CORES: Record<string, string> = {
  'Baixa': 'bg-gradient-to-br from-sky-500 to-sky-700',
  'Média': 'bg-gradient-to-br from-amber-500 to-amber-700',
  'Alta': 'bg-gradient-to-br from-orange-500 to-orange-700',
  'Urgente': 'bg-gradient-to-br from-red-500 to-red-700',
};

const STATUS_CORES: Record<string, string> = {
  'Aberta': 'bg-blue-100 text-blue-700',
  'Manutenção': 'bg-yellow-100 text-yellow-700',
  'Concluída': 'bg-green-100 text-green-700',
  'Cancelada': 'bg-red-100 text-red-700',
};

const STATUS_LIST = ['Aberta', 'Manutenção', 'Concluída', 'Cancelada'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const ANOS = Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - i).toString());
const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 outline-none transition-all focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400';

const ORDEM_SERVICO_PUBLICA_TOUR_STEPS = [
  {
    selector: 'h1',
    title: 'Consulta pública de OS',
    body: 'Esta página mostra as ordens de serviço publicadas para acompanhamento sem precisar entrar no sistema interno.',
    detail: 'Ela é usada para consultar situação, prioridade, solicitante, equipe, data e descrição resumida das OS. Para criar ou editar uma OS, use o módulo interno de Ordens de Serviço.',
  },
  {
    selector: 'button',
    title: 'Modo de filtro',
    body: 'Escolha entre filtrar por Mês/Ano ou por Período.',
    detail: 'Mês/Ano é melhor para consulta mensal. Período permite buscar um intervalo específico, útil quando você sabe a data aproximada da solicitação.',
  },
  {
    selector: 'select, input',
    title: 'Filtros de data e status',
    body: 'Os campos reduzem a lista por mês, ano, intervalo de datas e status.',
    detail: 'O status mostra a fase atual da OS: Aberta, Manutenção, Concluída ou Cancelada. Use esse filtro para acompanhar pendências ou conferir o que já foi resolvido.',
  },
  {
    selector: '.space-y-2 button',
    title: 'Cartões da lista',
    body: 'Cada cartão representa uma ordem de serviço. O número em destaque identifica a OS, e as etiquetas indicam prioridade e status.',
    detail: 'A descrição aparece resumida. Também são exibidos solicitante, cargo, data de emissão e equipe. Clique no cartão para abrir a versão detalhada.',
  },
];

const ORDEM_SERVICO_PUBLICA_DETALHE_TOUR_STEPS = [
  {
    selector: 'button',
    title: 'Voltar ou imprimir',
    body: 'No topo da OS aberta, Voltar retorna para a lista e Imprimir envia a ordem para impressão ou salvamento em PDF pelo navegador.',
    detail: 'Use Imprimir quando precisar anexar a OS em outro processo, salvar uma cópia ou entregar para acompanhamento externo.',
  },
  {
    selector: 'h1, h2',
    title: 'Identificação da OS',
    body: 'A área principal mostra número, solicitante, equipe, emissão, prioridade, status e local quando preenchido.',
    detail: 'Esses campos ajudam a confirmar se você abriu a ordem correta antes de imprimir ou repassar a informação.',
  },
  {
    selector: '[class*="whitespace-pre-wrap"]',
    title: 'Descrição e observações',
    body: 'A descrição informa o problema ou solicitação registrada. Observações complementam o acompanhamento quando existirem.',
    detail: 'Se houver imagens do problema, elas aparecem na própria visualização. O motivo de cancelamento também aparece em destaque quando a OS foi cancelada.',
  },
];

function fmt(d: string) {
  return formatarDataBR(d);
}

function dataFiltroOrdem(os: OrdemServico): string {
  return os.dataEmissao || os.createdAt?.slice(0, 10) || '';
}

function numeroDestaqueOS(numero: string): string {
  const texto = String(numero || '').trim();
  const match = texto.match(/(?:OS\/SCI|OS SCI|OS-SCI)-?(\d+)\//i) || texto.match(/(\d+)(?=\/\d{4})/);
  return match?.[1] || texto || '-';
}

export function OrdemServicoPublica() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionada, setSelecionada] = useState<OrdemServico | null>(null);
  const [filterMode, setFilterMode] = useState<'mes-ano' | 'periodo'>('mes-ano');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [dataInicio, setDataInicio] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const imagensSelecionada = selecionada ? parseOrdemServicoImagens(selecionada.imagem) : [];

  const ordensFiltradas = useMemo(() => {
    let lista = ordens;
    if (filtroStatus) lista = lista.filter(os => os.status === filtroStatus);
    if (filterMode === 'mes-ano') {
      if (filtroAno) {
        lista = lista.filter(os => {
          const data = dataFiltroOrdem(os);
          const ano = data ? new Date(`${data}T12:00:00`).getFullYear() : new Date(os.createdAt).getFullYear();
          return String(ano) === filtroAno;
        });
      }
      if (filtroMes) {
        lista = lista.filter(os => {
          const data = dataFiltroOrdem(os);
          const mes = data ? new Date(`${data}T12:00:00`).getMonth() + 1 : new Date(os.createdAt).getMonth() + 1;
          return String(mes) === filtroMes;
        });
      }
    } else {
      if (dataInicio) lista = lista.filter(os => dataFiltroOrdem(os) >= dataInicio);
      if (dataFinal) lista = lista.filter(os => dataFiltroOrdem(os) <= dataFinal);
    }
    return [...lista].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [ordens, filtroStatus, filterMode, filtroAno, filtroMes, dataInicio, dataFinal]);

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

            {imagensSelecionada.length > 0 && (
              <div className="mt-4">
                <h2 className="mb-1 text-xs font-bold uppercase text-graphite-500 dark:text-graphite-400">Imagens do Problema</h2>
                <div className={imagensSelecionada.length === 1 ? '' : 'grid grid-cols-2 gap-3'}>
                  {imagensSelecionada.map((imagem, index) => (
                    <img key={`${imagem.slice(0, 32)}-${index}`} src={imagem} alt={`Imagem da OS ${index + 1}`} className="max-h-72 w-full rounded-lg border border-graphite-300 object-contain dark:border-border-dark" />
                  ))}
                </div>
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
        <PageTour
          steps={ORDEM_SERVICO_PUBLICA_DETALHE_TOUR_STEPS}
          targetAttribute="data-os-publica-tour"
          title="Abrir tutorial da OS"
          detailLabel="Como usar esta página"
        />
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

        <div className="mb-5 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-graphite-200 bg-white/80 p-3 shadow-sm dark:border-border-dark dark:bg-surface-card">
          <div className="inline-flex overflow-hidden rounded-xl border border-graphite-300 bg-white text-sm dark:border-border-dark dark:bg-surface-card">
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
              <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className={`${inputCls} sm:!w-auto`}>
                <option value="">Todos os meses</option>
                {MESES.map((mes, index) => <option key={mes} value={index + 1}>{mes}</option>)}
              </select>
              <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={`${inputCls} sm:!w-auto`}>
                <option value="">Todos os anos</option>
                {ANOS.map(ano => <option key={ano} value={ano}>{ano}</option>)}
              </select>
            </>
          ) : (
            <>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={`${inputCls} sm:!w-auto`} />
              <input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)} className={`${inputCls} sm:!w-auto`} />
            </>
          )}
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className={`${inputCls} sm:!w-auto`}>
            <option value="">Todos os status</option>
            {STATUS_LIST.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
          <span className="rounded-full bg-graphite-100 px-3 py-2 text-xs font-semibold text-graphite-600 dark:bg-[#0d1117] dark:text-graphite-300">
            {ordensFiltradas.length} OS
          </span>
        </div>

        {ordensFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card">
            <ClipboardList className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
            <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhuma OS encontrada</h3>
          </div>
        ) : (
          <div className="space-y-2">
            {ordensFiltradas.map(os => (
              <button key={os.id} onClick={() => setSelecionada(os)}
                className="block w-full rounded-2xl border border-graphite-200 bg-white p-4 text-left shadow-sm transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
                <div className="flex items-center gap-3">
                  <div
                    title={os.numero}
                    className={`flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl px-3 text-xs font-black text-white shadow-sm ${PRIORIDADE_BADGE_CORES[os.prioridade] || 'bg-gradient-to-br from-aviation-500 to-aviation-700'}`}
                  >
                    {numeroDestaqueOS(os.numero)}
                  </div>
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
      <PageTour
        steps={ORDEM_SERVICO_PUBLICA_TOUR_STEPS}
        targetAttribute="data-os-publica-tour"
        title="Abrir tutorial de Ordens de Serviço"
        detailLabel="Como usar esta página"
      />
    </div>
  );
}

export default OrdemServicoPublica;
