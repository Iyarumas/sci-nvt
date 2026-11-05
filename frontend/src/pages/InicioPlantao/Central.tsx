import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ClipboardCheck, ClipboardList, Clock, FileText, Radio, ShieldCheck } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarConferencias } from '../../services/conferenciaService';
import { obterFimPlantao } from '../../services/fimPlantaoService';
import { obterInicioPlantao } from '../../services/inicioPlantaoService';
import { listarOcorrencias } from '../../services/ocorrenciaService';
import type { Conferencia } from '../../types/conferencia';
import type { Ocorrencia } from '../../types/ocorrencia';
import { horarioPlantaoPorEquipe } from '../../utils/equipes';
import { dataDoPlantaoAtual, movimentacoesDoPlantao } from '../../utils/plantaoRegistros';

interface Situacao {
  inicio: { por: string; em: string } | null;
  fim: { por: string; em: string } | null;
  ocorrencias: number;
  inspecoes: number;
  solicitacoes: number;
}

function dataPorExtenso(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
}

function horaCurta(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Tela de boas-vindas do comunicante: o caminho do plantão em três passos. */
export default function Central() {
  const { user, equipeEfetiva } = useContextoOperacional();
  const equipe = equipeEfetiva || '';
  const dataPlantao = equipe ? dataDoPlantaoAtual(equipe) : '';
  const horario = equipe ? horarioPlantaoPorEquipe(equipe) : null;
  const [situacao, setSituacao] = useState<Situacao | null>(null);

  useEffect(() => {
    if (!equipe || !dataPlantao) return;
    let cancelado = false;
    Promise.all([
      obterInicioPlantao(dataPlantao, equipe).catch(() => null),
      obterFimPlantao(dataPlantao, equipe).catch(() => null),
      listarOcorrencias().catch(() => [] as Ocorrencia[]),
      listarConferencias().catch(() => [] as Conferencia[]),
    ]).then(([inicio, fim, ocorrencias, conferencias]) => {
      if (cancelado) return;
      const movimentacoes = movimentacoesDoPlantao({ ocorrencias, conferencias, equipe, dataPlantao });
      setSituacao({
        inicio: inicio ? { por: inicio.atualizadoPor, em: inicio.atualizadoEm } : null,
        fim: fim ? { por: fim.atualizadoPor, em: fim.atualizadoEm } : null,
        ocorrencias: movimentacoes.filter(m => m.origem === 'Ocorrência').length,
        inspecoes: movimentacoes.filter(m => m.origem === 'Inspeção').length,
        solicitacoes: movimentacoes.filter(m => m.origem === 'Solicitação').length,
      });
    });
    return () => { cancelado = true; };
  }, [equipe, dataPlantao]);

  const nome = user?.pessoa?.nomeGuerra || user?.name || '';
  const passo = 'flex items-start gap-4 rounded-2xl border border-graphite-200/70 bg-white/80 p-5 transition-colors hover:border-aviation-400/60 dark:border-border-dark dark:bg-surface-card/80 dark:hover:border-aviation-500/50';
  const numero = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-aviation-600 text-sm font-bold text-white';

  const status = (feito: { por: string; em: string } | null | undefined) => (
    feito
      ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Salvo por {feito.por} às {horaCurta(feito.em)}</span>
      : <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300"><Clock className="h-3.5 w-3.5" /> Ainda não preenchido</span>
  );

  return (
    <PageContainer>
      <header className="mb-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-aviation-600 dark:text-aviation-400"><Radio className="h-4 w-4" /> Central de comunicação</p>
        <h1 className="mt-1 text-2xl font-bold text-graphite-900 dark:text-graphite-100">Bem-vindo à Central{nome ? `, ${nome}` : ''}</h1>
        {equipe ? (
          <p className="mt-1 text-sm text-graphite-500 dark:text-graphite-400">
            Plantão da equipe <strong className="text-graphite-800 dark:text-graphite-200">{equipe}</strong> de {dataPorExtenso(dataPlantao)}
            {horario ? `, das ${horario.horarioInicio} às ${horario.horarioTermino}` : ''}.
          </p>
        ) : (
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">Seu usuário ainda não está vinculado a uma equipe. Peça ao administrador para vincular.</p>
        )}
      </header>

      <ol className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <li>
          <Link to="/inicio-plantao" className={passo}>
            <span className={numero}>1</span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-bold text-graphite-900 dark:text-graphite-100"><Radio className="h-4 w-4" /> Início de plantão</span>
              <span className="mt-1 block text-sm text-graphite-500 dark:text-graphite-400">Torre, SME, viaturas e efetivo. Gera a mensagem do dia.</span>
              <span className="mt-3 block">{situacao ? status(situacao.inicio) : null}</span>
            </span>
          </Link>
        </li>
        <li className={`${passo} hover:border-graphite-200/70 dark:hover:border-border-dark`}>
          <span className={numero}>2</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 font-bold text-graphite-900 dark:text-graphite-100"><FileText className="h-4 w-4" /> Registros do plantão</span>
            <span className="mt-1 block text-sm text-graphite-500 dark:text-graphite-400">Lance durante o plantão. Tudo vai para o fim de plantão e para o LRO.</span>
            <span className="mt-3 grid gap-2">
              <Link to="/registros-diarios/lro-ocorrencias" className="flex items-center justify-between rounded-xl border border-graphite-200/70 px-3 py-2 text-sm font-medium text-graphite-700 hover:bg-aviation-50 dark:border-border-dark dark:text-graphite-200 dark:hover:bg-aviation-900/20">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> LRO/Ocorrências</span>
                <span className="text-xs text-graphite-500">{situacao?.ocorrencias ?? 0}</span>
              </Link>
              <Link to="/registros-diarios/inspecoes" className="flex items-center justify-between rounded-xl border border-graphite-200/70 px-3 py-2 text-sm font-medium text-graphite-700 hover:bg-aviation-50 dark:border-border-dark dark:text-graphite-200 dark:hover:bg-aviation-900/20">
                <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Inspeções</span>
                <span className="text-xs text-graphite-500">{situacao?.inspecoes ?? 0}</span>
              </Link>
              <Link to="/registros-diarios/solicitacoes" className="flex items-center justify-between rounded-xl border border-graphite-200/70 px-3 py-2 text-sm font-medium text-graphite-700 hover:bg-aviation-50 dark:border-border-dark dark:text-graphite-200 dark:hover:bg-aviation-900/20">
                <span className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Solicitações</span>
                <span className="text-xs text-graphite-500">{situacao?.solicitacoes ?? 0}</span>
              </Link>
            </span>
          </span>
        </li>
        <li>
          <Link to="/fim-plantao" className={passo}>
            <span className={numero}>3</span>
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-bold text-graphite-900 dark:text-graphite-100"><ClipboardCheck className="h-4 w-4" /> Fim de plantão</span>
              <span className="mt-1 block text-sm text-graphite-500 dark:text-graphite-400">Checklist, escala de rádio e movimentações. Gera o relatório para o chefe.</span>
              <span className="mt-3 block">{situacao ? status(situacao.fim) : null}</span>
            </span>
          </Link>
        </li>
      </ol>
    </PageContainer>
  );
}
