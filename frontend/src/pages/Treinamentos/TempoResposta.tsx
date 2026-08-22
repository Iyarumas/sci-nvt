import { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, Trash2, Save, X, Timer,
  AlertTriangle, Shield, Eye, Printer, CheckCircle2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { SearchSelect } from '../../components/ui/SearchSelect';
import type { AtivoItem } from '../../components/ui/SearchSelect';
import { PdfPreview } from '../../components/documentos/PdfPreview';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { resolverEfetivoOperacional } from '../../services/efetivoOperacionalService';
import {
  listarTreinos, criarTreino, atualizarTreino,
  excluirTreino, obterProximoNumero,
} from '../../services/tempoRespostaService';
import { listarAtivos } from '../../services/bombeiroService';
import { gerarTempoRespostaPdf } from '../../services/tempoRespostaPdfService';
import type { TreinamentoTempoResposta, TreinamentoTempoRespostaInput } from '../../types/tempoResposta';
import { formatarDataBR, hojeLocalISO } from '../../utils/datas';
import { montarOpcoesEfetivoOperacional } from '../../utils/efetivoOperacional';
import { imprimirPdfBlob } from '../../utils/pdfPrint';

const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta'] as const;
const CCI_OPTIONS = ['319', '320', '333'];
const CONCEITO_OPTIONS = ['A', 'R'];
const PERFORMANCE_OPTIONS = ['Satisfatório', 'Insatisfatório'];

const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark';
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

function fmt(d: string) {
  return formatarDataBR(d);
}

export default function TempoResposta() {
  const { user, contexto, canManageGlobal, canManageEquipe, equipeEfetiva } = useContextoOperacional();
  const canCreate = canManageGlobal || !!equipeEfetiva;
  const isAdminSistema = contexto.isAdministradorSistema;
  const currentUsername = user?.username || user?.name || '';
  const currentName = user?.name || user?.username || '';
  const [treinos, setTreinos] = useState<TreinamentoTempoResposta[]>([]);
  const [opcoesParticipantes, setOpcoesParticipantes] = useState<AtivoItem[]>([]);
  const [search, setSearch] = useState('');
  const [filtroEquipe, setFiltroEquipe] = useState('');
  const [filtroAno, setFiltroAno] = useState(new Date().getFullYear().toString());
  const [formOpen, setFormOpen] = useState(false);
  const [editando, setEditando] = useState<TreinamentoTempoResposta | null>(null);
  const [savingAction, setSavingAction] = useState<'draft' | 'approve' | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [processingPdfId, setProcessingPdfId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [previewPdfData, setPreviewPdfData] = useState<ArrayBuffer | null>(null);
  const [previewPdfTitle, setPreviewPdfTitle] = useState('');
  const [nomeGsPadrao, setNomeGsPadrao] = useState('');
  const saving = savingAction !== null;

  // Form state
  const [formEquipe, setFormEquipe] = useState('');
  const [formNumero, setFormNumero] = useState(0);
  const [formAno, setFormAno] = useState('');
  const [formData, setFormData] = useState('');
  const [formHora, setFormHora] = useState('');
  const [formLocal, setFormLocal] = useState('');
  const [formChefeEquipe, setFormChefeEquipe] = useState('');

  // F2
  const [f2Cci, setF2Cci] = useState('');
  const [f2BaMc, setF2BaMc] = useState('');
  const [f2BaCe, setF2BaCe] = useState('');
  const [f2Ba2, setF2Ba2] = useState('');
  const [f2T1, setF2T1] = useState('');
  const [f2T2, setF2T2] = useState('');
  const [f2T3, setF2T3] = useState('');
  const [f2Conceito, setF2Conceito] = useState('');
  const [f2Performance, setF2Performance] = useState('');

  // F3
  const [f3Cci, setF3Cci] = useState('');
  const [f3BaMc, setF3BaMc] = useState('');
  const [f3Ba21, setF3Ba21] = useState('');
  const [f3Ba22, setF3Ba22] = useState('');
  const [f3T1, setF3T1] = useState('');
  const [f3T2, setF3T2] = useState('');
  const [f3T3, setF3T3] = useState('');
  const [f3Conceito, setF3Conceito] = useState('');
  const [f3Performance, setF3Performance] = useState('');

  // Textareas
  const [formObservacoes, setFormObservacoes] = useState('');
  const [formResumo, setFormResumo] = useState('');
  const [formConsideracoes, setFormConsideracoes] = useState('');
  const [formCoordenacao, setFormCoordenacao] = useState('');
  const [formAcionamento, setFormAcionamento] = useState('');
  const [formSistemaAlarmes, setFormSistemaAlarmes] = useState('');
  const [formComunicacao, setFormComunicacao] = useState('');
  const [formDeslocamento, setFormDeslocamento] = useState('');
  const [formVisibilidade, setFormVisibilidade] = useState('');
  const [formProcedimentos, setFormProcedimentos] = useState('');
  const [formTempoResposta, setFormTempoResposta] = useState('');
  const [formFeedbackSpe, setFormFeedbackSpe] = useState('');
  const [formFeedbackTwr, setFormFeedbackTwr] = useState('');
  const [formFeedbackSci, setFormFeedbackSci] = useState('');
  const [formGerente, setFormGerente] = useState('');

  const equipesFormulario = useMemo(() => {
    if (canManageGlobal) return [...EQUIPES];
    return equipeEfetiva ? [equipeEfetiva] : [];
  }, [canManageGlobal, equipeEfetiva]);

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => { carregar(); }, [filtroAno]);

  useEffect(() => {
    if (!formOpen) return;
    let active = true;
    (async () => {
      try {
        const nomeCompletoGs = await obterNomeGsCompleto();
        if (!active || !nomeCompletoGs) return;
        setNomeGsPadrao(nomeCompletoGs);
        setFormGerente(prev => prev || nomeCompletoGs);
      } catch {
        // Mantém o valor manual caso o cadastro de GS não esteja disponível.
      }
    })();
    return () => { active = false; };
  }, [formOpen]);

  async function carregar() {
    const lista = await listarTreinos({ ano: filtroAno });
    setTreinos(lista);
  }

  const filtered = useMemo(() => {
    let lista = treinos;
    if (filtroEquipe) lista = lista.filter(t => t.equipe === filtroEquipe);
    if (search) {
      const s = search.toLowerCase();
      lista = lista.filter(t =>
        `${String(t.numero).padStart(3, '0')}/${t.ano}`.includes(s) ||
        t.equipe.toLowerCase().includes(s) ||
        t.local.toLowerCase().includes(s)
      );
    }
    return lista;
  }, [treinos, search, filtroEquipe]);

  const stats = useMemo(() => ({
    total: treinos.length,
  }), [treinos]);

  function registroAprovado(registro?: Pick<TreinamentoTempoResposta, 'status'> | null) {
    return registro?.status === 'Aprovado';
  }

  function canUsarPdf(registro: TreinamentoTempoResposta) {
    return registroAprovado(registro);
  }

  function canAlterarRegistro(registro: TreinamentoTempoResposta) {
    return registroAprovado(registro) ? isAdminSistema : canManageEquipe(registro.equipe);
  }

  function mensagemBloqueioRegistro(registro: TreinamentoTempoResposta) {
    return registroAprovado(registro)
      ? 'Este treino já foi aprovado. Somente administradores e desenvolvedores podem alterar.'
      : 'Você só pode alterar treinamentos da sua equipe efetiva.';
  }

  async function obterNomeGsCompleto() {
    const listaGs = await listarAtivos({ cargo: 'GS' });
    const gs = listaGs.find(b =>
      `${b.nomeCompleto} ${b.nomeGuerra}`.toLowerCase().includes('gustavo')
    ) || listaGs[0];
    return gs?.nomeCompleto || gs?.nomeGuerra || '';
  }

  async function completarNomesAssinatura(registro: TreinamentoTempoResposta): Promise<TreinamentoTempoResposta> {
    let chefeEquipe = registro.chefeEquipe;
    let gerente = registro.gerente || nomeGsPadrao;

    try {
      const efetivo = await resolverEfetivoOperacional(registro.equipe, registro.data);
      const opcoes = montarOpcoesEfetivoOperacional(efetivo, registro.equipe);
      const nomeSalvo = (registro.chefeEquipe || '').trim().toLowerCase();
      const chefe = opcoes.find(item =>
        item.cargo === 'BA-CE' &&
        (
          item.nomeCompleto.toLowerCase() === nomeSalvo ||
          item.nomeGuerra.toLowerCase() === nomeSalvo
        )
      ) || opcoes.find(item => item.cargo === 'BA-CE');
      chefeEquipe = chefe?.nomeCompleto || chefeEquipe;
    } catch {
      // Mantém o nome salvo se não conseguir consultar o efetivo.
    }

    if (!gerente) {
      try {
        gerente = await obterNomeGsCompleto();
        if (gerente) setNomeGsPadrao(gerente);
      } catch {
        gerente = registro.aprovadoPorNome || registro.aprovadoPor;
      }
    }

    return {
      ...registro,
      chefeEquipe,
      gerente,
    };
  }

  function limparSelecoesEquipe() {
    setF2BaMc('');
    setF2BaCe('');
    setF2Ba2('');
    setF3BaMc('');
    setF3Ba21('');
    setF3Ba22('');
    setFormChefeEquipe('');
  }

  function handleEquipeChange(equipe: string) {
    setFormEquipe(equipe);
    limparSelecoesEquipe();
  }

  function handleDataChange(data: string) {
    setFormData(data);
    if (data) {
      setFormAno(data.slice(0, 4));
    }
    limparSelecoesEquipe();
  }

  function resetForm() {
    setFormEquipe(canManageGlobal ? '' : equipeEfetiva || ''); setFormNumero(0); setFormAno(''); setFormData(''); setFormHora(''); setFormLocal('');
    setF2Cci(''); setF2BaMc(''); setF2BaCe(''); setF2Ba2(''); setF2T1(''); setF2T2(''); setF2T3(''); setF2Conceito(''); setF2Performance('');
    setF3Cci(''); setF3BaMc(''); setF3Ba21(''); setF3Ba22(''); setF3T1(''); setF3T2(''); setF3T3(''); setF3Conceito(''); setF3Performance('');
    setFormObservacoes(''); setFormResumo(''); setFormConsideracoes(''); setFormCoordenacao('');
    setFormAcionamento(''); setFormSistemaAlarmes(''); setFormComunicacao(''); setFormDeslocamento('');
    setFormVisibilidade(''); setFormProcedimentos(''); setFormTempoResposta(''); setFormFeedbackSpe(''); setFormFeedbackTwr(''); setFormFeedbackSci('');
    setFormGerente(contexto.cargo === 'GS' ? currentName : '');
    setFormChefeEquipe('');
    setOpcoesParticipantes([]);
  }

  async function handleNovo() {
    if (!canCreate) {
      alert('Você precisa ter uma equipe efetiva para criar treinamentos.');
      return;
    }
    resetForm();
    setEditando(null);
    const anoAtual = new Date().getFullYear().toString();
    setFormAno(anoAtual);
    setFormData(hojeLocalISO());
    setFormHora(new Date().toTimeString().slice(0, 5));
    const prox = await obterProximoNumero(anoAtual);
    setFormNumero(prox);
    setFormOpen(true);
  }

  useEffect(() => {
    if (!formOpen || !formEquipe || !formData) {
      setOpcoesParticipantes([]);
      return;
    }

    let active = true;
    (async () => {
      try {
        const efetivo = await resolverEfetivoOperacional(formEquipe, formData);
        if (!active) return;
        const opcoes = montarOpcoesEfetivoOperacional(efetivo, formEquipe);
        setOpcoesParticipantes(opcoes);
        const deveAtualizarChefe = !editando || formEquipe !== editando.equipe || formData !== editando.data || !formChefeEquipe;
        if (deveAtualizarChefe) {
          const chefe = opcoes.find(item => item.cargo === 'BA-CE');
          setFormChefeEquipe(chefe?.nomeCompleto || chefe?.nomeGuerra || '');
        }
      } catch {
        if (active) setOpcoesParticipantes([]);
      }
    })();
    return () => { active = false; };
  }, [formOpen, editando, formEquipe, formData, formChefeEquipe]);

  function handleEditar(t: TreinamentoTempoResposta) {
    if (!canAlterarRegistro(t)) {
      alert(mensagemBloqueioRegistro(t));
      return;
    }
    setEditando(t);
    setFormEquipe(t.equipe); setFormNumero(t.numero); setFormAno(t.ano);
    setFormData(t.data); setFormHora(t.hora); setFormLocal(t.local);
    setF2Cci(t.f2Cci); setF2BaMc(t.f2BaMc); setF2BaCe(t.f2BaCe); setF2Ba2(t.f2Ba2);
    setF2T1(t.f2T1); setF2T2(t.f2T2); setF2T3(t.f2T3); setF2Conceito(t.f2Conceito); setF2Performance(t.f2Performance);
    setF3Cci(t.f3Cci); setF3BaMc(t.f3BaMc); setF3Ba21(t.f3Ba21); setF3Ba22(t.f3Ba22);
    setF3T1(t.f3T1); setF3T2(t.f3T2); setF3T3(t.f3T3); setF3Conceito(t.f3Conceito); setF3Performance(t.f3Performance);
    setFormObservacoes(t.observacoes); setFormResumo(t.resumoExercicio); setFormConsideracoes(t.consideracoesFinais);
    setFormCoordenacao(t.coordenacaoTwrSpeSci); setFormAcionamento(t.acionamento); setFormSistemaAlarmes(t.sistemaAlarmes);
    setFormComunicacao(t.comunicacaoFraseologia); setFormDeslocamento(t.deslocamentoVtrs); setFormVisibilidade(t.visibilidadeSuperficie);
    setFormProcedimentos(t.procedimentoPcinc); setFormTempoResposta(t.tempoResposta); setFormFeedbackSpe(t.feedbackSpe);
    setFormFeedbackTwr(t.feedbackTwr); setFormFeedbackSci(t.feedbackSci); setFormGerente(t.gerente);
    setFormChefeEquipe(t.chefeEquipe || '');
    setFormOpen(true);
  }

  async function handleSalvar(aprovar = false) {
    const equipeAlvo = canManageGlobal ? formEquipe : equipeEfetiva || '';
    if (!equipeAlvo || !formData) return;
    if (editando && !canAlterarRegistro(editando)) {
      alert(mensagemBloqueioRegistro(editando));
      return;
    }
    if (!canManageEquipe(equipeAlvo)) {
      alert('Você só pode salvar treinamentos da sua equipe efetiva.');
      return;
    }
    setSavingAction(aprovar ? 'approve' : 'draft');
    try {
      const ano = formAno || formData.slice(0, 4);
      const data: TreinamentoTempoRespostaInput = {
        equipe: equipeAlvo, numero: formNumero, ano: formAno,
        data: formData, hora: formHora, local: formLocal,
        f2Cci, f2BaMc, f2BaCe, f2Ba2, f2T1, f2T2, f2T3, f2Conceito, f2Performance,
        f3Cci, f3BaMc, f3Ba21, f3Ba22, f3T1, f3T2, f3T3, f3Conceito, f3Performance,
        observacoes: formObservacoes, resumoExercicio: formResumo, consideracoesFinais: formConsideracoes,
        coordenacaoTwrSpeSci: formCoordenacao, acionamento: formAcionamento, sistemaAlarmes: formSistemaAlarmes,
        comunicacaoFraseologia: formComunicacao, deslocamentoVtrs: formDeslocamento,
        visibilidadeSuperficie: formVisibilidade, procedimentoPcinc: formProcedimentos,
        tempoResposta: formTempoResposta, feedbackSpe: formFeedbackSpe,
        feedbackTwr: formFeedbackTwr, feedbackSci: formFeedbackSci,
        chefeEquipe: formChefeEquipe || user?.name || '',
        gerente: formGerente || nomeGsPadrao || (contexto.cargo === 'GS' ? currentName : ''),
      };
      data.ano = ano;
      data.numero = formNumero || await obterProximoNumero(ano);
      if (aprovar) {
        data.status = 'Aprovado';
        data.aprovadoPor = currentUsername;
        data.aprovadoPorNome = currentName;
        data.aprovadoEm = new Date().toISOString();
      }
      if (editando) {
        await atualizarTreino(editando.id, data);
      } else {
        await criarTreino(data);
      }
      if (filtroAno !== ano) setFiltroAno(ano);
      setTreinos(await listarTreinos({ ano }));
      setFormOpen(false);
    } catch (err) {
      alert('Erro ao salvar: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally { setSavingAction(null); }
  }

  async function handleExcluir(id: string) {
    const treino = treinos.find(t => t.id === id);
    if (treino && !canAlterarRegistro(treino)) {
      alert(mensagemBloqueioRegistro(treino));
      setDeleteConfirm(null);
      return;
    }
    await excluirTreino(id);
    await carregar();
    setDeleteConfirm(null);
  }

  async function handleAprovarRegistro(treino: TreinamentoTempoResposta) {
    if (!canAlterarRegistro(treino)) {
      alert(mensagemBloqueioRegistro(treino));
      return;
    }
    setApprovingId(treino.id);
    try {
      const treinoComAssinaturas = await completarNomesAssinatura(treino);
      await atualizarTreino(treino.id, {
        chefeEquipe: treinoComAssinaturas.chefeEquipe,
        gerente: treinoComAssinaturas.gerente,
        status: 'Aprovado',
        aprovadoPor: currentUsername,
        aprovadoPorNome: currentName,
        aprovadoEm: new Date().toISOString(),
      });
      await carregar();
    } catch (err) {
      alert('Erro ao aprovar: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setApprovingId(null);
    }
  }

  function closePreviewPdf() {
    setPreviewPdfData(null);
    setPreviewPdfTitle('');
  }

  async function handlePreviewPdf(treino: TreinamentoTempoResposta) {
    if (!canUsarPdf(treino)) {
      alert('O PDF fica disponível depois da aprovação.');
      return;
    }
    setProcessingPdfId(treino.id);
    try {
      closePreviewPdf();
      const treinoComAssinaturas = await completarNomesAssinatura(treino);
      const pdf = await gerarTempoRespostaPdf(treinoComAssinaturas);
      setPreviewPdfData(await pdf.arrayBuffer());
      setPreviewPdfTitle(`${String(treino.numero).padStart(3, '0')}/${treino.ano} - Tempo Resposta`);
    } catch (err) {
      alert('Erro ao visualizar PDF: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setProcessingPdfId(null);
    }
  }

  async function handlePrintPdf(treino: TreinamentoTempoResposta) {
    if (!canUsarPdf(treino)) {
      alert('Só é possível imprimir depois de aprovado.');
      return;
    }
    setProcessingPdfId(treino.id);
    try {
      const treinoComAssinaturas = await completarNomesAssinatura(treino);
      const pdf = await gerarTempoRespostaPdf(treinoComAssinaturas);
      await imprimirPdfBlob(pdf);
    } catch (err) {
      alert('Erro ao imprimir PDF: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setProcessingPdfId(null);
    }
  }

  function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
          <option value="">Selecione</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
      <div>
        <label className={labelCls}>{label}</label>
        <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className={`${inputCls} resize-none`} />
      </div>
    );
  }

  return (
    <PageContainer>
      <PageTitle icon={Timer} title="Treinamento de Tempo Resposta" />

      <div className="space-y-6">
        {/* Header */}
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
              <Plus className="h-4 w-4" /> Novo Treino
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar..." className={`${inputCls} !pl-10`} />
          </div>
          <select value={filtroEquipe} onChange={e => setFiltroEquipe(e.target.value)} className={`${inputCls} !w-auto`}>
            <option value="">Todas equipas</option>
            {EQUIPES.map(eq => <option key={eq} value={eq}>{eq}</option>)}
          </select>
          <select value={filtroAno} onChange={e => setFiltroAno(e.target.value)} className={`${inputCls} !w-auto`}>
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(a =>
              <option key={a} value={a.toString()}>{a}</option>
            )}
          </select>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white/50 p-12 text-center dark:border-border-dark dark:bg-surface-card/50">
            <Timer className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
            <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum treino registado</h3>
            <p className="text-sm text-graphite-400 dark:text-graphite-500">Clique em "Novo Treino" para criar.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => {
              const aprovado = registroAprovado(t);
              const podeAlterar = canAlterarRegistro(t);
              const podeUsarPdf = canUsarPdf(t);
              const processing = processingPdfId === t.id;
              const expandido = expandidoId === t.id;
              const f2Dados = [
                ['CCI', t.f2Cci],
                ['BA-MC', t.f2BaMc],
                ['BA-CE', t.f2BaCe],
                ['BA-2', t.f2Ba2],
                ['T1', t.f2T1],
                ['T2', t.f2T2],
                ['T3', t.f2T3],
                ['Conceito', t.f2Conceito],
                ['Performance', t.f2Performance],
              ].filter(([, valor]) => Boolean(valor));
              const f3Dados = [
                ['CCI', t.f3Cci],
                ['BA-MC', t.f3BaMc],
                ['BA-2', t.f3Ba21],
                ['BA-2', t.f3Ba22],
                ['T1', t.f3T1],
                ['T2', t.f3T2],
                ['T3', t.f3T3],
                ['Conceito', t.f3Conceito],
                ['Performance', t.f3Performance],
              ].filter(([, valor]) => Boolean(valor));
              return (
                <div key={t.id} className="rounded-2xl border border-graphite-200/60 bg-white/80 p-4 transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandidoId(expandido ? null : t.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aviation-500 to-aviation-700 text-sm font-bold text-white">
                        {t.equipe.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-graphite-900 dark:text-graphite-100">
                            {String(t.numero).padStart(3, '0')}/{t.ano} - {t.equipe} - Tempo Resposta
                          </p>
                          <span className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${aprovado ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                            {aprovado ? 'Aprovado' : 'Rascunho'}
                          </span>
                        </div>
                        <p className="truncate text-xs text-graphite-500 dark:text-graphite-400">
                          {fmt(t.data)} {t.hora && `às ${t.hora}`} - {t.local || 'Sem local'} - Chefe: {t.chefeEquipe || '-'}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandidoId(expandido ? null : t.id)}
                      className="flex shrink-0 items-center gap-1 rounded-xl border border-graphite-200 bg-white px-3 py-1.5 text-xs font-semibold text-graphite-700 transition-all hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-hover dark:text-graphite-200"
                    >
                      Detalhes {expandido ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>

                  {expandido && (
                    <div className="mt-4 space-y-4 border-t border-graphite-200/60 pt-4 dark:border-border-dark">
                      <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-4">
                        <div><span className="font-black text-graphite-500 dark:text-graphite-400">Data</span><p className="font-semibold text-graphite-900 dark:text-graphite-100">{fmt(t.data)}</p></div>
                        <div><span className="font-black text-graphite-500 dark:text-graphite-400">Hora</span><p className="font-semibold text-graphite-900 dark:text-graphite-100">{t.hora || '-'}</p></div>
                        <div><span className="font-black text-graphite-500 dark:text-graphite-400">Local</span><p className="font-semibold text-graphite-900 dark:text-graphite-100">{t.local || '-'}</p></div>
                        <div><span className="font-black text-graphite-500 dark:text-graphite-400">Chefe</span><p className="font-semibold text-graphite-900 dark:text-graphite-100">{t.chefeEquipe || '-'}</p></div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-xl border border-graphite-200/60 bg-graphite-50/70 p-3 dark:border-border-dark dark:bg-surface-hover/60">
                          <p className="mb-2 text-xs font-black uppercase tracking-wider text-aviation-700 dark:text-aviation-300">Faísca 2</p>
                          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                            {f2Dados.length === 0 ? (
                              <p className="text-graphite-500 dark:text-graphite-400">Sem dados preenchidos.</p>
                            ) : (
                              f2Dados.map(([label, valor], index) => (
                                <p key={`${label}-${index}`} className="min-w-0 text-graphite-700 dark:text-graphite-300">
                                  <b>{label}:</b> <span className="break-words">{valor}</span>
                                </p>
                              ))
                            )}
                          </div>
                        </div>
                        <div className="rounded-xl border border-graphite-200/60 bg-graphite-50/70 p-3 dark:border-border-dark dark:bg-surface-hover/60">
                          <p className="mb-2 text-xs font-black uppercase tracking-wider text-aviation-700 dark:text-aviation-300">Faísca 3</p>
                          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                            {f3Dados.length === 0 ? (
                              <p className="text-graphite-500 dark:text-graphite-400">Sem dados preenchidos.</p>
                            ) : (
                              f3Dados.map(([label, valor], index) => (
                                <p key={`${label}-${index}`} className="min-w-0 text-graphite-700 dark:text-graphite-300">
                                  <b>{label}:</b> <span className="break-words">{valor}</span>
                                </p>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {(t.resumoExercicio || t.observacoes || t.consideracoesFinais) && (
                        <div className="space-y-2 text-xs text-graphite-700 dark:text-graphite-300">
                          {t.resumoExercicio && <p><b>Resumo:</b> {t.resumoExercicio}</p>}
                          {t.observacoes && <p><b>Observações:</b> {t.observacoes}</p>}
                          {t.consideracoesFinais && <p><b>Considerações:</b> {t.consideracoesFinais}</p>}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        {!aprovado && podeAlterar && (
                          <button
                            type="button"
                            onClick={() => void handleAprovarRegistro(t)}
                            disabled={approvingId === t.id}
                            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-4 w-4" /> {approvingId === t.id ? 'Aprovando...' : 'Aprovar'}
                          </button>
                        )}
                        {podeUsarPdf && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handlePreviewPdf(t)}
                              disabled={processing}
                              className="flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-3 py-2 text-xs font-semibold text-aviation-700 transition-all hover:bg-aviation-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300"
                            >
                              <Eye className="h-4 w-4" /> {processing ? 'Gerando...' : 'Ver documento'}
                            </button>
                            <button
                              type="button"
                              onClick={() => void handlePrintPdf(t)}
                              disabled={processing}
                              className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                            >
                              <Printer className="h-4 w-4" /> Imprimir
                            </button>
                          </>
                        )}
                        {podeAlterar && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleEditar(t)}
                              className="rounded-xl p-2 text-graphite-400 transition-all hover:bg-graphite-100 hover:text-graphite-700 dark:hover:bg-surface-hover dark:hover:text-graphite-200"
                              title="Editar"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(t.id)}
                              className="rounded-xl p-2 text-red-400 transition-all hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
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
          <div className="relative w-full max-w-4xl mx-4 rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur-sm dark:bg-surface-elevated/95">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">
                  {editando ? 'Editar' : 'Novo'} Treino de Tempo Resposta
                </h2>
                {editando && (
                  <p className="mt-1 text-xs font-semibold text-graphite-500 dark:text-graphite-400">
                    Status: {registroAprovado(editando) ? 'Aprovado' : 'Rascunho'}
                  </p>
                )}
              </div>
              <button onClick={() => setFormOpen(false)}
                className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Cabeçalho */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div>
                  <label className={labelCls}>Equipe</label>
                  <select value={formEquipe} onChange={e => handleEquipeChange(e.target.value)} disabled={!canManageGlobal} className={inputCls}>
                    <option value="">Selecione</option>
                    {equipesFormulario.map(eq => <option key={eq} value={eq}>{eq}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Nº do Treino</label>
                  <input value={`${String(formNumero).padStart(3, '0')}/${formAno}`} disabled className={`${inputCls} opacity-60`} />
                </div>
                <div>
                  <label className={labelCls}>Data</label>
                  <input type="date" value={formData} onChange={e => handleDataChange(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Hora</label>
                  <input type="time" value={formHora} onChange={e => setFormHora(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Local</label>
                <input type="text" value={formLocal} onChange={e => setFormLocal(e.target.value)} placeholder="Local..." className={inputCls} />
              </div>

              {/* F2 */}
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50/30 p-4 dark:border-amber-800 dark:bg-amber-900/10">
                <h4 className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" /> FAISCA 2
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <SelectField label="CCI" value={f2Cci} onChange={setF2Cci}
                      options={CCI_OPTIONS.map(v => ({ value: v, label: `CCI ${v}` }))} />
                    <SlotField label="BA-MC" value={f2BaMc} onChange={setF2BaMc} cargo="BA-MC" options={opcoesParticipantes} />
                    <SlotField label="BA-CE" value={f2BaCe} onChange={setF2BaCe} cargo="BA-CE" options={opcoesParticipantes} />
                    <SlotField label="BA-2" value={f2Ba2} onChange={setF2Ba2} cargo="BA-2" options={opcoesParticipantes} />
                  </div>
                  <div className="space-y-3">
                    <SelectField label="Conceito" value={f2Conceito} onChange={setF2Conceito}
                      options={CONCEITO_OPTIONS.map(v => ({ value: v, label: v === 'A' ? 'Aprovado' : 'Reprovado' }))} />
                    <SelectField label="Performance" value={f2Performance} onChange={setF2Performance}
                      options={PERFORMANCE_OPTIONS.map(v => ({ value: v, label: v }))} />
                    <div>
                      <label className={labelCls}>T1 (HH:MM:SS)</label>
                      <input type="text" value={f2T1} onChange={e => setF2T1(e.target.value)} placeholder="00:00:00" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>T2 (HH:MM:SS)</label>
                      <input type="text" value={f2T2} onChange={e => setF2T2(e.target.value)} placeholder="00:00:00" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>T3 (HH:MM:SS)</label>
                      <input type="text" value={f2T3} onChange={e => setF2T3(e.target.value)} placeholder="00:00:00" className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>

              {/* F3 */}
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/30 p-4 dark:border-emerald-800 dark:bg-emerald-900/10">
                <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4" /> FAISCA 3
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <SelectField label="CCI" value={f3Cci} onChange={setF3Cci}
                      options={CCI_OPTIONS.map(v => ({ value: v, label: `CCI ${v}` }))} />
                    <SlotField label="BA-MC" value={f3BaMc} onChange={setF3BaMc} cargo="BA-MC" options={opcoesParticipantes} />
                    <SlotField label="BA-2" value={f3Ba21} onChange={setF3Ba21} cargo="BA-2" options={opcoesParticipantes} />
                    <SlotField label="BA-2" value={f3Ba22} onChange={setF3Ba22} cargo="BA-2" options={opcoesParticipantes} />
                  </div>
                  <div className="space-y-3">
                    <SelectField label="Conceito" value={f3Conceito} onChange={setF3Conceito}
                      options={CONCEITO_OPTIONS.map(v => ({ value: v, label: v === 'A' ? 'Aprovado' : 'Reprovado' }))} />
                    <SelectField label="Performance" value={f3Performance} onChange={setF3Performance}
                      options={PERFORMANCE_OPTIONS.map(v => ({ value: v, label: v }))} />
                    <div>
                      <label className={labelCls}>T1 (HH:MM:SS)</label>
                      <input type="text" value={f3T1} onChange={e => setF3T1(e.target.value)} placeholder="00:00:00" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>T2 (HH:MM:SS)</label>
                      <input type="text" value={f3T2} onChange={e => setF3T2(e.target.value)} placeholder="00:00:00" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>T3 (HH:MM:SS)</label>
                      <input type="text" value={f3T3} onChange={e => setF3T3(e.target.value)} placeholder="00:00:00" className={inputCls} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Textareas */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextareaField label="Observações" value={formObservacoes} onChange={setFormObservacoes} />
                <TextareaField label="Resumo do Exercício" value={formResumo} onChange={setFormResumo} />
                <TextareaField label="Considerações Finais" value={formConsideracoes} onChange={setFormConsideracoes} />
                <TextareaField label="Coordenação TWR/SPE/SCI" value={formCoordenacao} onChange={setFormCoordenacao} />
                <TextareaField label="Acionamento" value={formAcionamento} onChange={setFormAcionamento} />
                <TextareaField label="Sistema de Alarmes" value={formSistemaAlarmes} onChange={setFormSistemaAlarmes} />
                <TextareaField label="Comunicação / Fraseologia" value={formComunicacao} onChange={setFormComunicacao} />
                <TextareaField label="Deslocamento VTR's" value={formDeslocamento} onChange={setFormDeslocamento} />
                <TextareaField label="Visibilidade e Superfície" value={formVisibilidade} onChange={setFormVisibilidade} />
                <TextareaField label="Procedimento PCINC" value={formProcedimentos} onChange={setFormProcedimentos} />
                <TextareaField label="Tempo Resposta" value={formTempoResposta} onChange={setFormTempoResposta} />
                <TextareaField label="Feedback SPE" value={formFeedbackSpe} onChange={setFormFeedbackSpe} />
                <TextareaField label="Feedback TWR" value={formFeedbackTwr} onChange={setFormFeedbackTwr} />
                <TextareaField label="Feedback SCI" value={formFeedbackSci} onChange={setFormFeedbackSci} />
              </div>

              {/* Chefe + Gerente */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-graphite-200/60 bg-graphite-50/80 p-4 dark:border-border-dark dark:bg-surface-card/80">
                  <label className={labelCls}>Chefe de Equipe</label>
                  <p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">{formChefeEquipe || user?.name || '-'}</p>
                </div>
                <div>
                  <label className={labelCls}>GS / Embaixador (Gerente)</label>
                  <input type="text" value={formGerente} onChange={e => setFormGerente(e.target.value)}
                    placeholder="Nome do gerente..." className={inputCls} />
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-3 border-t border-graphite-200 pt-4 dark:border-border-dark">
                <button onClick={() => setFormOpen(false)}
                  className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
                  Cancelar
                </button>
                <button onClick={() => handleSalvar(false)} disabled={!formEquipe || !formData || saving}
                  className="flex items-center gap-2 rounded-xl border border-aviation-300 bg-white px-5 py-2.5 text-sm font-semibold text-aviation-700 transition-all hover:bg-aviation-50 disabled:opacity-50 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">
                  <Save className="h-4 w-4" /> {savingAction === 'draft' ? 'Salvando...' : registroAprovado(editando) ? 'Salvar' : 'Salvar rascunho'}
                </button>
                {!registroAprovado(editando) && (
                  <button onClick={() => handleSalvar(true)} disabled={!formEquipe || !formData || saving}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all hover:shadow-xl active:scale-[0.98] disabled:opacity-50">
                    <CheckCircle2 className="h-4 w-4" /> {savingAction === 'approve' ? 'Aprovando...' : 'Aprovar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {previewPdfData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl shadow-black/10 dark:bg-surface-elevated">
            <div className="flex items-center justify-between gap-3 border-b border-graphite-200/70 px-5 py-4 dark:border-border-dark">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-graphite-900 dark:text-graphite-100">{previewPdfTitle || 'Tempo Resposta'}</h3>
                <p className="text-xs text-graphite-500 dark:text-graphite-400">Visualização do documento</p>
              </div>
              <button onClick={closePreviewPdf} className="shrink-0 rounded-lg p-1.5 text-graphite-500 transition-colors hover:bg-graphite-100 hover:text-graphite-800 dark:text-graphite-300 dark:hover:bg-surface-hover" title="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-graphite-100/60 p-4 dark:bg-surface-card/40">
              <PdfPreview pdfData={previewPdfData} fields={[]} />
            </div>
          </div>
        </div>
      )}

      {/* Delete */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">Confirmar exclusão</h3>
            </div>
            <p className="mb-6 text-sm text-graphite-500 dark:text-graphite-400">Tem certeza que deseja excluir este treino?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
              <button onClick={() => handleExcluir(deleteConfirm)}
                className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all hover:shadow-xl active:scale-[0.98]">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function SlotField({ label, value, onChange, cargo, options }: { label: string; value: string; onChange: (v: string) => void; cargo?: string; options: AtivoItem[] }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">{label}</label>
      <SearchSelect
        value={value}
        onChange={onChange}
        cargo={cargo}
        options={options}
        showCargo
        displayMode="operational"
        placeholder={`Selecione ${label}`}
      />
    </div>
  );
}
