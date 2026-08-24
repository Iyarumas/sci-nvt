import { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle, Plus, Save, Eye, Pencil, Trash2, ChevronDown, ChevronUp, FileText,
  CheckCircle, Printer, X,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { PdfPreview } from '../../components/documentos/PdfPreview';
import { SearchSelect } from '../../components/ui/SearchSelect';
import type { AtivoItem } from '../../components/ui/SearchSelect';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { turnoAutoPorEquipe } from '../../types/bombeiro';
import { listarOcorrencias, criarOcorrencia, atualizarOcorrencia, excluirOcorrencia } from '../../services/ocorrenciaService';
import { atualizarRea, criarRea, excluirRea, listarReas, obterRea } from '../../services/reaService';
import { gerarReaPdf, nomeArquivoReaPdf } from '../../services/reaPdfService';
import { gerarBonaPdf } from '../../services/bonaPdfService';
import { resolverEfetivoOperacional } from '../../services/efetivoOperacionalService';
import { downloadPdf } from '../../services/pdfService';
import { BONA_FUNCOES, BONA_TIPOS_OCORRENCIA, CATEGORIAS_OCORRENCIA, EQUIPES, TIPO_DOCUMENTO, criarBonaDadosVazios, normalizarFuncaoBona } from '../../types/ocorrencia';
import type { BonaBombeiro, BonaDados, Ocorrencia, TipoDocumento } from '../../types/ocorrencia';
import type { ReaDados, ReaRegistro, ReaStatus } from '../../types/rea';
import { ReaModal } from './ReaModal';
import { ReaCard } from './ReaCard';
import { hojeLocalISO } from '../../utils/datas';
import { montarOpcoesEfetivoOperacional } from '../../utils/efetivoOperacional';
import { PageTour } from '../../components/ui/PageTour';

const BONA_ULTIMO_NUMERO_LEGADO = 63;

const BONA_REA_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'BONA/REA',
    body: 'Esta página reúne documentos formais de ocorrência: BONA e REA.',
    detail: 'BONA é usado para ocorrência não aeronáutica. REA é usado para registro de emergência aeronáutica. Eles têm numeração, aprovação e geração/visualização de PDF.',
  },
  {
    selector: 'main button, main select, main input',
    title: 'Filtros da lista',
    body: 'Alterne entre Mês/Ano e Período, filtre por tipo de documento e equipe.',
    detail: 'Use BONA ou REA quando precisar conferir somente um tipo. O período ajuda em auditorias ou fechamento mensal.',
  },
  {
    selector: 'main button',
    title: 'Novo documento',
    body: 'O botão Novo Documento permite escolher entre criar BONA ou REA.',
    detail: 'Escolha BONA para ocorrência não aeronáutica e REA para emergência aeronáutica. Cada tipo abre um formulário próprio.',
  },
  {
    selector: 'main .space-y-3',
    title: 'Cards de documentos',
    body: 'A lista mostra BONA e REA juntos, com ações de visualizar, editar, aprovar, gerar/baixar PDF e excluir conforme permissão.',
    detail: 'Registros aprovados devem ser revisados com cuidado. A numeração e o PDF são parte do histórico formal.',
  },
  {
    selector: 'main input, main textarea, main select',
    title: 'Campos do BONA/REA',
    body: 'Os formulários pedem data, hora, equipe, tipo, local, descrição, atuação da equipe, bombeiros envolvidos e demais campos específicos.',
    detail: 'Preencha de forma completa porque esses dados aparecem no PDF e nos relatórios. Para BONA, confira também os bombeiros/funções puxados do efetivo operacional.',
  },
  {
    selector: 'main iframe, main canvas, main button',
    title: 'PDF e aprovação',
    body: 'A prévia mostra o PDF antes de baixar ou imprimir.',
    detail: 'Revise o documento antes de aprovar ou baixar. Se encontrar erro, volte para editar antes de gerar a versão final.',
  },
];

function numeroSequencial(registro: Pick<Ocorrencia, 'numero'>, prefixo: string, ano: number): number {
  const regex = new RegExp(`^${prefixo}-(\\d+)(?:\\/${ano})?$`, 'i');
  const match = String(registro.numero || '').trim().match(regex);
  return match ? Number(match[1]) : 0;
}

function gerarNumero(tipo: TipoDocumento, existentes: Ocorrencia[]): string {
  const prefixo = tipo === 'BONA' ? 'BONA' : 'REA';
  const ano = new Date().getFullYear();
  const maiorExistente = existentes
    .filter(o => o.tipoDocumento === tipo && o.numero.startsWith(prefixo))
    .reduce((maior, item) => Math.max(maior, numeroSequencial(item, prefixo, ano)), 0);
  const base = tipo === 'BONA' ? BONA_ULTIMO_NUMERO_LEGADO : 0;
  const sequencia = Math.max(base, maiorExistente) + 1;
  return `${prefixo}-${String(sequencia).padStart(3, '0')}/${ano}`;
}

function gerarNumeroRea(existentes: ReaRegistro[]): string {
  const ano = new Date().getFullYear();
  const regex = new RegExp(`^REA-(\\d+)\\/${ano}$`);
  const maior = existentes.reduce((max, item) => {
    const match = item.numero.match(regex);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `REA-${String(maior + 1).padStart(3, '0')}/${ano}`;
}

function emptyOcorrencia(): Omit<Ocorrencia, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> {
  return {
    tipoDocumento: 'BONA',
    numero: '',
    data: hojeLocalISO(),
    hora: '',
    equipe: '',
    turno: '',
    categoria: 'Outros',
    titulo: TIPO_DOCUMENTO.BONA,
    descricao: '',
    local: '',
    envolvidos: '',
    acoesTomadas: '',
    status: 'Aberta',
    fotos: [],
    bonaDados: criarBonaDadosVazios(),
  };
}

type OcorrenciaFormData = Omit<Ocorrencia, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;

function bombeirosFromTexto(raw: string): BonaBombeiro[] {
  return raw
    .split(/\r?\n|;|,/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [nome, ...funcao] = item.split(/\s+-\s+|\s+–\s+|\s+\|\s+/);
      return { nome: nome.trim(), funcao: funcao.join(' - ').trim() };
    })
    .filter(item => item.nome || item.funcao);
}

function bonaDadosFromOcorrencia(ocorrencia: Partial<Ocorrencia>): BonaDados {
  const dados = criarBonaDadosVazios(ocorrencia.bonaDados || {});
  const bombeiros = dados.bombeiros.length > 0 ? dados.bombeiros : bombeirosFromTexto(ocorrencia.envolvidos || '');
  return criarBonaDadosVazios({
    ...dados,
    areaEvento: dados.areaEvento || ocorrencia.local || '',
    tipoOcorrencia: dados.tipoOcorrencia || ocorrencia.titulo || ocorrencia.categoria || '',
    bombeiros,
    acionamento: dados.acionamento || ocorrencia.hora || '',
    descricaoOcorrencia: dados.descricaoOcorrencia || ocorrencia.descricao || '',
    descricaoAtuacaoEquipe: dados.descricaoAtuacaoEquipe || ocorrencia.acoesTomadas || '',
  });
}

function bombeirosParaTexto(bombeiros: BonaBombeiro[]): string {
  return bombeiros
    .filter(item => item.nome || item.funcao)
    .map(item => item.funcao ? `${item.nome} - ${item.funcao}` : item.nome)
    .join('\n');
}

function calcularTempoAtendimento(inicio: string, fim: string): string {
  if (!/^\d{2}:\d{2}$/.test(inicio) || !/^\d{2}:\d{2}$/.test(fim)) return '';
  const [hi, mi] = inicio.split(':').map(Number);
  const [hf, mf] = fim.split(':').map(Number);
  const start = hi * 60 + mi;
  let end = hf * 60 + mf;
  if (end < start) end += 24 * 60;
  const diff = end - start;
  return `${String(Math.floor(diff / 60)).padStart(2, '0')}:${String(diff % 60).padStart(2, '0')}`;
}

function categoriaSistema(tipoOcorrencia: string): Ocorrencia['categoria'] {
  return CATEGORIAS_OCORRENCIA.includes(tipoOcorrencia as Ocorrencia['categoria'])
    ? tipoOcorrencia as Ocorrencia['categoria']
    : 'Outros';
}

function bonaBombeiroFromOpcao(opcao: AtivoItem): BonaBombeiro {
  return {
    nome: opcao.nomeCompleto || opcao.nomeGuerra,
    funcao: normalizarFuncaoBona(opcao.cargo || ''),
  };
}

function opcoesParaBombeiros(opcoes: AtivoItem[]): BonaBombeiro[] {
  return opcoes.map(bonaBombeiroFromOpcao);
}

function nomePessoaKey(value: string): string {
  return value.trim().toLocaleLowerCase('pt-BR');
}

function completarNomesBombeiros(bombeiros: BonaBombeiro[], opcoes: AtivoItem[]): BonaBombeiro[] {
  const porNome = new Map<string, AtivoItem>();
  opcoes.forEach(opcao => {
    if (opcao.nomeGuerra) porNome.set(nomePessoaKey(opcao.nomeGuerra), opcao);
    if (opcao.nomeCompleto) porNome.set(nomePessoaKey(opcao.nomeCompleto), opcao);
  });

  return bombeiros.map(bombeiro => {
    const opcao = porNome.get(nomePessoaKey(bombeiro.nome));
    if (!opcao) return bombeiro;
    return {
      nome: opcao.nomeCompleto || bombeiro.nome,
      funcao: bombeiro.funcao || normalizarFuncaoBona(opcao.cargo || ''),
    };
  });
}

function opcoesFuncaoBona(funcaoAtual: string): string[] {
  const funcao = normalizarFuncaoBona(funcaoAtual);
  if (!funcao || BONA_FUNCOES.includes(funcao as typeof BONA_FUNCOES[number])) {
    return [...BONA_FUNCOES];
  }
  return [funcao, ...BONA_FUNCOES];
}

function prepararBonaParaSalvar(data: OcorrenciaFormData): OcorrenciaFormData {
  const dados = bonaDadosFromOcorrencia(data);
  const tempoCalculado = calcularTempoAtendimento(dados.acionamento, dados.retornoSci);
  const bonaDados = criarBonaDadosVazios({
    ...dados,
    tempoGastoAtendimento: dados.tempoGastoAtendimento || tempoCalculado,
  });
  return {
    ...data,
    hora: data.hora || bonaDados.acionamento,
    local: bonaDados.areaEvento,
    titulo: bonaDados.tipoOcorrencia || TIPO_DOCUMENTO.BONA,
    categoria: categoriaSistema(bonaDados.tipoOcorrencia),
    descricao: bonaDados.descricaoOcorrencia,
    envolvidos: bombeirosParaTexto(bonaDados.bombeiros),
    acoesTomadas: bonaDados.descricaoAtuacaoEquipe,
    bonaDados,
  };
}

function formDataFromOcorrencia(ocorrencia: Ocorrencia): OcorrenciaFormData {
  const bonaDados = bonaDadosFromOcorrencia(ocorrencia);
  return {
    tipoDocumento: ocorrencia.tipoDocumento,
    numero: ocorrencia.numero,
    data: ocorrencia.data,
    hora: ocorrencia.hora,
    equipe: ocorrencia.equipe,
    turno: ocorrencia.turno,
    categoria: ocorrencia.categoria,
    titulo: ocorrencia.titulo,
    descricao: ocorrencia.descricao,
    local: ocorrencia.local,
    envolvidos: ocorrencia.envolvidos,
    acoesTomadas: ocorrencia.acoesTomadas,
    status: ocorrencia.status,
    fotos: [],
    bonaDados,
  };
}

async function prepararBonaParaDocumento(ocorrencia: Ocorrencia): Promise<Ocorrencia> {
  const dados = bonaDadosFromOcorrencia(ocorrencia);
  if (!ocorrencia.equipe || !ocorrencia.data || dados.bombeiros.length === 0) return ocorrencia;

  try {
    const efetivo = await resolverEfetivoOperacional(ocorrencia.equipe, ocorrencia.data);
    const opcoes = montarOpcoesEfetivoOperacional(efetivo, ocorrencia.equipe);
    const bombeiros = completarNomesBombeiros(dados.bombeiros, opcoes);
    const bonaDados = criarBonaDadosVazios({ ...dados, bombeiros });
    return {
      ...ocorrencia,
      envolvidos: bombeirosParaTexto(bombeiros),
      bonaDados,
    };
  } catch {
    return ocorrencia;
  }
}

async function imprimirPdfBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  document.body.appendChild(iframe);

  await new Promise<void>((resolve) => {
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      resolve();
    };
    setTimeout(resolve, 2500);
  });

  setTimeout(() => {
    iframe.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

/* ───────── Formulário ───────── */

function OcorrenciaForm({
  ocorrencia,
  userEquipe,
  todas,
  canManageGlobal,
  isAdminSistema,
  onSave,
  onSelectRea,
  onCancel,
}: {
  ocorrencia?: Ocorrencia;
  userEquipe: string;
  todas: Ocorrencia[];
  canManageGlobal: boolean;
  isAdminSistema: boolean;
  onSave: (data: OcorrenciaFormData) => void;
  onSelectRea?: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<OcorrenciaFormData>(ocorrencia
    ? formDataFromOcorrencia(ocorrencia)
    : { ...emptyOcorrencia(), equipe: userEquipe, turno: turnoAutoPorEquipe(userEquipe as any), numero: gerarNumero('BONA', todas) });
  const [opcoesBombeiros, setOpcoesBombeiros] = useState<AtivoItem[]>([]);
  const [loadingEfetivo, setLoadingEfetivo] = useState(false);

  const input = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all duration-200 focus:border-aviation-500 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:placeholder:text-graphite-500 dark:scheme-dark';
  const select = input;
  const inputReadOnly = input + ' cursor-not-allowed bg-graphite-50 dark:bg-surface-hover';
  const label = 'block mb-1.5 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';
  const bonaDados = bonaDadosFromOcorrencia(form);
  const tempoCalculado = calcularTempoAtendimento(bonaDados.acionamento, bonaDados.retornoSci);
  const camposBloqueados = form.status === 'Fechada';
  const tipoOcorrenciaSelecionado = (BONA_TIPOS_OCORRENCIA as readonly string[]).includes(bonaDados.tipoOcorrencia)
    ? bonaDados.tipoOcorrencia
    : '';

  useEffect(() => {
    let active = true;
    if (!form.equipe || !form.data) {
      setOpcoesBombeiros([]);
      return () => { active = false; };
    }

    setLoadingEfetivo(true);
    resolverEfetivoOperacional(form.equipe, form.data)
      .then(efetivo => {
        if (!active) return;
        const opcoes = montarOpcoesEfetivoOperacional(efetivo, form.equipe);
        setOpcoesBombeiros(opcoes);
        setForm(f => {
          const dados = bonaDadosFromOcorrencia(f);
          if (camposBloqueados || opcoes.length === 0) return f;
          if (dados.bombeiros.length > 0) {
            const bombeiros = completarNomesBombeiros(dados.bombeiros, opcoes);
            const mudou = bombeiros.some((bombeiro, index) =>
              bombeiro.nome !== dados.bombeiros[index]?.nome ||
              bombeiro.funcao !== dados.bombeiros[index]?.funcao
            );
            if (!mudou) return f;
            return {
              ...f,
              bonaDados: criarBonaDadosVazios({
                ...dados,
                bombeiros,
              }),
            };
          }
          return {
            ...f,
            turno: f.turno || turnoAutoPorEquipe(f.equipe as any),
            bonaDados: criarBonaDadosVazios({
              ...dados,
              bombeiros: opcoesParaBombeiros(opcoes),
            }),
          };
        });
      })
      .catch(() => {
        if (active) setOpcoesBombeiros([]);
      })
      .finally(() => {
        if (active) setLoadingEfetivo(false);
      });

    return () => {
      active = false;
    };
  }, [form.equipe, form.data, camposBloqueados]);

  function setBonaDados(updates: Partial<BonaDados>) {
    if (camposBloqueados) return;
    setForm(f => ({ ...f, bonaDados: criarBonaDadosVazios({ ...bonaDadosFromOcorrencia(f), ...updates }) }));
  }

  function setBonaCampo<K extends keyof BonaDados>(campo: K, value: BonaDados[K]) {
    setBonaDados({ [campo]: value } as Partial<BonaDados>);
  }

  function handleHora(value: string) {
    if (camposBloqueados) return;
    setForm(f => {
      const dados = bonaDadosFromOcorrencia(f);
      return {
        ...f,
        hora: value,
        bonaDados: criarBonaDadosVazios({
          ...dados,
          acionamento: dados.acionamento || value,
        }),
      };
    });
  }

  function handleBombeiro(index: number, campo: keyof BonaBombeiro, value: string) {
    if (camposBloqueados) return;
    setForm(f => {
      const dados = bonaDadosFromOcorrencia(f);
      const bombeiros = [...dados.bombeiros];
      while (bombeiros.length <= index) bombeiros.push({ nome: '', funcao: '' });
      bombeiros[index] = {
        ...bombeiros[index],
        [campo]: campo === 'funcao' ? normalizarFuncaoBona(value) : value,
      };
      return { ...f, bonaDados: criarBonaDadosVazios({ ...dados, bombeiros }) };
    });
  }

  function handleBombeiroNome(index: number, value: string) {
    if (camposBloqueados) return;
    const selecionado = opcoesBombeiros.find(opcao => opcao.nomeGuerra === value || opcao.nomeCompleto === value);
    setForm(f => {
      const dados = bonaDadosFromOcorrencia(f);
      const bombeiros = [...dados.bombeiros];
      while (bombeiros.length <= index) bombeiros.push({ nome: '', funcao: '' });
      bombeiros[index] = {
        nome: selecionado?.nomeCompleto || value,
        funcao: selecionado ? normalizarFuncaoBona(selecionado.cargo || '') : bombeiros[index].funcao,
      };
      return { ...f, bonaDados: criarBonaDadosVazios({ ...dados, bombeiros }) };
    });
  }

  function addBombeiro() {
    if (camposBloqueados) return;
    setBonaCampo('bombeiros', [...bonaDados.bombeiros, { nome: '', funcao: '' }]);
  }

  function removeBombeiro(index: number) {
    if (camposBloqueados) return;
    setBonaCampo('bombeiros', bonaDados.bombeiros.filter((_, i) => i !== index));
  }

  function limparBombeirosParaRecarregar(f: OcorrenciaFormData, updates: Partial<OcorrenciaFormData>): OcorrenciaFormData {
    const dados = bonaDadosFromOcorrencia(f);
    return {
      ...f,
      ...updates,
      bonaDados: criarBonaDadosVazios({
        ...dados,
        bombeiros: [],
      }),
    };
  }

  function handleData(value: string) {
    if (camposBloqueados) return;
    setForm(f => limparBombeirosParaRecarregar(f, { data: value }));
  }

  function handleEquipe(equipe: string) {
    if (camposBloqueados) return;
    const turno = turnoAutoPorEquipe(equipe as any);
    setForm(f => limparBombeirosParaRecarregar(f, { equipe, turno }));
  }

  function handleTipo(tipo: TipoDocumento) {
    if (camposBloqueados) return;
    if (tipo === 'REA' && onSelectRea) {
      onSelectRea();
      return;
    }
    setForm(f => ({
      ...f,
      tipoDocumento: tipo,
      titulo: TIPO_DOCUMENTO[tipo],
      numero: gerarNumero(tipo, todas),
      bonaDados: tipo === 'BONA' ? bonaDadosFromOcorrencia(f) : f.bonaDados,
    }));
  }

  const tipoBadge = form.tipoDocumento === 'BONA'
    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400';

  const statusBadge: Record<string, string> = {
    'Aberta': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'Encaminhada': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'Em Andamento': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'Fechada': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  };

  const status = form.status;
  const salvarDesabilitado = camposBloqueados
    ? !isAdminSistema || !form.numero.trim()
    : !form.data || !form.hora || !form.equipe || !bonaDados.areaEvento.trim() || !tipoOcorrenciaSelecionado || !bonaDados.descricaoOcorrencia.trim();

  function disabledIdsBombeiros(indexAtual: number): Set<string> {
    const ids = bonaDados.bombeiros
      .map((bombeiro, index) => {
        if (index === indexAtual) return null;
        return opcoesBombeiros.find(opcao => opcao.nomeGuerra === bombeiro.nome || opcao.nomeCompleto === bombeiro.nome)?.id || null;
      })
      .filter((id): id is string => !!id);
    return new Set(ids);
  }

  function opcoesDaLinhaBombeiro(bombeiro: BonaBombeiro, index: number): AtivoItem[] {
    if (!bombeiro.nome) return opcoesBombeiros;
    const existe = opcoesBombeiros.some(opcao => opcao.nomeGuerra === bombeiro.nome || opcao.nomeCompleto === bombeiro.nome);
    if (existe) return opcoesBombeiros;
    return [
      {
        id: `manual-${index}-${bombeiro.nome}`,
        nomeGuerra: bombeiro.nome,
        nomeCompleto: bombeiro.nome,
        cargo: bombeiro.funcao,
        equipe: form.equipe,
      },
      ...opcoesBombeiros,
    ];
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-3 pt-6 sm:p-4 sm:pt-10">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl shadow-black/10 dark:bg-surface-elevated">
        <div className="flex items-center justify-between border-b border-graphite-200 px-6 py-4 dark:border-border-dark">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{ocorrencia ? 'Editar Documento' : 'Novo Documento'}</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tipoBadge}`}>
              {form.tipoDocumento} · {form.numero}
            </span>
            {status && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadge[status] || ''}`}>
                {status}
              </span>
            )}
          </div>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-graphite-400 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-5 rounded-xl border border-graphite-200 bg-graphite-50 p-4 dark:border-border-dark dark:bg-surface-card">
            <label className={label}>Tipo de Documento *</label>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {(['BONA', 'REA'] as TipoDocumento[]).map(tipo => (
                <button key={tipo} type="button" onClick={() => handleTipo(tipo)} disabled={camposBloqueados}
                  className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                    form.tipoDocumento === tipo
                      ? 'border-aviation-500 bg-aviation-50 dark:border-aviation-400 dark:bg-aviation-900/20'
                      : 'border-graphite-200 bg-white hover:border-graphite-300 dark:border-border-dark dark:bg-surface-card dark:hover:border-graphite-600'
                  } disabled:cursor-not-allowed disabled:opacity-60`}>
                  <FileText className={`h-5 w-5 shrink-0 ${form.tipoDocumento === tipo ? 'text-aviation-600 dark:text-aviation-400' : 'text-graphite-400'}`} />
                  <div>
                    <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{tipo}</p>
                    <p className="text-[11px] text-graphite-500 dark:text-graphite-400">{TIPO_DOCUMENTO[tipo]}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
              <div className="sm:col-span-2 lg:col-span-4">
                <label className={label}>Nº Ocorrência</label>
                <input
                  value={form.numero}
                  onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                  readOnly={!isAdminSistema}
                  className={isAdminSistema ? input : inputReadOnly}
                />
              </div>
              <div className="lg:col-span-2">
                <label className={label}>Data *</label>
                <input type="date" value={form.data} onChange={e => handleData(e.target.value)} disabled={camposBloqueados} className={camposBloqueados ? inputReadOnly : input} />
              </div>
              <div className="lg:col-span-2">
                <label className={label}>Hora *</label>
                <input type="time" value={form.hora} onChange={e => handleHora(e.target.value)} disabled={camposBloqueados} className={camposBloqueados ? inputReadOnly : input} />
              </div>
              <div className="lg:col-span-2">
                <label className={label}>Equipe *</label>
                <select value={form.equipe} onChange={e => handleEquipe(e.target.value)} className={camposBloqueados ? inputReadOnly : select} disabled={!canManageGlobal || camposBloqueados}>
                  <option value="">Selecione</option>
                  {EQUIPES.filter(eq => canManageGlobal || eq === userEquipe).map(eq => <option key={eq} value={eq}>{eq}</option>)}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className={label}>Turno</label>
                <input value={form.turno} readOnly className={inputReadOnly} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <label className={label}>Área do evento (Mapa de Grade) *</label>
                <input value={bonaDados.areaEvento} onChange={e => setBonaCampo('areaEvento', e.target.value)} disabled={camposBloqueados} className={camposBloqueados ? inputReadOnly : input} />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label className={label}>Tipo de Ocorrência *</label>
                <select
                  value={tipoOcorrenciaSelecionado}
                  onChange={e => setBonaCampo('tipoOcorrencia', e.target.value)}
                  disabled={camposBloqueados}
                  className={camposBloqueados ? inputReadOnly : select}
                  title={tipoOcorrenciaSelecionado}
                >
                  <option value="">Selecione...</option>
                  {BONA_TIPOS_OCORRENCIA.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className={label}>Vítimas Fatais</label>
                <input type="number" min="0" value={bonaDados.vitimasFatais} onChange={e => setBonaCampo('vitimasFatais', e.target.value)} disabled={camposBloqueados} className={camposBloqueados ? inputReadOnly : input} />
              </div>
              <div className="lg:col-span-2">
                <label className={label}>Vítimas Feridas</label>
                <input type="number" min="0" value={bonaDados.vitimasFeridas} onChange={e => setBonaCampo('vitimasFeridas', e.target.value)} disabled={camposBloqueados} className={camposBloqueados ? inputReadOnly : input} />
              </div>
            </div>

            <div className="rounded-xl border border-graphite-200 p-4 dark:border-border-dark">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-graphite-800 dark:text-graphite-100">Bombeiros envolvidos</p>
                  <p className="mt-0.5 text-xs text-graphite-500 dark:text-graphite-400">
                    {loadingEfetivo ? 'Carregando efetivo do dia...' : opcoesBombeiros.length ? `${opcoesBombeiros.length} pessoa(s) em serviço nessa equipe/data.` : 'Selecione equipe e data para carregar o efetivo.'}
                  </p>
                </div>
                <button type="button" onClick={addBombeiro} disabled={camposBloqueados}
                  className="flex items-center gap-1 rounded-lg bg-aviation-50 px-3 py-1.5 text-xs font-medium text-aviation-700 hover:bg-aviation-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-aviation-900/30 dark:text-aviation-300">
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              </div>
              <div className="space-y-2">
                {(bonaDados.bombeiros.length ? bonaDados.bombeiros : [{ nome: '', funcao: '' }]).map((bombeiro, index) => (
                  <div key={index} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <div>
                      <label className={label}>Bombeiro</label>
                      {camposBloqueados ? (
                        <input value={bombeiro.nome} readOnly className={inputReadOnly} />
                      ) : (
                        <SearchSelect
                          value={bombeiro.nome}
                          onChange={value => handleBombeiroNome(index, value)}
                          options={opcoesDaLinhaBombeiro(bombeiro, index)}
                          valueField="nomeCompleto"
                          disabledIds={disabledIdsBombeiros(index)}
                          disabledTooltip="Pessoa já adicionada no BONA"
                          showCargo
                          displayMode="operational"
                          placeholder={opcoesBombeiros.length ? 'Selecione do efetivo do dia' : 'Selecione equipe e data'}
                        />
                      )}
                    </div>
                    <div>
                      <label className={label}>Função</label>
                      <select value={bombeiro.funcao} onChange={e => handleBombeiro(index, 'funcao', e.target.value)} className={camposBloqueados ? inputReadOnly : select} disabled={camposBloqueados}>
                        <option value="">Selecione</option>
                        {opcoesFuncaoBona(bombeiro.funcao).map(funcao => <option key={funcao} value={funcao}>{funcao}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button type="button" onClick={() => removeBombeiro(index)} disabled={camposBloqueados || bonaDados.bombeiros.length <= 1}
                        className="mb-0.5 rounded-lg bg-red-50 p-2 text-alert-red transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-red-900/20 dark:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={label}>Acionamento</label>
                <input type="time" value={bonaDados.acionamento} onChange={e => setBonaCampo('acionamento', e.target.value)} disabled={camposBloqueados} className={camposBloqueados ? inputReadOnly : input} />
              </div>
              <div>
                <label className={label}>Hora de Saída</label>
                <input type="time" value={bonaDados.saida} onChange={e => setBonaCampo('saida', e.target.value)} disabled={camposBloqueados} className={camposBloqueados ? inputReadOnly : input} />
              </div>
              <div>
                <label className={label}>Chegada no Local</label>
                <input type="time" value={bonaDados.chegadaLocal} onChange={e => setBonaCampo('chegadaLocal', e.target.value)} disabled={camposBloqueados} className={camposBloqueados ? inputReadOnly : input} />
              </div>
              <div>
                <label className={label}>Término da Ocorrência</label>
                <input type="time" value={bonaDados.terminoOcorrencia} onChange={e => setBonaCampo('terminoOcorrencia', e.target.value)} disabled={camposBloqueados} className={camposBloqueados ? inputReadOnly : input} />
              </div>
              <div>
                <label className={label}>Retorno à SCI</label>
                <input type="time" value={bonaDados.retornoSci} onChange={e => setBonaCampo('retornoSci', e.target.value)} disabled={camposBloqueados} className={camposBloqueados ? inputReadOnly : input} />
              </div>
              <div>
                <label className={label}>Tempo Gasto</label>
                <input value={bonaDados.tempoGastoAtendimento || tempoCalculado} onChange={e => setBonaCampo('tempoGastoAtendimento', e.target.value)} disabled={camposBloqueados} className={camposBloqueados ? inputReadOnly : input} placeholder="00:00" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className={label}>Descrição Sucinta da Ocorrência / Acionamento *</label>
                <textarea value={bonaDados.descricaoOcorrencia} onChange={e => setBonaCampo('descricaoOcorrencia', e.target.value)} rows={4} disabled={camposBloqueados} className={(camposBloqueados ? inputReadOnly : input) + ' resize-y'} />
              </div>
              <div>
                <label className={label}>Descrição Sucinta da Atuação da Equipe do SESCINC</label>
                <textarea value={bonaDados.descricaoAtuacaoEquipe} onChange={e => setBonaCampo('descricaoAtuacaoEquipe', e.target.value)} rows={5} disabled={camposBloqueados} className={(camposBloqueados ? inputReadOnly : input) + ' resize-y'} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <label className={label}>Veículos Utilizados</label>
                <textarea value={bonaDados.veiculosUtilizados} onChange={e => setBonaCampo('veiculosUtilizados', e.target.value)} rows={2} disabled={camposBloqueados} className={(camposBloqueados ? inputReadOnly : input) + ' resize-y'} />
              </div>
              <div>
                <label className={label}>LGE</label>
                <input type="number" min="0" value={bonaDados.agentesLge} onChange={e => setBonaCampo('agentesLge', e.target.value)} disabled={camposBloqueados} className={camposBloqueados ? inputReadOnly : input} />
              </div>
              <div>
                <label className={label}>PQ</label>
                <input type="number" min="0" value={bonaDados.agentesPq} onChange={e => setBonaCampo('agentesPq', e.target.value)} disabled={camposBloqueados} className={camposBloqueados ? inputReadOnly : input} />
              </div>
              <div className="sm:col-span-4">
                <label className={label}>Outros Recursos Utilizados</label>
                <textarea value={bonaDados.outrosRecursosUtilizados} onChange={e => setBonaCampo('outrosRecursosUtilizados', e.target.value)} rows={3} disabled={camposBloqueados} className={(camposBloqueados ? inputReadOnly : input) + ' resize-y'} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-graphite-200 px-6 py-4 dark:border-border-dark">
          <button onClick={onCancel} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
            Cancelar
          </button>

          <button onClick={() => onSave(prepararBonaParaSalvar({ ...form, status: status === 'Fechada' ? 'Fechada' : 'Aberta', fotos: [] }))} disabled={salvarDesabilitado}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl hover:from-aviation-500 hover:to-aviation-600 disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="h-4 w-4" /> {camposBloqueados ? 'Salvar número' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────── Visualização ───────── */

function OcorrenciaView({ ocorrencia, onBack }: { ocorrencia: Ocorrencia; onBack: () => void }) {
  const label = 'text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';
  const value = 'text-sm text-graphite-900 dark:text-graphite-100';
  const bonaDados = bonaDadosFromOcorrencia(ocorrencia);

  const statusColor: Record<string, string> = {
    'Aberta': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'Encaminhada': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'Em Andamento': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'Fechada': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  };
  const tipoBadge = ocorrencia.tipoDocumento === 'BONA'
    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400';

  return (
    <div className="rounded-2xl border border-graphite-200 bg-white p-6 shadow-sm dark:border-border-dark dark:bg-surface-card">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{ocorrencia.numero}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tipoBadge}`}>{ocorrencia.tipoDocumento}</span>
          </div>
          <p className="mt-1 text-sm font-medium text-graphite-600 dark:text-graphite-300">{TIPO_DOCUMENTO[ocorrencia.tipoDocumento]}</p>
          <p className="mt-0.5 text-sm text-graphite-500 dark:text-graphite-400">{ocorrencia.data} {ocorrencia.hora && `às ${ocorrencia.hora}`}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusColor[ocorrencia.status] || ''}`}>{ocorrencia.status}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div><p className={label}>Equipe</p><p className={value}>{ocorrencia.equipe}</p></div>
        <div><p className={label}>Turno</p><p className={value}>{ocorrencia.turno || '—'}</p></div>
        <div><p className={label}>Tipo</p><p className={value}>{bonaDados.tipoOcorrencia || '—'}</p></div>
        <div><p className={label}>Área</p><p className={value}>{bonaDados.areaEvento || '—'}</p></div>
        <div><p className={label}>Vítimas fatais</p><p className={value}>{bonaDados.vitimasFatais || '0'}</p></div>
        <div><p className={label}>Vítimas feridas</p><p className={value}>{bonaDados.vitimasFeridas || '0'}</p></div>
        <div><p className={label}>Tempo gasto</p><p className={value}>{bonaDados.tempoGastoAtendimento || calcularTempoAtendimento(bonaDados.acionamento, bonaDados.retornoSci) || '—'}</p></div>
      </div>

      {bonaDados.bombeiros.length > 0 && (
        <div className="mt-4">
          <p className={label}>Bombeiros envolvidos</p>
          <div className="mt-2 overflow-hidden rounded-xl border border-graphite-200 dark:border-border-dark">
            {bonaDados.bombeiros.map((bombeiro, index) => (
              <div key={index} className="grid grid-cols-1 gap-1 border-b border-graphite-200 px-3 py-2 text-sm last:border-b-0 dark:border-border-dark sm:grid-cols-2">
                <span className="font-medium text-graphite-900 dark:text-graphite-100">{bombeiro.nome || '—'}</span>
                <span className="text-graphite-600 dark:text-graphite-300">{bombeiro.funcao || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
        <div><p className={label}>Acionamento</p><p className={value}>{bonaDados.acionamento || '—'}</p></div>
        <div><p className={label}>Saída</p><p className={value}>{bonaDados.saida || '—'}</p></div>
        <div><p className={label}>Chegada</p><p className={value}>{bonaDados.chegadaLocal || '—'}</p></div>
        <div><p className={label}>Término</p><p className={value}>{bonaDados.terminoOcorrencia || '—'}</p></div>
        <div><p className={label}>Retorno SCI</p><p className={value}>{bonaDados.retornoSci || '—'}</p></div>
      </div>

      {bonaDados.descricaoOcorrencia && (
        <div className="mt-4"><p className={label}>Descrição Sucinta da Ocorrência / Acionamento</p><p className={value + ' mt-1 whitespace-pre-wrap'}>{bonaDados.descricaoOcorrencia}</p></div>
      )}
      {bonaDados.descricaoAtuacaoEquipe && (
        <div className="mt-3"><p className={label}>Descrição Sucinta da Atuação da Equipe do SESCINC</p><p className={value + ' mt-1 whitespace-pre-wrap'}>{bonaDados.descricaoAtuacaoEquipe}</p></div>
      )}
      {(bonaDados.veiculosUtilizados || bonaDados.outrosRecursosUtilizados || bonaDados.agentesLge || bonaDados.agentesPq) && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2"><p className={label}>Veículos Utilizados</p><p className={value + ' whitespace-pre-wrap'}>{bonaDados.veiculosUtilizados || '—'}</p></div>
          <div><p className={label}>LGE</p><p className={value}>{bonaDados.agentesLge || '0'}</p></div>
          <div><p className={label}>PQ</p><p className={value}>{bonaDados.agentesPq || '0'}</p></div>
          <div className="sm:col-span-4"><p className={label}>Outros Recursos Utilizados</p><p className={value + ' whitespace-pre-wrap'}>{bonaDados.outrosRecursosUtilizados || '—'}</p></div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button onClick={onBack} className="rounded-xl border border-graphite-300 bg-white px-5 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Voltar</button>
      </div>
    </div>
  );
}

/* ───────── Card ───────── */

function OcorrenciaCard({
  o,
  canManage,
  canEditApprovedNumber,
  canDeleteApproved,
  processingPdf,
  approving,
  onView,
  onPreviewDocument,
  onPrintDocument,
  onApprove,
  onEdit,
  onDelete,
}: {
  o: Ocorrencia; canManage: boolean;
  canEditApprovedNumber: boolean;
  canDeleteApproved: boolean;
  processingPdf: boolean;
  approving: boolean;
  onView: () => void;
  onPreviewDocument: () => void;
  onPrintDocument: () => void;
  onApprove: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusColor: Record<string, string> = {
    'Aberta': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'Encaminhada': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'Em Andamento': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    'Fechada': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  };
  const tipoBadge = o.tipoDocumento === 'BONA'
    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
    : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400';

  const bonaDados = bonaDadosFromOcorrencia(o);
  const isFechada = o.status === 'Fechada';
  const canEdit = isFechada ? canEditApprovedNumber : canManage;
  const canDelete = isFechada ? canDeleteApproved : canManage;
  const canApprove = !isFechada && canManage;
  const detailCardCls = 'rounded-xl border border-graphite-200/60 bg-graphite-50/70 p-3 dark:border-border-dark dark:bg-surface-hover/70';
  const detailLabelCls = 'text-[10px] font-black uppercase tracking-wider text-graphite-500 dark:text-graphite-400';
  const detailValueCls = 'mt-1 text-sm font-semibold text-graphite-900 dark:text-graphite-100';
  const detailCard = (label: string, value?: string) => (
    <div className={detailCardCls}>
      <p className={detailLabelCls}>{label}</p>
      <p className={detailValueCls}>{value || '—'}</p>
    </div>
  );

  return (
    <div className="rounded-2xl border border-graphite-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
      <button onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${tipoBadge}`}>{o.tipoDocumento}</span>
            <span className="shrink-0 text-xs font-semibold text-graphite-500 dark:text-graphite-400">{o.numero}</span>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusColor[o.status] || ''}`}>{o.status}</span>
            <span className="min-w-0 truncate rounded-full bg-aviation-50 px-2.5 py-0.5 text-[10px] font-medium text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">{bonaDados.tipoOcorrencia || o.categoria}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-graphite-500 dark:text-graphite-400">
            <span>{o.data}</span>
            {o.hora && <span>às {o.hora}</span>}
            <span>Equipe {o.equipe}</span>
            {o.local && <span>· {o.local}</span>}
          </div>
        </div>
        <span className="ml-3 flex shrink-0 items-center gap-1 rounded-lg bg-graphite-100 px-2.5 py-1 text-xs font-medium text-graphite-600 dark:bg-surface-hover dark:text-graphite-300">
          Detalhes
          {expanded ? <ChevronUp className="h-4 w-4 text-graphite-400" /> : <ChevronDown className="h-4 w-4 text-graphite-400" />}
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-graphite-200 px-5 py-4 dark:border-border-dark">
          <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-4">
            {detailCard('Data', o.data)}
            {detailCard('Hora', o.hora)}
            {detailCard('Equipe', o.equipe)}
            {detailCard('Turno', o.turno)}
            {detailCard('Tipo', bonaDados.tipoOcorrencia || o.categoria)}
            {detailCard('Área', bonaDados.areaEvento)}
            {detailCard('Local', o.local)}
            {detailCard('Tempo gasto', bonaDados.tempoGastoAtendimento || calcularTempoAtendimento(bonaDados.acionamento, bonaDados.retornoSci))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {detailCard('Vítimas fatais', bonaDados.vitimasFatais || '0')}
            {detailCard('Vítimas feridas', bonaDados.vitimasFeridas || '0')}
            {detailCard('Status', o.status)}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {detailCard('Acionamento', bonaDados.acionamento)}
            {detailCard('Saída', bonaDados.saida)}
            {detailCard('Chegada', bonaDados.chegadaLocal)}
            {detailCard('Término', bonaDados.terminoOcorrencia)}
            {detailCard('Retorno SCI', bonaDados.retornoSci)}
          </div>

          {bonaDados.bombeiros.length > 0 && (
            <div className={detailCardCls}>
              <p className={detailLabelCls}>Bombeiros envolvidos</p>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                {bonaDados.bombeiros.map((bombeiro, index) => (
                  <div key={index} className="rounded-lg bg-white/80 px-3 py-2 text-xs dark:bg-surface-card">
                    <p className="font-semibold text-graphite-900 dark:text-graphite-100">{bombeiro.nome || '—'}</p>
                    <p className="mt-0.5 text-graphite-500 dark:text-graphite-400">{bombeiro.funcao || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bonaDados.descricaoOcorrencia && (
            <div className={detailCardCls}>
              <p className={detailLabelCls}>Descrição da ocorrência / acionamento</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-graphite-800 dark:text-graphite-100">{bonaDados.descricaoOcorrencia}</p>
            </div>
          )}
          {bonaDados.descricaoAtuacaoEquipe && (
            <div className={detailCardCls}>
              <p className={detailLabelCls}>Atuação da equipe</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-graphite-800 dark:text-graphite-100">{bonaDados.descricaoAtuacaoEquipe}</p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-graphite-200/60 pt-3 dark:border-border-dark">
            {canApprove && (
              <button onClick={onApprove} disabled={approving} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">
                <CheckCircle className="h-4 w-4" /> {approving ? 'Aprovando...' : 'Aprovar'}
              </button>
            )}
            <button onClick={onPreviewDocument} disabled={processingPdf} className="flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-3 py-2 text-xs font-semibold text-aviation-700 transition-all hover:bg-aviation-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">
              <Eye className="h-4 w-4" /> {processingPdf ? 'Gerando...' : 'Ver documento'}
            </button>
            {isFechada && (
              <button onClick={onPrintDocument} disabled={processingPdf} className="flex items-center gap-2 rounded-xl bg-graphite-100 px-3 py-2 text-xs font-medium text-graphite-700 transition-colors hover:bg-graphite-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-surface-hover dark:text-graphite-300 dark:hover:bg-surface-hover">
                <Printer className="h-4 w-4" /> Imprimir
              </button>
            )}
            <button onClick={onView} className="flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-3 py-2 text-xs font-semibold text-aviation-700 transition-all hover:bg-aviation-50 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">
              <FileText className="h-4 w-4" /> Dados
            </button>
            {canEdit && (
              <button onClick={onEdit} className="flex items-center gap-2 rounded-xl bg-graphite-100 px-3 py-2 text-xs font-medium text-graphite-700 transition-colors hover:bg-graphite-200 dark:bg-surface-hover dark:text-graphite-300 dark:hover:bg-surface-hover">
                <Pencil className="h-4 w-4" /> {isFechada ? 'Editar número' : 'Editar'}
              </button>
            )}
            {canDelete && (
              <button onClick={onDelete} className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-alert-red transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30">
                <Trash2 className="h-4 w-4" /> Excluir
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Página principal ───────── */

export function Ocorrencias() {
  const { user, contexto, canManageGlobal, canManageEquipe, equipeEfetiva } = useContextoOperacional();
  const username = user?.username || '';
  const canCreate = canManageGlobal || !!equipeEfetiva;
  const isAdminSistema = contexto.isAdministradorSistema;

  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [reas, setReas] = useState<ReaRegistro[]>([]);
  const [mode, setMode] = useState<'list' | 'form' | 'view'>('list');
  const [editando, setEditando] = useState<Ocorrencia | null>(null);
  const [editandoRea, setEditandoRea] = useState<ReaRegistro | null>(null);
  const [showNovoDocumento, setShowNovoDocumento] = useState(false);
  const [showReaModal, setShowReaModal] = useState(false);
  const [savingRea, setSavingRea] = useState(false);
  const [downloadingReaId, setDownloadingReaId] = useState<string | null>(null);
  const [processingBonaPdfId, setProcessingBonaPdfId] = useState<string | null>(null);
  const [approvingBonaId, setApprovingBonaId] = useState<string | null>(null);
  const [previewPdfData, setPreviewPdfData] = useState<ArrayBuffer | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [visualizando, setVisualizando] = useState<Ocorrencia | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteRea, setConfirmDeleteRea] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');
  function clearSuccess() { setSuccessMsg(''); }
  useEffect(() => { if (successMsg) { const t = setTimeout(clearSuccess, 3000); return () => clearTimeout(t); } }, [successMsg]);

  const [filtroAno, setFiltroAno] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filterMode, setFilterMode] = useState<'mes-ano' | 'periodo'>('mes-ano');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFinal, setDataFinal] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const ANOS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
  const inputClass = 'rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all duration-200 hover:border-graphite-400 focus:border-aviation-500 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:placeholder:text-graphite-500 dark:scheme-dark';

  async function carregar() {
    const [ocorrenciasData, reasData] = await Promise.all([listarOcorrencias(), listarReas()]);
    setOcorrencias(ocorrenciasData);
    setReas(reasData);
  }
  useEffect(() => { carregar(); }, []);

  const filtradas = useMemo(() => {
    let list = ocorrencias.filter(o => !!o.numero?.trim());
    if (filtroEquipe) {
      list = list.filter(o => o.equipe === filtroEquipe);
    }
    if (filtroTipo) {
      list = list.filter(o => o.tipoDocumento === filtroTipo);
    }
    if (filterMode === 'mes-ano') {
      if (filtroAno) list = list.filter(o => o.data.startsWith(filtroAno));
      if (filtroMes) list = list.filter(o => (new Date(o.data).getMonth() + 1).toString() === filtroMes);
    } else {
      if (dataInicio) list = list.filter(o => o.data >= dataInicio);
      if (dataFinal) list = list.filter(o => o.data <= dataFinal);
    }
    return list;
  }, [ocorrencias, filtroEquipe, filtroTipo, filterMode, filtroAno, filtroMes, dataInicio, dataFinal]);

  const reasFiltrados = useMemo(() => {
    let list = reas;
    if (filtroTipo && filtroTipo !== 'REA') return [];
    if (filtroEquipe) {
      list = list.filter(r => r.equipe === filtroEquipe);
    }
    if (filterMode === 'mes-ano') {
      if (filtroAno) list = list.filter(r => (r.dataAcidente || r.createdAt).startsWith(filtroAno));
      if (filtroMes) list = list.filter(r => {
        const date = r.dataAcidente || r.createdAt.slice(0, 10);
        return date ? (new Date(date).getMonth() + 1).toString() === filtroMes : false;
      });
    } else {
      if (dataInicio) list = list.filter(r => (r.dataAcidente || r.createdAt.slice(0, 10)) >= dataInicio);
      if (dataFinal) list = list.filter(r => (r.dataAcidente || r.createdAt.slice(0, 10)) <= dataFinal);
    }
    return list;
  }, [reas, filtroEquipe, filtroTipo, filterMode, filtroAno, filtroMes, dataInicio, dataFinal]);

  const documentosFiltrados = useMemo(() => {
    return [
      ...filtradas.map(item => ({ tipo: 'ocorrencia' as const, data: item.data || item.createdAt.slice(0, 10), item })),
      ...reasFiltrados.map(item => ({ tipo: 'rea' as const, data: item.dataAcidente || item.createdAt.slice(0, 10), item })),
    ].sort((a, b) => b.data.localeCompare(a.data));
  }, [filtradas, reasFiltrados]);

  async function handleSave(data: OcorrenciaFormData) {
    const equipeAlvo = canManageGlobal ? data.equipe : equipeEfetiva || data.equipe;
    if (!canManageEquipe(equipeAlvo)) {
      alert('Você só pode salvar BONA da sua equipe efetiva.');
      return;
    }
    const alvo = savedId ? ocorrencias.find(o => o.id === savedId) || editando : editando;
    if (alvo?.status === 'Fechada') {
      if (!isAdminSistema) {
        alert('BONA aprovado não pode mais ser alterado.');
        return;
      }
      const numero = data.numero.trim();
      if (!numero) {
        alert('Informe o número do BONA.');
        return;
      }
      const updated = await atualizarOcorrencia(alvo.id, { numero, status: 'Fechada' });
      if (updated) {
        setOcorrencias(prev => prev.map(o => o.id === updated.id ? updated : o));
      } else {
        await carregar();
      }
      setEditando(null);
      setSavedId(null);
      setSuccessMsg('Número do BONA atualizado.');
      setMode('list');
      return;
    }
    if (alvo && !canManageEquipe(alvo.equipe)) {
      alert('Você só pode editar BONA da sua equipe efetiva.');
      return;
    }
    const normalizedData = prepararBonaParaSalvar(data);
    const payload: OcorrenciaFormData = {
      ...normalizedData,
      equipe: equipeAlvo as string,
      status: normalizedData.status === 'Fechada' ? 'Fechada' : 'Aberta',
      fotos: [],
    };
    let saved: Ocorrencia | null;
    if (savedId) {
      saved = await atualizarOcorrencia(savedId, payload);
    } else {
      saved = await criarOcorrencia({ ...payload, createdBy: username });
    }
    await carregar();
    setEditando(null);
    setSavedId(null);
    setSuccessMsg(saved ? 'BONA salvo com sucesso. Abra os detalhes para visualizar ou aprovar.' : '');
    setMode('list');
  }

  async function handleDelete(id: string) {
    const alvo = ocorrencias.find(o => o.id === id);
    if (!alvo) {
      setConfirmDelete(null);
      return;
    }
    if (alvo.status === 'Fechada' && !isAdminSistema) {
      alert('Somente administrador pode excluir BONA aprovado.');
      setConfirmDelete(null);
      return;
    }
    if (!isAdminSistema && !canManageEquipe(alvo.equipe)) {
      alert('Você só pode excluir BONA da sua equipe efetiva.');
      setConfirmDelete(null);
      return;
    }
    await excluirOcorrencia(id);
    setConfirmDelete(null);
    carregar();
  }

  async function handleSaveRea(data: { status: ReaStatus; dados: ReaDados }) {
    setSavingRea(true);
    try {
      if (editandoRea) {
        if (!canManageEquipe(editandoRea.equipe)) {
          alert('Você só pode editar REA da sua equipe efetiva.');
          return;
        }
        await atualizarRea(editandoRea.id, {
          numero: editandoRea.numero,
          status: data.status,
          equipe: editandoRea.equipe,
          dados: data.dados,
        });
      } else {
        if (!canManageEquipe(equipeEfetiva)) {
          alert('Você só pode criar REA quando possui equipe efetiva.');
          return;
        }
        await criarRea({
          createdBy: username,
          numero: gerarNumeroRea(reas),
          status: data.status,
          equipe: equipeEfetiva || '',
          dados: data.dados,
        });
      }
      setShowReaModal(false);
      setEditandoRea(null);
      await carregar();
    } finally {
      setSavingRea(false);
    }
  }

  async function handleDeleteRea(id: string) {
    const alvo = reas.find(r => r.id === id);
    if (!alvo || !canManageEquipe(alvo.equipe)) {
      alert('Você só pode excluir REA da sua equipe efetiva.');
      setConfirmDeleteRea(null);
      return;
    }
    await excluirRea(id);
    setConfirmDeleteRea(null);
    carregar();
  }

  async function handleDownloadRea(id: string) {
    setDownloadingReaId(id);
    try {
      const rea = await obterRea(id);
      if (!rea) throw new Error('REA nao encontrado.');
      if (rea.status !== 'Fechada') {
        alert('O PDF do REA fica disponível depois de finalizado.');
        return;
      }
      const pdf = await gerarReaPdf(rea);
      downloadPdf(pdf, nomeArquivoReaPdf(rea));
    } finally {
      setDownloadingReaId(null);
    }
  }

  async function handlePreviewRea(id: string) {
    setProcessingBonaPdfId(id);
    try {
      closeBonaPreview();
      const rea = await obterRea(id);
      if (!rea) throw new Error('REA nao encontrado.');
      const pdf = await gerarReaPdf(rea);
      setPreviewPdfData(await pdf.arrayBuffer());
      setPreviewPdfTitle(`${rea.numero || 'REA'} - ${TIPO_DOCUMENTO.REA}`);
    } finally {
      setProcessingBonaPdfId(null);
    }
  }

  async function handleApproveRea(registro: ReaRegistro) {
    if (!canManageEquipe(registro.equipe)) {
      alert('Você só pode aprovar REA da sua equipe efetiva.');
      return;
    }
    if (registro.status === 'Fechada') return;

    setApprovingBonaId(registro.id);
    try {
      const updated = await atualizarRea(registro.id, { status: 'Fechada' });
      if (updated) setReas(prev => prev.map(r => r.id === updated.id ? updated : r));
      else await carregar();
      setSuccessMsg('REA aprovado e finalizado.');
    } finally {
      setApprovingBonaId(null);
    }
  }

  function closeBonaPreview() {
    setPreviewPdfData(null);
    setPreviewPdfTitle('');
  }

  async function handlePreviewBona(ocorrencia: Ocorrencia) {
    setProcessingBonaPdfId(ocorrencia.id);
    try {
      closeBonaPreview();
      const registroDocumento = await prepararBonaParaDocumento(ocorrencia);
      const pdf = await gerarBonaPdf(registroDocumento);
      setPreviewPdfData(await pdf.arrayBuffer());
      setPreviewPdfTitle(`${ocorrencia.numero || 'BONA'} - ${TIPO_DOCUMENTO.BONA}`);
    } finally {
      setProcessingBonaPdfId(null);
    }
  }

  async function handlePrintBona(ocorrencia: Ocorrencia) {
    if (ocorrencia.status !== 'Fechada') {
      alert('Só é possível imprimir o BONA depois de aprovado.');
      return;
    }
    setProcessingBonaPdfId(ocorrencia.id);
    try {
      const registroDocumento = await prepararBonaParaDocumento(ocorrencia);
      const pdf = await gerarBonaPdf(registroDocumento);
      await imprimirPdfBlob(pdf);
    } finally {
      setProcessingBonaPdfId(null);
    }
  }

  async function handleApproveBona(ocorrencia: Ocorrencia) {
    if (!canManageEquipe(ocorrencia.equipe)) {
      alert('Você só pode aprovar BONA da sua equipe efetiva.');
      return;
    }
    if (ocorrencia.status === 'Fechada') return;

    setApprovingBonaId(ocorrencia.id);
    try {
      const updated = await atualizarOcorrencia(ocorrencia.id, { status: 'Fechada' });
      if (updated) {
        setOcorrencias(prev => prev.map(o => o.id === updated.id ? updated : o));
        if (visualizando?.id === updated.id) setVisualizando(updated);
      } else {
        await carregar();
      }
      setSuccessMsg('BONA aprovado e finalizado.');
    } finally {
      setApprovingBonaId(null);
    }
  }

  function handleEditBona(ocorrencia: Ocorrencia) {
    if (ocorrencia.status === 'Fechada' && !isAdminSistema) {
      alert('BONA aprovado não pode mais ser alterado.');
      return;
    }
    setEditando(ocorrencia);
    setSavedId(ocorrencia.id);
    setMode('form');
  }

  function openBonaForm() {
    if (!canCreate) {
      alert('Seu usuário não possui equipe efetiva para criar BONA.');
      return;
    }
    setShowNovoDocumento(false);
    setEditando(null);
    setSavedId(null);
    setMode('form');
  }

  function openReaForm(registro?: ReaRegistro | null) {
    if (registro && !canManageEquipe(registro.equipe)) {
      alert('Você só pode editar REA da sua equipe efetiva.');
      return;
    }
    if (!registro && !canCreate) {
      alert('Seu usuário não possui equipe efetiva para criar REA.');
      return;
    }
    setShowNovoDocumento(false);
    setEditandoRea(registro || null);
    setShowReaModal(true);
    setMode('list');
  }

  if (mode === 'view' && visualizando) {
    return (
      <PageContainer>
        <PageTitle icon={AlertTriangle} title={visualizando.numero} />
        <OcorrenciaView ocorrencia={visualizando} onBack={() => setMode('list')} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle icon={AlertTriangle} title="BONA/REA" />

      {successMsg && (
        <div className="mb-4 rounded-xl border border-green-300 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 dark:border-green-700 dark:bg-green-900/30 dark:text-green-400">
          {successMsg}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-xl border border-graphite-300/60 bg-white/70 text-xs font-medium dark:border-border-dark dark:bg-surface-card">
            <button onClick={() => setFilterMode('mes-ano')}
              className={`px-3 py-2 transition-colors ${filterMode === 'mes-ano' ? 'bg-aviation-600 text-white' : 'text-graphite-600 hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover'}`}>
              Mês/Ano
            </button>
            <button onClick={() => setFilterMode('periodo')}
              className={`px-3 py-2 transition-colors ${filterMode === 'periodo' ? 'bg-aviation-600 text-white' : 'text-graphite-600 hover:bg-graphite-100 dark:text-graphite-300 dark:hover:bg-surface-hover'}`}>
              Período
            </button>
          </div>
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className={inputClass}>
            <option value="">Todos os tipos</option>
            <option value="BONA">BONA</option>
            <option value="REA">REA</option>
          </select>
          {filterMode === 'mes-ano' ? (
            <>
              <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={inputClass}>
                <option value="">Todos</option>
                {ANOS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className={inputClass}>
                <option value="">Todos os meses</option>
                {MESES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </>
          ) : (
            <>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className={inputClass} placeholder="Data início" />
              <span className="text-xs text-graphite-400">a</span>
              <input type="date" value={dataFinal} onChange={e => setDataFinal(e.target.value)} className={inputClass} placeholder="Data fim" />
            </>
          )}
          <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)} className={inputClass}>
            <option value="">Todas as equipes</option>
            {EQUIPES.map(eq => <option key={eq} value={eq}>{eq}</option>)}
          </select>
        </div>
        {canCreate && (
          <button onClick={() => setShowNovoDocumento(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
            <Plus className="h-4 w-4" /> Novo Documento
          </button>
        )}
      </div>

      {documentosFiltrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <AlertTriangle className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum documento encontrado</h3>
          <p className="text-sm text-graphite-400 dark:text-graphite-500">{canCreate ? 'Clique em "Novo Documento" para criar BONA ou REA.' : 'Nenhum documento disponível.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documentosFiltrados.map(doc => doc.tipo === 'ocorrencia' ? (
            <OcorrenciaCard key={`ocorrencia-${doc.item.id}`} o={doc.item} canManage={canManageEquipe(doc.item.equipe)}
              canEditApprovedNumber={isAdminSistema}
              canDeleteApproved={isAdminSistema}
              processingPdf={processingBonaPdfId === doc.item.id}
              approving={approvingBonaId === doc.item.id}
              onView={() => { setVisualizando(doc.item); setMode('view'); }}
              onPreviewDocument={() => handlePreviewBona(doc.item)}
              onPrintDocument={() => handlePrintBona(doc.item)}
              onApprove={() => handleApproveBona(doc.item)}
              onEdit={() => handleEditBona(doc.item)}
              onDelete={() => setConfirmDelete(doc.item.id)}
            />
          ) : (
            <ReaCard key={`rea-${doc.item.id}`} rea={doc.item} canEdit={canManageEquipe(doc.item.equipe)}
              downloading={downloadingReaId === doc.item.id}
              processing={processingBonaPdfId === doc.item.id}
              approving={approvingBonaId === doc.item.id}
              onEdit={() => openReaForm(doc.item)}
              onDelete={() => setConfirmDeleteRea(doc.item.id)}
              onPreview={() => handlePreviewRea(doc.item.id)}
              onApprove={() => handleApproveRea(doc.item)}
              onDownload={() => handleDownloadRea(doc.item.id)}
            />
          ))}
        </div>
      )}

      {showNovoDocumento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated">
            <h3 className="mb-4 text-lg font-bold text-graphite-900 dark:text-graphite-100">Novo Documento</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={openBonaForm}
                className="flex items-start gap-3 rounded-xl border-2 border-graphite-200 bg-white p-4 text-left transition-all hover:border-aviation-400 dark:border-border-dark dark:bg-surface-card"
              >
                <FileText className="mt-0.5 h-5 w-5 text-aviation-600 dark:text-aviation-400" />
                <div>
                  <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">BONA</p>
                  <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">{TIPO_DOCUMENTO.BONA}</p>
                </div>
              </button>
              <button
                onClick={() => openReaForm(null)}
                className="flex items-start gap-3 rounded-xl border-2 border-graphite-200 bg-white p-4 text-left transition-all hover:border-aviation-400 dark:border-border-dark dark:bg-surface-card"
              >
                <FileText className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">REA</p>
                  <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">{TIPO_DOCUMENTO.REA}</p>
                </div>
              </button>
            </div>
            <div className="mt-5 flex justify-end">
              <button onClick={() => setShowNovoDocumento(false)}
                className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {mode === 'form' && (
        <OcorrenciaForm
          ocorrencia={editando || undefined}
          userEquipe={equipeEfetiva || ''}
          todas={ocorrencias}
          canManageGlobal={canManageGlobal}
          isAdminSistema={isAdminSistema}
          onSave={handleSave}
          onSelectRea={() => openReaForm(null)}
          onCancel={() => { setMode('list'); setEditando(null); setSavedId(null); }}
        />
      )}

      {showReaModal && (
        <ReaModal
          registro={editandoRea}
          numero={editandoRea?.numero || gerarNumeroRea(reas)}
          saving={savingRea}
          onSave={handleSaveRea}
          onSelectBona={() => { setShowReaModal(false); setEditandoRea(null); openBonaForm(); }}
          onCancel={() => { setShowReaModal(false); setEditandoRea(null); }}
        />
      )}

      {previewPdfData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl shadow-black/10 dark:bg-surface-elevated">
            <div className="flex items-center justify-between gap-3 border-b border-graphite-200/70 px-5 py-4 dark:border-border-dark">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-graphite-900 dark:text-graphite-100">{previewPdfTitle || 'BONA'}</h3>
                <p className="text-xs text-graphite-500 dark:text-graphite-400">Visualizacao do documento</p>
              </div>
              <button
                onClick={closeBonaPreview}
                className="shrink-0 rounded-lg p-1.5 text-graphite-500 transition-colors hover:bg-graphite-100 hover:text-graphite-800 dark:text-graphite-300 dark:hover:bg-surface-hover"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-graphite-100/60 p-4 dark:bg-surface-card/40">
              <PdfPreview pdfData={previewPdfData} fields={[]} />
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            <p className="mb-6 text-sm text-graphite-500 dark:text-graphite-400">Tem certeza que deseja excluir este documento?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)}
                className="rounded-xl bg-gradient-to-r from-alert-red to-red-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all hover:shadow-xl hover:shadow-red-500/30 active:scale-[0.98]">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteRea && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated">
            <h3 className="mb-2 text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusao</h3>
            <p className="mb-6 text-sm text-graphite-500 dark:text-graphite-400">Tem certeza que deseja excluir este REA?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeleteRea(null)}
                className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
              <button onClick={() => handleDeleteRea(confirmDeleteRea)}
                className="rounded-xl bg-gradient-to-r from-alert-red to-red-700 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all hover:shadow-xl hover:shadow-red-500/30 active:scale-[0.98]">Excluir</button>
            </div>
          </div>
        </div>
      )}
      <PageTour
        steps={BONA_REA_TOUR_STEPS}
        targetAttribute="data-bona-rea-tour"
        title="Abrir tutorial de BONA/REA"
        detailLabel="Documento formal"
      />
    </PageContainer>
  );
}

export default Ocorrencias;
