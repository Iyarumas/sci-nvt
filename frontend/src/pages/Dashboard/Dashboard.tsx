import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Shield, AlertTriangle, CalendarClock,
  GraduationCap, Flame, Truck, FileText, ArrowRight, Activity,
  Clock, CheckCircle2, XCircle, AlertCircle, Eye, UserCheck,
  Calendar, Award, HardHat,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { listarAtivos } from '../../services/bombeiroService';
import { listarFeriasGozo } from '../../services/feriasService';
import { listarOcorrencias } from '../../services/ocorrenciaService';
import { listarReas } from '../../services/reaService';
import { listarSubstituicoesTemporarias } from '../../services/substituicaoTemporariaService';
import { listarCertificacoes } from '../../services/certificacaoService';
import { listarCertificacoesCursos } from '../../services/certificacaoCursoService';
import { listarVagasPendentes } from '../../services/vagaPendenteService';
import type { Bombeiro } from '../../types/bombeiro';
import type { FeriasGozo } from '../../types/ferias';
import type { Ocorrencia } from '../../types/ocorrencia';
import type { ReaRegistro } from '../../types/rea';
import type { SubstituicaoTemporaria } from '../../types/substituicaoTemporaria';
import type { CertificacaoNR } from '../../types/certificacao';
import type { CertificacaoCurso } from '../../types/certificacaoCurso';
import { formatarDataBR } from '../../utils/datas';

function fmt(d?: string) {
  return formatarDataBR(d);
}

function numeroDocumentoBadge(numero?: string): string {
  const texto = String(numero || '').trim();
  const sequencial = texto.match(/^(?:BONA|REA)-?(\d+)/i)?.[1] || texto.match(/^(\d+)/)?.[1];
  return sequencial || '?';
}

function StatusBadge({ status, map }: { status: string; map: Record<string, string> }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${map[status] || 'bg-graphite-100 text-graphite-600'}`}>{status}</span>;
}

const STATUS_OCORRENCIA_COLORS: Record<string, string> = {
  'Aberta': 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
  'Encaminhada': 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  'Em Andamento': 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  'Fechada': 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
};

const STATUS_GOZO_COLORS: Record<string, string> = {
  'Programadas': 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  'Em Gozo': 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  'Gozadas': 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
};

const STATUS_SUBST_COLORS: Record<string, string> = {
  'Pendente': 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  'Aprovado': 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  'Rejeitado': 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
};

function CardStat({ icon: Icon, label, value, color, onClick }: { icon: any; label: string; value: string | number; color: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`flex items-center gap-4 rounded-2xl border border-graphite-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card ${onClick ? 'cursor-pointer' : ''}`}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div className="min-w-0 text-left">
        <p className="text-2xl font-black text-graphite-900 dark:text-graphite-100">{value}</p>
        <p className="text-xs text-graphite-500 dark:text-graphite-400 truncate">{label}</p>
      </div>
    </button>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [feriasGozo, setFeriasGozo] = useState<FeriasGozo[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [reas, setReas] = useState<ReaRegistro[]>([]);
  const [substituicoes, setSubstituicoes] = useState<SubstituicaoTemporaria[]>([]);
  const [certificacoes, setCertificacoes] = useState<CertificacaoNR[]>([]);
  const [vagasPendentes, setVagasPendentes] = useState<any[]>([]);
  const [cursos, setCursos] = useState<CertificacaoCurso[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [b, g, o, r, s, c, cr, vp] = await Promise.all([
          listarAtivos(),
          listarFeriasGozo(),
          listarOcorrencias({ status: undefined }),
          listarReas(),
          listarSubstituicoesTemporarias(),
          listarCertificacoes(),
          listarCertificacoesCursos(),
          listarVagasPendentes({ resolvido: false }),
        ]);
        setBombeiros(b); setFeriasGozo(g); setOcorrencias(o);
        setReas(r); setSubstituicoes(s); setCertificacoes(c); setCursos(cr);
        setVagasPendentes(vp);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

interface DocumentoResumo {
  id: string;
  tipo: 'BONA' | 'REA';
  numero: string;
  titulo: string;
  data: string;
  equipe: string;
  status: string;
}

const documentos = useMemo<DocumentoResumo[]>(() => {
  const bonas = ocorrencias
    .filter(o => o.numero?.trim())
    .map(o => ({
      id: o.id,
      tipo: 'BONA' as const,
      numero: o.numero,
      titulo: o.titulo || 'BONA',
      data: o.data,
      equipe: o.equipe,
      status: o.status,
    }));
  const reasList = reas.map(r => ({
    id: r.id,
    tipo: 'REA' as const,
    numero: r.numero,
    titulo: 'REA',
    data: r.dataAcidente || r.createdAt.slice(0, 10),
    equipe: r.equipe,
    status: r.status,
  }));
  return [...bonas, ...reasList];
}, [ocorrencias, reas]);

  const stats = useMemo(() => {
    const emGozo = feriasGozo.filter(g => g.status === 'Em Gozo');
    const programadas = feriasGozo.filter(g => g.status === 'Programadas');
    const ocorrenciasAbertas = documentos.filter(d => d.status !== 'Fechada').length;
    const substPendentes = substituicoes.filter(s => s.status === 'Pendente');
    const certVencendo = certificacoes.filter(c => {
      if (!c.dataValidade) return false;
      const v = new Date(c.dataValidade + 'T00:00:00');
      return v > new Date() && v < new Date(Date.now() + 30 * 86400000);
    });
    const cursosVencendo = cursos.filter(c => {
      if (!c.dataValidade) return false;
      const v = new Date(c.dataValidade + 'T00:00:00');
      return v > new Date() && v < new Date(Date.now() + 30 * 86400000);
    });

    return {
      totalBombeiros: bombeiros.length,
      emGozo: emGozo.length,
      programadas: programadas.length,
      ocorrenciasAbertas,
      substPendentes: substPendentes.length,
      vagasPendentes: vagasPendentes.length,
      certVencendo: certVencendo.length + cursosVencendo.length,
      equipes: ['Alfa', 'Bravo', 'Charlie', 'Delta'].map(eq => ({
        nome: eq, total: bombeiros.filter(b => b.equipe === eq).length,
      })),
    };
  }, [bombeiros, feriasGozo, documentos, substituicoes, certificacoes, cursos, vagasPendentes]);

  const feriasEmAndamento = useMemo(() =>
    feriasGozo.filter(g => g.status === 'Em Gozo').slice(0, 8),
    [feriasGozo],
  );

  const ocorrenciasRecentes = useMemo(() =>
    [...documentos]
      .sort((a, b) => new Date(b.data + 'T12:00:00').getTime() - new Date(a.data + 'T12:00:00').getTime())
      .slice(0, 6),
    [documentos],
  );

  const substituicoesPendentes = useMemo(() =>
    substituicoes.filter(s => s.status === 'Pendente').slice(0, 6),
    [substituicoes],
  );

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-6">
        <PageTitle icon={LayoutDashboard} title="Dashboard" />
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <CardStat icon={Users} label="Bombeiros Ativos" value={stats.totalBombeiros} color="bg-gradient-to-br from-blue-500 to-blue-700" onClick={() => navigate('/funcionarios')} />
        <CardStat icon={AlertTriangle} label="Ocorrências Abertas" value={stats.ocorrenciasAbertas} color="bg-gradient-to-br from-red-500 to-red-700" onClick={() => navigate('/registros-diarios/bona-rea')} />
        <CardStat icon={CalendarClock} label="Férias em Gozo" value={stats.emGozo} color="bg-gradient-to-br from-amber-500 to-amber-700" onClick={() => navigate('/cadastro/ferias')} />
        <CardStat icon={Clock} label="Substituições Pendentes" value={stats.substPendentes} color="bg-gradient-to-br from-purple-500 to-purple-700" onClick={() => navigate('/funcionarios/substituicoes')} />
        <CardStat icon={Award} label="Certificações Vencendo" value={stats.certVencendo} color="bg-gradient-to-br from-emerald-500 to-emerald-700" onClick={() => navigate('/certificacoes')} />
        <CardStat icon={AlertCircle} label="Vagas Pendentes" value={stats.vagasPendentes} color="bg-gradient-to-br from-cyan-500 to-cyan-700" onClick={() => navigate('/cadastro/ferias')} />
      </div>

      {/* Charts Row */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Equipes Distribution */}
        <div className="rounded-2xl border border-graphite-200 bg-white p-5 dark:border-border-dark dark:bg-surface-card">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-100">
            <Users className="h-4 w-4 text-aviation-600" /> Distribuição por Equipe
          </h3>
          <div className="space-y-3">
            {stats.equipes.map(eq => {
              const max = Math.max(...stats.equipes.map(x => x.total), 1);
              const pct = (eq.total / max) * 100;
              return (
                <div key={eq.nome}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-graphite-700 dark:text-graphite-300">{eq.nome}</span>
                    <span className="text-graphite-500">{eq.total}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-graphite-100 dark:bg-graphite-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-aviation-500 to-aviation-600 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Férias Status */}
        <div className="rounded-2xl border border-graphite-200 bg-white p-5 dark:border-border-dark dark:bg-surface-card">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-100">
            <Calendar className="h-4 w-4 text-aviation-600" /> Status das Férias
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Programadas', value: stats.programadas, color: 'bg-blue-500' },
              { label: 'Em Gozo', value: stats.emGozo, color: 'bg-amber-500' },
              { label: 'Gozadas', value: feriasGozo.filter(g => g.status === 'Gozadas').length, color: 'bg-green-500' },
            ].map(item => {
              const total = stats.programadas + stats.emGozo + feriasGozo.filter(g => g.status === 'Gozadas').length || 1;
              const pct = (item.value / total) * 100;
              return (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-graphite-700 dark:text-graphite-300">{item.label}</span>
                    <span className="text-graphite-500">{item.value}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-graphite-100 dark:bg-graphite-800">
                    <div className={`h-full rounded-full ${item.color} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ocorrências por Status */}
        <div className="rounded-2xl border border-graphite-200 bg-white p-5 dark:border-border-dark dark:bg-surface-card">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-100">
            <Activity className="h-4 w-4 text-aviation-600" /> Ocorrências por Status
          </h3>
          <div className="space-y-3">
            {['Aberta', 'Encaminhada', 'Em Andamento', 'Fechada'].map(status => {
              const count = documentos.filter(d => d.status === status).length;
              const total = documentos.length || 1;
              const pct = (count / total) * 100;
              const colors: Record<string, string> = {
                'Aberta': 'bg-red-500', 'Encaminhada': 'bg-yellow-500',
                'Em Andamento': 'bg-blue-500', 'Fechada': 'bg-green-500',
              };
              return (
                <div key={status}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-graphite-700 dark:text-graphite-300">{status}</span>
                    <span className="text-graphite-500">{count}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-graphite-100 dark:bg-graphite-800">
                    <div className={`h-full rounded-full ${colors[status]} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {/* Férias em Andamento */}
        <div className="rounded-2xl border border-graphite-200 bg-white shadow-sm dark:border-border-dark dark:bg-surface-card">
          <div className="flex items-center justify-between border-b border-graphite-200 px-5 py-4 dark:border-border-dark">
            <h3 className="flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-100">
              <CalendarClock className="h-4 w-4 text-amber-500" /> Férias em Andamento
            </h3>
            <button onClick={() => navigate('/cadastro/ferias')} className="text-xs text-aviation-600 hover:text-aviation-700 dark:text-aviation-400">Ver todas</button>
          </div>
          <div className="p-3">
            {feriasEmAndamento.length === 0 ? (
              <p className="py-6 text-center text-xs text-graphite-400">Nenhuma féria em andamento</p>
            ) : (
              <div className="space-y-1">
                {feriasEmAndamento.map(g => (
                  <div key={g.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-graphite-50 dark:hover:bg-surface-hover/50">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-[10px] font-bold text-white">
                      {g.funcionarioNome?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-graphite-900 dark:text-graphite-100 truncate">{g.funcionarioNome?.split(' ')[0]}</p>
                      <p className="text-[10px] text-graphite-500">{fmt(g.dataInicio)} - {fmt(g.dataFim)}</p>
                    </div>
                    <StatusBadge status={g.status} map={STATUS_GOZO_COLORS} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ocorrências Recentes */}
        <div className="rounded-2xl border border-graphite-200 bg-white shadow-sm dark:border-border-dark dark:bg-surface-card">
          <div className="flex items-center justify-between border-b border-graphite-200 px-5 py-4 dark:border-border-dark">
            <h3 className="flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-100">
              <AlertTriangle className="h-4 w-4 text-red-500" /> Ocorrências Recentes
            </h3>
            <button onClick={() => navigate('/registros-diarios/bona-rea')} className="text-xs text-aviation-600 hover:text-aviation-700 dark:text-aviation-400">Ver todas</button>
          </div>
          <div className="p-3">
            {ocorrenciasRecentes.length === 0 ? (
              <p className="py-6 text-center text-xs text-graphite-400">Nenhuma ocorrência registrada</p>
            ) : (
              <div className="space-y-1">
                {ocorrenciasRecentes.map(d => (
                  <div key={`${d.tipo}-${d.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-graphite-50 dark:hover:bg-surface-hover/50">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white ${
                      d.tipo === 'REA'
                        ? 'bg-gradient-to-br from-red-400 to-red-600'
                        : d.status === 'Fechada' ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-red-400 to-red-600'
                    }`}>
                      {numeroDocumentoBadge(d.numero)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-graphite-900 dark:text-graphite-100 truncate">
                        <span className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                          d.tipo === 'BONA' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                        }`}>{d.tipo}</span>
                        {d.numero || d.titulo}
                      </p>
                      <p className="text-[10px] text-graphite-500">{d.equipe} · {fmt(d.data)}</p>
                    </div>
                    <StatusBadge status={d.status} map={STATUS_OCORRENCIA_COLORS} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Substituições Pendentes */}
        <div className="rounded-2xl border border-graphite-200 bg-white shadow-sm dark:border-border-dark dark:bg-surface-card">
          <div className="flex items-center justify-between border-b border-graphite-200 px-5 py-4 dark:border-border-dark">
            <h3 className="flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-100">
              <Clock className="h-4 w-4 text-purple-500" /> Substituições Pendentes
            </h3>
            <button onClick={() => navigate('/funcionarios/substituicoes')} className="text-xs text-aviation-600 hover:text-aviation-700 dark:text-aviation-400">Ver todas</button>
          </div>
          <div className="p-3">
            {substituicoesPendentes.length === 0 ? (
              <p className="py-6 text-center text-xs text-graphite-400">Nenhuma substituição pendente</p>
            ) : (
              <div className="space-y-1">
                {substituicoesPendentes.map(s => (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-graphite-50 dark:hover:bg-surface-hover/50">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 text-[10px] font-bold text-white">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-graphite-900 dark:text-graphite-100 truncate">{s.funcionarioNome?.split(' ')[0]} → {s.substitutoNome?.split(' ')[0]}</p>
                      <p className="text-[10px] text-graphite-500">{s.motivo || 'Sem motivo'}</p>
                    </div>
                    <StatusBadge status={s.status} map={STATUS_SUBST_COLORS} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

export default Dashboard;
