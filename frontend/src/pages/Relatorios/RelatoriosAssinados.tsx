import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Eye, FileDown, FileSignature, Printer, X } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { PdfPreview } from '../../components/documentos/PdfPreview';
import { obterPdfAssinado, type TipoEnvioAssinatura } from '../../services/autentiqueEnviosService';
import {
  juntarPdfs, listarDocumentosRelatorio, montarPdfRelatorio, naPrimeiraQuinzena,
  type DocumentoRelatorio, type SituacaoRelatorio,
} from '../../services/relatoriosAssinadosService';
import { gerarRelatorioTrocasMensalPdf } from '../../services/trocasMensalPdfService';
import { listarBombeirosPublico } from '../../services/bombeiroService';
import type { Bombeiro } from '../../types/bombeiro';
import { listarReas } from '../../services/reaService';
import { gerarReaPdf } from '../../services/reaPdfService';
import type { ReaRegistro } from '../../types/rea';

const CONFIG: Record<string, { tipo: TipoEnvioAssinatura; nome: string; sigla: string }> = {
  'ptr-ba': { tipo: 'ptrba', nome: 'PTR-BA', sigla: 'PTRBA' },
  lro: { tipo: 'lro', nome: 'LRO', sigla: 'LRO' },
  bona: { tipo: 'bona', nome: 'BONA', sigla: 'BONA' },
  taf: { tipo: 'taf', nome: 'TAF', sigla: 'TAF' },
  'tp-epr': { tipo: 'tpepr', nome: 'TP/EPR', sigla: 'TP EPR' },
  posicionamento: { tipo: 'posicionamento', nome: 'Exercício de Posicionamento', sigla: 'POSICIONAMENTO' },
  'tempo-resposta': { tipo: 'temporesposta', nome: 'Tempo Resposta', sigla: 'TEMPO RESPOSTA' },
  trocas: { tipo: 'troca', nome: 'Trocas de serviço', sigla: 'TROCAS' },
};

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_MAIUSCULO = MESES.map(m => m.toUpperCase());

const SITUACAO: Record<SituacaoRelatorio, { rotulo: string; classe: string }> = {
  assinado: { rotulo: 'Assinado', classe: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  aguardando: { rotulo: 'Aguardando', classe: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  nao_enviado: { rotulo: 'Não enviado', classe: 'bg-graphite-100 text-graphite-600 dark:bg-surface-hover dark:text-graphite-300' },
  fora: { rotulo: 'Fora do Autentique', classe: 'bg-graphite-100 text-graphite-500 dark:bg-surface-hover dark:text-graphite-400' },
};

const br = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '-');
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export default function RelatoriosAssinados({ rota: rotaFixa }: { rota?: string } = {}) {
  const { tipo: rotaUrl = 'ptr-ba' } = useParams();
  const rota = rotaFixa ?? rotaUrl;
  const cfgRota = CONFIG[rota] ?? CONFIG['ptr-ba'];
  // Aba BONA/REA: seletor entre os dois. O REA não passa pelo Autentique — o PDF é gerado pelo sistema.
  const [modelo, setModelo] = useState<'BONA' | 'REA'>('BONA');
  const ehRea = cfgRota.tipo === 'bona' && modelo === 'REA';
  const cfg = ehRea ? { ...cfgRota, nome: 'REA', sigla: 'REA' } : cfgRota;
  const [reas, setReas] = useState<ReaRegistro[]>([]);
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [equipe, setEquipe] = useState('');
  const [periodo, setPeriodo] = useState<'quinzena' | 'mes'>('mes');
  const [docs, setDocs] = useState<DocumentoRelatorio[]>([]);
  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [gerando, setGerando] = useState<string | null>(null);
  const [visualizando, setVisualizando] = useState<{ titulo: string; pdf: ArrayBuffer } | null>(null);

  useEffect(() => {
    if (cfg.tipo === 'troca') listarBombeirosPublico().then(setBombeiros).catch(() => setBombeiros([]));
  }, [cfg.tipo]);

  useEffect(() => {
    setCarregando(true);
    setErro('');
    const prefixo = `${ano}-${String(mes).padStart(2, '0')}`;
    // REA sem data do acidente entra pela data em que foi criado, para não sumir do relatório.
    const dataRea = (r: ReaRegistro) => (r.dataAcidente || r.createdAt || '').slice(0, 10);
    const busca: Promise<DocumentoRelatorio[]> = ehRea
      ? listarReas().then(todos => {
        const lista = todos.filter(r => dataRea(r).startsWith(prefixo));
        setReas(lista);
        return [...lista]
          .sort((a, b) => dataRea(a).localeCompare(dataRea(b)) || (a.horaAcidente || '').localeCompare(b.horaAcidente || ''))
          .map(r => ({
            referenciaId: r.id, data: dataRea(r), equipe: r.equipe || '', turno: r.horaAcidente || '',
            numero: r.numero || '', solicitante: '', solicitado: '', dataTrabalhar: '', criadoEm: r.createdAt,
            envioId: null, situacao: 'assinado' as const,
          }));
      })
      : listarDocumentosRelatorio(cfg.tipo, ano, mes);
    busca
      .then(setDocs)
      .catch(e => setErro(e instanceof Error ? e.message : 'Não foi possível carregar os documentos.'))
      .finally(() => setCarregando(false));
  }, [cfg.tipo, ano, mes, ehRea]);

  const reaPorId = (id: string) => reas.find(r => r.id === id);

  /** Trocas: nome completo do cadastro, como no relatório de trocas de hoje. */
  const nomeCompleto = (nome: string) => {
    if (!nome) return '-';
    const n = normalizar(nome);
    return bombeiros.find(b => normalizar(b.nomeCompleto) === n || normalizar(b.nomeGuerra || '') === n)?.nomeCompleto || nome;
  };

  // Ordem: plantões (vem do servidor). Trocas: igual ao relatório de trocas de hoje (nome de quem pediu, data).
  const lista = useMemo(() => {
    let l = docs.filter(d => !equipe || d.equipe === equipe);
    if (cfg.tipo === 'troca') {
      l = [...l].sort((a, b) => nomeCompleto(a.solicitante).toLocaleLowerCase('pt-BR')
        .localeCompare(nomeCompleto(b.solicitante).toLocaleLowerCase('pt-BR'), 'pt-BR')
        || a.data.localeCompare(b.data) || String(a.criadoEm).localeCompare(String(b.criadoEm)));
    }
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, equipe, cfg.tipo, bombeiros]);

  const doPeriodo = useMemo(() => (periodo === 'quinzena' ? lista.filter(d => naPrimeiraQuinzena(d.data)) : lista), [lista, periodo]);
  const assinadosNoPeriodo = doPeriodo.filter(d => d.situacao === 'assinado').length;

  const nomeDocumento = (d: DocumentoRelatorio) => {
    if (cfg.tipo === 'troca') return `${nomeCompleto(d.solicitante)} ↔ ${nomeCompleto(d.solicitado)}`;
    // BONA e REA já têm o número completo (BONA-084/2026, REA-001/2026).
    if (ehRea || cfg.tipo === 'bona') return `${br(d.data).replace(/\//g, '-')} NVT ${d.numero || cfg.sigla} ${d.equipe.toUpperCase()}`.trim();
    const numero = d.numero ? ` Nº ${String(d.numero).padStart(3, '0')}` : '';
    return `${br(d.data).replace(/\//g, '-')} NVT ${cfg.sigla}${numero} ${d.equipe.toUpperCase()}`.trim();
  };

  const nomeArquivo = () => {
    const parte = periodo === 'quinzena' ? '1ª QUINZENA' : 'MÊS COMPLETO';
    return `RELATORIO ${cfg.sigla} ${MESES_MAIUSCULO[mes - 1]} ${ano} ${parte}${equipe ? ` ${equipe.toUpperCase()}` : ''}.pdf`;
  };

  /** Folha do relatório de trocas (a de sempre). Usa a mesma lista, na mesma ordem, das trocas assinadas. */
  const folhaTrocas = () => gerarRelatorioTrocasMensalPdf({
    mes: mes - 1, ano, observacao: '',
    rows: doPeriodo.map(d => ({
      nomeSolicitante: nomeCompleto(d.solicitante), dataSolicitada: d.data,
      dataATrabalhar: d.dataTrabalhar, nomeSolicitado: nomeCompleto(d.solicitado),
    })),
  });

  async function gerar(soFolha = false): Promise<Blob | null> {
    setErro('');
    if (!assinadosNoPeriodo && cfg.tipo !== 'troca') {
      setErro(ehRea ? 'Nenhum REA neste período.' : 'Nenhum documento assinado neste período.');
      return null;
    }
    setGerando('Preparando…');
    try {
      if (soFolha) return await folhaTrocas();
      if (ehRea) {
        const pdfs: Blob[] = [];
        for (const d of doPeriodo) {
          const rea = reaPorId(d.referenciaId);
          if (!rea) continue;
          pdfs.push(await gerarReaPdf(rea));
          setGerando(`Gerando ${pdfs.length} de ${doPeriodo.length}…`);
        }
        return new Blob([(await juntarPdfs(pdfs)) as BlobPart], { type: 'application/pdf' });
      }
      // Trocas: primeiro as trocas assinadas, por último a folha do relatório de trocas (mesma sequência).
      const fim = cfg.tipo === 'troca' ? await folhaTrocas() : undefined;
      const bytes = await montarPdfRelatorio(cfg.tipo, doPeriodo, fim, (feitos, total) => setGerando(`Juntando ${feitos} de ${total}…`));
      return new Blob([bytes as BlobPart], { type: 'application/pdf' });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível montar o PDF.');
      return null;
    } finally {
      setGerando(null);
    }
  }

  async function baixar(soFolha = false) {
    const blob = await gerar(soFolha);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = soFolha ? nomeArquivo().replace('RELATORIO TROCAS', 'FOLHA TROCAS') : nomeArquivo();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function imprimir(soFolha = false) {
    const blob = await gerar(soFolha);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => { iframe.remove(); URL.revokeObjectURL(url); }, 60_000);
    };
  }

  async function ver(d: DocumentoRelatorio) {
    const rea = ehRea ? reaPorId(d.referenciaId) : undefined;
    if (!d.envioId && !rea) return;
    try {
      const pdf = await (rea ? gerarReaPdf(rea) : obterPdfAssinado(d.envioId!)).then(b => b.arrayBuffer());
      setVisualizando({ titulo: nomeDocumento(d), pdf });
    } catch {
      setErro('Não foi possível abrir o documento.');
    }
  }

  const anos = Array.from({ length: 4 }, (_, i) => hoje.getFullYear() - i);
  const quinzenas: Array<[string, DocumentoRelatorio[]]> = [
    ['1ª quinzena · dias 01 a 15', lista.filter(d => naPrimeiraQuinzena(d.data))],
    ['2ª quinzena · dia 16 ao fim do mês', lista.filter(d => !naPrimeiraQuinzena(d.data))],
  ];
  let ordem = 0;
  const seletor = 'rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm dark:border-border-dark dark:bg-surface-card dark:text-graphite-100';

  return (
    <PageContainer>
      <PageTitle icon={FileSignature} title={`Relatório de ${cfg.nome}`}
        subtitle={ehRea
          ? 'REAs do período, por data e hora, gerados pelo sistema (o REA não passa pelo Autentique).'
          : 'Documentos assinados do período, na ordem dos plantões, sem a página de auditoria do Autentique.'} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {cfgRota.tipo === 'bona' && (
          <div role="radiogroup" aria-label="Documento" className="inline-flex rounded-xl border border-graphite-200 bg-graphite-50 p-1 dark:border-border-dark dark:bg-surface-elevated">
            {(['BONA', 'REA'] as const).map(m => (
              <button key={m} type="button" role="radio" aria-checked={modelo === m} onClick={() => setModelo(m)}
                className={`rounded-lg px-4 py-1.5 text-sm font-semibold ${modelo === m ? 'bg-white text-graphite-900 shadow-sm dark:bg-surface-card dark:text-graphite-100' : 'text-graphite-500'}`}>
                {m}
              </button>
            ))}
          </div>
        )}
        <select value={mes} onChange={e => setMes(Number(e.target.value))} className={seletor} aria-label="Mês">
          {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={ano} onChange={e => setAno(Number(e.target.value))} className={seletor} aria-label="Ano">
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {cfg.tipo !== 'troca' && (
          <select value={equipe} onChange={e => setEquipe(e.target.value)} className={seletor} aria-label="Equipe">
            <option value="">Todas as equipes</option>
            {['Alfa', 'Bravo', 'Charlie', 'Delta'].map(eq => <option key={eq} value={eq}>{eq}</option>)}
          </select>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-graphite-200 bg-white p-3 dark:border-border-dark dark:bg-surface-card">
        <div role="radiogroup" aria-label="Período do PDF" className="inline-flex rounded-xl border border-graphite-200 bg-graphite-50 p-1 dark:border-border-dark dark:bg-surface-elevated">
          {([['quinzena', '1ª quinzena'], ['mes', 'Mês completo']] as const).map(([id, rotulo]) => (
            <button key={id} type="button" role="radio" aria-checked={periodo === id} onClick={() => setPeriodo(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${periodo === id ? 'bg-white text-graphite-900 shadow-sm dark:bg-surface-card dark:text-graphite-100' : 'text-graphite-500'}`}>
              {rotulo}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => baixar()} disabled={!!gerando}
          className="flex items-center gap-2 rounded-xl bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-500 disabled:opacity-60">
          <FileDown className="h-4 w-4" /> Baixar PDF
        </button>
        <button type="button" onClick={() => imprimir()} disabled={!!gerando}
          className="flex items-center gap-2 rounded-xl border border-graphite-300 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 disabled:opacity-60 dark:border-border-dark dark:text-graphite-200">
          <Printer className="h-4 w-4" /> Imprimir
        </button>
        {cfg.tipo === 'troca' && (
          <div className="flex items-center gap-1 border-l border-graphite-200 pl-2 dark:border-border-dark">
            <span className="text-xs text-graphite-500 dark:text-graphite-400">Só a folha de trocas:</span>
            <button type="button" onClick={() => baixar(true)} disabled={!!gerando} aria-label="Baixar só a folha de trocas" title="Baixar só a folha de trocas"
              className="rounded-lg p-2 text-graphite-600 hover:bg-graphite-100 disabled:opacity-60 dark:text-graphite-300 dark:hover:bg-surface-hover"><FileDown className="h-4 w-4" /></button>
            <button type="button" onClick={() => imprimir(true)} disabled={!!gerando} aria-label="Imprimir só a folha de trocas" title="Imprimir só a folha de trocas"
              className="rounded-lg p-2 text-graphite-600 hover:bg-graphite-100 disabled:opacity-60 dark:text-graphite-300 dark:hover:bg-surface-hover"><Printer className="h-4 w-4" /></button>
          </div>
        )}
        <span className="ml-auto text-xs text-graphite-500 dark:text-graphite-400">
          {gerando ?? (ehRea ? `${assinadosNoPeriodo} REA(s) entram no PDF`
            : `${assinadosNoPeriodo} assinado(s) entram no PDF${cfg.tipo === 'troca' ? ', e a folha de trocas por último' : ''}`)}
        </span>
      </div>

      {erro && <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-300">{erro}</p>}

      <div className="overflow-x-auto rounded-2xl border border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-graphite-200 bg-graphite-50 text-left text-xs text-graphite-500 dark:border-border-dark dark:bg-surface-elevated dark:text-graphite-400">
              <th className="w-10 px-3 py-2 font-semibold">#</th>
              <th className="px-3 py-2 font-semibold">Data</th>
              {cfg.tipo !== 'troca' && <th className="px-3 py-2 font-semibold">{ehRea ? 'Hora' : 'Plantão'}</th>}
              {cfg.tipo !== 'troca' && <th className="px-3 py-2 font-semibold">Equipe</th>}
              <th className="px-3 py-2 font-semibold">Documento</th>
              <th className="px-3 py-2 font-semibold">Situação</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {carregando && <tr><td colSpan={7} className="px-3 py-6 text-center text-graphite-500">Carregando…</td></tr>}
            {!carregando && lista.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-graphite-500">Nenhum documento neste mês.</td></tr>
            )}
            {!carregando && quinzenas.map(([titulo, itens]) => itens.length > 0 && (
              [
                <tr key={titulo} className="bg-graphite-50/70 dark:bg-surface-elevated/60">
                  <td colSpan={7} className="px-3 py-1.5 text-xs font-semibold text-graphite-500 dark:text-graphite-400">{titulo}</td>
                </tr>,
                ...itens.map(d => {
                  ordem += 1;
                  const rea = ehRea ? reaPorId(d.referenciaId) : undefined;
                  const s = rea
                    ? { rotulo: rea.status, classe: rea.status === 'Fechada' ? SITUACAO.assinado.classe : SITUACAO.aguardando.classe }
                    : SITUACAO[d.situacao];
                  return (
                    <tr key={d.referenciaId} className="border-t border-graphite-100 dark:border-border-dark">
                      <td className="px-3 py-2 text-xs tabular-nums text-graphite-400">{ordem}</td>
                      <td className="px-3 py-2 tabular-nums text-graphite-800 dark:text-graphite-100">{br(d.data)}</td>
                      {cfg.tipo !== 'troca' && <td className="px-3 py-2 text-graphite-600 dark:text-graphite-300">{d.turno || '-'}</td>}
                      {cfg.tipo !== 'troca' && <td className="px-3 py-2 text-graphite-600 dark:text-graphite-300">{d.equipe || '-'}</td>}
                      <td className="px-3 py-2 text-graphite-800 dark:text-graphite-100">{nomeDocumento(d)}</td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.classe}`}>{s.rotulo}</span></td>
                      <td className="px-2 py-2 text-right">
                        {d.situacao === 'assinado' && (
                          <button type="button" onClick={() => ver(d)} aria-label="Ver documento" title="Ver documento"
                            className="rounded-lg p-1.5 text-graphite-400 hover:bg-graphite-100 hover:text-graphite-700 dark:hover:bg-surface-hover"><Eye className="h-4 w-4" /></button>
                        )}
                      </td>
                    </tr>
                  );
                }),
              ]
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-graphite-500 dark:text-graphite-400">
        {ehRea ? 'Todos os REAs do período entram no PDF, na ordem da lista.'
          : 'Só os documentos assinados por todos entram no PDF; "Aguardando" e "Não enviado" ficam só na lista.'}
        {cfg.tipo === 'ptrba' && ' No PTR-BA entra a 1ª página de cada um.'}
      </p>

      {visualizando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setVisualizando(null)}>
          <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-surface-elevated"
            onClick={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
            <div className="flex items-center gap-3 border-b border-graphite-200 px-5 py-3 dark:border-border-dark">
              <h3 className="flex-1 truncate text-sm font-bold text-graphite-900 dark:text-graphite-100">{visualizando.titulo}</h3>
              <button onClick={() => setVisualizando(null)} aria-label="Fechar" className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-auto bg-graphite-100 p-4 dark:bg-surface-card">
              <PdfPreview pdfData={visualizando.pdf} fields={[]} />
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
