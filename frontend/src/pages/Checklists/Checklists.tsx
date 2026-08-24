import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClipboardCheck,
  Columns3,
  HelpCircle,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCcw,
  Rows3,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { AlertModal } from '../../components/ui/AlertModal';
import { AnimatedPageTour, type AnimatedTourStep } from '../../components/ui/AnimatedPageTour';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import {
  CHECKLIST_TOTAL_ROWS,
  CHECKLIST_TOTAL_TEMPLATES,
  type ChecklistTotalRow,
} from '../../data/checklistTotal';
import {
  CHECKLIST_TOTAL_PRINT_DOCUMENTS,
  type ChecklistTotalPrintDocument,
  type ChecklistTotalPrintLayout,
  type ChecklistTotalPrintRow,
} from '../../data/checklistTotalPrint';
import {
  atualizarChecklist,
  criarChecklist,
  excluirChecklist,
  listarChecklists,
} from '../../services/checklistService';
import type {
  Checklist,
  ChecklistColumn,
  ChecklistPayload,
  ChecklistQuinzena,
  ChecklistRow,
  ChecklistTipo,
} from '../../types/checklist';
import { formatarDataBR } from '../../utils/datas';
import { equipesNoDia } from '../../utils/equipes';

type ChecklistDraft = Omit<Checklist, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'status'>;
type ChecklistPrintData = ChecklistDraft & {
  id?: string;
  createdBy?: string;
  updatedAt?: string;
  identificacaoLabel?: string;
  identificacaoValor?: string;
  printLayout?: ChecklistTotalPrintLayout;
  printPages?: Array<{ rows: ChecklistTotalPrintRow[] }>;
};
type ChecklistTourStep = AnimatedTourStep & { formOpen?: boolean; adminOnly?: boolean };

const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Ferista'];
const CHECKLIST_TOTAL_MODEL_TEAM = 'MODELO FIXO';
const CHECKLIST_TOTAL_MODEL_RESPONSAVEL_PREFIX = 'MODELO:';
const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400 dark:scheme-dark';
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';
const iconButtonCls = 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-graphite-200 bg-white text-graphite-500 transition-all hover:border-graphite-300 hover:bg-graphite-50 hover:text-graphite-800 dark:border-border-dark dark:bg-surface-card dark:text-graphite-300 dark:hover:bg-surface-hover';
const PRINT_ROWS_PER_PAGE = 31;

const CHECKLISTS_TOUR_STEPS: ChecklistTourStep[] = [
  {
    target: 'checklists-titulo',
    title: 'Página de Checklists',
    body: 'Esta página organiza os checklists operacionais que podem ser impressos ou editados conforme a permissão do usuário.',
    detail: 'Ela serve tanto para usar o CHECK LIST TOTAL fixo quanto para criar checklists personalizados do dia a dia.',
  },
  {
    target: 'checklists-stats',
    title: 'Resumo dos registros',
    body: 'Os cards mostram quantos checklists existem no total e quantos são quinzenais ou personalizados.',
    detail: 'Esse resumo ajuda a perceber se o módulo está sendo usado mais para modelos fixos ou para checklists próprios.',
  },
  {
    target: 'checklists-total',
    title: 'CHECK LIST TOTAL',
    body: 'Este bloco gera o documento fixo do sistema para a 1ª ou 2ª quinzena do mês selecionado.',
    detail: 'Escolha mês e ano, depois clique na quinzena desejada para imprimir todos os checklists do modelo total em um único documento.',
  },
  {
    target: 'checklists-total-edicao',
    title: 'Edição do modelo fixo',
    body: 'Administradores podem escolher qual documento do CHECK LIST TOTAL será ajustado e abrir a edição do modelo.',
    detail: 'Essa edição altera a estrutura fixa usada na impressão, então deve ser feita com cuidado para não despadronizar o documento.',
    adminOnly: true,
  },
  {
    target: 'checklists-filtros',
    title: 'Pesquisa, filtros e novo checklist',
    body: 'Aqui você pesquisa por título, descrição, equipe, responsável ou período, além de filtrar por quinzenal ou personalizado.',
    detail: 'O botão Novo Checklist cria um modelo independente, útil para controles específicos que não fazem parte do CHECK LIST TOTAL.',
  },
  {
    target: 'checklists-lista',
    title: 'Lista de checklists',
    body: 'Cada linha mostra o título, tipo, período, quantidade de linhas e colunas, além das ações de imprimir, editar ou excluir quando permitido.',
    detail: 'Checklists personalizados normalmente podem ser editados pelo criador; modelos fixos ficam restritos ao administrador.',
  },
  {
    target: 'checklists-form-identificacao',
    title: 'Identificação do checklist',
    body: 'No formulário você define título, tipo, equipe responsável e quem responde pelo checklist.',
    detail: 'Essas informações aparecem na impressão e ajudam a rastrear quem criou ou atualizou o documento.',
    formOpen: true,
  },
  {
    target: 'checklists-form-periodo',
    title: 'Período e descrição',
    body: 'Mês, ano e quinzena determinam o período do documento. A descrição identifica melhor a finalidade do checklist.',
    detail: 'No modelo quinzenal, o período orienta a impressão por dias; no personalizado, ajuda a organizar o controle criado pela equipe.',
    formOpen: true,
  },
  {
    target: 'checklists-form-estrutura',
    title: 'Colunas e linhas',
    body: 'Em checklists personalizados você pode montar colunas de marcação ou texto e criar linhas por seção.',
    detail: 'As linhas viram itens de verificação. As colunas definem como cada item será marcado, preenchido ou conferido na impressão.',
    formOpen: true,
  },
  {
    target: 'checklists-form-tabela',
    title: 'Prévia da impressão',
    body: 'A tabela mostra como o checklist ficará na impressão, com seções, quantidades, itens e campos de preenchimento.',
    detail: 'Revise essa prévia antes de salvar para evitar itens duplicados, nomes cortados ou colunas desnecessárias.',
    formOpen: true,
  },
  {
    target: 'checklists-form-acoes',
    title: 'Salvar ou imprimir',
    body: 'No rodapé você cancela ou salva o checklist. O botão de impressão no topo do formulário permite conferir o documento antes do uso.',
    detail: 'Salvar grava o modelo no sistema; imprimir apenas gera a visualização para papel ou PDF do navegador.',
    formOpen: true,
  },
];
const PRINT_LAST_PAGE_ROWS = 22;
const PRINT_FOOTER_BLANK_ROWS = 5;

function uid(prefix: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

function diasDaQuinzena(mes: number, ano: number, quinzena: ChecklistQuinzena) {
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const inicio = quinzena === '1' ? 1 : 16;
  const fim = quinzena === '1' ? 15 : ultimoDia;
  return Array.from({ length: fim - inicio + 1 }, (_, index) => inicio + index);
}

function colunasDaQuinzena(mes: number, ano: number, quinzena: ChecklistQuinzena): ChecklistColumn[] {
  return diasDaQuinzena(mes, ano, quinzena).flatMap(dia => (
    equipesNoDia(new Date(ano, mes - 1, dia, 12, 0, 0, 0)).map(equipe => ({
      id: `dia-${dia}-${equipe.toLowerCase()}`,
      label: String(dia).padStart(2, '0'),
      type: 'check' as const,
      dia,
      equipe,
      fixa: true,
    }))
  ));
}

function valoresIniciais(colunas: ChecklistColumn[]) {
  return colunas.reduce<Record<string, string | boolean>>((acc, coluna) => {
    acc[coluna.id] = coluna.type === 'check' ? false : '';
    return acc;
  }, {});
}

function alinharValores(row: ChecklistRow, colunas: ChecklistColumn[]): ChecklistRow {
  const valores = valoresIniciais(colunas);
  colunas.forEach(coluna => {
    const atual = row.valores?.[coluna.id];
    if (atual !== undefined) valores[coluna.id] = atual;
  });
  return { ...row, valores };
}

function linhasDoModelo(colunas: ChecklistColumn[], rows: readonly ChecklistTotalRow[] = CHECKLIST_TOTAL_ROWS): ChecklistRow[] {
  return rows.map((linha, index) => ({
    id: `modelo-${index + 1}`,
    secao: linha.secao,
    quantidade: linha.quantidade,
    item: linha.item,
    valores: valoresIniciais(colunas),
  }));
}

function payloadQuinzenal(
  mes: number,
  ano: number,
  quinzena: ChecklistQuinzena,
  rows: readonly ChecklistTotalRow[] = CHECKLIST_TOTAL_ROWS,
): ChecklistPayload {
  const colunas = colunasDaQuinzena(mes, ano, quinzena);
  return {
    mes,
    ano,
    quinzena,
    colunas,
    linhas: linhasDoModelo(colunas, rows),
  };
}

function payloadPersonalizado(mes: number, ano: number): ChecklistPayload {
  const colunas: ChecklistColumn[] = [];
  return {
    mes,
    ano,
    quinzena: '1',
    colunas,
    linhas: [],
  };
}

function dataReferencia(mes: number, ano: number, quinzena: ChecklistQuinzena) {
  const dia = quinzena === '1' ? '01' : '16';
  return `${ano}-${String(mes).padStart(2, '0')}-${dia}`;
}

function novoDraft(tipo: ChecklistTipo = 'personalizado'): ChecklistDraft {
  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();
  const quinzena: ChecklistQuinzena = hoje.getDate() <= 15 ? '1' : '2';
  if (tipo === 'personalizado') {
    return {
      titulo: '',
      descricao: '',
      tipo,
      data: dataReferencia(mes, ano, quinzena),
      equipe: '',
      responsavel: '',
      payload: payloadPersonalizado(mes, ano),
    };
  }
  const template = CHECKLIST_TOTAL_TEMPLATES[0];
  const payload = payloadQuinzenal(mes, ano, quinzena, template.rows);
  return {
    titulo: template.titulo,
    descricao: template.identificacaoValor,
    tipo: 'quinzenal',
    data: dataReferencia(mes, ano, quinzena),
    equipe: '',
    responsavel: '',
    payload,
  };
}

function checklistTotalModelKey(documentoId: string) {
  return `${CHECKLIST_TOTAL_MODEL_RESPONSAVEL_PREFIX}${documentoId}`;
}

function isChecklistTotalModel(checklist: Checklist) {
  return checklist.equipe === CHECKLIST_TOTAL_MODEL_TEAM && checklist.responsavel.startsWith(CHECKLIST_TOTAL_MODEL_RESPONSAVEL_PREFIX);
}

function documentoParaLinhasEditaveis(documento: ChecklistTotalPrintDocument): ChecklistRow[] {
  const linhas: ChecklistRow[] = [];
  let secaoAtual = 'GERAL';
  documento.pages.forEach(page => {
    page.rows.forEach(row => {
      if (row.secao && !row.item) {
        secaoAtual = row.secao;
        return;
      }
      linhas.push({
        id: uid('linha'),
        secao: secaoAtual,
        quantidade: row.quantidade || row.exig || '',
        item: row.item || '',
        valores: {},
      });
    });
  });
  return linhas;
}

function documentoParaDraft(documento: ChecklistTotalPrintDocument, mes: number, ano: number, quinzena: ChecklistQuinzena, modelo?: Checklist): ChecklistDraft {
  if (modelo) {
    const colunas = colunasDaQuinzena(mes, ano, quinzena);
    return {
      titulo: modelo.titulo,
      descricao: modelo.descricao,
      tipo: modelo.tipo,
      data: dataReferencia(mes, ano, quinzena),
      equipe: modelo.equipe,
      responsavel: modelo.responsavel,
      payload: {
        ...modelo.payload,
        mes,
        ano,
        quinzena,
        colunas,
        linhas: modelo.payload.linhas
          .filter(linha => linha.item.trim() || linha.quantidade.trim())
          .map(linha => alinharValores(linha, colunas)),
      },
    };
  }
  const colunas = colunasDaQuinzena(mes, ano, quinzena);
  return {
    titulo: documento.titulo,
    descricao: documento.identificacaoValor,
    tipo: 'quinzenal',
    data: dataReferencia(mes, ano, quinzena),
    equipe: CHECKLIST_TOTAL_MODEL_TEAM,
    responsavel: checklistTotalModelKey(documento.id),
    payload: {
      mes,
      ano,
      quinzena,
      colunas,
      linhas: documentoParaLinhasEditaveis(documento).map(linha => alinharValores(linha, colunas)),
    },
  };
}

function documentoOriginalParaImpressao(
  documento: ChecklistTotalPrintDocument,
  mes: number,
  ano: number,
  quinzena: ChecklistQuinzena,
  modelo?: Checklist,
): ChecklistPrintData {
  if (modelo) {
    const colunas = colunasDaQuinzena(mes, ano, quinzena);
    return {
      titulo: modelo.titulo,
      descricao: modelo.descricao,
      tipo: modelo.tipo,
      data: dataReferencia(mes, ano, quinzena),
      equipe: '',
      responsavel: '',
      payload: {
        ...modelo.payload,
        mes,
        ano,
        quinzena,
        colunas,
        linhas: modelo.payload.linhas
          .filter(linha => linha.item.trim() || linha.quantidade.trim())
          .map(linha => alinharValores(linha, colunas)),
      },
      identificacaoLabel: documento.identificacaoLabel,
      identificacaoValor: modelo.descricao || documento.identificacaoValor,
      printLayout: documento.layout,
    };
  }
  return {
    titulo: documento.titulo,
    descricao: documento.identificacaoValor,
    tipo: 'quinzenal',
    data: dataReferencia(mes, ano, quinzena),
    equipe: '',
    responsavel: '',
    payload: payloadQuinzenal(mes, ano, quinzena, []),
    identificacaoLabel: documento.identificacaoLabel,
    identificacaoValor: documento.identificacaoValor,
    printLayout: documento.layout,
    printPages: documento.pages,
  };
}

function dividirLinhas(linhas: ChecklistRow[]) {
  const paginas: ChecklistRow[][] = [];
  let index = 0;
  let restantes = linhas.length;
  while (restantes > PRINT_LAST_PAGE_ROWS) {
    const tamanhoPagina = Math.min(PRINT_ROWS_PER_PAGE, restantes - PRINT_LAST_PAGE_ROWS);
    paginas.push(linhas.slice(index, index + tamanhoPagina));
    index += tamanhoPagina;
    restantes -= tamanhoPagina;
  }
  paginas.push(linhas.slice(index));
  return paginas;
}

function linhasParaImpressao(linhas: ChecklistRow[]): ChecklistTotalPrintRow[] {
  const result: ChecklistTotalPrintRow[] = [];
  let secaoAtual = '';
  linhas.forEach(linha => {
    if (linha.secao && linha.secao !== secaoAtual) {
      result.push({ secao: linha.secao });
      secaoAtual = linha.secao;
    }
    if (!linha.quantidade.trim() && !linha.item.trim()) return;
    result.push({ quantidade: linha.quantidade, item: linha.item });
  });
  return result;
}

function dividirLinhasImpressao(checklist: ChecklistPrintData) {
  if (checklist.printPages?.length) return checklist.printPages;
  return dividirLinhas(checklist.payload.linhas).map(rows => ({ rows: linhasParaImpressao(rows) }));
}

function mesAnoLabel(payload: ChecklistPayload) {
  return `${MESES[payload.mes - 1] || payload.mes}/${payload.ano}`;
}

function colunaEditorLabel(coluna: ChecklistColumn) {
  if (coluna.fixa && coluna.equipe) return `${coluna.label} ${coluna.equipe}`;
  return coluna.label;
}

function totalDiasDoPayload(payload: ChecklistPayload) {
  const dias = payload.colunas
    .filter(coluna => coluna.fixa && coluna.dia)
    .map(coluna => coluna.dia);
  if (dias.length) return new Set(dias).size;
  return payload.colunas.length;
}

function agruparColunasPorDia(colunas: ChecklistColumn[]) {
  return colunas.reduce<Array<{ dia?: number; label: string; colunas: ChecklistColumn[] }>>((acc, coluna) => {
    const last = acc.at(-1);
    if (last && last.dia === coluna.dia && coluna.dia !== undefined) {
      last.colunas.push(coluna);
      return acc;
    }
    acc.push({ dia: coluna.dia, label: coluna.label, colunas: [coluna] });
    return acc;
  }, []);
}

function substituirColunas(payload: ChecklistPayload, colunas: ChecklistColumn[]): ChecklistPayload {
  return {
    ...payload,
    colunas,
    linhas: payload.linhas.map(linha => alinharValores(linha, colunas)),
  };
}

function ChecklistPrintLayout({ checklists }: { checklists: ChecklistPrintData[] }) {
  if (checklists.length === 0) return null;

  return (
    <div className="checklist-print-root">
      {checklists.map((checklist, checklistIndex) => {
        const paginas = dividirLinhasImpressao(checklist);
        const colunas = checklist.payload.colunas;
        const gruposColunas = agruparColunasPorDia(colunas);
        const layout = checklist.printLayout || 'padrao';
        const fixedColumns = layout === 'equipamentos' ? 3 : 2;
        const totalColumns = fixedColumns + colunas.length;
        const showLegendFooter = totalColumns >= 14;
        const footerLegendColumns = showLegendFooter ? 12 : 0;
        const footerTextColumns = showLegendFooter ? totalColumns - footerLegendColumns : totalColumns;
        const quantityHeader = checklist.identificacaoValor?.includes('EQUIPAMENTOS') ? 'Quant.' : 'Item';
        return paginas.map((pagina, pageIndex) => {
          const isLastPage = pageIndex === paginas.length - 1;
          const footerBlankRows = isLastPage ? PRINT_FOOTER_BLANK_ROWS : 0;
          return (
            <section key={`${checklistIndex}-${pageIndex}`} className="checklist-print-page">
              <header className="checklist-print-header">
                <div className="checklist-print-logo">
                  <img src="/assets/med-group-logo.png" alt="med+ Group" />
                </div>
                <div className="checklist-print-title">
                  <div className="checklist-print-org">FORMULÁRIO (FOR)</div>
                  <h1>{checklist.titulo || 'CHECKLIST DIÁRIO'}</h1>
                </div>
                <div className="checklist-print-code">
                  <div className="code-label">Código:</div>
                  <div className="code-value">MMS.BR.BA.FOR.010</div>
                  <div className="code-grid">
                    <span>Revisão:</span>
                    <span>Página:</span>
                    <strong>0</strong>
                    <strong>{pageIndex + 1} de {paginas.length}</strong>
                  </div>
                </div>
              </header>

              <div className="checklist-print-identification">
                <div className="id-label">IDENTIFICAÇÃO DO AEROPORTO:</div>
                <div className="id-label">{checklist.identificacaoLabel || 'IDENTIFICAÇÃO'}:</div>
                <div className="id-label">TAG:</div>
                <div className="id-label">MÊS / ANO:</div>
                <div>AEROPORTO INTERNACIONAL MINISTRO VICTOR KONDER - SBNF</div>
                <div>{checklist.identificacaoValor || checklist.descricao || '________________'}</div>
                <div>&nbsp;</div>
                <div>{MESES[checklist.payload.mes - 1]?.toLowerCase()}/{String(checklist.payload.ano).slice(-2)}</div>
              </div>

              <table className="checklist-print-table">
                <thead>
                  <tr>
                    {layout === 'equipamentos' ? (
                      <>
                        <th className="print-exig">Exig</th>
                        <th className="print-disp">Disp</th>
                        <th className="print-item print-item-equipment">Item a inspecionar</th>
                      </>
                    ) : (
                      <>
                        <th className="print-qtd">{quantityHeader}</th>
                        <th className="print-item">Item a inspecionar</th>
                      </>
                    )}
                    {gruposColunas.map(grupo => (
                      <th key={`${grupo.label}-${grupo.colunas.map(coluna => coluna.id).join('-')}`} className="print-day-group" colSpan={grupo.colunas.length}>
                        {grupo.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagina.rows.map((linha, index) => {
                    const key = `${pageIndex}-${index}-${linha.secao || linha.item || ''}`;
                    const isSection = !!linha.secao && !linha.item;
                    if (isSection) {
                      return (
                        <tr key={key}>
                          <td className="print-section" colSpan={totalColumns}>{linha.secao}</td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={key}>
                        {layout === 'equipamentos' ? (
                          <>
                            <td className="print-exig">{linha.exig || linha.quantidade}</td>
                            <td className="print-disp">{linha.disp}</td>
                          </>
                        ) : (
                          <td className="print-qtd">{linha.quantidade}</td>
                        )}
                          <td className="print-item">{linha.item}</td>
                          {colunas.map(coluna => (
                            <td key={coluna.id} className="print-day">&nbsp;</td>
                          ))}
                      </tr>
                    );
                  })}
                </tbody>
                {isLastPage && (
                  <tfoot>
                    <tr className="print-signature-row">
                      <td className="print-signature-label" colSpan={fixedColumns}>NOME E MATRÍCULA DO CONFERENTE</td>
                      {colunas.map(coluna => (
                        <td key={`assinatura-${coluna.id}`} className="print-signature-cell">&nbsp;</td>
                      ))}
                    </tr>
                    <tr className="print-alert-row">
                      <td className="print-alert-main" colSpan={footerTextColumns}>Em caso de encontrar alguma não conformidade ou falha no equipamento:</td>
                      {showLegendFooter && <td className="print-legend-title" colSpan={footerLegendColumns}>Legenda:</td>}
                    </tr>
                    <tr className="print-note-row">
                      <td className="print-note-main" colSpan={footerTextColumns}>
                        Favor anotar as anomalias/ falhas abaixo deste Check list com o máximo de detalhes (item / data / horário etc.) e no caso de vazamentos sempre que houver indicar o local.
                        {!showLegendFooter && ' Legenda: B - BOM | I - IRREGULAR | IN - INEXISTENTE.'}
                      </td>
                      {showLegendFooter && (
                        <>
                          <td className="print-legend-value" colSpan={4}>B - BOM</td>
                          <td className="print-legend-value" colSpan={4}>I - IRREGULAR</td>
                          <td className="print-legend-value" colSpan={4}>IN - INEXISTENTE</td>
                        </>
                      )}
                    </tr>
                    {Array.from({ length: footerBlankRows }, (_, index) => (
                      <tr key={`linha-extra-${index}`}>
                        <td className="print-footer-blank" colSpan={totalColumns}>&nbsp;</td>
                      </tr>
                    ))}
                  </tfoot>
                )}
              </table>
            </section>
          );
        });
      })}
    </div>
  );
}

function ChecklistForm({
  editando,
  initialDraft,
  saving,
  allowQuinzenal,
  onCancel,
  onSave,
  onPrint,
}: {
  editando: Checklist | null;
  initialDraft?: ChecklistDraft;
  saving: boolean;
  allowQuinzenal: boolean;
  onCancel: () => void;
  onSave: (draft: ChecklistDraft) => void;
  onPrint: (draft: ChecklistPrintData) => void;
}) {
  const [draft, setDraft] = useState<ChecklistDraft>(() => {
    if (initialDraft) return initialDraft;
    if (!editando) return novoDraft('personalizado');
    return {
      titulo: editando.titulo,
      descricao: editando.descricao,
      tipo: editando.tipo,
      data: editando.data,
      equipe: editando.equipe,
      responsavel: editando.responsavel,
      payload: editando.payload,
    };
  });
  const [novaColuna, setNovaColuna] = useState('');
  const [novoTipoColuna, setNovoTipoColuna] = useState<ChecklistColumn['type']>('check');

  const anos = useMemo(() => {
    const atual = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, index) => atual - 2 + index);
  }, []);
  const equipesDisponiveis = useMemo(() => {
    if (draft.equipe && !EQUIPES.includes(draft.equipe)) return [draft.equipe, ...EQUIPES];
    return EQUIPES;
  }, [draft.equipe]);
  const isModeloQuinzenal = draft.tipo === 'quinzenal';
  const editorColunas = isModeloQuinzenal ? [] : draft.payload.colunas;

  function setCampo<K extends keyof ChecklistDraft>(campo: K, valor: ChecklistDraft[K]) {
    setDraft(prev => ({ ...prev, [campo]: valor }));
  }

  function alterarPeriodo(mes: number, ano: number, quinzena: ChecklistQuinzena) {
    setDraft(prev => {
      const colunasFixas = prev.tipo === 'quinzenal' ? colunasDaQuinzena(mes, ano, quinzena) : [];
      const colunasCustom = prev.payload.colunas.filter(coluna => !coluna.fixa);
      const colunas = prev.tipo === 'quinzenal' ? [...colunasFixas, ...colunasCustom] : prev.payload.colunas;
      const payload = substituirColunas({ ...prev.payload, mes, ano, quinzena }, colunas);
      return {
        ...prev,
        data: prev.tipo === 'quinzenal' ? dataReferencia(mes, ano, quinzena) : prev.data,
        payload,
      };
    });
  }

  function alterarTipo(tipo: ChecklistTipo) {
    if (tipo === 'quinzenal' && !allowQuinzenal) return;
    setDraft(prev => {
      if (tipo === prev.tipo) return prev;
      const { mes, ano, quinzena } = prev.payload;
      if (tipo === 'quinzenal') {
        const template = CHECKLIST_TOTAL_TEMPLATES[0];
        return {
          ...prev,
          tipo,
          titulo: template.titulo,
          descricao: template.identificacaoValor,
          data: dataReferencia(mes, ano, quinzena),
          payload: payloadQuinzenal(mes, ano, quinzena, template.rows),
        };
      }
      return {
        ...prev,
        tipo,
        titulo: tipo === 'personalizado' ? prev.titulo : prev.titulo.trim() ? prev.titulo : 'Checklist Personalizado',
        payload: payloadPersonalizado(mes, ano),
      };
    });
  }

  function aplicarTemplate(templateId: string) {
    const template = CHECKLIST_TOTAL_TEMPLATES.find(item => item.id === templateId);
    if (!template) return;
    setDraft(prev => ({
      ...prev,
      tipo: 'quinzenal',
      titulo: template.titulo,
      descricao: template.identificacaoValor,
      data: dataReferencia(prev.payload.mes, prev.payload.ano, prev.payload.quinzena),
      payload: payloadQuinzenal(prev.payload.mes, prev.payload.ano, prev.payload.quinzena, template.rows),
    }));
  }

  function restaurarModelo() {
    setDraft(prev => ({
      ...prev,
      payload: payloadQuinzenal(
        prev.payload.mes,
        prev.payload.ano,
        prev.payload.quinzena,
        (CHECKLIST_TOTAL_TEMPLATES.find(item => item.titulo === prev.titulo && item.identificacaoValor === prev.descricao) || CHECKLIST_TOTAL_TEMPLATES[0]).rows,
      ),
    }));
  }

  function adicionarColuna() {
    const label = novaColuna.trim();
    if (!label) return;
    setDraft(prev => {
      const coluna: ChecklistColumn = { id: uid('col'), label, type: novoTipoColuna };
      return { ...prev, payload: substituirColunas(prev.payload, [...prev.payload.colunas, coluna]) };
    });
    setNovaColuna('');
  }

  function removerColuna(id: string) {
    setDraft(prev => {
      const coluna = prev.payload.colunas.find(item => item.id === id);
      if (coluna?.fixa) return prev;
      return { ...prev, payload: substituirColunas(prev.payload, prev.payload.colunas.filter(item => item.id !== id)) };
    });
  }

  function atualizarColuna(id: string, patch: Partial<ChecklistColumn>) {
    setDraft(prev => {
      const colunas = prev.payload.colunas.map(coluna => (
        coluna.id === id && !coluna.fixa ? { ...coluna, ...patch } : coluna
      ));
      return { ...prev, payload: substituirColunas(prev.payload, colunas) };
    });
  }

  function adicionarLinha() {
    setDraft(prev => ({
      ...prev,
      payload: {
        ...prev.payload,
        linhas: [
          ...prev.payload.linhas,
          {
            id: uid('linha'),
            secao: prev.payload.linhas.at(-1)?.secao || 'GERAL',
            quantidade: '',
            item: '',
            valores: valoresIniciais(prev.payload.colunas),
          },
        ],
      },
    }));
  }

  function adicionarSecao() {
    setDraft(prev => ({
      ...prev,
      payload: {
        ...prev.payload,
        linhas: [
          ...prev.payload.linhas,
          {
            id: uid('secao'),
            secao: 'NOVA SEÇÃO',
            quantidade: '',
            item: '',
            valores: valoresIniciais(prev.payload.colunas),
          },
        ],
      },
    }));
  }

  function removerLinha(id: string) {
    setDraft(prev => ({
      ...prev,
      payload: {
        ...prev.payload,
        linhas: prev.payload.linhas.filter(linha => linha.id !== id),
      },
    }));
  }

  function atualizarLinha(id: string, patch: Partial<ChecklistRow>) {
    setDraft(prev => ({
      ...prev,
      payload: {
        ...prev.payload,
        linhas: prev.payload.linhas.map(linha => (linha.id === id ? { ...linha, ...patch } : linha)),
      },
    }));
  }

  function salvar() {
    if (!draft.titulo.trim() || !draft.equipe.trim() || !draft.responsavel.trim()) return;
    if (draft.tipo === 'quinzenal' && !allowQuinzenal) return;
    onSave({
      ...draft,
      titulo: draft.titulo.trim(),
      equipe: draft.equipe.trim(),
      responsavel: draft.responsavel.trim(),
      descricao: draft.descricao.trim(),
      payload: {
        ...draft.payload,
        linhas: draft.payload.linhas
          .filter(linha => linha.item.trim() || linha.secao.trim() || linha.quantidade.trim())
          .map(linha => ({
            ...linha,
            secao: linha.secao.trim() || 'GERAL',
            quantidade: linha.quantidade.trim(),
            item: linha.item.trim(),
          })),
      },
    });
  }

  function imprimirDraft() {
    const template = CHECKLIST_TOTAL_TEMPLATES.find(item => item.titulo === draft.titulo && item.identificacaoValor === draft.descricao);
    onPrint({
      ...draft,
      identificacaoLabel: template?.identificacaoLabel || 'IDENTIFICAÇÃO',
      identificacaoValor: template?.identificacaoValor || draft.descricao,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 p-3 md:p-6">
      <div className="w-full max-w-[1500px] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-surface-elevated" data-checklists-tour="checklists-form">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-graphite-200 px-5 py-4 dark:border-border-dark">
          <div>
            <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">
              {editando ? 'Editar Checklist' : 'Novo Checklist'}
            </h2>
            <p className="text-xs text-graphite-500 dark:text-graphite-400">
              Modelo para impressão · {draft.payload.linhas.length} linhas · {draft.payload.colunas.length} colunas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={imprimirDraft} className={iconButtonCls} title="Imprimir">
              <Printer className="h-4 w-4" />
            </button>
            <button onClick={onCancel} className={iconButtonCls} title="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr]" data-checklists-tour="checklists-form-identificacao">
            <div>
              <label className={labelCls}>Título *</label>
              <input value={draft.titulo} onChange={e => setCampo('titulo', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Tipo</label>
              {allowQuinzenal ? (
                <div className="grid grid-cols-2 rounded-xl border border-graphite-200 bg-graphite-50 p-1 dark:border-border-dark dark:bg-surface-card">
                  {(['quinzenal', 'personalizado'] as ChecklistTipo[]).map(tipo => (
                    <button
                      key={tipo}
                      onClick={() => alterarTipo(tipo)}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition-all ${draft.tipo === tipo ? 'bg-aviation-700 text-white shadow-sm' : 'text-graphite-600 hover:bg-white dark:text-graphite-300 dark:hover:bg-surface-hover'}`}
                    >
                      {tipo === 'quinzenal' ? 'Quinzenal' : 'Personalizado'}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-graphite-200 bg-graphite-50 px-3 py-2.5 text-sm font-semibold text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
                  Personalizado
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Equipe *</label>
              <select value={draft.equipe} onChange={e => setCampo('equipe', e.target.value)} className={inputCls}>
                <option value="">Selecionar equipe</option>
                {equipesDisponiveis.map(equipe => <option key={equipe} value={equipe}>{equipe}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Responsável *</label>
              <input value={draft.responsavel} onChange={e => setCampo('responsavel', e.target.value)} className={inputCls} />
            </div>
          </div>

          {draft.tipo === 'quinzenal' && allowQuinzenal && (
            <div>
              <label className={labelCls}>Modelo base</label>
              <select
                value={CHECKLIST_TOTAL_TEMPLATES.find(template => template.titulo === draft.titulo && template.identificacaoValor === draft.descricao)?.id || ''}
                onChange={e => aplicarTemplate(e.target.value)}
                className={inputCls}
              >
                <option value="">Modelo editado manualmente</option>
                {CHECKLIST_TOTAL_TEMPLATES.map(template => (
                  <option key={template.id} value={template.id}>{template.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.8fr_0.7fr_0.8fr_1.2fr]" data-checklists-tour="checklists-form-periodo">
            <div>
              <label className={labelCls}>Mês</label>
              <select
                value={draft.payload.mes}
                onChange={e => alterarPeriodo(Number(e.target.value), draft.payload.ano, draft.payload.quinzena)}
                className={inputCls}
              >
                {MESES.map((mes, index) => <option key={mes} value={index + 1}>{mes}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Ano</label>
              <select
                value={draft.payload.ano}
                onChange={e => alterarPeriodo(draft.payload.mes, Number(e.target.value), draft.payload.quinzena)}
                className={inputCls}
              >
                {anos.map(ano => <option key={ano} value={ano}>{ano}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Quinzena</label>
              <select
                value={draft.payload.quinzena}
                onChange={e => alterarPeriodo(draft.payload.mes, draft.payload.ano, e.target.value as ChecklistQuinzena)}
                className={inputCls}
              >
                <option value="1">1ª quinzena</option>
                <option value="2">2ª quinzena</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Descrição</label>
              <input value={draft.descricao} onChange={e => setCampo('descricao', e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className={`grid grid-cols-1 gap-4 ${isModeloQuinzenal ? '' : 'xl:grid-cols-[1fr_1fr]'}`} data-checklists-tour="checklists-form-estrutura">
            {!isModeloQuinzenal && (
              <div className="rounded-2xl border border-graphite-200 bg-white p-4 dark:border-border-dark dark:bg-surface-card">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-100">
                    <Columns3 className="h-4 w-4 text-aviation-500" />
                    Colunas
                  </div>
                </div>
                <div className="mb-3 grid grid-cols-[1fr_130px_auto] gap-2">
                  <input value={novaColuna} onChange={e => setNovaColuna(e.target.value)} placeholder="Nova coluna" className={inputCls} />
                  <select value={novoTipoColuna} onChange={e => setNovoTipoColuna(e.target.value as ChecklistColumn['type'])} className={inputCls}>
                    <option value="check">Marcação</option>
                    <option value="texto">Texto</option>
                  </select>
                  <button onClick={adicionarColuna} className={iconButtonCls} title="Adicionar coluna">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto pr-1">
                  {draft.payload.colunas.map(coluna => (
                    <div key={coluna.id} className="flex items-center gap-1 rounded-xl border border-graphite-200 bg-graphite-50 px-2 py-1 dark:border-border-dark dark:bg-surface-hover">
                      <input
                        value={coluna.label}
                        onChange={e => atualizarColuna(coluna.id, { label: e.target.value })}
                        className="w-24 bg-transparent text-xs font-semibold text-graphite-700 outline-none dark:text-graphite-200"
                      />
                      <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase text-graphite-400 dark:bg-surface-card">
                        {coluna.type === 'check' ? 'OK' : 'TXT'}
                      </span>
                      <button onClick={() => removerColuna(coluna.id)} className="text-red-500 hover:text-red-700" title="Remover coluna">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-graphite-200 bg-white p-4 dark:border-border-dark dark:bg-surface-card">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-graphite-900 dark:text-graphite-100">
                  <Rows3 className="h-4 w-4 text-aviation-500" />
                  Linhas
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isModeloQuinzenal && allowQuinzenal && (
                    <button onClick={restaurarModelo} className="inline-flex items-center gap-2 rounded-xl border border-aviation-200 px-3 py-2 text-xs font-semibold text-aviation-700 hover:bg-aviation-50 dark:border-aviation-800 dark:text-aviation-300 dark:hover:bg-aviation-900/20">
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Recarregar modelo
                    </button>
                  )}
                  <button onClick={adicionarSecao} className="inline-flex items-center gap-2 rounded-xl border border-aviation-200 px-3 py-2 text-xs font-semibold text-aviation-700 hover:bg-aviation-50 dark:border-aviation-800 dark:text-aviation-300 dark:hover:bg-aviation-900/20">
                    <Plus className="h-3.5 w-3.5" />
                    Seção
                  </button>
                  <button onClick={adicionarLinha} className="inline-flex items-center gap-2 rounded-xl bg-aviation-700 px-3 py-2 text-xs font-semibold text-white hover:bg-aviation-800">
                    <Plus className="h-3.5 w-3.5" />
                    Linha
                  </button>
                </div>
              </div>
              <div className={`grid gap-2 text-center ${isModeloQuinzenal ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <div className="rounded-xl bg-graphite-50 p-3 dark:bg-surface-hover">
                  <p className="text-xl font-black text-graphite-900 dark:text-graphite-100">{draft.payload.linhas.length}</p>
                  <p className="text-[10px] font-bold uppercase text-graphite-400">Itens</p>
                </div>
                {!isModeloQuinzenal && (
                  <div className="rounded-xl bg-aviation-50 p-3 dark:bg-aviation-900/20">
                    <p className="text-xl font-black text-aviation-700 dark:text-aviation-300">{draft.payload.colunas.length}</p>
                    <p className="text-[10px] font-bold uppercase text-aviation-500">Colunas</p>
                  </div>
                )}
                <div className="rounded-xl bg-green-50 p-3 dark:bg-green-900/20">
                  <p className="text-xl font-black text-green-700 dark:text-green-300">{totalDiasDoPayload(draft.payload)}</p>
                  <p className="text-[10px] font-bold uppercase text-green-500">Dias</p>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-card" data-checklists-tour="checklists-form-tabela">
            <div className="flex items-center justify-between gap-3 border-b border-graphite-200 px-4 py-3 dark:border-border-dark">
              <div>
                <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{mesAnoLabel(draft.payload)} · {draft.payload.quinzena}ª quinzena</p>
                <p className="text-xs text-graphite-500 dark:text-graphite-400">{draft.tipo === 'quinzenal' ? 'Modelo CHECK LIST TOTAL' : 'Modelo personalizado'}</p>
              </div>
              <span className="rounded-full bg-graphite-100 px-3 py-1 text-[11px] font-bold uppercase text-graphite-500 dark:bg-surface-hover dark:text-graphite-300">Impressão</span>
            </div>

            <div className="max-h-[58vh] overflow-auto">
              <table className="min-w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-graphite-100 text-[10px] uppercase tracking-wider text-graphite-500 dark:bg-surface-elevated dark:text-graphite-400">
                  <tr>
                    <th className="sticky left-0 z-20 w-28 border-b border-r border-graphite-200 bg-graphite-100 px-3 py-2 dark:border-border-dark dark:bg-surface-elevated">Qtd.</th>
                    <th className="sticky left-28 z-20 min-w-[280px] border-b border-r border-graphite-200 bg-graphite-100 px-3 py-2 dark:border-border-dark dark:bg-surface-elevated">Item</th>
                    {editorColunas.map(coluna => (
                      <th key={coluna.id} className="min-w-16 border-b border-r border-graphite-200 px-2 py-2 text-center dark:border-border-dark">
                        <span className="block">{colunaEditorLabel(coluna)}</span>
                      </th>
                    ))}
                    <th className="w-14 border-b border-graphite-200 px-2 py-2 text-center dark:border-border-dark">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.payload.linhas
                    .filter(linha => linha.item.trim() || linha.quantidade.trim())
                    .map((linha, index, linhasVisiveis) => {
                    const secaoAnterior = linhasVisiveis[index - 1]?.secao;
                    const mostrarSecao = index === 0 || secaoAnterior !== linha.secao;
                    return (
                      <Fragment key={linha.id}>
                        {mostrarSecao && (
                          <tr>
                            <td colSpan={editorColunas.length + 3} className="bg-aviation-900 px-3 py-2 text-xs font-black uppercase tracking-wide text-white">
                              {linha.secao || 'GERAL'}
                            </td>
                          </tr>
                        )}
                        <tr className="border-b border-graphite-100 hover:bg-graphite-50 dark:border-border-dark dark:hover:bg-surface-hover">
                          <td className="sticky left-0 z-10 border-r border-graphite-100 bg-white px-2 py-1.5 dark:border-border-dark dark:bg-surface-card">
                            <input
                              value={linha.quantidade}
                              onChange={e => atualizarLinha(linha.id, { quantidade: e.target.value })}
                              className="w-20 rounded-lg border border-graphite-200 bg-white px-2 py-1 text-xs font-semibold text-graphite-900 outline-none focus:border-aviation-500 dark:border-border-dark dark:bg-surface-elevated dark:text-graphite-100"
                            />
                          </td>
                          <td className="sticky left-28 z-10 min-w-[280px] border-r border-graphite-100 bg-white px-2 py-1.5 dark:border-border-dark dark:bg-surface-card">
                            <div className="grid grid-cols-[100px_1fr] gap-2">
                              <input
                                value={linha.secao}
                                onChange={e => atualizarLinha(linha.id, { secao: e.target.value })}
                                className="rounded-lg border border-graphite-200 bg-white px-2 py-1 text-[11px] font-semibold text-aviation-700 outline-none focus:border-aviation-500 dark:border-border-dark dark:bg-surface-elevated dark:text-aviation-300"
                              />
                              <input
                                value={linha.item}
                                onChange={e => atualizarLinha(linha.id, { item: e.target.value })}
                                className="rounded-lg border border-graphite-200 bg-white px-2 py-1 text-xs text-graphite-900 outline-none focus:border-aviation-500 dark:border-border-dark dark:bg-surface-elevated dark:text-graphite-100"
                              />
                            </div>
                          </td>
                          {editorColunas.map(coluna => (
                            <td key={coluna.id} className="border-r border-graphite-100 px-2 py-1.5 text-center dark:border-border-dark">
                              {coluna.type === 'check' ? (
                                <span className="inline-flex h-4 w-4 rounded border border-graphite-300 bg-white dark:border-graphite-500 dark:bg-surface-elevated" />
                              ) : (
                                <span className="inline-flex h-6 w-32 rounded-lg border border-graphite-200 bg-white dark:border-border-dark dark:bg-surface-elevated" />
                              )}
                            </td>
                          ))}
                          <td className="px-2 py-1.5 text-center">
                            <button onClick={() => removerLinha(linha.id)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" title="Remover linha">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-3 border-t border-graphite-200 pt-4 dark:border-border-dark" data-checklists-tour="checklists-form-acoes">
            <button onClick={onCancel} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover">
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={saving || !draft.titulo.trim() || !draft.equipe.trim() || !draft.responsavel.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Checklists() {
  const { contexto, user } = useContextoOperacional();
  const tutorialOrigemRef = useRef<{ formOpen: boolean; editando: Checklist | null; editingTotalDocument: ChecklistTotalPrintDocument | null; initialDraft: ChecklistDraft | undefined; scrollY: number } | null>(null);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<Checklist | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Checklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const hoje = useMemo(() => new Date(), []);
  const [printMes, setPrintMes] = useState(hoje.getMonth() + 1);
  const [printAno, setPrintAno] = useState(hoje.getFullYear());
  const [printChecklists, setPrintChecklists] = useState<ChecklistPrintData[]>([]);
  const [imprimindoQuinzena, setImprimindoQuinzena] = useState<ChecklistQuinzena | null>(null);
  const [selectedTotalDocumentId, setSelectedTotalDocumentId] = useState(CHECKLIST_TOTAL_PRINT_DOCUMENTS[0]?.id || '');
  const [editingTotalDocument, setEditingTotalDocument] = useState<ChecklistTotalPrintDocument | null>(null);
  const [initialDraft, setInitialDraft] = useState<ChecklistDraft | undefined>(undefined);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);

  async function carregar() {
    setLoading(true);
    setError('');
    try {
      setChecklists(await listarChecklists());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar checklists.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  useEffect(() => {
    if (printChecklists.length === 0) return;
    document.body.classList.add('printing-checklist');

    const handleAfterPrint = () => {
      document.body.classList.remove('printing-checklist');
      setPrintChecklists([]);
      setImprimindoQuinzena(null);
    };

    window.addEventListener('afterprint', handleAfterPrint);
    const timer = window.setTimeout(() => window.print(), 80);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-checklist');
    };
  }, [printChecklists]);

  const checklistTotalModels = useMemo(() => checklists.filter(isChecklistTotalModel), [checklists]);

  function getChecklistTotalModel(documentoId: string) {
    const key = checklistTotalModelKey(documentoId);
    return checklistTotalModels.find(checklist => checklist.responsavel === key);
  }

  const filtered = useMemo(() => {
    let lista = checklists.filter(checklist => !isChecklistTotalModel(checklist));
    if (filterTipo) lista = lista.filter(c => c.tipo === filterTipo);
    if (search.trim()) {
      const termo = search.trim().toLowerCase();
      lista = lista.filter(c => [
        c.titulo,
        c.descricao,
        c.equipe,
        c.responsavel,
        mesAnoLabel(c.payload),
      ].some(value => value.toLowerCase().includes(termo)));
    }
    return lista;
  }, [checklists, filterTipo, search]);

  const stats = useMemo(() => ({
    total: checklists.filter(c => !isChecklistTotalModel(c)).length,
    quinzenais: checklists.filter(c => !isChecklistTotalModel(c) && c.tipo === 'quinzenal').length,
    personalizados: checklists.filter(c => !isChecklistTotalModel(c) && c.tipo === 'personalizado').length,
  }), [checklists]);

  const canManageFixedChecklists = contexto.isAdministradorSistema;
  const currentUsername = user?.username || user?.name || '';
  const checklistTourSteps = CHECKLISTS_TOUR_STEPS.filter(step => !step.adminOnly || canManageFixedChecklists);
  const currentTutorialStep = checklistTourSteps[tutorialStepIndex] || checklistTourSteps[0];
  const tutorialPrecisaFormulario = !!currentTutorialStep?.formOpen;

  useEffect(() => {
    if (!showTutorial) return;
    if (tutorialStepIndex < checklistTourSteps.length) return;
    setTutorialStepIndex(Math.max(0, checklistTourSteps.length - 1));
  }, [checklistTourSteps.length, showTutorial, tutorialStepIndex]);

  useEffect(() => {
    if (!showTutorial) return;
    if (tutorialPrecisaFormulario) {
      if (!formOpen) {
        setEditando(null);
        setEditingTotalDocument(null);
        setInitialDraft(undefined);
        setFormOpen(true);
      }
      return;
    }
    if (formOpen) {
      setFormOpen(false);
      setEditando(null);
      setEditingTotalDocument(null);
      setInitialDraft(undefined);
    }
  }, [formOpen, showTutorial, tutorialPrecisaFormulario]);

  function canEditChecklist(checklist: Checklist) {
    if (canManageFixedChecklists) return true;
    return checklist.tipo === 'personalizado' && checklist.createdBy === currentUsername;
  }

  function abrirTutorialChecklists() {
    tutorialOrigemRef.current = { formOpen, editando, editingTotalDocument, initialDraft, scrollY: window.scrollY };
    setConfirmDelete(null);
    setTutorialStepIndex(0);
    setShowTutorial(true);
  }

  function fecharTutorialChecklists() {
    const origem = tutorialOrigemRef.current;
    setShowTutorial(false);
    setTutorialStepIndex(0);
    if (origem) {
      setFormOpen(origem.formOpen);
      setEditando(origem.editando);
      setEditingTotalDocument(origem.editingTotalDocument);
      setInitialDraft(origem.initialDraft);
      window.setTimeout(() => window.scrollTo({ top: origem.scrollY, behavior: 'smooth' }), 50);
    }
    tutorialOrigemRef.current = null;
  }

  function voltarTutorialChecklists() {
    setTutorialStepIndex(index => Math.max(0, index - 1));
  }

  function avancarTutorialChecklists() {
    if (tutorialStepIndex >= checklistTourSteps.length - 1) {
      fecharTutorialChecklists();
      return;
    }
    setTutorialStepIndex(index => index + 1);
  }

  function abrirNovoChecklist() {
    setEditando(null);
    setEditingTotalDocument(null);
    setInitialDraft(undefined);
    setFormOpen(true);
  }

  function handlePrint(data: ChecklistPrintData) {
    const template = CHECKLIST_TOTAL_TEMPLATES.find(item => item.titulo === data.titulo && item.identificacaoValor === data.descricao);
    setPrintChecklists([{
      ...data,
      identificacaoLabel: data.identificacaoLabel || template?.identificacaoLabel || 'IDENTIFICAÇÃO',
      identificacaoValor: data.identificacaoValor || template?.identificacaoValor || data.descricao,
    }]);
  }

  function handleImprimirQuinzena(quinzena: ChecklistQuinzena) {
    setImprimindoQuinzena(quinzena);
    setError('');
    setPrintChecklists(CHECKLIST_TOTAL_PRINT_DOCUMENTS.map(documento => (
      documentoOriginalParaImpressao(documento, printMes, printAno, quinzena, getChecklistTotalModel(documento.id))
    )));
  }

  function handleEditarChecklistTotal() {
    if (!canManageFixedChecklists) return;
    const documento = CHECKLIST_TOTAL_PRINT_DOCUMENTS.find(item => item.id === selectedTotalDocumentId);
    if (!documento) return;
    const modelo = getChecklistTotalModel(documento.id);
    setEditingTotalDocument(documento);
    setEditando(modelo || null);
    setInitialDraft(documentoParaDraft(documento, printMes, printAno, '1', modelo));
    setFormOpen(true);
  }

  async function handleSave(draft: ChecklistDraft) {
    if (draft.tipo === 'quinzenal' && !canManageFixedChecklists) {
      setError('Apenas administradores e desenvolvedores podem alterar o modelo fixo.');
      return;
    }
    if (editando && !canEditChecklist(editando)) {
      setError('Você só pode alterar checklists personalizados criados por você.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        ...draft,
        ...(editingTotalDocument
          ? {
              titulo: editingTotalDocument.titulo,
              descricao: draft.descricao || editingTotalDocument.identificacaoValor,
              tipo: 'quinzenal' as const,
              equipe: CHECKLIST_TOTAL_MODEL_TEAM,
              responsavel: checklistTotalModelKey(editingTotalDocument.id),
            }
          : {}),
        status: 'pendente' as const,
        createdBy: editando?.createdBy || currentUsername,
      };
      const salvo = editando
        ? await atualizarChecklist(editando.id, payload)
        : await criarChecklist(payload);

      setChecklists(prev => {
        if (!editando) return [salvo, ...prev];
        return prev.map(item => (item.id === salvo.id ? salvo : item));
      });
      setFormOpen(false);
      setEditando(null);
      setEditingTotalDocument(null);
      setInitialDraft(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar checklist.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    if (!canEditChecklist(confirmDelete)) {
      setError(confirmDelete.tipo === 'quinzenal'
        ? 'Apenas administradores e desenvolvedores podem excluir o modelo fixo.'
        : 'Você só pode excluir checklists personalizados criados por você.');
      setConfirmDelete(null);
      return;
    }

    setSaving(true);
    setError('');
    try {
      await excluirChecklist(confirmDelete.id);
      setChecklists(prev => prev.filter(item => item.id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir checklist.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageContainer>
      <div data-checklists-tour="checklists-titulo">
        <PageTitle icon={ClipboardCheck} title="Checklists" />
      </div>

      <div className="mb-4 grid max-w-md grid-cols-3 gap-3" data-checklists-tour="checklists-stats">
        <div className="rounded-xl border border-graphite-200 bg-white p-3 text-center dark:border-border-dark dark:bg-surface-card">
          <p className="text-xl font-black text-graphite-900 dark:text-graphite-100">{stats.total}</p>
          <p className="text-[10px] font-bold uppercase text-graphite-500">Total</p>
        </div>
        <div className="rounded-xl border border-aviation-200 bg-aviation-50 p-3 text-center dark:border-aviation-800 dark:bg-aviation-900/20">
          <p className="text-xl font-black text-aviation-700 dark:text-aviation-300">{stats.quinzenais}</p>
          <p className="text-[10px] font-bold uppercase text-aviation-500">Quinzenais</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-center dark:border-purple-800 dark:bg-purple-900/20">
          <p className="text-xl font-black text-purple-700 dark:text-purple-300">{stats.personalizados}</p>
          <p className="text-[10px] font-bold uppercase text-purple-500">Personalizados</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-graphite-200 bg-white p-4 dark:border-border-dark dark:bg-surface-card" data-checklists-tour="checklists-total">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-graphite-900 dark:text-graphite-100">CHECK LIST TOTAL</h2>
            <p className="text-xs font-medium text-graphite-500 dark:text-graphite-400">Modelo fixo do sistema</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select value={printMes} onChange={e => setPrintMes(Number(e.target.value))} className={`${inputCls} w-auto min-w-36`}>
              {MESES.map((mes, index) => <option key={mes} value={index + 1}>{mes}</option>)}
            </select>
            <select value={printAno} onChange={e => setPrintAno(Number(e.target.value))} className={`${inputCls} w-auto min-w-28`}>
              {Array.from({ length: 7 }, (_, index) => hoje.getFullYear() - 2 + index).map(ano => <option key={ano} value={ano}>{ano}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {([
            ['1', 'CHECK LIST TOTAL - 1ª QUINZENA', 'Todos os checklists em um único documento'],
            ['2', 'CHECK LIST TOTAL - 2ª QUINZENA', 'Todos os checklists em um único documento'],
          ] as const).map(([quinzena, titulo, descricao]) => (
            <button
              key={quinzena}
              onClick={() => handleImprimirQuinzena(quinzena)}
              disabled={imprimindoQuinzena !== null}
              className="flex items-center justify-between rounded-xl border border-aviation-200 bg-aviation-50 px-4 py-3 text-left transition-all hover:border-aviation-300 hover:bg-aviation-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-aviation-800/60 dark:bg-aviation-900/20 dark:hover:bg-aviation-900/30"
            >
              <span>
                <span className="block text-sm font-bold text-graphite-900 dark:text-graphite-100">{titulo}</span>
                <span className="mt-0.5 block text-xs text-graphite-500 dark:text-graphite-400">{descricao}</span>
              </span>
              {imprimindoQuinzena === quinzena ? (
                <Loader2 className="h-5 w-5 animate-spin text-aviation-700 dark:text-aviation-300" />
              ) : (
                <Printer className="h-5 w-5 text-aviation-700 dark:text-aviation-300" />
              )}
            </button>
          ))}
        </div>
        {canManageFixedChecklists && (
          <div className="mt-4 rounded-xl border border-graphite-200 bg-graphite-50 p-3 dark:border-border-dark dark:bg-surface-hover/60" data-checklists-tour="checklists-total-edicao">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[260px] flex-1">
                <label className={labelCls}>Editar documento do CHECK LIST TOTAL</label>
                <select
                  value={selectedTotalDocumentId}
                  onChange={e => setSelectedTotalDocumentId(e.target.value)}
                  className={inputCls}
                >
                  {CHECKLIST_TOTAL_PRINT_DOCUMENTS.map(documento => (
                    <option key={documento.id} value={documento.id}>
                      {documento.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleEditarChecklistTotal}
                className="inline-flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-4 py-2.5 text-sm font-semibold text-aviation-700 transition-all hover:bg-aviation-50 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300"
              >
                <Pencil className="h-4 w-4" />
                Editar modelo
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3" data-checklists-tour="checklists-filtros">
        <div className="relative min-w-[240px] flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." className={`${inputCls} pl-10`} />
        </div>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className={`${inputCls} w-auto min-w-40`}>
          <option value="">Todos</option>
          <option value="quinzenal">Quinzenais</option>
          <option value="personalizado">Personalizados</option>
        </select>
        <button
          onClick={abrirNovoChecklist}
          data-checklists-tour="checklists-novo"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Novo Checklist
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-aviation-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card" data-checklists-tour="checklists-lista">
          <ClipboardCheck className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum checklist encontrado</h3>
          <p className="text-sm text-graphite-400 dark:text-graphite-500">Os registros criados aparecerão aqui.</p>
        </div>
      ) : (
        <div className="space-y-3" data-checklists-tour="checklists-lista">
          {filtered.map(checklist => {
            const canEdit = canEditChecklist(checklist);
            return (
              <div key={checklist.id} className="rounded-2xl border border-graphite-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aviation-600 to-aviation-800 text-white">
                    <ClipboardCheck className="h-5 w-5" />
                  </div>
                  <button
                    onClick={() => {
                      if (canEdit) {
                        setEditingTotalDocument(null);
                        setInitialDraft(undefined);
                        setEditando(checklist);
                        setFormOpen(true);
                      }
                    }}
                    className={`min-w-0 flex-1 text-left ${canEdit ? '' : 'cursor-default'}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{checklist.titulo}</p>
                      <span className="rounded-full bg-aviation-50 px-2 py-0.5 text-[10px] font-bold text-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">
                        {checklist.tipo === 'quinzenal' ? `${checklist.payload.quinzena}ª quinzena` : 'Personalizado'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">
                      {mesAnoLabel(checklist.payload)} · {checklist.payload.linhas.length} linhas · {checklist.payload.colunas.length} colunas · {formatarDataBR(checklist.updatedAt)}
                    </p>
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handlePrint(checklist)} className={iconButtonCls} title="Imprimir">
                      <Printer className="h-4 w-4" />
                    </button>
                    {canEdit && (
                      <>
                        <button onClick={() => {
                          setEditingTotalDocument(null);
                          setInitialDraft(undefined);
                          setEditando(checklist);
                          setFormOpen(true);
                        }} className={iconButtonCls} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => setConfirmDelete(checklist)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition-all hover:bg-red-100 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300" title="Excluir">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {formOpen && (
        <ChecklistForm
          editando={editando}
          initialDraft={initialDraft}
          saving={saving}
          allowQuinzenal={canManageFixedChecklists}
          onCancel={() => {
            setFormOpen(false);
            setEditando(null);
            setEditingTotalDocument(null);
            setInitialDraft(undefined);
          }}
          onSave={handleSave}
          onPrint={handlePrint}
        />
      )}

      <ChecklistPrintLayout checklists={printChecklists} />
      <style>{`
        .checklist-print-root {
          display: none;
        }

        @media print {
          @page {
            size: A4 landscape;
            margin: 15mm;
          }

          body.printing-checklist {
            background: #ffffff !important;
          }

          body.printing-checklist * {
            visibility: hidden !important;
          }

          body.printing-checklist .checklist-print-root,
          body.printing-checklist .checklist-print-root * {
            visibility: visible !important;
          }

          body.printing-checklist .checklist-print-root {
            display: block !important;
            position: absolute;
            inset: 0 auto auto 0;
            width: 100%;
            background: #ffffff !important;
            color: #111827 !important;
            font-family: Arial, Helvetica, sans-serif;
          }

          .checklist-print-page {
            break-after: page;
            page-break-after: always;
            min-height: 180mm;
            background: #ffffff;
          }

          .checklist-print-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          .checklist-print-header {
            display: grid;
            grid-template-columns: 14% 72% 14%;
            border: 1px solid #111827;
            border-bottom: 0;
            background: #ffffff;
          }

          .checklist-print-logo {
            display: flex;
            min-height: 16mm;
            align-items: center;
            justify-content: center;
            border-right: 1px solid #111827;
            padding: 0.8mm;
          }

          .checklist-print-logo img {
            display: block;
            width: 100%;
            height: 100%;
            max-height: 14.4mm;
            object-fit: contain;
          }

          .checklist-print-title {
            text-align: center;
          }

          .checklist-print-org {
            height: 4mm;
            border-bottom: 1px solid #111827;
            font-size: 6pt;
            font-weight: 700;
            letter-spacing: 0.04em;
            line-height: 4mm;
          }

          .checklist-print-header h1 {
            display: flex;
            min-height: 12mm;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 0 3mm;
            font-size: 12.6pt;
            font-weight: 800;
            text-transform: uppercase;
          }

          .checklist-print-code {
            display: grid;
            grid-template-rows: 4mm 5mm 7mm;
            border-left: 1px solid #111827;
            text-align: center;
            font-size: 6pt;
            font-weight: 800;
          }

          .code-label,
          .code-value {
            border-bottom: 1px solid #111827;
            line-height: 4mm;
          }

          .code-value {
            font-size: 7pt;
            line-height: 5mm;
          }

          .code-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 3.5mm 3.5mm;
          }

          .code-grid span,
          .code-grid strong {
            border-right: 1px solid #111827;
            line-height: 3.5mm;
          }

          .code-grid span:nth-child(2),
          .code-grid strong:nth-child(4) {
            border-right: 0;
          }

          .code-grid span {
            border-bottom: 1px solid #111827;
            font-size: 5.5pt;
          }

          .checklist-print-identification {
            display: grid;
            grid-template-columns: 45% 27% 14% 14%;
            border: 1px solid #111827;
            border-bottom: 0;
            font-size: 7.8pt;
            text-align: center;
          }

          .checklist-print-identification > div {
            min-height: 4mm;
            border-right: 1px solid #111827;
            border-bottom: 1px solid #111827;
            padding: 1mm 1.5mm;
            line-height: 3mm;
          }

          .checklist-print-identification > div:nth-child(4n) {
            border-right: 0;
          }

          .checklist-print-identification .id-label {
            font-weight: 700;
            text-transform: uppercase;
          }

          .checklist-print-table {
            width: 100%;
            table-layout: fixed;
            border-collapse: collapse;
            font-size: 5.6pt;
            line-height: 1;
          }

          .checklist-print-table th,
          .checklist-print-table td {
            border: 1px solid #111827;
            padding: 0.7mm 0.7mm;
            vertical-align: middle;
          }

          .checklist-print-table th {
            background: #ffffff !important;
            font-weight: 800;
            text-transform: uppercase;
            text-align: center;
          }

          .checklist-print-table tbody td {
            height: 3.6mm;
          }

          .checklist-print-table .print-qtd {
            width: 12mm;
            text-align: center;
            font-weight: 700;
          }

          .checklist-print-table .print-exig,
          .checklist-print-table .print-disp {
            width: 8mm;
            text-align: center;
            font-weight: 700;
          }

          .checklist-print-table .print-item {
            width: 26%;
            text-align: left;
          }

          .checklist-print-table .print-item-equipment {
            width: 24%;
          }

          .checklist-print-table .print-day-group {
            text-align: center;
            font-size: 5.8pt;
            padding: 0.65mm 0;
          }

          .checklist-print-table .print-day {
            width: 3.6mm;
            text-align: center;
            padding: 0;
          }

          .checklist-print-table .print-section {
            background: #ffffff !important;
            padding: 0.55mm 1mm;
            font-size: 6.2pt;
            font-weight: 900;
            text-transform: uppercase;
            text-align: center;
          }

          .checklist-print-table tfoot td {
            font-size: 7.2pt;
            font-weight: 800;
          }

          .print-signature-row td {
            height: 32mm;
          }

          .print-signature-label {
            padding: 3mm;
            text-align: center;
            vertical-align: middle;
          }

          .print-signature-cell {
            padding: 0;
          }

          .print-alert-main,
          .print-legend-title,
          .print-note-main,
          .print-legend-value {
            padding: 1mm 1.4mm;
          }

          .print-alert-main {
            text-align: left;
          }

          .print-legend-title,
          .print-legend-value {
            text-align: center;
            white-space: nowrap;
          }

          .print-note-main {
            min-height: 6mm;
            text-align: center;
            line-height: 1.25;
          }

          .print-footer-blank {
            height: 3.2mm;
            padding: 0;
          }
        }
      `}</style>

      <AlertModal
        open={!!confirmDelete}
        title="Excluir checklist"
        message={`Deseja excluir ${confirmDelete?.titulo || 'este checklist'}?`}
        variant="danger"
        confirmLabel="Excluir"
        loading={saving}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
      />

      <button
        type="button"
        onClick={abrirTutorialChecklists}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-aviation-200 bg-aviation-600 text-white shadow-2xl shadow-aviation-900/30 transition-all hover:scale-105 hover:bg-aviation-500 focus:outline-none focus:ring-4 focus:ring-aviation-300/40 dark:border-aviation-400/30"
        title="Abrir tutorial de Checklists"
      >
        <HelpCircle className="h-7 w-7" />
      </button>
      <AnimatedPageTour
        open={showTutorial}
        steps={checklistTourSteps}
        stepIndex={tutorialStepIndex}
        targetAttribute="data-checklists-tour"
        onBack={voltarTutorialChecklists}
        onNext={avancarTutorialChecklists}
        onClose={fecharTutorialChecklists}
      />
    </PageContainer>
  );
}

export default Checklists;
