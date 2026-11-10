import { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  AlertTriangle, CheckCircle2, CircleDashed, FileImage, FileText, FolderOpen, FolderSearch, MinusCircle, Plus, Trash2, X, XCircle,
} from 'lucide-react';
import { PdfPreview } from '../../components/documentos/PdfPreview';
import { hojeLocalISO } from '../../utils/datas';
import {
  PASTAS_DRIVE, PASTA_EXTRAS, TIPOS_COM_VALIDADE_PROPRIA, avaliarPessoa, posicaoNaPasta, documentosDaPastaEscolhida, tipoPeloNome, tiposEncontrados,
  type ConfigDocumentos, type DocumentoAvaliado, type SituacaoDocumento, type ArquivoDrive,
} from './regrasDrive';

/* ───────── Cores por situação ───────── */

export const ESTILO_SITUACAO: Record<SituacaoDocumento, {
  card: string; icone: string; texto: string; ponto: string; rotulo: string;
}> = {
  vencido: {
    card: 'border-red-200 bg-red-50/70 hover:border-red-300 dark:border-red-800/50 dark:bg-red-900/15',
    icone: 'bg-red-500 text-white', texto: 'text-red-700 dark:text-red-400', ponto: 'bg-red-500', rotulo: 'Vencidos',
  },
  vence: {
    card: 'border-amber-200 bg-amber-50/70 hover:border-amber-300 dark:border-amber-700/50 dark:bg-amber-900/15',
    icone: 'bg-amber-500 text-white', texto: 'text-amber-700 dark:text-amber-400', ponto: 'bg-amber-500', rotulo: 'Vencem em breve',
  },
  emdia: {
    card: 'border-emerald-200 bg-emerald-50/60 hover:border-emerald-300 dark:border-emerald-800/50 dark:bg-emerald-900/15',
    icone: 'bg-emerald-600 text-white', texto: 'text-emerald-700 dark:text-emerald-400', ponto: 'bg-emerald-500', rotulo: 'Em dia',
  },
  neutro: {
    card: 'border-graphite-200 bg-graphite-50/70 hover:border-graphite-300 dark:border-border-dark dark:bg-surface-card/60',
    icone: 'bg-graphite-300 text-graphite-700 dark:bg-graphite-700 dark:text-graphite-200', texto: 'text-graphite-500 dark:text-graphite-400', ponto: 'bg-graphite-400', rotulo: 'Sem vencimento',
  },
  falta: {
    card: 'border-dashed border-red-300 bg-white dark:border-red-800/60 dark:bg-transparent',
    icone: 'bg-white text-red-500 ring-1 ring-red-300 dark:bg-transparent dark:ring-red-800', texto: 'text-red-600 dark:text-red-400', ponto: 'bg-red-300', rotulo: 'Faltam',
  },
};

const ICONE_SITUACAO: Record<SituacaoDocumento, typeof CheckCircle2> = {
  vencido: XCircle, vence: AlertTriangle, emdia: CheckCircle2, neutro: MinusCircle, falta: CircleDashed,
};

const ORDEM_SITUACAO: SituacaoDocumento[] = ['vencido', 'falta', 'vence', 'emdia', 'neutro'];

/* ───────── Crachá (credencial aeroportuária) no cabeçalho do card ───────── */

export { TIPO_CREDENCIAL as TIPO_CRACHA } from './regrasDrive';

const FAIXA_CRACHA: Record<SituacaoDocumento, string> = {
  vencido: 'bg-red-500', vence: 'bg-amber-500', emdia: 'bg-emerald-500', neutro: 'bg-graphite-400', falta: 'bg-red-300',
};

/** "faltam 1 ano e 3 meses", "faltam 24 dias", "há 2 meses". */
export function tempoAteVencer(vencimento: string, hojeISO: string): string {
  const [a1, m1, d1] = hojeISO.split('-').map(Number);
  const [a2, m2, d2] = vencimento.split('-').map(Number);
  const dias = Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
  const passou = dias < 0;
  const abs = Math.abs(dias);
  let texto: string;
  if (abs === 0) return 'vence hoje';
  if (abs < 60) {
    texto = `${abs} dia${abs === 1 ? '' : 's'}`;
  } else {
    const mesesEntre = (ai: number, mi: number, di: number, af: number, mf: number, df: number) =>
      (af - ai) * 12 + (mf - mi) - (df < di ? 1 : 0);
    const meses = passou ? mesesEntre(a2, m2, d2, a1, m1, d1) : mesesEntre(a1, m1, d1, a2, m2, d2);
    const anos = Math.floor(meses / 12);
    const resto = meses % 12;
    const parteAno = anos ? `${anos} ano${anos === 1 ? '' : 's'}` : '';
    const parteMes = resto ? `${resto} ${resto === 1 ? 'mês' : 'meses'}` : '';
    texto = [parteAno, parteMes].filter(Boolean).join(' e ');
  }
  const singular = /^1 (dia|mês|ano)$/.test(texto);
  return passou ? `há ${texto}` : `falta${singular ? '' : 'm'} ${texto}`;
}

export interface AlertaAsur {
  /** 'vencido' (curso ASUR vencido ou faltando), 'vence' (vence em até 4 meses) ou 'neutro' (só vence antes da credencial). */
  situacao: 'vencido' | 'vence' | 'neutro';
  texto: string;
  detalhes: string[];
}

/**
 * Os cursos internos ASUR (pasta 02) são a base da credencial: avisa quando algum venceu, falta,
 * vence em até 4 meses ou vence antes da própria credencial.
 */
export function alertaCursosAsur(docsAsur: DocumentoAvaliado[], vencimentoCredencial: string | null): AlertaAsur | null {
  const vencidos = docsAsur.filter(d => d.situacao === 'vencido' || d.situacao === 'falta');
  const vencendo = docsAsur.filter(d => d.situacao === 'vence');
  const antes = vencimentoCredencial
    ? docsAsur.filter(d => d.situacao === 'emdia' && d.vencimento && d.vencimento < vencimentoCredencial)
    : [];
  const br = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');
  const detalhes = [
    ...vencidos.map(d => `${d.tipo}: ${d.situacao === 'falta' ? 'não está na pasta' : d.texto}`),
    ...vencendo.map(d => `${d.tipo}: ${d.texto}`),
    ...antes.map(d => `${d.tipo}: vence em ${br(d.vencimento)}, antes da credencial`),
  ];
  const resumo = (lista: DocumentoAvaliado[], singular: string, plural: string) =>
    lista.length === 1 ? `${lista[0].tipo} ${singular}` : `${lista.length} cursos ASUR ${plural}`;
  if (vencidos.length) {
    const faltam = vencidos.every(d => d.situacao === 'falta');
    return { situacao: 'vencido', texto: resumo(vencidos, faltam ? 'falta' : 'vencido', faltam ? 'faltam' : vencidos.some(d => d.situacao === 'falta') ? 'vencidos ou faltando' : 'vencidos'), detalhes };
  }
  if (vencendo.length) return { situacao: 'vence', texto: resumo(vencendo, 'vence logo', 'vencem logo'), detalhes };
  if (antes.length) return { situacao: 'neutro', texto: resumo(antes, 'vence antes', 'vencem antes'), detalhes };
  return null;
}

/** Desenho de um crachá com a cor e a data da credencial. Clicar abre a credencial (se houver arquivo). */
export function CrachaValidade({ doc, iniciais, onInfo, alertaAsur }: {
  doc?: DocumentoAvaliado; iniciais: string; onInfo?: () => void; alertaAsur?: AlertaAsur | null;
}) {
  const situacaoCredencial: SituacaoDocumento = doc?.situacao ?? 'falta';
  // A cor do crachá piora junto com os cursos ASUR (base da credencial).
  const peso: Record<SituacaoDocumento, number> = { vencido: 4, falta: 3, vence: 2, emdia: 1, neutro: 0 };
  const situacao: SituacaoDocumento = alertaAsur && alertaAsur.situacao !== 'neutro'
    && peso[alertaAsur.situacao] > peso[situacaoCredencial] && situacaoCredencial !== 'falta'
    ? alertaAsur.situacao : situacaoCredencial;
  const estiloData = ESTILO_SITUACAO[situacaoCredencial];
  const data = doc?.vencimento ? doc.vencimento.split('-').reverse().join('/') : null;
  const legenda = !doc || situacaoCredencial === 'falta' ? 'Validade não cadastrada'
    : situacaoCredencial === 'vencido' ? `Venceu ${data}`
      : data ? `Vence ${data}` : doc.texto;
  const tempo = doc?.vencimento && situacaoCredencial !== 'falta' ? tempoAteVencer(doc.vencimento, hojeLocalISO()) : null;

  const desenho = (
    <span className="relative flex h-[60px] w-[44px] shrink-0 flex-col items-center overflow-hidden rounded-md border border-graphite-200 bg-white shadow-sm dark:border-border-dark dark:bg-surface-elevated">
      <span className={`flex h-3.5 w-full items-start justify-center ${FAIXA_CRACHA[situacao]}`}>
        <span className="mt-1 h-1 w-3 rounded-full bg-white/80" />
      </span>
      <span className="mt-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-graphite-200 text-[8px] font-bold text-graphite-600 dark:bg-graphite-700 dark:text-graphite-200">{iniciais}</span>
      <span className="mt-1 h-[3px] w-6 rounded bg-graphite-200 dark:bg-graphite-700" />
      <span className="mt-[3px] h-[3px] w-4 rounded bg-graphite-200 dark:bg-graphite-700" />
      {situacaoCredencial === 'falta' && <span className="absolute inset-0 rounded-md border-2 border-dashed border-red-300 bg-white/60 dark:bg-transparent" />}
    </span>
  );

  const conteudo = (
    <>
      {desenho}
      <span className="hidden min-w-0 flex-col text-left md:flex">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-graphite-400">Credencial</span>
        <span className={`whitespace-nowrap text-xs font-bold tabular-nums ${estiloData.texto}`}>{legenda}</span>
        {tempo && <span className="whitespace-nowrap text-[11px] text-graphite-500 dark:text-graphite-400">{tempo}</span>}
        {alertaAsur && (
          <span className={`flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold ${
            alertaAsur.situacao === 'neutro' ? 'text-graphite-500 dark:text-graphite-400' : ESTILO_SITUACAO[alertaAsur.situacao].texto
          }`}>
            <AlertTriangle className="h-3 w-3 shrink-0" /> {alertaAsur.texto}
          </span>
        )}
      </span>
    </>
  );

  const titulo = [
    `Credencial aeroportuária · ${doc && situacaoCredencial !== 'falta' ? doc.texto : 'validade não cadastrada'}`,
    ...(alertaAsur ? ['', 'Cursos ASUR (base da credencial):', ...alertaAsur.detalhes] : []),
  ].join('\n');
  if (onInfo) {
    return (
      <span role="button" tabIndex={0} title={titulo}
        onClick={e => { e.stopPropagation(); onInfo(); }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onInfo(); } }}
        className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-graphite-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aviation-500/40 dark:hover:bg-surface-hover">
        {conteudo}
      </span>
    );
  }
  return <span title={titulo} className="flex items-center gap-2.5 px-1.5 py-1">{conteudo}</span>;
}

/** Ao clicar na credencial: só informações (validade do cadastro e cursos ASUR com problema). */
export function InfoCredencial({ pessoaNome, credencial, docsAsur, onClose }: {
  pessoaNome: string; credencial?: DocumentoAvaliado; docsAsur: DocumentoAvaliado[]; onClose: () => void;
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onClose]);

  const hoje = hojeLocalISO();
  const situacao: SituacaoDocumento = credencial?.situacao ?? 'falta';
  const data = credencial?.vencimento ? credencial.vencimento.split('-').reverse().join('/') : null;
  const problemas = docsAsur
    .filter(d => d.situacao === 'vencido' || d.situacao === 'falta' || d.situacao === 'vence'
      || (d.situacao === 'emdia' && !!d.vencimento && !!credencial?.vencimento && d.vencimento < credencial.vencimento))
    .sort((a, b) => ORDEM_SITUACAO.indexOf(a.situacao) - ORDEM_SITUACAO.indexOf(b.situacao));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Credencial de ${pessoaNome}`} onClick={e => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-surface-elevated">
        <div className="flex items-start gap-3 border-b border-graphite-200 px-5 py-4 dark:border-border-dark">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400">Credencial aeroportuária</p>
            <h3 className="truncate text-base font-bold text-graphite-900 dark:text-graphite-100">{pessoaNome}</h3>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className={`rounded-xl border p-3 ${ESTILO_SITUACAO[situacao].card}`}>
            <p className="text-xs text-graphite-500 dark:text-graphite-400">Validade (cadastro)</p>
            {data ? (
              <p className={`text-sm font-bold ${ESTILO_SITUACAO[situacao].texto}`}>
                {situacao === 'vencido' ? `Venceu em ${data}` : `Vence em ${data}`} · {tempoAteVencer(credencial!.vencimento!, hoje)}
              </p>
            ) : (
              <p className="text-sm font-bold text-red-600 dark:text-red-400">Validade não cadastrada</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Cursos ASUR (base da credencial)</p>
            {problemas.length === 0 ? (
              <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-900/15 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" /> Todos os cursos ASUR em dia
              </p>
            ) : (
              <ul className="space-y-1.5">
                {problemas.map(d => {
                  const antes = d.situacao === 'emdia';
                  const Icone = ICONE_SITUACAO[d.situacao];
                  const texto = d.situacao === 'falta' ? 'Não está na pasta'
                    : antes ? `Vence em ${d.vencimento!.split('-').reverse().join('/')}, antes da credencial` : d.texto;
                  return (
                    <li key={d.tipo} className="flex items-center gap-2.5 rounded-lg border border-graphite-200 px-3 py-2 dark:border-border-dark">
                      <Icone className={`h-4 w-4 shrink-0 ${antes ? 'text-graphite-400' : ESTILO_SITUACAO[d.situacao].texto}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-graphite-900 dark:text-graphite-100">{d.tipo}</span>
                        <span className={`block text-xs ${antes ? 'text-graphite-500 dark:text-graphite-400' : ESTILO_SITUACAO[d.situacao].texto}`}>{texto}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Resumo no cabeçalho do card da pessoa ───────── */

export function ResumoDrive({ contagem }: { contagem: Record<SituacaoDocumento, number> }) {
  return (
    <div className="flex items-center gap-1.5">
      {ORDEM_SITUACAO.filter(s => s !== 'neutro' && contagem[s] > 0).map(s => (
        <span key={s} title={ESTILO_SITUACAO[s].rotulo}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
            s === 'vencido' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              : s === 'falta' ? 'border border-dashed border-red-300 bg-white text-red-600 dark:border-red-800 dark:bg-transparent dark:text-red-300'
                : s === 'vence' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
          }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${ESTILO_SITUACAO[s].ponto}`} />
          {contagem[s]}
        </span>
      ))}
    </div>
  );
}

/* ───────── Blocos por pasta ───────── */

function CardDocumento({ doc, onAbrir }: { doc: DocumentoAvaliado; onAbrir: (doc: DocumentoAvaliado) => void }) {
  const estilo = ESTILO_SITUACAO[doc.situacao];
  const Icone = ICONE_SITUACAO[doc.situacao];
  const conteudo = (
    <>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${estilo.icone}`}>
        <Icone className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-graphite-900 dark:text-graphite-100">{doc.tipo}</p>
        <p className={`text-[10.5px] font-medium leading-snug ${estilo.texto}`}>{doc.situacao === 'falta' ? 'Falta · não está na pasta' : doc.texto}</p>
        {doc.arquivos.length > 1 && <p className="text-[10px] text-graphite-500 dark:text-graphite-400">{doc.arquivos.length} arquivos</p>}
      </div>
      {doc.arquivo && (doc.arquivo.formato === 'imagem'
        ? <FileImage className="h-3.5 w-3.5 shrink-0 text-graphite-300 transition-colors group-hover:text-graphite-500" />
        : <FileText className="h-3.5 w-3.5 shrink-0 text-graphite-300 transition-colors group-hover:text-graphite-500" />)}
    </>
  );
  const classe = `group flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition-colors ${estilo.card}`;
  if (!doc.arquivo || doc.arquivo.marcadorFalta) return <div className={classe}>{conteudo}</div>;
  return (
    <button type="button" onClick={() => onAbrir(doc)} title={`Ver ${doc.arquivo.nomeArquivo}`}
      className={`${classe} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aviation-500/40 active:scale-[0.99]`}>
      {conteudo}
    </button>
  );
}

export function PastasDrive({ arquivos, config, hojeISO, onAbrir }: {
  arquivos: ArquivoDrive[]; config: ConfigDocumentos; hojeISO: string; onAbrir: (doc: DocumentoAvaliado) => void;
}) {
  const { porPasta } = useMemo(() => avaliarPessoa(arquivos, config, hojeISO), [arquivos, config, hojeISO]);
  return (
    <div className="space-y-4">
      {PASTAS_DRIVE.map(pasta => {
        // Ordem da pasta no Drive (Nº padrão); sem Nº, os piores primeiro.
        const docs = [...(porPasta.get(pasta.id) ?? [])]
          .sort((a, b) => posicaoNaPasta(pasta.id, a.tipo, config) - posicaoNaPasta(pasta.id, b.tipo, config)
            || ORDEM_SITUACAO.indexOf(a.situacao) - ORDEM_SITUACAO.indexOf(b.situacao)
            || a.tipo.localeCompare(b.tipo, 'pt-BR', { numeric: true }));
        return (
          <section key={pasta.id}>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">
              <FolderOpen className="h-3.5 w-3.5" /> {pasta.nome}
              <span className="font-normal normal-case tracking-normal text-graphite-400">· {docs.length}</span>
            </h4>
            {docs.length === 0 ? (
              <p className="rounded-xl border border-dashed border-graphite-200 py-3 text-center text-xs text-graphite-400 dark:border-border-dark">Pasta vazia.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {docs.map(doc => <CardDocumento key={`${doc.pastaId}-${doc.tipo}`} doc={doc} onAbrir={onAbrir} />)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/* ───────── Visualizador (dentro do sistema, sem baixar) ───────── */

/** Enquanto não há Drive: gera um arquivo de exemplo para mostrar como o visualizador fica. */
function arquivoDeExemplo(doc: DocumentoAvaliado, arquivo: ArquivoDrive): Promise<{ pdf?: ArrayBuffer; imagem?: string }> {
  if (arquivo.formato === 'outro') return Promise.resolve({});
  const linhas = [
    `Arquivo: ${arquivo.nomeArquivo}`,
    `Data do curso: ${arquivo.dataCurso ? arquivo.dataCurso.split('-').reverse().join('/') : 'não informada'}`,
    `Situação: ${doc.texto}`,
  ];
  if (arquivo.formato === 'imagem') {
    const canvas = document.createElement('canvas');
    canvas.width = 900; canvas.height = 560;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#f4f6f8'; ctx.fillRect(0, 0, 900, 560);
    ctx.strokeStyle = '#c3ccd5'; ctx.lineWidth = 4; ctx.strokeRect(30, 30, 840, 500);
    ctx.fillStyle = '#1f2a37'; ctx.font = 'bold 38px sans-serif'; ctx.fillText(doc.tipo, 70, 120);
    ctx.font = '22px sans-serif'; ctx.fillStyle = '#4b5563';
    linhas.forEach((l, i) => ctx.fillText(l, 70, 200 + i * 40));
    ctx.fillStyle = '#b45309'; ctx.font = 'italic 20px sans-serif';
    ctx.fillText('EXEMPLO — a foto real virá do Google Drive', 70, 470);
    return Promise.resolve({ imagem: canvas.toDataURL('image/png') });
  }
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  pdf.setDrawColor(180); pdf.setLineWidth(1); pdf.rect(12, 12, 273, 186);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(30); pdf.text('CERTIFICADO', 148.5, 55, { align: 'center' });
  pdf.setFontSize(22); pdf.text(doc.tipo, 148.5, 75, { align: 'center' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(13);
  linhas.forEach((l, i) => pdf.text(l, 148.5, 105 + i * 10, { align: 'center' }));
  pdf.setTextColor(180, 83, 9); pdf.setFont('helvetica', 'italic');
  pdf.text('EXEMPLO — o PDF real virá do Google Drive', 148.5, 175, { align: 'center' });
  return Promise.resolve({ pdf: pdf.output('arraybuffer') });
}

export function VisualizadorDocumento({ doc, pessoaNome, onClose, carregar, onInformarData }: {
  doc: DocumentoAvaliado; pessoaNome: string; onClose: () => void;
  /** Só para quem pode corrigir a data (administrador/GS). */
  onInformarData?: (arquivo: ArquivoDrive, data: string | null) => Promise<void>;
  /** Busca o arquivo de verdade (Drive). Sem ele, mostra um arquivo de exemplo. */
  carregar?: (arquivo: ArquivoDrive) => Promise<{ pdf?: ArrayBuffer; imagem?: string }>;
}) {
  const [erro, setErro] = useState('');
  const [editandoData, setEditandoData] = useState(false);
  const [novaData, setNovaData] = useState('');
  const [salvandoData, setSalvandoData] = useState(false);
  const [conteudo, setConteudo] = useState<{ pdf?: ArrayBuffer; imagem?: string } | null>(null);
  const [indice, setIndice] = useState(() => Math.max(0, doc.arquivos.findIndex(a => a.id === doc.arquivo?.id)));
  const arquivo = doc.arquivos[indice] ?? doc.arquivo!;
  const estilo = ESTILO_SITUACAO[doc.situacao];

  useEffect(() => {
    let cancelado = false;
    setConteudo(null);
    setErro('');
    (carregar ? carregar(arquivo) : arquivoDeExemplo(doc, arquivo))
      .then(c => { if (!cancelado) setConteudo(c); })
      .catch(() => { if (!cancelado) setErro('Não foi possível abrir o documento agora.'); });
    return () => { cancelado = true; };
  }, [doc, arquivo]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-surface-elevated"
        onClick={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
        <div className="flex items-center gap-3 border-b border-graphite-200 px-5 py-3 dark:border-border-dark">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-bold text-graphite-900 dark:text-graphite-100">{doc.tipo} · {pessoaNome}</h3>
            <p className="truncate text-xs text-graphite-500 dark:text-graphite-400">
              {arquivo.nomeArquivo} · <span className={`font-medium ${estilo.texto}`}>{doc.texto}</span>
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-graphite-500 dark:text-graphite-400">
              <span>
                Data do curso: <strong className="text-graphite-800 dark:text-graphite-200">
                  {arquivo.dataCurso ? arquivo.dataCurso.split('-').reverse().join('/') : 'não encontrada'}
                </strong>
                {arquivo.origemData && ` (${arquivo.origemData === 'informada' ? 'informada' : 'lida do PDF'})`}
              </span>
              {onInformarData && !editandoData && (
                <button type="button" onClick={() => { setNovaData(arquivo.dataCurso ?? ''); setEditandoData(true); }}
                  className="rounded-md border border-graphite-300 px-2 py-0.5 font-medium text-graphite-700 hover:border-aviation-400 dark:border-border-dark dark:text-graphite-200">
                  {arquivo.dataCurso ? 'Corrigir data' : 'Informar data'}
                </button>
              )}
              {onInformarData && editandoData && (
                <form className="flex items-center gap-1.5" onSubmit={async e => {
                  e.preventDefault();
                  setSalvandoData(true);
                  try { await onInformarData(arquivo, novaData || null); setEditandoData(false); } finally { setSalvandoData(false); }
                }}>
                  <input type="date" value={novaData} onChange={e => setNovaData(e.target.value)} aria-label="Data do curso"
                    className="rounded-md border border-graphite-300 bg-white px-2 py-0.5 text-xs text-graphite-900 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100" />
                  <button type="submit" disabled={salvandoData} className="rounded-md bg-aviation-600 px-2 py-0.5 font-medium text-white disabled:opacity-50">Salvar</button>
                  <button type="button" onClick={() => setEditandoData(false)} className="px-1 font-medium text-graphite-500">Cancelar</button>
                </form>
              )}
            </div>
          </div>
          {doc.arquivos.length > 1 && (
            <div className="flex shrink-0 gap-1 rounded-lg bg-graphite-100 p-0.5 dark:bg-surface-card">
              {doc.arquivos.map((a, i) => (
                <button key={a.id} onClick={() => setIndice(i)} title={a.nomeArquivo}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${i === indice ? 'bg-white text-graphite-900 shadow-sm dark:bg-surface-elevated dark:text-graphite-100' : 'text-graphite-500'}`}>
                  {a.nomeArquivo.match(/^\s*(\d{1,3}[A-Z]?)/i)?.[1] ?? i + 1}
                </button>
              ))}
            </div>
          )}
          <button onClick={onClose} aria-label="Fechar" className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-auto bg-graphite-100 p-4 dark:bg-surface-card">
          {erro ? (
            <p className="py-16 text-center text-sm text-red-600">{erro}</p>
          ) : !conteudo ? (
            <p className="py-16 text-center text-sm text-graphite-500">Carregando documento...</p>
          ) : conteudo.pdf ? (
            <PdfPreview pdfData={conteudo.pdf} fields={[]} />
          ) : conteudo.imagem ? (
            <img src={conteudo.imagem} alt={doc.tipo} draggable={false} className="mx-auto max-h-[75vh] select-none rounded-lg object-contain shadow" />
          ) : (
            <p className="py-16 text-center text-sm text-graphite-500">Este tipo de arquivo não tem visualização.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────── Aba "Validade dos documentos" (administrador) ───────── */


export function ValidadeDocumentos({ config, onChange, encontrados }: {
  config: ConfigDocumentos; onChange: (c: ConfigDocumentos) => void;
  /** Documentos achados nas pastas do Drive (sem isso, usa a lista de exemplo). */
  encontrados?: Array<{ tipo: string; pastaId: string }>;
}) {
  const [adicionando, setAdicionando] = useState<string | null>(null);
  const [novo, setNovo] = useState({ nome: '', prazo: '', obrigatorio: true });
  const [erroNovo, setErroNovo] = useState('');

  const tipos = useMemo(() => {
    const lista: Array<{ tipo: string; pastaId: string; manual: boolean }> =
      (encontrados ?? tiposEncontrados()).map(t => ({ ...t, manual: false }));
    for (const a of config.adicionados ?? []) {
      if (!lista.some(t => t.tipo === a.tipo)) lista.push({ ...a, manual: true });
    }
    return lista;
  }, [config.adicionados, encontrados]);

  /** Nº padrão do documento na pasta (arquivo "05 - …" na pasta 01 = CNH, qualquer que seja o nome). */
  function numeroDe(pastaId: string, tipo: string): string {
    const daPasta = config.padroes?.[pastaId] ?? {};
    return Object.keys(daPasta).find(n => daPasta[n] === tipo) ?? '';
  }

  function mudarNumero(pastaId: string, tipo: string, valor: string) {
    const limpo = valor.replace(/\D/g, '').slice(0, 2);
    const daPasta = Object.fromEntries(Object.entries(config.padroes?.[pastaId] ?? {}).filter(([, t]) => t !== tipo));
    if (limpo) daPasta[limpo.padStart(2, '0')] = tipo;
    onChange({ ...config, padroes: { ...(config.padroes ?? {}), [pastaId]: daPasta } });
  }

  /** "COMLIANCE" passa a contar como "COMPLIANCE" (e o que já estava juntado nele também). */
  function juntar(tipo: string, alvo: string) {
    if (!alvo || alvo === tipo) return;
    const apelidos = Object.fromEntries(Object.entries(config.apelidos ?? {}).map(([de, para]) => [de, para === tipo ? alvo : para]));
    apelidos[tipo] = alvo;
    onChange({ ...config, apelidos, obrigatorios: config.obrigatorios.filter(t => t !== tipo) });
  }

  function separar(variante: string) {
    const apelidos = { ...(config.apelidos ?? {}) };
    delete apelidos[variante];
    onChange({ ...config, apelidos });
  }

  function abrirAdicionar(pastaId: string) {
    setAdicionando(pastaId);
    setNovo({ nome: '', prazo: '', obrigatorio: true });
    setErroNovo('');
  }

  function salvarNovo(pastaId: string) {
    const tipo = tipoPeloNome(novo.nome.trim());
    if (!tipo) { setErroNovo('Escreva o nome do documento.'); return; }
    const existente = tipos.find(t => t.tipo === tipo);
    if (existente) {
      const pasta = PASTAS_DRIVE.find(p => p.id === existente.pastaId)?.nome ?? '';
      setErroNovo(`"${tipo}" já existe em ${pasta}.`);
      return;
    }
    const prazo = novo.prazo.trim() === '' ? null : Number(novo.prazo);
    onChange({
      prazos: { ...config.prazos, [tipo]: prazo },
      obrigatorios: novo.obrigatorio ? [...config.obrigatorios, tipo] : config.obrigatorios,
      adicionados: [...(config.adicionados ?? []), { tipo, pastaId }],
    });
    setAdicionando(null);
  }

  const entradaPasta = useRef<HTMLInputElement>(null);
  const [lidos, setLidos] = useState<Array<{ tipo: string; pastaId: string; arquivos: string[] }> | null>(null);
  const [marcados, setMarcados] = useState<string[]>([]);

  function lerPasta(arquivos: FileList | null) {
    if (!arquivos || arquivos.length === 0) return;
    const caminhos = [...arquivos].map(f => (f as File & { webkitRelativePath: string }).webkitRelativePath || f.name);
    const achados = documentosDaPastaEscolhida(caminhos);
    setLidos(achados);
    setMarcados(achados.filter(a => a.pastaId !== PASTA_EXTRAS && !tipos.some(t => t.tipo === a.tipo)).map(a => a.tipo));
    if (entradaPasta.current) entradaPasta.current.value = '';
  }

  function adicionarLidos() {
    if (!lidos) return;
    const novos = lidos.filter(l => marcados.includes(l.tipo) && !tipos.some(t => t.tipo === l.tipo));
    const prazos = { ...config.prazos };
    for (const n of novos) if (!(n.tipo in prazos)) prazos[n.tipo] = null;
    onChange({
      ...config,
      prazos,
      adicionados: [...(config.adicionados ?? []), ...novos.map(n => ({ tipo: n.tipo, pastaId: n.pastaId }))],
    });
    setLidos(null);
  }

  function removerAdicionado(tipo: string) {
    const prazos = { ...config.prazos };
    delete prazos[tipo];
    onChange({
      prazos,
      obrigatorios: config.obrigatorios.filter(t => t !== tipo),
      adicionados: (config.adicionados ?? []).filter(a => a.tipo !== tipo),
    });
  }
  const semPrazo = tipos.filter(t => t.pastaId !== PASTA_EXTRAS && !TIPOS_COM_VALIDADE_PROPRIA.includes(t.tipo)
    && (config.prazos[t.tipo] === null || config.prazos[t.tipo] === undefined)).length;

  function mudarPrazo(tipo: string, valor: string) {
    const limpo = valor.replace(/\D/g, '').slice(0, 3);
    onChange({ ...config, prazos: { ...config.prazos, [tipo]: limpo === '' ? null : Number(limpo) } });
  }
  function mudarObrigatorio(tipo: string, marcado: boolean) {
    const obrigatorios = marcado ? [...config.obrigatorios, tipo] : config.obrigatorios.filter(t => t !== tipo);
    onChange({ ...config, obrigatorios });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-graphite-200 bg-white p-4 text-sm text-graphite-600 dark:border-border-dark dark:bg-surface-card dark:text-graphite-300">
        Prazo em <strong>meses</strong> a partir da data do curso. <strong>0</strong> = não vence. Em branco = ainda não definido
        {semPrazo > 0 && <span className="ml-1 font-semibold text-amber-700 dark:text-amber-400">({semPrazo} para definir)</span>}.
        A lista cresce sozinha com os documentos que aparecerem nas pastas; para exigir um documento que ninguém tem ainda,
        use <strong>Adicionar documento</strong> na pasta. Marque <strong>Obrigatório</strong> para o sistema avisar quando o
        documento não estiver na pasta da pessoa.
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => entradaPasta.current?.click()}
            className="flex items-center gap-1.5 rounded-lg bg-aviation-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-aviation-500">
            <FolderSearch className="h-4 w-4" /> Ler pasta do computador
          </button>
          <span className="text-xs text-graphite-500 dark:text-graphite-400">
            Escolha a pasta de uma pessoa no Google Drive (G:) ou uma subpasta. O sistema lê só os nomes dos arquivos; nada é enviado.
          </span>
          <input ref={entradaPasta} type="file" multiple className="hidden" onChange={e => lerPasta(e.target.files)}
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} />
        </div>
      </div>

      {lidos && (
        <section className="overflow-hidden rounded-2xl border border-aviation-200 bg-white dark:border-aviation-800/50 dark:bg-surface-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-aviation-200 bg-aviation-50/60 px-4 py-2.5 dark:border-aviation-800/50 dark:bg-aviation-900/10">
            <h4 className="flex-1 text-sm font-semibold text-graphite-900 dark:text-graphite-100">
              {lidos.length === 0 ? 'Nenhum documento encontrado' : `${lidos.length} documento(s) encontrado(s)`}
            </h4>
            <button type="button" onClick={() => setLidos(null)}
              className="rounded-lg border border-graphite-300 bg-white px-3 py-1.5 text-xs font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Fechar</button>
            {lidos.length > 0 && (
              <button type="button" onClick={adicionarLidos} disabled={marcados.length === 0}
                className="rounded-lg bg-aviation-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-aviation-500 disabled:cursor-not-allowed disabled:opacity-50">
                Adicionar {marcados.length} novo(s)
              </button>
            )}
          </div>
          {lidos.length === 0 ? (
            <p className="px-4 py-3 text-xs text-graphite-500">A pasta escolhida não tem subpastas "01 - …" a "06 - …" nem arquivos dentro delas.</p>
          ) : (
            <ul className="max-h-[50vh] divide-y divide-graphite-100 overflow-auto dark:divide-border-dark">
              {lidos.map(l => {
                const jaExiste = tipos.some(t => t.tipo === l.tipo);
                return (
                  <li key={l.tipo} className="flex items-center gap-3 px-4 py-2">
                    <input type="checkbox" disabled={jaExiste} checked={jaExiste || marcados.includes(l.tipo)}
                      onChange={e => setMarcados(m => e.target.checked ? [...m, l.tipo] : m.filter(t => t !== l.tipo))}
                      aria-label={`Adicionar ${l.tipo}`}
                      className="h-4 w-4 rounded border-graphite-300 text-aviation-600 focus:ring-aviation-500 disabled:opacity-40" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-graphite-900 dark:text-graphite-100">{l.tipo}</p>
                      <p className="truncate text-[11px] text-graphite-500 dark:text-graphite-400">
                        {PASTAS_DRIVE.find(p => p.id === l.pastaId)?.nome} · {l.arquivos.join(', ')}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      jaExiste ? 'bg-graphite-100 text-graphite-500 dark:bg-graphite-800 dark:text-graphite-400' : 'bg-aviation-50 text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300'
                    }`}>{jaExiste ? 'Já está na lista' : 'Novo'}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      {PASTAS_DRIVE.map(pasta => {
        const daPasta = tipos.filter(t => t.pastaId === pasta.id)
          .sort((a, b) => posicaoNaPasta(pasta.id, a.tipo, config) - posicaoNaPasta(pasta.id, b.tipo, config)
            || a.tipo.localeCompare(b.tipo, 'pt-BR', { numeric: true }));
        return (
          <section key={pasta.id} className="overflow-hidden rounded-2xl border border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card">
            <div className="flex items-center gap-2 border-b border-graphite-200 bg-graphite-50 px-4 py-2 dark:border-border-dark dark:bg-surface-elevated">
              <h4 className="flex flex-1 items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">
                <FolderOpen className="h-3.5 w-3.5" /> {pasta.nome}
              </h4>
              {adicionando !== pasta.id && (
                <button type="button" onClick={() => abrirAdicionar(pasta.id)}
                  className="flex items-center gap-1 rounded-lg border border-graphite-300 bg-white px-2.5 py-1 text-xs font-medium text-graphite-700 transition-colors hover:border-aviation-400 hover:text-aviation-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
                  <Plus className="h-3.5 w-3.5" /> Adicionar documento
                </button>
              )}
            </div>
            {adicionando === pasta.id && (
              <form onSubmit={e => { e.preventDefault(); salvarNovo(pasta.id); }}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-aviation-200 bg-aviation-50/50 px-4 py-3 dark:border-aviation-800/50 dark:bg-aviation-900/10">
                <input autoFocus value={novo.nome} onChange={e => { setNovo(n => ({ ...n, nome: e.target.value })); setErroNovo(''); }}
                  placeholder="Nome do documento (ex.: NR 20)" aria-label="Nome do documento"
                  className="min-w-[12rem] flex-1 rounded-lg border border-graphite-300 bg-white px-3 py-1.5 text-sm text-graphite-900 outline-none focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100" />
                <label className="flex items-center gap-2 text-xs text-graphite-500 dark:text-graphite-400">
                  <input type="checkbox" checked={novo.obrigatorio} onChange={e => setNovo(n => ({ ...n, obrigatorio: e.target.checked }))}
                    className="h-4 w-4 rounded border-graphite-300 text-aviation-600 focus:ring-aviation-500" />
                  Obrigatório
                </label>
                <label className="flex items-center gap-2 text-xs text-graphite-500 dark:text-graphite-400">
                  <input inputMode="numeric" value={novo.prazo} onChange={e => setNovo(n => ({ ...n, prazo: e.target.value.replace(/\D/g, '').slice(0, 3) }))}
                    placeholder="—" aria-label="Prazo em meses do novo documento"
                    className="w-16 rounded-lg border border-graphite-300 bg-white px-2 py-1.5 text-right text-sm tabular-nums text-graphite-900 outline-none focus:border-aviation-500 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100" />
                  <span className="w-20">{novo.prazo === '0' ? 'não vence' : 'meses'}</span>
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setAdicionando(null)}
                    className="rounded-lg border border-graphite-300 bg-white px-3 py-1.5 text-xs font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
                  <button type="submit"
                    className="rounded-lg bg-aviation-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-aviation-500">Salvar</button>
                </div>
                {erroNovo && <p className="w-full text-xs font-medium text-red-600 dark:text-red-400">{erroNovo}</p>}
              </form>
            )}
            {daPasta.length === 0 && adicionando !== pasta.id && (
              <p className="px-4 py-3 text-xs text-graphite-400">Nenhum documento nesta pasta ainda.</p>
            )}
            <ul className="divide-y divide-graphite-100 dark:divide-border-dark">
              {daPasta.map(({ tipo, manual }) => {
                const prazo = config.prazos[tipo];
                const propria = TIPOS_COM_VALIDADE_PROPRIA.includes(tipo);
                const indefinido = !propria && pasta.id !== PASTA_EXTRAS && (prazo === null || prazo === undefined);
                return (
                  <li key={tipo} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
                    <span className="min-w-[10rem] flex-1 text-sm font-medium text-graphite-900 dark:text-graphite-100">
                      {tipo}
                      {indefinido && <span className="ml-2 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Novo · definir</span>}
                      {manual && <span className="ml-2 rounded-full bg-aviation-50 px-1.5 py-0.5 text-[10px] font-bold text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">Adicionado</span>}
                    </span>
                    {(() => {
                      const juntados = Object.entries(config.apelidos ?? {}).filter(([, para]) => para === tipo).map(([de]) => de);
                      return juntados.length > 0 && (
                        <span className="order-last flex w-full flex-wrap items-center gap-1 pl-0.5 text-[11px] text-graphite-500 dark:text-graphite-400">
                          Também conta como {tipo}:
                          {juntados.map(j => (
                            <span key={j} className="inline-flex items-center gap-1 rounded-full bg-graphite-100 py-0.5 pl-2 pr-1 dark:bg-surface-elevated">
                              {j}
                              <button type="button" onClick={() => separar(j)} aria-label={`Separar ${j}`} title="Separar"
                                className="rounded-full p-0.5 text-graphite-400 hover:bg-graphite-200 hover:text-graphite-700 dark:hover:bg-surface-hover"><X className="h-3 w-3" /></button>
                            </span>
                          ))}
                        </span>
                      );
                    })()}
                    <label className="flex items-center gap-1.5 text-xs text-graphite-500 dark:text-graphite-400" title="Número na frente do arquivo nesta pasta">
                      Nº
                      <input inputMode="numeric" value={numeroDe(pasta.id, tipo)} onChange={e => mudarNumero(pasta.id, tipo, e.target.value)} placeholder="—"
                        aria-label={`Número padrão de ${tipo} na pasta`}
                        className="w-11 rounded-lg border border-graphite-300 bg-white px-1.5 py-1.5 text-center text-sm tabular-nums text-graphite-900 outline-none focus:border-aviation-500 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100" />
                    </label>
                    <select value="" onChange={e => juntar(tipo, e.target.value)} aria-label={`Juntar ${tipo} com outro documento`}
                      className="max-w-[9.5rem] rounded-lg border border-graphite-300 bg-white px-2 py-1.5 text-xs text-graphite-600 outline-none focus:border-aviation-500 dark:border-border-dark dark:bg-surface-card dark:text-graphite-300">
                      <option value="">Juntar com…</option>
                      {daPasta.filter(o => o.tipo !== tipo).map(o => <option key={o.tipo} value={o.tipo}>{o.tipo}</option>)}
                    </select>
                    <label className="flex items-center gap-2 text-xs text-graphite-500 dark:text-graphite-400">
                      <input type="checkbox" checked={config.obrigatorios.includes(tipo)} onChange={e => mudarObrigatorio(tipo, e.target.checked)}
                        className="h-4 w-4 rounded border-graphite-300 text-aviation-600 focus:ring-aviation-500" />
                      Obrigatório
                    </label>
                    {propria ? (
                      <span className="w-[9.5rem] text-right text-xs text-graphite-500 dark:text-graphite-400">usa a validade do cadastro</span>
                    ) : (
                    <label className="flex items-center gap-2 text-xs text-graphite-500 dark:text-graphite-400">
                      <input inputMode="numeric" value={indefinido ? '' : String(prazo)} onChange={e => mudarPrazo(tipo, e.target.value)} placeholder="—"
                        aria-label={`Prazo em meses de ${tipo}`}
                        className={`w-16 rounded-lg border px-2 py-1.5 text-right text-sm tabular-nums text-graphite-900 outline-none focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:bg-surface-card dark:text-graphite-100 ${
                          indefinido ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700' : 'border-graphite-300 bg-white dark:border-border-dark'
                        }`} />
                      <span className="w-20">{prazo === 0 ? 'não vence' : 'meses'}</span>
                    </label>
                    )}
                    {manual ? (
                      <button type="button" onClick={() => removerAdicionado(tipo)} aria-label={`Remover ${tipo}`} title="Remover"
                        className="rounded-lg p-1.5 text-graphite-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                    ) : <span className="w-7" aria-hidden />}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
