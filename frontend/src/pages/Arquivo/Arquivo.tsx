import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Archive, Search, FileText, Loader2, CheckCircle, XCircle, Clock,
  RefreshCw, CalendarDays, HardHat, Award, AlertTriangle,
  ClipboardList, FileSpreadsheet, Target, ScrollText, ClipboardCheck,
  Activity, ArrowRight, Lock,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { PageTour } from '../../components/ui/PageTour';
import { listarDocumentos, listarPreenchimentos } from '../../services/documentoService';
import type { Document, DocumentFill } from '../../types/document';
import { SOURCE_MODULE_OPTIONS } from '../../types/document';
import { useAuth } from '../../context/AuthContext';
import {
  canGerenciarArquivo,
  canVisualizarArquivo,
  podeVerArquivoBase,
  podeVerCadastroCompletoBase,
  resolverContextoOperacional,
} from '../../utils/permissoes';
import { formatarDataBR } from '../../utils/datas';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const TIPO_ICONS: Record<string, typeof FileText> = {
  trocas: RefreshCw, ferias: CalendarDays, epis: HardHat,
  certificacoes: Award, ocorrencias: AlertTriangle, ordem_servico: ClipboardList, lro: FileSpreadsheet,
  ptrba: FileText, taf: Target, tpepr: ScrollText,
  exercicio_posicionamento: Target, exercicio_tempo_resposta: Activity,
  dds: FileText, checklists: ClipboardCheck,
};

const TIPO_LABELS: Record<string, string> = {};
SOURCE_MODULE_OPTIONS.forEach(o => { TIPO_LABELS[o.value] = o.label; });

function getTipoIcon(tipo?: string) {
  if (tipo === 'treinamentos') return Activity;
  if (tipo && TIPO_ICONS[tipo]) return TIPO_ICONS[tipo];
  return Archive;
}

function getTipoLabel(tipo?: string) {
  if (!tipo) return 'Arquivo';
  if (tipo === 'treinamentos') return 'Arquivo - Treinamentos';
  return TIPO_LABELS[tipo] ? `Arquivo - ${TIPO_LABELS[tipo]}` : `Arquivo - ${tipo}`;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'signed': return <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
    case 'pending': return <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />;
    case 'cancelled': return <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
    default: return <Clock className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />;
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'signed': return { label: 'Assinado', cls: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' };
    case 'pending': return { label: 'Aguardando', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' };
    case 'cancelled': return { label: 'Cancelado', cls: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400' };
    default: return { label: 'Rascunho', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' };
  }
}

function fmt(d: string) {
  return formatarDataBR(d);
}

const ARQUIVO_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'Arquivo do sistema',
    body: 'Esta tela reúne documentos que já foram arquivados, separados por tipo quando você acessa uma categoria específica pela sidebar.',
    detail: 'Aqui aparecem trocas, férias, EPIs, certificações, ocorrências, LRO, PTR-BA, treinamentos, checklists e outros documentos que já saíram do fluxo principal. É uma área de consulta e conferência histórica.',
  },
  {
    selector: 'main a',
    title: 'Atalhos para a origem',
    body: 'Quando disponível, os atalhos levam de volta ao módulo que gera aquele documento, como Trocas ou LRO.',
    detail: 'Use esses atalhos quando perceber que precisa criar um novo registro, revisar a tela de origem ou conferir por que determinado documento foi arquivado.',
  },
  {
    selector: 'main input, main select',
    title: 'Filtros do arquivo',
    body: 'A busca pesquisa dentro dos dados preenchidos do documento. Os filtros de ano, mês, status, tipo e equipe reduzem a lista para encontrar o registro correto.',
    detail: 'O filtro de status ajuda a separar assinado, aguardando, cancelado e rascunho. O filtro de equipe é importante para localizar documentos operacionais de Alfa, Bravo, Charlie, Delta ou Ferista.',
  },
  {
    selector: 'main .space-y-2',
    title: 'Lista de documentos',
    body: 'Cada linha representa um documento arquivado. O ícone e a cor indicam o módulo, enquanto o título e subtítulo mostram as informações principais.',
    detail: 'Em Trocas, por exemplo, a linha mostra quem solicitou e quem foi chamado. Em LRO aparece equipe e data. Em PTR-BA aparece assunto/equipe. Isso ajuda a conferir sem abrir cada documento.',
  },
  {
    selector: 'main a[title], main button[title]',
    title: 'Ações e links',
    body: 'Quando o documento tem link de assinatura, o ícone abre o Autentique. Outras ações podem levar para a tela de detalhes ou origem do documento.',
    detail: 'Visualizar o arquivo não significa poder alterar. A gestão do arquivo fica restrita a perfis autorizados; BA-CE e BA-LR podem visualizar, mas alterações ficam para Admin/GS quando a regra do sistema exigir.',
  },
  {
    selector: 'main',
    title: 'Quando usar o Arquivo',
    body: 'Use esta página para auditoria, impressão posterior, conferência de histórico e localização de documentos já concluídos ou arquivados.',
    detail: 'Se o documento ainda estiver em preenchimento ou revisão, procure a tela de origem. O Arquivo é o lugar certo quando o registro já saiu do fluxo ativo.',
  },
];

function getCardInfo(doc: Document, fill: DocumentFill): { titulo: string; subtitulo: string; cor: string; icon: typeof FileText } {
  const data = (fill.filled_data || {}) as Record<string, string>;
  const nome = doc.name || '';
  const icon = TIPO_ICONS[doc.source_module || ''] || FileText;
  const cor = doc.source_module === 'trocas' ? 'from-amber-500 to-amber-700' :
              doc.source_module === 'lro' ? 'from-blue-500 to-blue-700' :
              doc.source_module === 'ptrba' ? 'from-emerald-500 to-emerald-700' :
              doc.source_module === 'ocorrencias' ? 'from-red-500 to-red-700' :
              'from-graphite-500 to-graphite-700';

  if (nome.includes('TROCA') || doc.source_module === 'trocas') {
    const sol = data.nome_solicitante || '';
    const solic = data.nome_solicitado || '';
    return {
      titulo: sol && solic ? `${sol} → ${solic}` : nome,
      subtitulo: `Troca de Serviço • ${fmt(fill.created_at)}`,
      cor, icon,
    };
  }

  if (doc.source_module === 'lro' || nome.includes('LRO')) {
    const equipe = data.equipeNome || data.equipe || '';
    return {
      titulo: equipe ? `LRO - Equipe ${equipe}` : nome,
      subtitulo: `${data.chefeEquipe || ''} • ${fmt(data.dataInicio || fill.created_at)}`,
      cor, icon,
    };
  }

  if (doc.source_module === 'ptrba' || nome.includes('PTR')) {
    const assunto = data.assuntoMinistrado || data.descricao || '';
    return {
      titulo: assunto ? assunto.slice(0, 60) : nome,
      subtitulo: `Equipe ${data.equipe || ''} • ${fmt(fill.created_at)}`,
      cor, icon,
    };
  }

  if (doc.source_module === 'ocorrencias') {
    return {
      titulo: data.titulo || data.categoria || nome,
      subtitulo: `${data.tipoDocumento || ''} • ${data.equipe || ''} • ${fmt(data.data || fill.created_at)}`.replace(/^ • /, ''),
      cor, icon,
    };
  }

  return {
    titulo: nome,
    subtitulo: fmt(fill.created_at),
    cor, icon,
  };
}

export default function Arquivo() {
  const { tipo } = useParams<{ tipo: string }>();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [canViewArquivo, setCanViewArquivo] = useState(() => podeVerArquivoBase(user));
  const [canManageArquivo, setCanManageArquivo] = useState(() => podeVerCadastroCompletoBase(user));
  const [documents, setDocuments] = useState<Document[]>([]);
  const [fills, setFills] = useState<DocumentFill[]>([]);
  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number>(-1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [filterTipoOcorrencia, setFilterTipoOcorrencia] = useState<string>('');
  const [filterTipoTreinamento, setFilterTipoTreinamento] = useState<string>('');
  const [filterEquipe, setFilterEquipe] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    setCanViewArquivo(podeVerArquivoBase(user));
    setCanManageArquivo(podeVerCadastroCompletoBase(user));

    resolverContextoOperacional(user)
      .then(contexto => {
        if (cancelled) return;
        setCanViewArquivo(canVisualizarArquivo(contexto));
        setCanManageArquivo(canGerenciarArquivo(contexto));
      })
      .catch(() => {
        if (!cancelled) {
          setCanViewArquivo(podeVerArquivoBase(user));
          setCanManageArquivo(podeVerCadastroCompletoBase(user));
        }
      });

    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!canViewArquivo) {
      setDocuments([]);
      setFills([]);
      setLoading(false);
      return;
    }

    loadData();
  }, [canViewArquivo, filterYear, filterMonth]);

  async function loadData() {
    try {
      setLoading(true);

      // Build query filters for the DB
      const year = filterYear;
      const month = filterMonth;
      let gte: string | undefined;
      let lte: string | undefined;
      if (month >= 0) {
        gte = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month + 1, 0).getDate();
        lte = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      } else {
        gte = `${year}-01-01`;
        lte = `${year}-12-31`;
      }

      const [docs, allFills] = await Promise.all([
        listarDocumentos(),
        listarPreenchimentos({
          status: 'archived',
          created_at_gte: gte,
          created_at_lte: lte,
        }),
      ]);
      setDocuments(docs);
      setFills(allFills);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  const docMap = useMemo(() => {
    const map = new Map<string, Document>();
    documents.forEach(d => map.set(d.id, d));
    return map;
  }, [documents]);

  const filteredFills = useMemo(() => {
    // DB already filtered by archived status + year/month
    let result = fills;

    if (tipo) {
      const treinoModules = ['taf', 'tpepr', 'exercicio_posicionamento', 'exercicio_tempo_resposta'];
      const modulos = tipo === 'treinamentos' ? treinoModules : [tipo];
      const docIds = new Set(documents.filter(d => modulos.includes(d.source_module || '')).map(d => d.id));
      result = result.filter(f => docIds.has(f.document_id));
    }
    if (statusFilter !== 'all') result = result.filter(f => f.status === statusFilter);
    if (filterTipoOcorrencia) {
      result = result.filter(f => {
        const data = (f.filled_data || {}) as Record<string, string>;
        return data.tipoDocumento === filterTipoOcorrencia;
      });
    }
    if (filterTipoTreinamento) {
      const treinoModules = new Set(
        documents.filter(d => d.source_module === filterTipoTreinamento).map(d => d.id)
      );
      result = result.filter(f => treinoModules.has(f.document_id));
    }
    if (filterEquipe) {
      result = result.filter(f => {
        const data = (f.filled_data || {}) as Record<string, string>;
        return data.equipe === filterEquipe || data.equipeNome === filterEquipe;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(f => {
        const data = (f.filled_data || {}) as Record<string, string>;
        return Object.values(data).some(v => String(v || '').toLowerCase().includes(q));
      });
    }
    return result.sort((a, b) => {
      const docA = docMap.get(a.document_id);
      const docB = docMap.get(b.document_id);
      const nameA = docA?.name || '';
      const nameB = docB?.name || '';
      if (nameA !== nameB) return nameA.localeCompare(nameB);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [fills, documents, tipo, statusFilter, filterTipoOcorrencia, filterTipoTreinamento, filterEquipe, search]);

  const anos = useMemo(() => {
    const s = new Set<number>();
    fills.forEach(f => s.add(new Date(f.created_at).getFullYear()));
    if (s.size === 0) s.add(new Date().getFullYear());
    return Array.from(s).sort((a, b) => b - a);
  }, [fills]);

  if (loading) {
    return (
      <PageContainer>
        <PageTitle icon={Archive} title="Arquivo" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-aviation-500" />
        </div>
        <PageTour
          steps={ARQUIVO_TOUR_STEPS}
          targetAttribute="data-arquivo-tour"
          title="Abrir tutorial do Arquivo"
          detailLabel="Como usar esta página"
        />
      </PageContainer>
    );
  }

  if (!canViewArquivo) {
    return (
      <PageContainer>
        <PageTitle icon={Archive} title="Arquivo" />
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Lock className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Acesso Restrito</h3>
          <p className="text-sm text-graphite-400 dark:text-graphite-500">Apenas Administradores, GS, BA-CE e BA-LR podem visualizar o arquivo.</p>
        </div>
        <PageTour
          steps={ARQUIVO_TOUR_STEPS}
          targetAttribute="data-arquivo-tour"
          title="Abrir tutorial do Arquivo"
          detailLabel="Como usar esta página"
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle icon={getTipoIcon(tipo)} title={getTipoLabel(tipo)} />

      {canManageArquivo && !tipo && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Link to="/relatorios/trocas" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            <RefreshCw className="h-4 w-4" /> Ir para Trocas
          </Link>
          <Link to="/registros-diarios/gerar-lro" className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
            <FileSpreadsheet className="h-4 w-4" /> Ir para LRO
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar em todos os documentos..."
            className="w-full rounded-lg border border-graphite-200 bg-white py-2 pl-9 pr-3 text-sm text-graphite-900 placeholder-graphite-400 focus:border-aviation-500 focus:outline-none dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100" />
        </div>
        <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
          className="rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200">
          {anos.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}
          className="rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200">
          <option value={-1}>Todos os meses</option>
          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200">
          <option value="all">Todos os status</option>
          <option value="signed">Assinado</option>
          <option value="pending">Aguardando</option>
          <option value="cancelled">Cancelado</option>
          <option value="draft">Rascunho</option>
        </select>
        {(!tipo || tipo === 'ocorrencias') && (
          <select value={filterTipoOcorrencia} onChange={e => setFilterTipoOcorrencia(e.target.value)}
            className="rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200">
            <option value="">Todos</option>
            <option value="BONA">BONA</option>
            <option value="REA">REA</option>
          </select>
        )}
        {(!tipo || tipo === 'treinamentos') && (
          <select value={filterTipoTreinamento} onChange={e => setFilterTipoTreinamento(e.target.value)}
            className="rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200">
            <option value="">Todos</option>
            <option value="taf">TAF</option>
            <option value="tpepr">TP/EPR</option>
            <option value="exercicio_posicionamento">Posicionamento</option>
            <option value="exercicio_tempo_resposta">Tempo Resposta</option>
          </select>
        )}
        <select value={filterEquipe} onChange={e => setFilterEquipe(e.target.value)}
          className="rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200">
          <option value="">Todas equipes</option>
          <option value="Alfa">Alfa</option>
          <option value="Bravo">Bravo</option>
          <option value="Charlie">Charlie</option>
          <option value="Delta">Delta</option>
          <option value="Ferista">Ferista</option>
        </select>
        <span className="text-xs text-graphite-400">{filteredFills.length} documento(s)</span>
      </div>

      {filteredFills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-graphite-300 bg-graphite-50 py-16 text-center dark:border-graphite-600 dark:bg-graphite-800/50">
          <Archive className="mx-auto mb-3 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <p className="text-graphite-500 dark:text-graphite-400">Nenhum documento encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFills.map(fill => {
            const doc = docMap.get(fill.document_id);
            if (!doc) return null;
            const info = getCardInfo(doc, fill);
            const statusInfo = getStatusLabel(fill.status);
            const data = (fill.filled_data || {}) as Record<string, string>;

            return (
              <div key={fill.id} className="rounded-2xl border border-graphite-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${info.cor} text-sm font-bold text-white`}>
                    <info.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100 truncate">{info.titulo}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${statusInfo.cls}`}>
                        {getStatusIcon(fill.status)} {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-xs text-graphite-500 dark:text-graphite-400">{info.subtitulo}</p>
                    {/* For troca documents, show extra details inline */}
                    {(doc.source_module === 'trocas' || doc.name?.includes('TROCA')) && (
                      <p className="mt-0.5 text-[10px] text-graphite-400">
                        {data.motivo_troca ? `Motivo: ${data.motivo_troca.slice(0, 60)}` : ''}
                        {data.data_solicitada ? ` · Data: ${fmt(data.data_solicitada)}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {fill.autentique_link && (
                      <a href={fill.autentique_link} target="_blank" rel="noopener noreferrer"
                        className="rounded-lg p-1.5 text-aviation-500 hover:bg-aviation-50 dark:hover:bg-aviation-900/20" title="Abrir no Autentique">
                        <FileText className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <Link to={`/documentos`}
                      className="rounded-lg p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover" title="Ver detalhes">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PageTour
        steps={ARQUIVO_TOUR_STEPS}
        targetAttribute="data-arquivo-tour"
        title="Abrir tutorial do Arquivo"
        detailLabel="Como usar esta página"
      />
    </PageContainer>
  );
}
