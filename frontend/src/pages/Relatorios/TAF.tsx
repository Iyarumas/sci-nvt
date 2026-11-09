import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Trash2, Save, X, Target,
  AlertTriangle, Users, Lock, Download,
  CheckCircle2, Eye, Pencil, Ban, Mail, RefreshCw, Signature,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { SearchSelect, type AtivoItem } from '../../components/ui/SearchSelect';
import { PdfPreview } from '../../components/documentos/PdfPreview';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarAtivos } from '../../services/bombeiroService';
import { resolverEfetivoOperacional } from '../../services/efetivoOperacionalService';
import { listarTAFs, criarTAF, atualizarTAF, excluirTAF, obterProximoNumero } from '../../services/tafService';
import { baixarTAFPdf, gerarTAFPdf, nomeArquivoTAFPdf } from '../../services/tafPdfService';
import type { TAFInput, TreinamentoTAF } from '../../types/taf';
import type { Bombeiro } from '../../types/bombeiro';
import { formatarDataBR, hojeLocalISO } from '../../utils/datas';
import { TEMPO_CRONOMETRO_ZERO, mascararTempoCronometro } from '../../utils/tempo';
import { PageTour } from '../../components/ui/PageTour';
import { resumoAuditoria } from '../../utils/auditoria';
import {
  atualizarEnvioAssinatura,
  baixarPdfAssinado,
  cancelarEnvioAssinatura,
  enviarParaAssinatura,
  listarEnviosAssinatura,
  obterPdfAssinado,
  previaEnvioAssinatura,
  reenviarAvisosAssinatura,
  type EnvioAssinatura,
  type PreviaSignatario,
} from '../../services/autentiqueEnviosService';
import { CelulaAssinatura, ConfirmarEnvioModal, SeloAssinatura, bordaAssinatura, funcoesVisiveis, situacaoAssinatura } from '../RegistrosDiarios/PTRBAAssinaturas';

/**
 * TAF a partir deste treinamento vai para assinatura pelo Autentique: todos os participantes
 * assinam na linha deles e o chefe de equipe e o gestor também no rodapé. Fica Assinado sozinho
 * quando todos assinarem. Não existe mais o Aprovar manual (igual ao PTR-BA).
 */
const INICIO_ASSINATURA_TAF = '2026-11-08';
function vaiPelaAssinatura(data: string) {
  return !!data && data.slice(0, 10) >= INICIO_ASSINATURA_TAF;
}

const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta'] as const;
const TIPO_TAF = ['TAF-1', 'TAF-2'];
const SLOTS = [
  { i: 1, label: 'BA-CE', cargo: 'BA-CE' }, { i: 2, label: 'BA-LR', cargo: 'BA-LR' },
  { i: 3, label: 'BA-MC', cargo: 'BA-MC' }, { i: 4, label: 'BA-MC', cargo: 'BA-MC' }, { i: 5, label: 'BA-MC', cargo: 'BA-MC' },
  { i: 6, label: 'BA-2', cargo: 'BA-2' }, { i: 7, label: 'BA-2', cargo: 'BA-2' }, { i: 8, label: 'BA-2', cargo: 'BA-2' },
  { i: 9, label: 'BA-2', cargo: 'BA-2' }, { i: 10, label: 'BA-2', cargo: 'BA-2' },
] as const;

const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark';
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

const TAF_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'TAF',
    body: 'Esta página registra e consulta o Teste de Aptidão Física das equipes.',
    detail: 'Cada registro tem número/ano, equipe, tipo TAF, data, hora, turno, participantes, função, idade, tempo, observações e status.',
  },
  {
    selector: 'main button',
    title: 'Novo TAF',
    body: 'O botão Novo TAF abre o formulário de lançamento.',
    detail: 'O sistema separa slots por função operacional e permite selecionar bombeiros da equipe. Confira cada pessoa antes de aprovar.',
  },
  {
    selector: 'main input, main select',
    title: 'Filtros da lista',
    body: 'Pesquise por registro e filtre por equipe e ano.',
    detail: 'Use para encontrar TAFs de um ciclo específico ou de uma equipe.',
  },
  {
    selector: 'main .space-y-2',
    title: 'Cards de TAF',
    body: 'Cada card mostra número/ano, equipe, tipo, data, turno e status: rascunho, aguardando assinaturas ou assinado.',
    detail: 'Ao expandir, aparecem participantes, funções, idades e tempos registrados.',
  },
  {
    selector: 'main input, main [role="combobox"]',
    title: 'Participantes e tempos',
    body: 'No formulário, selecione cada bombeiro por função e informe o tempo no formato do cronômetro.',
    detail: 'Evite duplicar participantes. O tempo é o dado central do TAF e precisa ser conferido antes de salvar ou aprovar.',
  },
  {
    selector: 'main button[title="Ver documento"], main button[title="Baixar PDF"], main button',
    title: 'Assinatura e PDF',
    body: 'Rascunhos podem ser editados e aprovados. Depois da aprovação, o documento pode ser visualizado e baixado em PDF.',
    detail: 'Salve o TAF e use "Enviar para assinatura": quando todos assinarem ele fica Assinado sozinho. Revise os tempos antes de enviar.',
  },
];

function fmt(d: string) { return formatarDataBR(d); }

function mensagemErro(err: unknown) {
  return err instanceof Error ? err.message : 'Erro inesperado';
}

function encontrarBombeiroPorNome(bombeiros: Bombeiro[], nome: string) {
  const normalizado = nome.trim().toLocaleLowerCase('pt-BR');
  return bombeiros.find(b =>
    b.nomeCompleto.toLocaleLowerCase('pt-BR') === normalizado ||
    b.nomeGuerra.toLocaleLowerCase('pt-BR') === normalizado
  );
}

type TafPessoaForm = { pessoaId: string; nome: string; nomeGuerra: string; funcao: string; idade: number; tempo: string };
type TafSlot = typeof SLOTS[number];

function criarPessoasTAFVazias(): TafPessoaForm[] {
  return Array.from({ length: 10 }, () => ({ pessoaId: '', nome: '', nomeGuerra: '', funcao: '', idade: 0, tempo: TEMPO_CRONOMETRO_ZERO }));
}

function pessoasDoRegistro(registro: TreinamentoTAF, bombeiros: Bombeiro[]): TafPessoaForm[] {
  return Array.from({ length: 10 }, (_, index) => {
    const slot = index + 1;
    const data = registro as unknown as Record<string, string | number>;
    const nome = String(data[`p${slot}Nome`] || '');
    const bombeiro = encontrarBombeiroPorNome(bombeiros, nome);
    return {
      pessoaId: bombeiro?.id || '',
      nome: bombeiro?.nomeCompleto || nome,
      nomeGuerra: bombeiro?.nomeGuerra || nome,
      funcao: String(data[`p${slot}Funcao`] || ''),
      idade: Number(data[`p${slot}Idade`] || bombeiro?.idade || 0),
      tempo: String(data[`p${slot}Tempo`] || ''),
    };
  });
}

function pessoaPreenchida(pessoa: TafPessoaForm) {
  return !!(pessoa.pessoaId || pessoa.nome || pessoa.nomeGuerra);
}

function moverCursorParaFim(event: { currentTarget: HTMLInputElement }) {
  const input = event.currentTarget;
  requestAnimationFrame(() => {
    input.setSelectionRange(input.value.length, input.value.length);
  });
}

function SlotLinha({
  idx,
  slot,
  pessoa,
  selectedIds,
  options,
  onSelectPessoa,
  onTempoChange,
  onClearPessoa,
}: {
  idx: number;
  slot: TafSlot;
  pessoa: TafPessoaForm;
  selectedIds: Set<string>;
  options: AtivoItem[];
  onSelectPessoa: (idx: number, nomeSelecionado: string, funcao: string) => void;
  onTempoChange: (idx: number, tempo: string) => void;
  onClearPessoa: (idx: number) => void;
}) {
  return (
    <div className="rounded-xl border border-graphite-200/60 bg-white/80 p-3 dark:border-border-dark dark:bg-surface-card/80">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-aviation-50 text-xs font-black text-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">{idx + 1}</span>
        <span className="rounded-lg border border-graphite-200 bg-graphite-50 px-2 py-1 text-xs font-bold text-graphite-700 dark:border-border-dark dark:bg-surface-hover dark:text-graphite-200">{slot.label}</span>
        {pessoa.nome && (
          <span className="min-w-0 truncate text-xs text-graphite-500 dark:text-graphite-400">{pessoa.nome}</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(72px,0.35fr)_minmax(96px,0.45fr)_auto]">
        <div className="min-w-0">
          <label className={labelCls}>Bombeiro</label>
          <SearchSelect
            value={pessoa.nomeGuerra || pessoa.nome}
            onChange={v => onSelectPessoa(idx, v, slot.cargo)}
            cargo={slot.cargo}
            options={options}
            valueField="nomeGuerra"
            showCargo
            showEquipe
            displayMode="operational"
            disabledIds={selectedIds}
            placeholder="Selecione o bombeiro"
          />
        </div>
        <div>
          <label className={labelCls}>Idade</label>
          <input value={pessoa.idade || ''} disabled className={`${inputCls} opacity-60`} />
        </div>
        <div>
          <label className={labelCls}>Tempo</label>
          <input
            type="text"
            value={pessoa.tempo || TEMPO_CRONOMETRO_ZERO}
            onChange={e => onTempoChange(idx, mascararTempoCronometro(e.target.value))}
            onFocus={moverCursorParaFim}
            onClick={moverCursorParaFim}
            inputMode="numeric"
            placeholder="MM:SS"
            className="w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-center text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100"
          />
        </div>
        <button
          type="button"
          onClick={() => onClearPessoa(idx)}
          className="mt-6 self-start rounded-xl p-2 text-red-400 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
          title="Limpar participante"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function TAF() {
  const { user, contexto, canManageGlobal, canManageEquipe, equipeEfetiva, canVisualizarRelatorios, loadingContexto } = useContextoOperacional();
  const location = useLocation();
  const isRelatorioRoute = location.pathname.startsWith('/relatorios');
  const canCreate = canManageGlobal || !!equipeEfetiva;
  const isAdminSistema = contexto.isAdministradorSistema;
  const currentUsername = user?.username || user?.name || '';
  const currentName = user?.name || user?.username || '';
  const [registros, setRegistros] = useState<TreinamentoTAF[]>([]);
  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [search, setSearch] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  // Mês do treinamento ('' = todos os meses do ano).
  const [filtroMes, setFiltroMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<TreinamentoTAF | null>(null);
  const [savingAction, setSavingAction] = useState<'draft' | 'approve' | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewPdfData, setPreviewPdfData] = useState<ArrayBuffer | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [opcoesParticipantes, setOpcoesParticipantes] = useState<AtivoItem[]>([]);

  const [fEquipe, setFEquipe] = useState('');
  const [fNumero, setFNumero] = useState(0);
  const [fAno, setFAno] = useState('');
  const [fData, setFData] = useState('');
  const [fHora, setFHora] = useState('');
  const [fTurno, setFTurno] = useState('');
  const [fTipo, setFTipo] = useState('');

  const [fPessoas, setFPessoas] = useState<TafPessoaForm[]>(
    criarPessoasTAFVazias()
  );
  const [fObs, setFObs] = useState('');
  const [fChefeEquipe, setFChefeEquipe] = useState('');
  const saving = savingAction !== null;
  const [envios, setEnvios] = useState<Record<string, EnvioAssinatura>>({});
  const [envioRegistro, setEnvioRegistro] = useState<TreinamentoTAF | null>(null);
  const [previaEnvio, setPreviaEnvio] = useState<PreviaSignatario[] | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [acaoEnvioId, setAcaoEnvioId] = useState<string | null>(null);

  async function carregarEnvios() {
    try {
      const lista = await listarEnviosAssinatura('taf');
      setEnvios(Object.fromEntries(lista.map(envio => [envio.referenciaId, envio])));
    } catch {
      // Sem o status das assinaturas, a lista continua funcionando.
    }
  }

  // Assinaturas aparecendo sozinhas: com TAF aguardando, confere a cada 30 s no nosso servidor.
  const temAguardando = Object.values(envios).some(envio => envio.status === 'aguardando');
  useEffect(() => {
    if (!temAguardando) return;
    const conferir = () => { if (document.visibilityState === 'visible') void carregar(); };
    const intervalo = window.setInterval(conferir, 30_000);
    document.addEventListener('visibilitychange', conferir);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener('visibilitychange', conferir);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temAguardando, filtroAno]);

  const equipesFormulario = useMemo(() => {
    if (canManageGlobal) return [...EQUIPES];
    return equipeEfetiva ? [equipeEfetiva] : [];
  }, [canManageGlobal, equipeEfetiva]);

  useEffect(() => {
    if (isRelatorioRoute && loadingContexto) return;
    if (isRelatorioRoute && !canVisualizarRelatorios) return;
    listarAtivos().then(setBombeiros);
    carregar();
  }, [isRelatorioRoute, canVisualizarRelatorios, loadingContexto]);

  useEffect(() => { carregar(); }, [filtroAno]);

  async function carregar() {
    void carregarEnvios();
    setRegistros(await listarTAFs({ ano: filtroAno }));
  }

  const filtered = useMemo(() => {
    let l = registros;
    if (filtroEquipe) l = l.filter(r => r.equipe === filtroEquipe);
    if (filtroMes) l = l.filter(r => String(r.data || '').slice(5, 7) === filtroMes);
    if (search) { const s = search.toLowerCase(); l = l.filter(r => `${String(r.numero).padStart(3,'0')}/${r.ano}`.includes(s) || r.equipe.toLowerCase().includes(s) || r.tipoTaf.toLowerCase().includes(s)); }
    return l;
  }, [registros, search, filtroEquipe, filtroMes]);

  const stats = useMemo(() => ({ total: registros.length }), [registros]);

  function registroAprovado(registro?: Pick<TreinamentoTAF, 'status'> | null) {
    return registro?.status === 'Aprovado';
  }

  function canAlterarRegistro(registro: TreinamentoTAF) {
    // Enviado para assinatura: não muda mais (para corrigir, um administrador cancela o envio).
    if (envios[registro.id]) return false;
    return registroAprovado(registro) ? isAdminSistema : canManageEquipe(registro.equipe);
  }

  function mensagemBloqueioRegistro(registro: TreinamentoTAF) {
    if (envios[registro.id]) return 'Este TAF ja foi enviado para assinatura e nao pode mais ser alterado.';
    return registroAprovado(registro)
      ? 'Este TAF ja foi assinado. Somente administradores e desenvolvedores podem alterar.'
      : 'Voce so pode alterar treinamentos da sua equipe efetiva.';
  }

  function canGerarPdf(registro: TreinamentoTAF) {
    return registroAprovado(registro) || envios[registro.id]?.status === 'assinado';
  }

  function setP(idx: number, field: keyof TafPessoaForm, val: any) {
    setFPessoas(prev => { const n = [...prev]; n[idx] = { ...n[idx], [field]: val }; return n; });
  }

  function onSelectPessoa(idx: number, nomeSelecionado: string, funcao: string) {
    const opcao = opcoesParticipantes.find(item => item.nomeGuerra === nomeSelecionado || item.nomeCompleto === nomeSelecionado);
    const b = (opcao ? bombeiros.find(item => item.id === opcao.id) : undefined) || encontrarBombeiroPorNome(bombeiros, nomeSelecionado);
    setP(idx, 'pessoaId', b?.id || opcao?.id || '');
    setP(idx, 'nome', b?.nomeCompleto || opcao?.nomeCompleto || nomeSelecionado);
    setP(idx, 'nomeGuerra', b?.nomeGuerra || opcao?.nomeGuerra || nomeSelecionado);
    setP(idx, 'funcao', funcao);
    setP(idx, 'idade', b?.idade || 0);
  }

  function limparPessoa(idx: number) {
    setFPessoas(prev => {
      const next = [...prev];
      next[idx] = { pessoaId: '', nome: '', nomeGuerra: '', funcao: '', idade: 0, tempo: TEMPO_CRONOMETRO_ZERO };
      return next;
    });
  }

  function resetForm() {
    const equipePadrao = canManageGlobal ? '' : equipeEfetiva || '';
    setFEquipe(equipePadrao); setFNumero(0); setFAno(''); setFData(''); setFHora(''); setFTurno(turnoAuto(equipePadrao)); setFTipo('');
    setFPessoas(criarPessoasTAFVazias());
    setOpcoesParticipantes([]);
    setFObs('');
    setFChefeEquipe('');
  }

  function turnoAuto(equipe: string) { return equipe === 'Alfa' || equipe === 'Charlie' ? 'Diurno' : equipe === 'Bravo' || equipe === 'Delta' ? 'Noturno' : ''; }

  async function autoPreencherParticipantes(preencherMembros = true) {
    if (!fEquipe || !fData) return;
    try {
      const efetivo = await resolverEfetivoOperacional(fEquipe, fData, { aplicarTrocas: false });
      const pool = efetivo
        .map(item => ({
          id: item.bombeiro.id,
          nomeCompleto: item.bombeiro.nomeCompleto || item.bombeiro.nome || item.bombeiro.nomeGuerra,
          nomeGuerra: item.bombeiro.nomeGuerra,
          idade: item.bombeiro.idade,
          cargo: item.cargoExercido,
        }));

      setOpcoesParticipantes(pool.map(b => ({
        id: b.id,
        nomeGuerra: b.nomeGuerra,
        nomeCompleto: b.nomeCompleto,
        cargo: b.cargo,
        equipe: fEquipe,
      })));
      const baCe = pool.find(b => b.cargo === 'BA-CE');
      if (preencherMembros) setFChefeEquipe(baCe ? baCe.nomeCompleto || baCe.nomeGuerra || '' : '');
      if (!preencherMembros) return;

      const usado = new Set<string>();
      const buscar = (cargo: string) => {
        const idx = pool.findIndex(b => b.cargo === cargo && !usado.has(b.id));
        if (idx === -1) return null;
        usado.add(pool[idx].id);
        return pool[idx];
      };

      function setSlot(idx: number, b: typeof pool[number], cargo: string) {
        setP(idx, 'pessoaId', b?.id || '');
        setP(idx, 'nome', b?.nomeCompleto || b?.nomeGuerra || '');
        setP(idx, 'nomeGuerra', b?.nomeGuerra || '');
        setP(idx, 'funcao', cargo);
        setP(idx, 'idade', b?.idade || 0);
      }

      // 1 BA-CE
      const ce = buscar('BA-CE');
      if (ce) { setSlot(0, ce, 'BA-CE'); } else { const q = pool.find(b => !usado.has(b.id)); if (q) { setSlot(0, q, 'BA-CE'); usado.add(q.id); } }

      // 2 BA-LR
      const lr = buscar('BA-LR');
      if (lr) { setSlot(1, lr, 'BA-LR'); } else { const q = pool.find(b => !usado.has(b.id)); if (q) { setSlot(1, q, 'BA-LR'); usado.add(q.id); } }

      // 3 BA-MC
      for (let i = 0; i < 3; i++) {
        const mc = buscar('BA-MC');
        if (mc) { setSlot(2 + i, mc, 'BA-MC'); } else { const q = pool.find(b => !usado.has(b.id)); if (q) { setSlot(2 + i, q, 'BA-MC'); usado.add(q.id); } }
      }

      // 5 BA-2
      for (let i = 0; i < 5; i++) {
        const b2 = buscar('BA-2');
        if (b2) { setSlot(5 + i, b2, 'BA-2'); } else { const q = pool.find(b => !usado.has(b.id)); if (q) { setSlot(5 + i, q, 'BA-2'); usado.add(q.id); } }
      }
    } catch { /* silencioso */ }
  }

  useEffect(() => {
    if (formOpen && fEquipe && fData) {
      const devePreencher = !editando || fEquipe !== editando.equipe || fData !== editando.data;
      autoPreencherParticipantes(devePreencher);
    }
  }, [fEquipe, fData, formOpen, editando]);

  async function handleNovo() {
    if (!canCreate) {
      alert('Você precisa ter uma equipe efetiva para criar treinamentos.');
      return;
    }
    resetForm();
    setEditando(null);
    const a = new Date().getFullYear().toString();
    setFAno(a); setFData(hojeLocalISO()); setFHora(new Date().toTimeString().slice(0, 5));
    setFormOpen(true);
    setFNumero(await obterProximoNumero(a));
  }

  function handleEditar(r: TreinamentoTAF) {
    if (!canAlterarRegistro(r)) {
      alert(mensagemBloqueioRegistro(r));
      return;
    }
    setEditando(r);
    setFEquipe(r.equipe); setFNumero(r.numero); setFAno(r.ano); setFData(r.data); setFHora(r.hora); setFTurno(r.turno); setFTipo(r.tipoTaf);
    setFPessoas(pessoasDoRegistro(r, bombeiros).map(pessoa => ({
      ...pessoa,
      tempo: mascararTempoCronometro(pessoa.tempo),
    })));
    setFObs(r.observacoes);
    setFChefeEquipe(r.chefeEquipe || '');
    setFormOpen(true);
  }

  async function handleSalvar(aprovar = false) {
    const equipeAlvo = canManageGlobal ? fEquipe : equipeEfetiva || '';
    if (!equipeAlvo || !fData || !fTipo) return;
    if (editando && !canAlterarRegistro(editando)) {
      alert(mensagemBloqueioRegistro(editando));
      return;
    }
    if (!canManageEquipe(equipeAlvo)) {
      alert('Voce so pode salvar treinamentos da sua equipe efetiva.');
      return;
    }
    setSavingAction(aprovar ? 'approve' : 'draft');
    try {
      const data = {
        equipe: equipeAlvo,
        numero: fNumero,
        ano: fAno,
        data: fData,
        hora: fHora,
        turno: turnoAuto(equipeAlvo),
        tipoTaf: fTipo,
        observacoes: fObs,
        chefeEquipe: fChefeEquipe || user?.name || '',
        createdBy: editando?.createdBy || currentUsername,
      } as TAFInput;
      if (editando) data.updatedBy = currentUsername;
      if (aprovar) {
        data.status = 'Aprovado';
        data.aprovadoPor = currentUsername;
        data.aprovadoPorNome = currentName;
        data.aprovadoEm = new Date().toISOString();
      }
      for (let i = 0; i < 10; i++) {
        (data as any)[`p${i+1}Nome`] = fPessoas[i].nome; (data as any)[`p${i+1}Funcao`] = fPessoas[i].funcao; (data as any)[`p${i+1}Idade`] = fPessoas[i].idade; (data as any)[`p${i+1}Tempo`] = mascararTempoCronometro(fPessoas[i].tempo);
      }
      if (editando) { await atualizarTAF(editando.id, data); } else { await criarTAF(data); }
      await carregar(); setFormOpen(false);
    } catch (err) { alert('Erro: ' + (err instanceof Error ? err.message : 'Erro')); } finally { setSavingAction(null); }
  }

  async function handleExcluir(id: string) {
    const registro = registros.find(r => r.id === id);
    if (registro && !canAlterarRegistro(registro)) {
      alert(mensagemBloqueioRegistro(registro));
      setDeleteConfirm(null);
      return;
    }
    await excluirTAF(id);
    await carregar();
    setDeleteConfirm(null);
  }

  async function handleDownload(registro: TreinamentoTAF) {
    if (!canGerarPdf(registro)) {
      alert('Aprove este TAF antes de gerar o PDF.');
      return;
    }

    try {
      setDownloadingId(registro.id);
      const envio = envios[registro.id];
      if (envio?.status === 'assinado' && envio.temPdfAssinado) {
        await baixarPdfAssinado(envio.id, nomeArquivoTAFPdf(registro).replace(/\.pdf$/i, ' ASSINADO.pdf'), 'primeiraPagina');
      } else {
        await baixarTAFPdf(prepararRegistroPdf(registro));
      }
    } catch (err) {
      alert('Erro ao gerar PDF do TAF: ' + mensagemErro(err));
    } finally {
      setDownloadingId(null);
    }
  }

  function prepararRegistroPdf(registro: TreinamentoTAF) {
    const registroComNomesCompletos = { ...registro } as TreinamentoTAF;
    pessoasDoRegistro(registro, bombeiros).forEach((pessoa, index) => {
      (registroComNomesCompletos as any)[`p${index + 1}Nome`] = pessoa.nome;
      (registroComNomesCompletos as any)[`p${index + 1}Idade`] = pessoa.idade;
    });
    return registroComNomesCompletos;
  }

  async function handlePreviewPdf(registro: TreinamentoTAF) {
    try {
      setPreviewingId(registro.id);
      const registroPdf = prepararRegistroPdf(registro);
      // Com alguém já assinado mostra o PDF do Autentique (com as assinaturas feitas até agora).
      const envio = envios[registro.id];
      const pdf = envio?.temPdfAssinado ? await obterPdfAssinado(envio.id) : await gerarTAFPdf(registroPdf);
      setPreviewPdfData(await pdf.arrayBuffer());
      setPreviewPdfTitle(nomeArquivoTAFPdf(registroPdf).replace(/\.pdf$/i, ''));
    } catch (err) {
      alert('Erro ao visualizar PDF do TAF: ' + mensagemErro(err));
    } finally {
      setPreviewingId(null);
    }
  }

  async function abrirEnvio(registro: TreinamentoTAF) {
    setErroEnvio(null);
    setPreviaEnvio(null);
    setEnvioRegistro(registro);
    try {
      setPreviaEnvio(await previaEnvioAssinatura({ tipo: 'taf', referenciaId: registro.id }));
    } catch (err) {
      setErroEnvio(mensagemErro(err));
      setPreviaEnvio([]);
    }
  }

  async function confirmarEnvio() {
    const registro = envioRegistro;
    if (!registro) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      const registroPdf = prepararRegistroPdf(registro);
      const pdf = await gerarTAFPdf(registroPdf);
      await enviarParaAssinatura({ tipo: 'taf', referenciaId: registro.id, pdf, nomeArquivo: nomeArquivoTAFPdf(registroPdf) });
      setEnvioRegistro(null);
      await carregar();
    } catch (err) {
      setErroEnvio(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  async function atualizarEnvio(envio: EnvioAssinatura) {
    setAcaoEnvioId(envio.id);
    try {
      await atualizarEnvioAssinatura(envio.id);
      await carregar();
    } catch (err) {
      alert('Erro ao atualizar as assinaturas: ' + mensagemErro(err));
    } finally {
      setAcaoEnvioId(null);
    }
  }

  async function reenviarEnvio(envio: EnvioAssinatura) {
    setAcaoEnvioId(envio.id);
    try {
      const { reenviados } = await reenviarAvisosAssinatura(envio.id);
      alert(`Aviso reenviado por e-mail para ${reenviados} pessoa(s) que ainda nao assinaram.`);
    } catch (err) {
      alert('Erro ao reenviar os avisos: ' + mensagemErro(err));
    } finally {
      setAcaoEnvioId(null);
    }
  }

  async function cancelarEnvio(envio: EnvioAssinatura) {
    const ok = window.confirm(
      'Tem certeza que deseja cancelar o envio deste TAF?\n\n'
      + '- Ninguem mais conseguira assinar pelos links ja enviados.\n'
      + '- As assinaturas ja feitas deixam de valer.\n'
      + '- O TAF volta a ser rascunho, para corrigir e enviar de novo.',
    );
    if (!ok) return;
    try {
      await cancelarEnvioAssinatura(envio.id);
      await carregar();
    } catch (err) {
      alert('Erro ao cancelar o envio: ' + mensagemErro(err));
    }
  }

  if (isRelatorioRoute && loadingContexto) {
    return <PageContainer><div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" /></div></PageContainer>;
  }

  if (isRelatorioRoute && !canVisualizarRelatorios) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Lock className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Acesso restrito</h3>
          <p className="text-sm text-graphite-400 dark:text-graphite-500">A tela de relatórios está disponível apenas para GS e administradores do sistema.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle icon={Target} title="TAF - Teste de Aptidão Física" />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-aviation-200 bg-aviation-50 px-4 py-2 text-center dark:border-aviation-800 dark:bg-aviation-900/20">
              <p className="text-xl font-black text-aviation-700 dark:text-aviation-300">{stats.total}</p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-aviation-500">{filtroAno}</p>
            </div>
          </div>
          {canCreate && (
            <button onClick={handleNovo}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:shadow-xl active:scale-[0.98]">
              <Plus className="h-4 w-4" /> Novo TAF
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar..." className={`${inputCls} !pl-10`} />
          </div>
          <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)} className={`${inputCls} !w-auto`}>
            <option value="">Todas</option>
            {EQUIPES.map(eq => <option key={eq} value={eq}>{eq}</option>)}
          </select>
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)} className={`${inputCls} !w-auto`} aria-label="Mês">
            <option value="">Todos os meses</option>
            {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((nome, i) => <option key={nome} value={String(i + 1).padStart(2, '0')}>{nome}</option>)}
          </select>
          <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={`${inputCls} !w-auto`}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(a => <option key={a} value={a.toString()}>{a}</option>)}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card/50">
            <Target className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
            <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum TAF registado</h3>
            <p className="text-sm text-graphite-400 dark:text-graphite-500">Clique em "Novo TAF" para criar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => {
              const participantes = pessoasDoRegistro(r, bombeiros).filter(pessoaPreenchida);
              const expandido = expandidoId === r.id;
              const aprovado = registroAprovado(r);
              const podeAlterar = canAlterarRegistro(r);
              const podeGerarPdf = canGerarPdf(r);
              const envio = envios[r.id];
              const pelaAssinatura = vaiPelaAssinatura(r.data);
              const borda = envio ? bordaAssinatura(situacaoAssinatura(envio)) : null;
              const etiqueta = envio?.status === 'assinado' ? { texto: 'Assinado', cor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' }
                : envio?.status === 'aguardando' ? { texto: 'Aguardando', cor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' }
                  : envio?.status === 'recusado' ? { texto: 'Recusado', cor: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' }
                    : aprovado ? { texto: 'Assinado', cor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' }
                      : { texto: 'Rascunho', cor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
              return (
                <div key={r.id} className="space-y-2">
              <div className={`flex items-center justify-between gap-3 rounded-2xl p-4 transition-all hover:shadow-md dark:bg-surface-card ${borda ? `border-2 ${borda} bg-white` : 'border border-graphite-200/60 bg-white/80 dark:border-border-dark'}`}>
                <button
                  type="button"
                  onClick={() => setExpandidoId(expandido ? null : r.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aviation-500 to-aviation-700 text-sm font-bold text-white">{r.equipe.charAt(0)}</div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-bold text-graphite-900 dark:text-graphite-100">{String(r.numero).padStart(3,'0')}/{r.ano} · {r.equipe} · {r.tipoTaf}</p>
                    </div>
                    <p className="text-xs text-graphite-500 dark:text-graphite-400 truncate">{fmt(r.data)} {r.hora && `às ${r.hora}`} · {r.turno}</p>
                    <p className="text-xs text-graphite-500 dark:text-graphite-400 truncate">{resumoAuditoria(r, bombeiros)}</p>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-2 self-center">
                  {envio && <SeloAssinatura envio={envio} />}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${etiqueta.cor}`}>
                    {etiqueta.texto}
                  </span>
                </div>
              </div>

              {expandido && (
                <div className="rounded-2xl border border-graphite-200/60 bg-white/80 p-3 dark:border-border-dark dark:bg-surface-card">
                  {participantes.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-graphite-200 bg-graphite-50 px-3 py-2 text-xs text-graphite-500 dark:border-border-dark dark:bg-surface-hover dark:text-graphite-400">
                      Sem participantes preenchidos.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {participantes.map((pessoa, index) => (
                        <div key={`${r.id}-${index}`} className="grid grid-cols-1 items-center gap-2 rounded-xl border border-graphite-200/60 bg-graphite-50/70 px-3 py-2 text-xs dark:border-border-dark dark:bg-surface-hover/70 md:grid-cols-[36px_90px_minmax(0,1fr)_70px_80px]">
                          <span className="font-black text-aviation-700 dark:text-aviation-300">{index + 1}</span>
                          <span className="font-bold text-graphite-700 dark:text-graphite-200">{pessoa.funcao || '-'}</span>
                          <span className="min-w-0 truncate font-semibold text-graphite-900 dark:text-graphite-100">{pessoa.nome || '-'}</span>
                          <span className="text-graphite-500 dark:text-graphite-400">Idade: {pessoa.idade || '-'}</span>
                          <span className="font-semibold text-aviation-700 dark:text-aviation-300">{pessoa.tempo || '-'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {envio && (
                    <div className="mt-3 rounded-xl border border-graphite-200/60 bg-white p-3 dark:border-border-dark dark:bg-surface-card">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-graphite-400 dark:text-graphite-500">Assinaturas</span>
                      <div className="mt-1 divide-y divide-graphite-100 dark:divide-border-dark">
                        {envio.signatarios.map(signatario => (
                          <div key={signatario.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                            <span className="text-graphite-800 dark:text-graphite-100">
                              <span className="font-semibold">{funcoesVisiveis(signatario.funcoes)}</span> · {signatario.nome}
                            </span>
                            <CelulaAssinatura envioId={envio.id} signatario={signatario} documento="TAF" />
                          </div>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-graphite-500 dark:text-graphite-400">
                        Enviado por {envio.enviadoPorNome || '-'} em {new Date(envio.enviadoEm).toLocaleString('pt-BR')}. Fica assinado quando todos assinarem.
                      </p>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-graphite-200/60 pt-3 dark:border-border-dark">
                    <button type="button" onClick={() => void handlePreviewPdf(r)} disabled={previewingId === r.id} className="flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-4 py-2.5 text-sm font-semibold text-aviation-700 transition-all hover:bg-aviation-50 disabled:opacity-60 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300" title="Ver documento">
                      <Eye className="h-4 w-4" /> {previewingId === r.id ? 'Abrindo documento' : 'Ver documento'}
                    </button>
                    {podeGerarPdf && (
                      <button type="button" onClick={() => handleDownload(r)} disabled={downloadingId === r.id} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600 disabled:opacity-60" title="Baixar PDF">
                        <Download className="h-4 w-4" /> {downloadingId === r.id ? 'Gerando PDF' : envio?.status === 'assinado' && envio.temPdfAssinado ? 'Download PDF assinado' : 'Download PDF'}
                      </button>
                    )}
                    {podeAlterar && (
                      <>
                        <button type="button" onClick={() => handleEditar(r)} className="flex items-center gap-2 rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2.5 text-sm font-semibold text-graphite-700 transition-all hover:bg-graphite-50 disabled:opacity-60 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200" title="Editar">
                          <Pencil className="h-4 w-4" /> Editar
                        </button>
                        <button type="button" onClick={() => setDeleteConfirm(r.id)} className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-alert-red transition-all hover:bg-red-500/15" title="Excluir">
                          <Trash2 className="h-4 w-4" /> Excluir
                        </button>
                      </>
                    )}
                    {!envio && !aprovado && pelaAssinatura && podeAlterar && (
                      <button type="button" onClick={() => void abrirEnvio(r)} className="flex items-center gap-2 rounded-xl border border-aviation-500/40 bg-aviation-500/10 px-4 py-2.5 text-sm font-semibold text-aviation-700 transition-all hover:bg-aviation-500/15 dark:text-aviation-300">
                        <Signature className="h-4 w-4" /> Enviar para assinatura
                      </button>
                    )}
                    {envio?.status === 'aguardando' && (
                      <button type="button" onClick={() => void atualizarEnvio(envio)} disabled={acaoEnvioId === envio.id} title="Consulta agora no Autentique quem ja assinou" className="flex items-center gap-2 rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2.5 text-sm font-semibold text-graphite-700 transition-all hover:bg-graphite-50 disabled:opacity-60 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
                        <RefreshCw className={`h-4 w-4 ${acaoEnvioId === envio.id ? 'animate-spin' : ''}`} /> {acaoEnvioId === envio.id ? 'Atualizando...' : 'Atualizar assinaturas'}
                      </button>
                    )}
                    {envio?.status === 'aguardando' && envio.podeGerir && (
                      <button type="button" onClick={() => void reenviarEnvio(envio)} disabled={acaoEnvioId === envio.id} className="flex items-center gap-2 rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2.5 text-sm font-semibold text-graphite-700 transition-all hover:bg-graphite-50 disabled:opacity-60 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
                        <Mail className="h-4 w-4" /> Reenviar aviso por e-mail
                      </button>
                    )}
                    {envio && isAdminSistema && (
                      <button type="button" onClick={() => void cancelarEnvio(envio)} className="ml-auto flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-alert-red transition-all hover:bg-red-500/15">
                        <Ban className="h-4 w-4" /> Cancelar envio
                      </button>
                    )}
                  </div>
                </div>
              )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-5">
          <div className="relative mx-4 w-full max-w-5xl rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm dark:bg-surface-elevated/95">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{editando ? 'Editar' : 'Novo'} TAF</h2>
                {editando && (
                  <p className="mt-1 text-xs font-semibold text-graphite-500 dark:text-graphite-400">
                    Status: {registroAprovado(editando) ? 'Assinado' : 'Rascunho'}
                  </p>
                )}
              </div>
              <button onClick={() => setFormOpen(false)} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                <div>
                  <label className={labelCls}>Equipe</label>
                  <select value={fEquipe} onChange={e => { setFEquipe(e.target.value); setFTurno(turnoAuto(e.target.value)); }} disabled={!canManageGlobal} className={inputCls}>
                    <option value="">Selecione</option>
                    {equipesFormulario.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Nº</label>
                  <input value={`${String(fNumero).padStart(3,'0')}/${fAno}`} disabled className={`${inputCls} opacity-60`} />
                </div>
                <div>
                  <label className={labelCls}>Tipo</label>
                  <select value={fTipo} onChange={e => setFTipo(e.target.value)} className={inputCls}>
                    <option value="">Selecione</option>
                    {TIPO_TAF.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Data</label>
                  <input type="date" value={fData} onChange={e => setFData(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Hora</label>
                  <input type="time" value={fHora} onChange={e => setFHora(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Turno</label>
                  <input value={fTurno} disabled className={`${inputCls} opacity-60`} />
                </div>
              </div>

              {/* Participantes */}
              <div>
                <p className="text-sm font-bold text-graphite-700 dark:text-graphite-300 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-aviation-500" /> Participantes
                </p>
                <div className="space-y-3">
                  <div className="hidden">
                    <span className="w-6 text-center">#</span>
                    <span className="flex-1">Nome Completo</span>
                    <span className="w-14 text-center">Função</span>
                    <span className="w-10 text-center">Idade</span>
                    <span className="w-20 text-center">Tempo</span>
                  </div>
                  {SLOTS.map(slot => {
                    const idx = slot.i - 1;
                    const selectedIds = new Set(fPessoas
                      .filter((pp, ii) => pp.pessoaId && ii !== idx)
                      .map(pp => pp.pessoaId)
                      .filter(Boolean));

                    return (
                      <SlotLinha
                        key={slot.i}
                        idx={idx}
                        slot={slot}
                        pessoa={fPessoas[idx]}
                        selectedIds={selectedIds}
                        options={opcoesParticipantes}
                        onSelectPessoa={onSelectPessoa}
                        onTempoChange={(slotIdx, tempo) => setP(slotIdx, 'tempo', tempo)}
                        onClearPessoa={limparPessoa}
                      />
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelCls}>Observações</label>
                <textarea value={fObs} onChange={e => setFObs(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
              </div>

              <div className="rounded-xl border border-graphite-200/60 bg-graphite-50/80 p-4 dark:border-border-dark dark:bg-surface-card/80">
                <label className={labelCls}>Chefe de Equipe</label>
                <p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">{fChefeEquipe || user?.name || '-'}</p>
              </div>

              <div className="flex flex-wrap justify-end gap-3 border-t border-graphite-200 pt-4 dark:border-border-dark">
                <button onClick={() => setFormOpen(false)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
                <button onClick={() => handleSalvar(false)} disabled={!fEquipe || !fData || !fTipo || saving}
                  className="flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-5 py-2.5 text-sm font-semibold text-aviation-700 transition-all hover:bg-aviation-50 disabled:opacity-50 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">
                  <Save className="h-4 w-4" /> {savingAction === 'draft' ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {envioRegistro && (
        <ConfirmarEnvioModal
          titulo={`TAF ${String(envioRegistro.numero).padStart(3, '0')}/${envioRegistro.ano} - Equipe ${envioRegistro.equipe} - ${fmt(envioRegistro.data)}`}
          documento="TAF"
          assinantes={previaEnvio}
          enviando={enviando}
          erro={erroEnvio}
          onCancelar={() => { if (!enviando) setEnvioRegistro(null); }}
          onConfirmar={() => void confirmarEnvio()}
        />
      )}

      {previewPdfData && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-surface-card">
          <div className="flex items-center justify-between border-b border-graphite-200 px-4 py-3 dark:border-border-dark">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-graphite-900 dark:text-graphite-100">{previewPdfTitle || 'TAF'}</h3>
              <p className="text-xs font-semibold text-graphite-500 dark:text-graphite-400">Visualização do documento</p>
            </div>
            <button
              type="button"
              onClick={() => { setPreviewPdfData(null); setPreviewPdfTitle(''); }}
              className="rounded-xl p-2 text-graphite-400 transition-all hover:bg-graphite-100 hover:text-graphite-700 dark:hover:bg-surface-hover dark:hover:text-graphite-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-graphite-100 p-4 dark:bg-graphite-950">
            <PdfPreview pdfData={previewPdfData} fields={[]} />
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20"><AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" /></div>
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            </div>
            <p className="mb-6 text-sm text-graphite-500">Tem certeza?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
              <button onClick={() => handleExcluir(deleteConfirm)} className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg">Excluir</button>
            </div>
          </div>
        </div>
      )}
      <PageTour
        steps={TAF_TOUR_STEPS}
        targetAttribute="data-taf-tour"
        title="Abrir tutorial do TAF"
        detailLabel="Treinamento"
      />
    </PageContainer>
  );
}

export default TAF;
