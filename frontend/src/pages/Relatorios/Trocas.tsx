import { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw, Plus, ArrowLeft, FileText, Loader2,
  Save, ChevronDown, ChevronUp, Filter,
  AlertTriangle, AlertCircle, Edit, Trash2, Eye, CheckCircle, X, ArrowRight, Archive, Lock,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { Autocomplete } from '../../components/documentos/Autocomplete';
import {
  listarDocumentos, buscarDocumento, criarDocumento,
  criarCamposEmLote, criarSignatario,
  criarPreenchimento, listarPreenchimentos,
  atualizarPreenchimento, excluirPreenchimento, getPdfBlob,
} from '../../services/documentoService';
import { preencherPdf } from '../../services/pdfService';
import { DOCUMENT_TEMPLATES, findTemplate } from '../../data/documentTemplates';
import type { TemplateFieldDef } from '../../data/documentTemplates';
import type { DocumentWithFields, DocumentField, DocumentFill } from '../../types/document';
import { useContextoOperacional } from '../../hooks/useContextoOperacional';
import { listarBombeiros } from '../../services/bombeiroService';
import { listarAPOCs } from '../../services/apocService';
import type { Bombeiro } from '../../types/bombeiro';
import { CARGO_OPTIONS, EQUIPE_OPTIONS } from '../../types/bombeiro';
import type { APOC } from '../../types/apoc';
import { formatarDataBR, formatarDataHoraBR, hojeLocalISO } from '../../utils/datas';
type SubView = 'list' | 'form';
type ViewMode = 'list' | 'report';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const MAX_TROCAS_PER_MONTH = 3;

const template = DOCUMENT_TEMPLATES[0];
const TROCA_TEMPLATE_PDF_URL = '/templates/troca.pdf';
const MM_TO_VIEWPORT = 2.8346 * 1.5;

function pdfPosition(xMm: number, yMm: number, widthMm: number, heightMm: number, fontSize = 8, textAlign?: 'left' | 'center' | 'right') {
  return {
    page: 1,
    x: xMm * MM_TO_VIEWPORT,
    y: yMm * MM_TO_VIEWPORT,
    width: widthMm * MM_TO_VIEWPORT,
    height: heightMm * MM_TO_VIEWPORT,
    font_size: fontSize,
    text_align: textAlign,
  };
}

const TROCA_PDF_POSITION_OVERRIDES = new Map<string, ReturnType<typeof pdfPosition>>([
  ['nome_solicitante', pdfPosition(18, 31.4, 101, 7, 11)],
  ['cpf_solicitante', pdfPosition(158, 31.4, 36, 7, 10.5)],
  ['data_solicitada', pdfPosition(118, 40, 42, 7, 10.5)],
  ['funcao_solicitante', pdfPosition(114, 48.6, 44, 7, 11)],
  ['motivo_troca', pdfPosition(10, 57.7, 180, 14.5, 10.5)],
  ['nome_solicitado', pdfPosition(10, 82.5, 93, 7, 11)],
  ['cpf_solicitado', pdfPosition(120, 82.5, 57, 7, 10.5)],
  ['data_folga_solicitado', pdfPosition(152.5, 99.45, 36, 7, 10.5)],
  ['check_troca_sim', pdfPosition(49.1, 220.6, 4, 4, 16)],
  ['check_troca_nao', pdfPosition(72.8, 220.6, 4, 4, 16)],
  ['justificativa_emergencial', pdfPosition(12, 235, 182, 15, 10.5)],
  ['data_autentique_1', pdfPosition(42, 153.1, 30, 7, 10.5)],
  ['data_autentique_2', pdfPosition(141, 153.1, 30, 7, 10.5)],
  ['data_autentique_3', pdfPosition(76, 240, 30, 7, 10.5)],
  ['check_deferido', pdfPosition(11.9, 250.6, 4, 4, 16)],
  ['check_indeferido', pdfPosition(11.9, 256.7, 4, 4, 16)],
  ['assinatura_solicitante', pdfPosition(22, 147, 65, 5)],
  ['assinatura_solicitado', pdfPosition(117, 147, 65, 5)],
  ['assinatura_chefe_solicitante', pdfPosition(22, 188, 65, 5)],
  ['assinatura_chefe_solicitado', pdfPosition(117, 188, 65, 5)],
  ['assinatura_gerente', pdfPosition(72, 280, 65, 5)],
]);

const CHECK_FIELD_OVERRIDES = new Map<string, { font_size: number; width: number; height: number }>(
  template.fields
    .filter(f => f.field_name.startsWith('check_'))
    .map(f => [f.field_name, { font_size: f.font_size, width: f.width, height: f.height }])
);

type TrocaPdfExtraPosition = ReturnType<typeof pdfPosition> & { field_name: string };

const TROCA_PDF_EXTRA_POSITIONS: TrocaPdfExtraPosition[] = [];

function fieldPositionsFromDoc(doc: DocumentWithFields) {
  const fields = doc.document_fields.map(f => {
    const fallback = TROCA_PDF_POSITION_OVERRIDES.get(f.field_name);
    const field = fallback
      ? { ...f, ...fallback }
      : f;
    const override = CHECK_FIELD_OVERRIDES.get(f.field_name);
    return {
      field_name: field.field_name,
      x: field.x,
      y: field.y,
      width: override?.width ?? field.width,
      height: override?.height ?? field.height,
      font_size: override?.font_size ?? field.font_size,
      is_signature: field.is_signature,
      field_type: field.field_type,
      page: field.page,
      text_align: fallback?.text_align,
    };
  });
  return [...fields, ...TROCA_PDF_EXTRA_POSITIONS];
}

function templateFieldsToDocFields(fields: TemplateFieldDef[]): DocumentField[] {
  return fields.map((tf, i) => ({
    ...fieldInputFromTemplate('', tf, i),
    id: `tpl_${i}`,
    created_at: new Date().toISOString(),
  }));
}

function fieldInputFromTemplate(documentId: string, tf: TemplateFieldDef, orderIndex: number): Omit<DocumentField, 'id' | 'created_at'> {
  const fallback = TROCA_PDF_POSITION_OVERRIDES.get(tf.field_name);
  return {
    document_id: documentId,
    field_name: tf.field_name,
    field_label: tf.field_label,
    field_type: tf.field_type,
    required: tf.required,
    placeholder: tf.placeholder,
    options: tf.options,
    order_index: orderIndex,
    page: fallback?.page ?? 1,
    x: fallback?.x ?? 0,
    y: fallback?.y ?? 0,
    width: fallback?.width ?? tf.width,
    height: fallback?.height ?? tf.height,
    font_size: fallback?.font_size ?? tf.font_size,
    data_source: tf.data_source,
    is_signature: tf.is_signature,
    signer_role: tf.signer_role,
    read_only: tf.read_only,
    conditional_on: tf.conditional_on,
  };
}

function normalizeTrocaDocument(doc: DocumentWithFields | null): DocumentWithFields | null {
  if (!doc) return null;
  return {
    ...doc,
    template_pdf_url: doc.template_pdf_url || TROCA_TEMPLATE_PDF_URL,
    source_module: doc.source_module || 'trocas',
    document_fields: doc.document_fields.length > 0
      ? doc.document_fields
      : templateFieldsToDocFields(template.fields),
  };
}

async function getTrocaPdfBlob(doc: DocumentWithFields): Promise<Blob | null> {
  const primaryPath = doc.template_pdf_url || TROCA_TEMPLATE_PDF_URL;
  const primaryBlob = await getPdfBlob(primaryPath);
  if (primaryBlob || primaryPath === TROCA_TEMPLATE_PDF_URL) return primaryBlob;
  return getPdfBlob(TROCA_TEMPLATE_PDF_URL);
}

const DRAFT_TTL_MS = 3 * 24 * 60 * 60 * 1000;

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Excluindo...';
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function Trocas() {
  const { user, canManageGlobal, canManageEquipe, equipeEfetiva, canVisualizarRelatorios, loadingContexto } = useContextoOperacional();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [subView, setSubView] = useState<SubView>('list');
  const isRelatorioRoute = location.pathname.startsWith('/relatorios');
  const [viewMode, setViewMode] = useState<ViewMode>(isRelatorioRoute ? 'report' : 'list');
  const canCreateTroca = !isRelatorioRoute && (canManageGlobal || !!equipeEfetiva);

  const [archiveConfirmFill, setArchiveConfirmFill] = useState<DocumentFill | null>(null);
  const [templateDoc, setTemplateDoc] = useState<DocumentWithFields | null>(null);
  const [fills, setFills] = useState<DocumentFill[]>([]);
  const [expandedFill, setExpandedFill] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showConfirmPdf, setShowConfirmPdf] = useState(false);
  const [showLimitPopup, setShowLimitPopup] = useState(false);
  const [limitPopupData, setLimitPopupData] = useState<{ count: number; targetName: string }>({ count: 0, targetName: '' });
  const [overrideName, setOverrideName] = useState('');
  const [editingFillId, setEditingFillId] = useState<string | null>(null);
  const [draftCountdowns, setDraftCountdowns] = useState<Record<string, number>>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showJustificativaPopup, setShowJustificativaPopup] = useState<string | null>(null);
  const [showValidationPopup, setShowValidationPopup] = useState<string | null>(null);
  const [showNotifPopup, setShowNotifPopup] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showPreviewInfo, setShowPreviewInfo] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState('');
  const [showAutorizacaoAviso, setShowAutorizacaoAviso] = useState(false);
  const [bombeirosList, setBombeirosList] = useState<Bombeiro[]>([]);
  const [apocsList, setApocsList] = useState<APOC[]>([]);
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState<number>(now.getMonth());
  const [filterYear, setFilterYear] = useState<number>(now.getFullYear());
  const [filterEquipe, setFilterEquipe] = useState('');

  const FIELD_LABEL_OVERRIDES: Record<string, string> = {
    deferido_indeferido: 'Parecer do Embaixador',
  };

  const displayFields = useMemo(() => {
    const base = templateDoc ? templateDoc.document_fields : templateFieldsToDocFields(template.fields);
    return base
      .filter(f => !f.field_name.startsWith('check_'))
      .map(f => {
        let patched = FIELD_LABEL_OVERRIDES[f.field_name] ? { ...f, field_label: FIELD_LABEL_OVERRIDES[f.field_name] } : f;
        if (patched.field_name === 'motivo_troca' || patched.field_name === 'justificativa_emergencial') {
          patched = { ...patched, field_type: 'textarea', is_signature: false, read_only: false, data_source: 'manual' };
        }
        return patched;
      });
  }, [templateDoc]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);

  const filteredFills = useMemo(() => {
    return fills.filter(fill => {
      if (fill.status === 'archived') return false;
      const d = new Date(fill.created_at);
      if (filterEquipe) {
        const data = fill.filled_data as Record<string, string>;
        const p1 = getPessoaByNome(data.nome_solicitante || '');
        const p2 = getPessoaByNome(data.nome_solicitado || '');
        const eq1 = p1?.equipe || '';
        const eq2 = p2?.equipe || '';
        if (eq1 !== filterEquipe && eq2 !== filterEquipe) return false;
      }
      return d.getMonth() === filterMonth && d.getFullYear() === filterYear;
    }).sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [fills, filterMonth, filterYear, filterEquipe]);

  const violationFillIds = useMemo(() => {
    const pessoaFills: Record<string, { id: string; created_at: string }[]> = {};
    const ids = new Set<string>();
    filteredFills.forEach(f => {
      const fd = f.filled_data as Record<string, string>;
      const nomes = new Set([fd.nome_solicitante, fd.nome_solicitado].filter(Boolean));
      nomes.forEach(nome => {
        if (!pessoaFills[nome]) pessoaFills[nome] = [];
        pessoaFills[nome].push({ id: f.id, created_at: f.created_at });
      });
      const p1 = getPessoaByNome(fd.nome_solicitante || '');
      const p2 = getPessoaByNome(fd.nome_solicitado || '');
      const cargo1 = p1?.cargo || (fd.funcao_solicitante || '').split(' - ')[0] || '';
      const cargo2 = p2?.cargo || (fd.funcao_solicitado || '').split(' - ')[0] || '';
      if (cargo1 && cargo2 && cargo1 !== cargo2) ids.add(f.id);
      if (p1?.turno && p2?.turno && !mesmoTurnoEfetivo(p1, p2)) ids.add(f.id);
      if (fd.troca_emergencial === 'SIM') ids.add(f.id);
    });
    Object.values(pessoaFills).forEach(arr => arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    Object.values(pessoaFills).forEach(arr => {
      arr.forEach((f, i) => {
        if (i >= MAX_TROCAS_PER_MONTH) ids.add(f.id);
      });
    });
    return ids;
  }, [filteredFills]);

  const excessoLimiteIds = useMemo(() => {
    const pessoaFills: Record<string, { id: string; created_at: string }[]> = {};
    const ids = new Set<string>();
    filteredFills.forEach(f => {
      const fd = f.filled_data as Record<string, string>;
      const nomes = new Set([fd.nome_solicitante, fd.nome_solicitado].filter(Boolean));
      nomes.forEach(nome => {
        if (!pessoaFills[nome]) pessoaFills[nome] = [];
        pessoaFills[nome].push({ id: f.id, created_at: f.created_at });
      });
    });
    Object.values(pessoaFills).forEach(arr => arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    Object.values(pessoaFills).forEach(arr => {
      arr.forEach((f, i) => {
        if (i >= MAX_TROCAS_PER_MONTH) ids.add(f.id);
      });
    });
    return ids;
  }, [filteredFills]);

  const currentUserTrocasThisMonth = useMemo(() => {
    const now2 = new Date();
    return fills.filter(fill => {
      const d = new Date(fill.created_at);
      return fill.filled_by === user?.username && d.getMonth() === now2.getMonth() && d.getFullYear() === now2.getFullYear();
    }).length;
  }, [fills, user]);

  useEffect(() => {
    if (isRelatorioRoute && loadingContexto) return;
    if (isRelatorioRoute && !canVisualizarRelatorios) {
      setLoading(false);
      return;
    }
    init();
  }, [isRelatorioRoute, canVisualizarRelatorios, loadingContexto]);

  useEffect(() => {
    const interval = setInterval(() => {
      const nowMs = Date.now();
      const countdowns: Record<string, number> = {};
      const toDelete: string[] = [];
      fills.forEach(fill => {
        if (fill.status !== 'draft') return;
        const created = new Date(fill.created_at).getTime();
        const remaining = created + DRAFT_TTL_MS - nowMs;
        if (remaining <= 0) {
          toDelete.push(fill.id);
        } else {
          countdowns[fill.id] = remaining;
        }
      });
      setDraftCountdowns(countdowns);
      if (toDelete.length > 0) {
        toDelete.forEach(async (id) => {
          try { await excluirPreenchimento(id); } catch { /* ignore */ }
        });
        setFills(prev => prev.filter(f => !toDelete.includes(f.id)));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [fills]);

  async function init() {
    try {
      setLoading(true);
      const [docs, bombeiros, apocs] = await Promise.all([
        listarDocumentos(),
        listarBombeiros().catch(() => { try { return JSON.parse(localStorage.getItem('sescinc-bombeiros') || '[]'); } catch { return []; } }),
        listarAPOCs(),
      ]);
      setBombeirosList(bombeiros);
      setApocsList(apocs);
      const trocaDoc = docs.find(d => d.source_module === 'trocas') || docs.find(d => findTemplate(d.name) !== null);
      if (trocaDoc) {
        const full = await buscarDocumento(trocaDoc.id);
        setTemplateDoc(normalizeTrocaDocument(full));
        const docFills = await listarPreenchimentos(trocaDoc.id);
        setFills(docFills);
      }
    } catch {
      setShowNotifPopup({ msg: 'Erro ao carregar trocas. Contate o administrador.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function ensureDocumentExists(): Promise<DocumentWithFields | null> {
    if (templateDoc) return templateDoc;
    try {
      const doc = await criarDocumento({
        name: 'FORMULARIO DE TROCA DE SERVICOS (PERMUTA)',
        description: 'Formulario de Troca de Servicos - Permuta',
        category: 'administrativo',
        template_pdf_url: TROCA_TEMPLATE_PDF_URL,
        active: true,
        template_pdf_pages: 0, template_pdf_width: 0, template_pdf_height: 0,
        source_module: 'trocas',
        created_by: null,
      });
      await criarCamposEmLote(doc.id, template.fields.map((tf, i) => fieldInputFromTemplate(doc.id, tf, i)));
      for (const ts of template.signers) {
        await criarSignatario({ document_id: doc.id, signer_name: ts.signer_name, signer_role: ts.signer_role, order_index: ts.order_index, required: true });
      }
      const full = await buscarDocumento(doc.id);
      const normalized = normalizeTrocaDocument(full);
      setTemplateDoc(normalized);
      return normalized;
    } catch {
      setShowNotifPopup({ msg: 'Erro ao criar documento. Contate o administrador.', type: 'error' });
      return null;
    }
  }

  function startNewTroca() {
    if (!canCreateTroca) {
      setShowNotifPopup({ msg: 'Você precisa ter uma equipe efetiva para criar trocas.', type: 'error' });
      return;
    }
    if (currentUserTrocasThisMonth >= MAX_TROCAS_PER_MONTH && !canManageGlobal) {
      setLimitPopupData({ count: currentUserTrocasThisMonth, targetName: '' });
      setShowLimitPopup(true);
      return;
    }
    const initialData: Record<string, string> = {};
    displayFields.forEach(f => { initialData[f.field_name] = ''; });
    setFormData(initialData);
    setEditingFillId(null);
    setSubView('form');
  }

  function handleFieldChange(fieldName: string, value: string) {
    setMissingFields(prev => prev.filter(f => f !== fieldName));
    if (fieldName === 'nome_solicitante' || fieldName === 'nome_solicitado') {
      handleNameSelect(fieldName, value);
      return;
    }
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  }

  const HIDDEN_AUTENTIQUE_FIELDS = ['data_autentique_1', 'data_autentique_2', 'data_autentique_3', 'check_troca_sim', 'check_troca_nao', 'check_deferido', 'check_indeferido', 'deferido_indeferido'];

  function getAllFuncionarios() {
    return [
      ...bombeirosList.map(b => {
        const cargoLabel = CARGO_OPTIONS.find(c => c.value === b.cargo)?.label || b.cargo;
        return { label: b.nomeCompleto, sublabel: `${cargoLabel} - ${b.email}`, _type: 'bombeiro' as const, _raw: b };
      }),
      ...apocsList.map(a => {
        const funcaoLabel = a.funcao === 'SUPERVISOR' ? 'Supervisor' : 'APOC';
        return { label: a.nomeCompleto, sublabel: `${funcaoLabel} - ${a.email}`, _type: 'apoc' as const, _raw: a };
      }),
    ];
  }

  function getFuncaoByNome(nome: string): string {
    if (!nome) return '';
    const all = getAllFuncionarios();
    const match = all.find(f => f.label === nome);
    if (!match) return '';
    if (match._type === 'bombeiro') return match._raw.cargo || '';
    if (match._type === 'apoc') return match._raw.funcao || 'APOC';
    return '';
  }

  function getCargoLabel(cargo: string): string {
    if (!cargo) return cargo;
    return CARGO_OPTIONS.find(c => c.value === cargo)?.label || cargo;
  }

  function getPessoaByNome(nome: string): { cargo: string; nomeGuerra: string; nomeCompleto: string; equipe: string; turno: string } | null {
    if (!nome) return null;
    const all = getAllFuncionarios();
    const lower = nome.toLowerCase().trim();
    const primeiroNome = lower.split(' ')[0];
    const match = all.find(f => {
      if (f.label.toLowerCase() === lower) return true;
      if (f._raw.nomeGuerra?.toLowerCase() === lower) return true;
      if (f._raw.nomeGuerra?.toLowerCase() === primeiroNome) return true;
      if (lower.startsWith(f._raw.nomeGuerra?.toLowerCase() || '')) return true;
      const completo = (f._raw.nomeCompleto || f.label || '').toLowerCase();
      const partes = lower.split(' ');
      return partes.every((p: string) => completo.includes(p));
    });
    if (!match) return null;
    if (match._type === 'bombeiro') {
      return { cargo: match._raw.cargo || '', nomeGuerra: match._raw.nomeGuerra || '', nomeCompleto: match._raw.nomeCompleto || '', equipe: match._raw.equipe || '', turno: match._raw.turno || '' };
    }
    return { cargo: match._raw.funcao || 'APOC', nomeGuerra: match._raw.nomeGuerra || match.label, nomeCompleto: match._raw.nomeCompleto || match.label, equipe: match._raw.equipe || '', turno: match._raw.turno || '' };
  }

  function getNomeCompletoRelatorio(nome: string): string {
    if (!nome) return '-';
    return getPessoaByNome(nome)?.nomeCompleto || nome;
  }

  function getFillEquipes(fill: DocumentFill): string[] {
    const data = fill.filled_data as Record<string, string>;
    return Array.from(new Set([
      data.equipe || '',
      getPessoaByNome(data.nome_solicitante || '')?.equipe || '',
      getPessoaByNome(data.nome_solicitado || '')?.equipe || '',
    ].filter(Boolean)));
  }

  function canManageFill(fill: DocumentFill): boolean {
    if (canManageGlobal) return true;
    return getFillEquipes(fill).some(eq => canManageEquipe(eq));
  }

  function canManageFormData(data: Record<string, string>): boolean {
    if (canManageGlobal) return true;
    const equipes = [
      data.equipe || '',
      getPessoaByNome(data.nome_solicitante || '')?.equipe || '',
      getPessoaByNome(data.nome_solicitado || '')?.equipe || '',
    ].filter(Boolean);
    return equipes.some(eq => canManageEquipe(eq));
  }

  function displayNomeGuerra(nome: string): string {
    const p = getPessoaByNome(nome);
    if (!p) return nome || 'Sem nome';
    return `${p.cargo} ${p.nomeGuerra}`;
  }

  function mesmoTurnoEfetivo(p1: { turno: string; equipe: string }, p2: { turno: string; equipe: string }): boolean {
    if (p1.turno === p2.turno) return true;
    if (p1.equipe === 'Ferista' || p2.equipe === 'Ferista') return true;
    return false;
  }

  function precisaAutorizacaoGerente(nomeSol: string, nomeSolic: string, existingFills?: DocumentFill[]): boolean {
    const pSol = getPessoaByNome(nomeSol);
    const pSolic = getPessoaByNome(nomeSolic);
    if (!pSol || !pSolic) return false;

    const now = new Date();
    const sourceFills = existingFills || fills;

    const nomes = [nomeSol, nomeSolic].filter(Boolean);
    for (const nome of nomes) {
      const count = sourceFills.filter(f => {
        const fd = f.filled_data as Record<string, string>;
        const d = new Date(f.created_at);
        return (fd.nome_solicitante === nome || fd.nome_solicitado === nome) &&
          d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;
      if (count >= MAX_TROCAS_PER_MONTH) return true;
    }

    if (pSol.turno && pSolic.turno && !mesmoTurnoEfetivo(pSol, pSolic)) return true;

    if (pSol.cargo && pSolic.cargo && pSol.cargo !== pSolic.cargo) return true;

    return false;
  }

  const personExcessMap = useMemo(() => {
    const countMap: Record<string, number> = {};
    filteredFills.forEach(fill => {
      const data = fill.filled_data as Record<string, string>;
      const nomeSol = data.nome_solicitante || '';
      const nomeSolic = data.nome_solicitado || '';
      if (nomeSol) countMap[nomeSol] = (countMap[nomeSol] || 0) + 1;
      if (nomeSolic && nomeSolic !== nomeSol) countMap[nomeSolic] = (countMap[nomeSolic] || 0) + 1;
    });
    const excessMap: Record<string, number> = {};
    Object.entries(countMap).forEach(([nome, count]) => {
      if (count > MAX_TROCAS_PER_MONTH) excessMap[nome] = count - MAX_TROCAS_PER_MONTH;
    });
    return excessMap;
  }, [filteredFills]);

  function handleNameSelect(fieldName: string, value: string) {
    const all = getAllFuncionarios();
    const match = all.find(f => f.label === value);
    setFormData(prev => {
      const next = { ...prev, [fieldName]: value };
      if (match?._type === 'bombeiro') {
        const b = match._raw;
        if (fieldName === 'nome_solicitante') {
          next.cpf_solicitante = formatCpf(b.cpf || '');
          next.funcao_solicitante = b.cargo || '';
        } else if (fieldName === 'nome_solicitado') {
          next.cpf_solicitado = formatCpf(b.cpf || '');
          next.funcao_solicitado = b.cargo || '';
        }
      } else if (match?._type === 'apoc') {
        const a = match._raw;
        if (fieldName === 'nome_solicitante') {
          next.cpf_solicitante = '';
          next.funcao_solicitante = a.funcao || 'APOC';
        } else if (fieldName === 'nome_solicitado') {
          next.cpf_solicitado = '';
          next.funcao_solicitado = a.funcao || 'APOC';
        }
      }
      return next;
    });
  }

  function handleCpfChange(fieldName: string, raw: string) {
    setFormData(prev => ({ ...prev, [fieldName]: formatCpf(raw) }));
  }

  function validateForm(): boolean {
    const missing: string[] = [];
    for (const field of displayFields.filter(f => !f.is_signature && !HIDDEN_AUTENTIQUE_FIELDS.includes(f.field_name))) {
      if (field.conditional_on) {
        const [depFieldName, depValue] = field.conditional_on.split('=');
        if ((formData[depFieldName] || '') !== depValue) continue;
      }
      if (field.required && !formData[field.field_name]) {
        missing.push(field.field_name);
      }
    }
    setMissingFields(missing);
    if (missing.length > 0) {
      setShowValidationPopup('Preencha todos os campos obrigatorios. Os campos em vermelho precisam ser preenchidos.');
      return false;
    }
    return true;
  }

  function prepareFormDataWithAuth(data: Record<string, string>): Record<string, string> {
    const result = { ...data };
    const criarNome = user?.pessoa?.nomeGuerra || user?.name || '';
    const criarCargo = user?.pessoa?.funcao || '';
    result.criado_por = criarCargo ? `${criarCargo} ${criarNome}` : criarNome;
    if (result.deferido_indeferido === 'DEFERIDO' || result.deferido_indeferido === 'INDEFERIDO') {
      const autorNome = user?.pessoa?.nomeGuerra || user?.name || '';
      const autorCargo = user?.pessoa?.funcao || '';
      result.autorizado_por = autorCargo ? `${autorCargo} ${autorNome}` : autorNome;
      result.data_autorizacao = hojeLocalISO();
    }
    return result;
  }

  function buildPdfData(data: Record<string, string>): Record<string, string> {
    const dadosStr: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (k === 'deferido_indeferido' || k.startsWith('check_')) continue;
      dadosStr[k] = String(v || '');
    }

    if (dadosStr.data_folga_solicitado) {
      const dateValue = dadosStr.data_folga_solicitado;
      const formattedDate = formatarDataBR(dateValue, dateValue);
      dadosStr.data_folga_solicitado = `a ${formattedDate}`;
    }

    dadosStr.check_troca_sim = data.troca_emergencial === 'SIM' ? 'V' : '';
    dadosStr.check_troca_nao = data.troca_emergencial === 'NAO' ? 'V' : '';
    dadosStr.justificativa_emergencial = data.troca_emergencial === 'SIM'
      ? String(data.justificativa_emergencial || '')
      : '';
    dadosStr.check_deferido = 'V';
    dadosStr.check_indeferido = '';

    return dadosStr;
  }

  async function handleConfirmGerarPdf() {
    setShowConfirmPdf(false);
    if (!canManageFormData(formData)) {
      setShowNotifPopup({ msg: 'Você só pode aprovar trocas vinculadas à sua equipe efetiva.', type: 'error' });
      return;
    }
    if (editingFillId) {
      const existingFill = fills.find(fill => fill.id === editingFillId);
      if (existingFill && !canManageFill(existingFill)) {
        setShowNotifPopup({ msg: 'Você só pode editar trocas vinculadas à sua equipe efetiva.', type: 'error' });
        return;
      }
    }
    setSaving(true);
    try {
      const doc = await ensureDocumentExists();
      if (!doc) return;

      // Aprovação automática: marca como DEFERIDO e registra quem autorizou
      const autorNome = user?.pessoa?.nomeGuerra || user?.name || '';
      const autorCargo = user?.pessoa?.funcao || '';
      const dadosAprovados: Record<string, string> = {
        ...formData,
        deferido_indeferido: 'DEFERIDO',
        autorizado_por: autorCargo ? `${autorCargo} ${autorNome}` : autorNome,
        data_autorizacao: hojeLocalISO(),
      };
      const formDataToSave = prepareFormDataWithAuth(dadosAprovados);

      const blob = await getTrocaPdfBlob(doc);
      if (!blob) { setShowNotifPopup({ msg: 'PDF template nao encontrado.', type: 'error' }); return; }
      const pdfBytes = await blob.arrayBuffer();
      const dadosStr = buildPdfData(dadosAprovados);
      const pdfBlob = await preencherPdf(pdfBytes, dadosStr, fieldPositionsFromDoc(doc));

      if (editingFillId) {
        await atualizarPreenchimento(editingFillId, {
          filled_data: formDataToSave,
          status: 'signed',
          autentique_document_id: null,
          autentique_link: null,
        });
      } else {
        await criarPreenchimento({
          document_id: doc.id, filled_by: user?.username || null,
          filled_data: formDataToSave, status: 'signed',
          autentique_document_id: null, autentique_link: null,
        });
      }

      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');

      const docFills = await listarPreenchimentos(doc.id);
      setFills(docFills);
      setEditingFillId(null);
      setSubView('list');
      setShowNotifPopup({ msg: 'Troca aprovada e documento gerado com sucesso!', type: 'success' });
    } catch {
      setShowNotifPopup({ msg: 'Erro ao aprovar a troca e gerar o documento. Contate o administrador.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmAutorizacaoAviso() {
    setShowAutorizacaoAviso(false);
    await handleConfirmGerarPdf();
  }

  function handleVisualizar() {
    if (!validateForm()) return;
    setShowPreviewInfo(true);
  }

  async function handleConfirmPreview() {
    setShowPreviewInfo(false);
    setSaving(true);
    try {
      const doc = await ensureDocumentExists();
      if (!doc) return;
      const blob = await getTrocaPdfBlob(doc);
      if (!blob) { setShowNotifPopup({ msg: 'PDF template nao encontrado.', type: 'error' }); return; }
      const pdfBytes = await blob.arrayBuffer();
      const dadosStr = buildPdfData(formData);
      const pdfBlob = await preencherPdf(pdfBytes, dadosStr, fieldPositionsFromDoc(doc));
      const url = URL.createObjectURL(pdfBlob);
      setPreviewPdfUrl(url);
      setShowPdfPreview(true);
    } catch (err) {
      console.error('Erro ao gerar visualizacao:', err);
      setShowNotifPopup({ msg: 'Erro ao gerar visualizacao. Contate o administrador.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  function handleGerarPdf() {
    if (!validateForm()) return;
    if (!canManageFormData(formData)) {
      setShowNotifPopup({ msg: 'Você só pode aprovar trocas vinculadas à sua equipe efetiva.', type: 'error' });
      return;
    }
    if (precisaAutorizacaoGerente(formData.nome_solicitante || '', formData.nome_solicitado || '')) {
      setShowAutorizacaoAviso(true);
    } else {
      setShowConfirmPdf(true);
    }
  }

  async function handleVisualizarPdf(fill: DocumentFill) {
    if (!templateDoc) return;
    try {
      const blob = await getTrocaPdfBlob(templateDoc);
      if (!blob) { setShowNotifPopup({ msg: 'PDF template nao encontrado.', type: 'error' }); return; }
      const pdfBytes = await blob.arrayBuffer();
      const data = fill.filled_data as Record<string, string>;
      const dadosStr = buildPdfData(data);
      const pdfBlob = await preencherPdf(pdfBytes, dadosStr, fieldPositionsFromDoc(templateDoc));
      const url = URL.createObjectURL(pdfBlob);
      window.open(url, '_blank');
    } catch {
      setShowNotifPopup({ msg: 'Erro ao visualizar PDF.', type: 'error' });
    }
  }

  async function handleOverrideLimit() {
    if (!overrideName.trim()) {
      setShowNotifPopup({ msg: 'Informe o nome da pessoa para a qual a troca esta sendo realizada.', type: 'error' });
      return;
    }
    setLimitPopupData(prev => ({ ...prev, targetName: overrideName.trim() }));
    setShowLimitPopup(false);
    setOverrideName('');
    const initialData: Record<string, string> = {};
    displayFields.forEach(f => { initialData[f.field_name] = ''; });
    setFormData(initialData);
    setSubView('form');
    setShowNotifPopup({ msg: `Aviso enviado ao gerente: ${user?.username} esta realizando uma troca adicional para ${overrideName.trim()}.`, type: 'info' });
    try {
      const existing = JSON.parse(localStorage.getItem('sescinc-notificacoes') || '[]');
      existing.push({
        id: crypto.randomUUID(),
        titulo: 'Limite de Trocas Excedido',
        descricao: `${user?.name} (${user?.username}) realizou ${limitPopupData.count + 1} trocas no mês e está realizando mais uma troca para ${overrideName.trim()}.`,
        tipo: 'alerta',
        lida: false,
        equipe: '',
        origem: 'substituicao',
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('sescinc-notificacoes', JSON.stringify(existing));
    } catch { /* ignore */ }
  }

  function handleEditFill(fill: DocumentFill) {
    if (!canManageFill(fill)) {
      setShowNotifPopup({ msg: 'Você só pode editar trocas vinculadas à sua equipe efetiva.', type: 'error' });
      return;
    }
    const data = fill.filled_data as Record<string, string>;
    const initialData: Record<string, string> = {};
    displayFields.forEach(f => { initialData[f.field_name] = data[f.field_name] || ''; });
    setFormData(initialData);
    setEditingFillId(fill.id);
    setSubView('form');
  }

  async function handleArchiveFill(fill: DocumentFill) {
    if (!canManageFill(fill)) {
      setArchiveConfirmFill(null);
      setShowNotifPopup({ msg: 'Você só pode arquivar trocas vinculadas à sua equipe efetiva.', type: 'error' });
      return;
    }
    try {
      await atualizarPreenchimento(fill.id, { status: 'archived' as any });
      setFills(prev => prev.filter(f => f.id !== fill.id));
      setArchiveConfirmFill(null);
      setShowNotifPopup({ msg: 'Documento arquivado com sucesso!', type: 'success' });
    } catch {
      setShowNotifPopup({ msg: 'Erro ao arquivar documento.', type: 'error' });
    }
  }

  function handleDeleteFill(fillId: string) {
    const fill = fills.find(item => item.id === fillId);
    if (fill && !canManageFill(fill)) {
      setShowNotifPopup({ msg: 'Você só pode excluir trocas vinculadas à sua equipe efetiva.', type: 'error' });
      return;
    }
    setDeleteTargetId(fillId);
    setShowDeleteConfirm(true);
  }

  async function confirmDeleteFill() {
    if (!deleteTargetId) return;
    const fill = fills.find(item => item.id === deleteTargetId);
    if (fill && !canManageFill(fill)) {
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
      setShowNotifPopup({ msg: 'Você só pode excluir trocas vinculadas à sua equipe efetiva.', type: 'error' });
      return;
    }
    try {
      await excluirPreenchimento(deleteTargetId);
      setFills(prev => prev.filter(f => f.id !== deleteTargetId));
    } catch {
      setShowNotifPopup({ msg: 'Erro ao excluir. Contate o administrador.', type: 'error' });
    } finally {
      setShowDeleteConfirm(false);
      setDeleteTargetId(null);
    }
  }

  async function handleSaveDraft() {
    if (!validateForm()) return;
    if (!canManageFormData(formData)) {
      setShowNotifPopup({ msg: 'Você só pode salvar trocas vinculadas à sua equipe efetiva.', type: 'error' });
      return;
    }
    if (editingFillId) {
      const existingFill = fills.find(fill => fill.id === editingFillId);
      if (existingFill && !canManageFill(existingFill)) {
        setShowNotifPopup({ msg: 'Você só pode editar trocas vinculadas à sua equipe efetiva.', type: 'error' });
        return;
      }
    }
    setSaving(true);
    try {
      const doc = await ensureDocumentExists();
      if (!doc) return;
      const formDataToSave = prepareFormDataWithAuth(formData);
      if (editingFillId) {
        await atualizarPreenchimento(editingFillId, { filled_data: formDataToSave, status: 'draft' });
      } else {
        await criarPreenchimento({
          document_id: doc.id, filled_by: user?.username || null,
          filled_data: formDataToSave, status: 'draft',
          autentique_document_id: null, autentique_link: null,
        });
      }
      const docFills = await listarPreenchimentos(doc.id);
      setFills(docFills);
      setEditingFillId(null);
      setSubView('list');
    } catch {
      setShowNotifPopup({ msg: 'Erro ao salvar. Contate o administrador.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const inputBase = 'w-full rounded-lg border bg-white px-3 py-2 text-sm text-graphite-900 placeholder-graphite-400 dark:border-graphite-600 dark:bg-graphite-700 dark:text-graphite-100 dark:placeholder-graphite-400';
  const inputNormal = `${inputBase} border-graphite-400`;
  const inputError = `${inputBase} border-red-500 ring-1 ring-red-300 dark:border-red-500 dark:ring-red-600`;
  const readonlyBase = 'w-full rounded-lg border border-graphite-400 bg-graphite-100 px-3 py-2 text-sm text-graphite-600 dark:border-graphite-500 dark:bg-graphite-800 dark:text-graphite-300 cursor-not-allowed';

  function renderField(field: TemplateFieldDef | DocumentField, customClass?: string) {
    const value = formData[field.field_name] || '';
    const cls = customClass || '';
    const funcionarios = getAllFuncionarios();
    const isError = missingFields.includes(field.field_name);
    const base = isError ? inputError : inputNormal;

    if (field.field_name === 'motivo_troca') {
      return <textarea value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder || 'Descreva o motivo da troca...'} rows={5} className={`${base} ${cls}`} />;
    }
    if (field.field_name === 'justificativa_emergencial') {
      return <textarea value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder || 'Informe a justificativa emergencial...'} rows={5} className={`${base} ${cls}`} />;
    }

    if (field.is_signature) return null;

    if (field.conditional_on) {
      const [depFieldName, depValue] = field.conditional_on.split('=');
      if ((formData[depFieldName] || '') !== depValue) return null;
    }

    if (field.field_name === 'funcao_solicitante' || field.field_name === 'funcao_solicitado') {
      const fullLabel = CARGO_OPTIONS.find(c => c.value === value)?.label || value;
      return <input type="text" value={fullLabel} readOnly className={`${readonlyBase} ${cls}`} />;
    }

    if (field.read_only) {
      return <input type="text" value={value} readOnly className={`${readonlyBase} ${cls}`} />;
    }

    switch (field.field_type) {
      case 'checkbox':
        return (
          <div className="flex gap-2">
            {field.options?.map(opt => (
              <label key={opt} className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm cursor-pointer ${
                value === opt ? 'border-aviation-500 bg-aviation-50 dark:border-aviation-400 dark:bg-aviation-900/40' : isError ? 'border-red-400 ring-1 ring-red-300 dark:border-red-500 dark:ring-red-600' : 'border-graphite-200 dark:border-graphite-600'
              }`}>
                <input type="radio" name={field.field_name} value={opt} checked={value === opt}
                  onChange={e => handleFieldChange(field.field_name, e.target.value)} className="sr-only" />
                <span className={`h-3.5 w-3.5 rounded border-2 flex items-center justify-center ${
                  value === opt ? 'border-aviation-500 bg-aviation-500' : 'border-graphite-400 dark:border-graphite-500'
                }`}>
                  {value === opt && <span className="text-[10px] font-bold text-white">X</span>}
                </span>
                <span className="text-graphite-700 dark:text-graphite-200">{opt}</span>
              </label>
            ))}
          </div>
        );
      case 'select':
        return (
          <select value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} className={`${base} ${cls}`}>
            <option value="">{field.placeholder || 'Selecione...'}</option>
            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
      case 'textarea':
        return <textarea value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder || ''} rows={2} className={`${base} ${cls}`} />;
      case 'date':
        return <input type="date" value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} className={`${base} ${cls}`} />;
      case 'number':
        return <input type="number" value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder || ''} className={`${base} ${cls}`} />;
      default:
        if (field.field_name === 'nome_solicitante' || field.field_name === 'nome_solicitado') {
          return <Autocomplete value={value} onChange={val => handleFieldChange(field.field_name, val)} options={funcionarios} placeholder={field.placeholder || 'Digite o nome...'} className={`${base} ${cls}`} />;
        }
        if (field.field_name === 'cpf_solicitante' || field.field_name === 'cpf_solicitado') {
          return <input type="text" value={value} onChange={e => handleCpfChange(field.field_name, e.target.value)} placeholder="000.000.000-00" maxLength={14} className={`${base} ${cls}`} />;
        }
        if (field.data_source && field.data_source !== 'manual') {
          return <Autocomplete value={value} onChange={val => handleFieldChange(field.field_name, val)} options={funcionarios} placeholder={field.placeholder || 'Digite o nome...'} className={`${base} ${cls}`} />;
        }
        return <input type="text" value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder || ''} className={`${base} ${cls}`} />;
    }
  }

  function Label({ field }: { field: TemplateFieldDef | DocumentField }) {
    const isMissing = missingFields.includes(field.field_name);
    return (
      <label className={`mb-1 block text-xs font-medium ${isMissing ? 'text-red-600 dark:text-red-400' : 'text-graphite-600 dark:text-graphite-300'}`}>
        {field.field_label}{field.required && <span className="ml-1 text-red-500">*</span>}
      </label>
    );
  }

  function getF(name: string): TemplateFieldDef | DocumentField | undefined {
    return displayFields.find(f => f.field_name === name);
  }

  if (loading || (isRelatorioRoute && loadingContexto)) {
    return <PageContainer><div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-aviation-500" /></div></PageContainer>;
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

  if (subView === 'form') {
    const sortedFields = [...displayFields].sort((a, b) => a.order_index - b.order_index);
    const signatureFields = sortedFields.filter(f => f.is_signature);

    const fNomeSol = getF('nome_solicitante');
    const fCpfSol = getF('cpf_solicitante');
    const fFuncaoSol = getF('funcao_solicitante');
    const fNomeSolic = getF('nome_solicitado');
    const fCpfSolic = getF('cpf_solicitado');
    const fFuncaoSolic = getF('funcao_solicitado');
    const fDataSol = getF('data_solicitada');
    const fDataFolga = getF('data_folga_solicitado');
    const fTrocaEmerg = getF('troca_emergencial');
    const fJustEmerg = getF('justificativa_emergencial');
    const fMotivo = getF('motivo_troca');

    return (
      <PageContainer>
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => setSubView('list')} className="rounded-lg border border-graphite-200 px-3 py-1.5 text-sm text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-200 dark:hover:bg-graphite-700">
            <ArrowLeft className="inline h-4 w-4 mr-1" />Voltar
          </button>
          <PageTitle icon={RefreshCw} title={editingFillId ? 'Editar Troca de Servico' : 'Nova Troca de Servico'} />
          <div className="ml-auto flex gap-3">
            <button onClick={handleVisualizar} disabled={saving} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Visualizar
            </button>
            <button onClick={handleGerarPdf} disabled={saving} className="flex items-center gap-2 rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Aprovar
            </button>
            <button onClick={handleSaveDraft} disabled={saving} className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50">
              <Save className="h-4 w-4" /> Salvar Rascunho
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {!templateDoc && (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-sm text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              Documento sera criado automaticamente ao salvar.
            </div>
          )}
          {fNomeSol && (
            <div className="rounded-xl border border-graphite-400 bg-graphite-50 p-4 shadow dark:border-graphite-500 dark:bg-graphite-800">
              <h4 className="mb-3 text-sm font-semibold text-graphite-700 dark:text-graphite-200">Solicitante</h4>
              <div className="flex gap-3">
                <div className="w-[45%] shrink-0"><Label field={fNomeSol} />{renderField(fNomeSol)}</div>
                {fCpfSol && <div className="w-[180px] shrink-0"><Label field={fCpfSol} />{renderField(fCpfSol)}</div>}
                {fFuncaoSol && <div className="min-w-0 flex-1"><Label field={fFuncaoSol} />{renderField(fFuncaoSol)}</div>}
              </div>
            </div>
          )}

          {fNomeSolic && (
            <div className="rounded-xl border border-graphite-400 bg-graphite-50 p-4 shadow dark:border-graphite-500 dark:bg-graphite-800">
              <h4 className="mb-3 text-sm font-semibold text-graphite-700 dark:text-graphite-200">Solicitado</h4>
              <div className="flex gap-3">
                <div className="w-[45%] shrink-0"><Label field={fNomeSolic} />{renderField(fNomeSolic)}</div>
                {fCpfSolic && <div className="w-[180px] shrink-0"><Label field={fCpfSolic} />{renderField(fCpfSolic)}</div>}
                {fFuncaoSolic && <div className="min-w-0 flex-1"><Label field={fFuncaoSolic} />{renderField(fFuncaoSolic)}</div>}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-graphite-400 bg-graphite-50 p-4 shadow dark:border-graphite-500 dark:bg-graphite-800">
            <h4 className="mb-3 text-sm font-semibold text-graphite-700 dark:text-graphite-200">Dados da Troca</h4>
            <div className="grid grid-cols-4 gap-3">
              {fDataSol && <div><Label field={fDataSol} />{renderField(fDataSol)}</div>}
              {fDataFolga && <div><Label field={fDataFolga} />{renderField(fDataFolga)}</div>}
              {fTrocaEmerg && <div><Label field={fTrocaEmerg} />{renderField(fTrocaEmerg)}</div>}
            </div>
            {fMotivo && (
              <div className="mt-3 grid grid-cols-1 gap-3">
                <div><Label field={fMotivo} />{renderField(fMotivo)}</div>
                {formData.troca_emergencial === 'SIM' && fJustEmerg && (
                  <div>
                    <Label field={fJustEmerg} />
                    {renderField(fJustEmerg)}
                  </div>
                )}
              </div>
            )}
          </div>

          {signatureFields.length > 0 && (
            <div className="rounded-xl border border-graphite-400 bg-graphite-50 p-4 shadow dark:border-graphite-500 dark:bg-graphite-800">
              <h4 className="mb-3 text-sm font-semibold text-graphite-700 dark:text-graphite-200">Assinaturas</h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {signatureFields.map(f => (
                  <div key={f.field_name} className="flex items-center justify-center gap-1 rounded-lg border-2 border-dashed border-purple-300 bg-purple-100 px-2 py-2 text-center dark:border-purple-600 dark:bg-purple-900/40">
                    <span className="text-xs text-purple-700 dark:text-purple-300 leading-tight">{f.field_label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {showConfirmPdf && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Confirmar Aprovação da Troca</h3>
              </div>
              <p className="mb-2 text-sm text-graphite-600 dark:text-graphite-300">
                Você tem certeza que deseja <strong>aprovar</strong> esta troca e gerar o documento?
              </p>
              <p className="mb-4 text-sm font-semibold text-red-600 dark:text-red-400">
                A troca aprovada alimentará automaticamente a escala diária, o LRO e o PTR-BA do dia.
              </p>
              <p className="mb-6 text-sm font-medium text-graphite-700 dark:text-graphite-200">
                Os dados estão todos corretos?
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => { setShowConfirmPdf(false); setSubView('list'); }} className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-200 dark:hover:bg-graphite-700">
                  Cancelar
                </button>
                <button onClick={handleConfirmGerarPdf} disabled={saving} className="flex items-center gap-2 rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} Aprovar e Gerar Documento
                </button>
              </div>
            </div>
          </div>
        )}

        {showAutorizacaoAviso && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Atenção - Autorização do Gerente</h3>
              </div>
              <p className="mb-4 text-sm text-graphite-600 dark:text-graphite-300">
                Este tipo de troca somente pode ser realizada com autorização do <strong>Gerente</strong>.
              </p>
              <p className="mb-6 text-sm font-medium text-graphite-700 dark:text-graphite-200">
                Deseja continuar?
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => { setShowAutorizacaoAviso(false); setSubView('list'); }} className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-200 dark:hover:bg-graphite-700">
                  Cancelar
                </button>
                <button onClick={handleConfirmAutorizacaoAviso} className="flex items-center gap-2 rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700">
                  Sim, Continuar
                </button>
              </div>
            </div>
          </div>
        )}

        {showLimitPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Limite de Trocas Atingido</h3>
              </div>
              <p className="mb-4 text-sm text-graphite-600 dark:text-graphite-300">
                Voce ja realizou <strong>{limitPopupData.count} trocas</strong> este mes. O limite e de <strong>{MAX_TROCAS_PER_MONTH} trocas por mes</strong>.
              </p>
              <p className="mb-4 text-sm text-graphite-600 dark:text-graphite-300">
                Caso deseje continuar, um aviso sera enviado ao gerente informando que voce esta realizando uma troca adicional.
              </p>
              <div className="mb-6">
                <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">
                  Informe o nome da pessoa para a qual a troca esta sendo realizada:
                </label>
                <input type="text" value={overrideName} onChange={e => setOverrideName(e.target.value)}
                  placeholder="Nome completo..."
                  className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm text-graphite-900 placeholder-graphite-400 dark:border-graphite-600 dark:bg-graphite-700 dark:text-graphite-100 dark:placeholder-graphite-400" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => { setShowLimitPopup(false); setOverrideName(''); }} className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-200 dark:hover:bg-graphite-700">
                  Cancelar
                </button>
                <button onClick={handleOverrideLimit} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                  Continuar e Enviar Aviso
                </button>
              </div>
            </div>
          </div>
        )}

        {showPreviewInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowPreviewInfo(false)}>
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800" onClick={e => e.stopPropagation()}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40">
                  <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Pré-visualização</h3>
              </div>
              <p className="mb-6 text-sm text-graphite-600 dark:text-graphite-300">
                Esta pré-visualização mostra como o documento aprovado será gerado.
              </p>
              <div className="flex justify-end">
                <button onClick={handleConfirmPreview} disabled={saving} className="flex items-center gap-2 rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} OK
                </button>
              </div>
            </div>
          </div>
        )}

        {showPdfPreview && previewPdfUrl && (
          <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-graphite-900">
            <div className="flex items-center justify-between border-b border-graphite-200 px-6 py-3 dark:border-graphite-700">
              <h2 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">
                Visualizar Documento
              </h2>
              <button onClick={() => { setShowPdfPreview(false); URL.revokeObjectURL(previewPdfUrl); setPreviewPdfUrl(''); }}
                className="rounded-lg border border-graphite-200 p-2 text-graphite-600 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-300 dark:hover:bg-graphite-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 bg-graphite-100 dark:bg-graphite-800">
              <iframe src={previewPdfUrl} className="h-full w-full" />
            </div>
          </div>
        )}

        {showValidationPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowValidationPopup(null)}>
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800" onClick={e => e.stopPropagation()}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Campos Obrigatorios</h3>
              </div>
              <p className="text-sm text-graphite-600 dark:text-graphite-300">{showValidationPopup}</p>
              <div className="mt-6 flex justify-end">
                <button onClick={() => setShowValidationPopup(null)} className="rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700">
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

      {archiveConfirmFill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                <Archive className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Arquivar Troca</h3>
            </div>
            <p className="mb-6 text-sm text-graphite-600 dark:text-graphite-300">
              Tem certeza que deseja arquivar esta troca? Ela <strong>desaparecerá da lista de Trocas</strong> e ficará disponível apenas no <strong>Arquivo</strong>.
              {(() => {
                const fd = archiveConfirmFill.filled_data as Record<string, string>;
                const sol = fd.nome_solicitante || '';
                const solic = fd.nome_solicitado || '';
                return sol || solic ? ` (${sol} → ${solic})` : '';
              })()}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setArchiveConfirmFill(null)} className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-200 dark:hover:bg-graphite-700">
                Cancelar
              </button>
              <button onClick={() => handleArchiveFill(archiveConfirmFill)} className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
                <Archive className="h-4 w-4" /> Arquivar
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotifPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNotifPopup(null)}>
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800" onClick={e => e.stopPropagation()}>
              <div className="mb-4 flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  showNotifPopup.type === 'success' ? 'bg-green-100 dark:bg-green-900/40' :
                  showNotifPopup.type === 'error' ? 'bg-red-100 dark:bg-red-900/40' :
                  'bg-blue-100 dark:bg-blue-900/40'
                }`}>
                  {showNotifPopup.type === 'success' ? <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" /> :
                   showNotifPopup.type === 'error' ? <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" /> :
                   <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">
                  {showNotifPopup.type === 'success' ? 'Sucesso' : showNotifPopup.type === 'error' ? 'Erro' : 'Aviso'}
                </h3>
              </div>
              <p className="text-sm text-graphite-600 dark:text-graphite-300">{showNotifPopup.msg}</p>
              <div className="mt-6 flex justify-end">
                <button onClick={() => setShowNotifPopup(null)} className="rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700">
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between">
        <PageTitle icon={RefreshCw} title="Trocas de Servico" />
        <div className="flex items-center gap-2">
          {!isRelatorioRoute && canManageGlobal && (
          <button onClick={() => setViewMode(viewMode === 'list' ? 'report' : 'list')}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
              viewMode === 'report'
                ? 'bg-aviation-600 text-white border-aviation-600'
                : 'border-graphite-300 text-graphite-700 hover:bg-graphite-50 dark:border-border-dark dark:text-graphite-200'
            }`}>
            <FileText className="h-4 w-4" /> {viewMode === 'report' ? 'Voltar à Lista' : 'Pré Relatório'}
          </button>
          )}
          {canCreateTroca && (
          <button onClick={startNewTroca} className="flex items-center gap-2 rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700">
            <Plus className="h-4 w-4" /> Criar Troca
          </button>
          )}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-graphite-400 bg-white p-3 dark:border-graphite-500 dark:bg-graphite-800">
        <Filter className="h-4 w-4 text-graphite-400 dark:text-graphite-500" />
        <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="rounded-lg border border-graphite-400 bg-white px-3 py-1.5 text-sm text-graphite-700 dark:border-graphite-500 dark:bg-graphite-700 dark:text-graphite-200">
          {MONTH_NAMES.map((name, i) => (<option key={i} value={i}>{name}</option>))}
        </select>
        <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="rounded-lg border border-graphite-200 bg-white px-3 py-1.5 text-sm text-graphite-700 dark:border-graphite-600 dark:bg-graphite-700 dark:text-graphite-200">
          {years.map(y => (<option key={y} value={y}>{y}</option>))}
        </select>
        <select value={filterEquipe} onChange={e => setFilterEquipe(e.target.value)} className="rounded-lg border border-graphite-200 bg-white px-3 py-1.5 text-sm text-graphite-700 dark:border-graphite-600 dark:bg-graphite-700 dark:text-graphite-200">
          <option value="">Todas as Equipes</option>
          {EQUIPE_OPTIONS.map(eq => (<option key={eq} value={eq}>{eq}</option>))}
        </select>
        {isRelatorioRoute && (
          <button onClick={() => window.print()}
            className="flex items-center gap-1 rounded-lg border border-graphite-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-graphite-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 dark:hover:bg-surface-hover">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            Imprimir Relatório
          </button>
        )}
        <span className="ml-auto text-xs text-graphite-500 dark:text-graphite-400">{filteredFills.length} troca(s) encontrada(s)</span>
      </div>

      {!isRelatorioRoute && Object.keys(personExcessMap).length > 0 && (
        <div className="mb-4 rounded-xl border border-red-400 bg-red-50 px-5 py-4 shadow-sm dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-200 dark:bg-red-800/50">
              <AlertTriangle className="h-4 w-4 text-red-700 dark:text-red-300" />
            </div>
            <div>
              <p className="text-xs font-bold text-red-800 dark:text-red-200 uppercase tracking-wider">Limite de Trocas Excedido</p>
              <p className="text-xs text-red-600 dark:text-red-400">Limite máximo de {MAX_TROCAS_PER_MONTH} trocas por mês por pessoa.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(personExcessMap).map(([nome, excesso]) => (
              <span key={nome} className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {nome} ({excesso} excedente)
              </span>
            ))}
          </div>
        </div>
      )}

      {(() => {
        const turnWarnings: string[] = [];
        const funcWarnings: string[] = [];
        filteredFills.forEach(fill => {
          const fd = fill.filled_data as Record<string, string>;
          const p1 = getPessoaByNome(fd.nome_solicitante || '');
          const p2 = getPessoaByNome(fd.nome_solicitado || '');
          const cargo1 = p1?.cargo || (fd.funcao_solicitante || '').split(' - ')[0] || '';
          const cargo2 = p2?.cargo || (fd.funcao_solicitado || '').split(' - ')[0] || '';
          const nome1 = p1?.nomeGuerra || fd.nome_solicitante?.split(' ')[0] || '';
          const nome2 = p2?.nomeGuerra || fd.nome_solicitado?.split(' ')[0] || '';
          if (p1?.turno && p2?.turno && !mesmoTurnoEfetivo(p1, p2)) {
            const label = `${cargo1} ${nome1} x ${cargo2} ${nome2} (${p1.turno} x ${p2.turno})`;
            if (!turnWarnings.includes(label)) turnWarnings.push(label);
          }
          if (cargo1 && cargo2 && cargo1 !== cargo2) {
            const label = `${cargo1} ${nome1} x ${cargo2} ${nome2}`;
            if (!funcWarnings.includes(label)) funcWarnings.push(label);
          }
        });
        if (isRelatorioRoute || (turnWarnings.length === 0 && funcWarnings.length === 0)) return null;
        return (
          <div className="space-y-3 mb-4">
            {turnWarnings.length > 0 && (
              <div className="rounded-xl border border-orange-400 bg-orange-50 px-5 py-4 shadow-sm dark:border-orange-800 dark:bg-orange-900/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-200 dark:bg-orange-800/50">
                    <AlertTriangle className="h-4 w-4 text-orange-700 dark:text-orange-300" />
                  </div>
                  <p className="text-xs font-bold text-orange-800 dark:text-orange-200 uppercase tracking-wider">Trocas entre Turnos Diferentes</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {turnWarnings.map((w, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-bold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {funcWarnings.length > 0 && (
              <div className="rounded-xl border border-amber-400 bg-amber-50 px-5 py-4 shadow-sm dark:border-amber-800 dark:bg-amber-900/20">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800/50">
                    <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                  </div>
                  <p className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">Trocas entre Funções Diferentes</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {funcWarnings.map((w, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {viewMode === 'report' ? (
        (() => {
          const baseList = isRelatorioRoute
            ? filteredFills.filter(f => f.status === 'signed')
            : filteredFills;
          // Remove duplicates (same solicitante + same solicitado)
          const unique = new Map<string, typeof baseList[0]>();
          baseList.forEach(f => {
            const fd = f.filled_data as Record<string, string>;
            const key = `${fd.nome_solicitante || ''}|${fd.nome_solicitado || ''}`.toLowerCase();
            if (!unique.has(key) || new Date(f.created_at) > new Date(unique.get(key)!.created_at)) {
              unique.set(key, f);
            }
          });
          const alfabetico = [...unique.values()].sort((a, b) => {
            const nomeA = getNomeCompletoRelatorio((a.filled_data as Record<string, string>)?.nome_solicitante || '').toLowerCase();
            const nomeB = getNomeCompletoRelatorio((b.filled_data as Record<string, string>)?.nome_solicitante || '').toLowerCase();
            const cmp = nomeA.localeCompare(nomeB);
            if (cmp !== 0) return cmp;
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          });
          const assinados = alfabetico.filter(f => f.status === 'signed');
          const naoAssinados = alfabetico.filter(f => f.status !== 'signed');
          return (
            <div className="space-y-6">
              <div className="rounded-2xl border border-graphite-200 bg-white overflow-hidden dark:border-border-dark dark:bg-surface-card">
                {!isRelatorioRoute && (
                <div className="border-b border-graphite-200 px-5 py-4 dark:border-border-dark">
                  <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-100">
                    Trocas de {MONTH_NAMES[filterMonth]} de {filterYear}
                    <span className="ml-2 text-xs font-normal text-graphite-400">({naoAssinados.length} pendentes · {assinados.length} aprovadas)</span>
                  </h3>
                </div>
                )}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-graphite-200 bg-graphite-50 dark:border-border-dark dark:bg-surface-hover">
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Solicitante</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Solicitado</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Data Solicitada</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Data a Trabalhar</th>
                          <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(isRelatorioRoute ? alfabetico : naoAssinados).map((fill, idx, arr) => {
                        const da = fill.filled_data as Record<string, string>;
                        return (
                          <tr key={fill.id} className={`border-b border-graphite-100 dark:border-border-dark ${idx === arr.length - 1 ? 'border-b-0' : ''}`}>
                            <td className="px-4 py-3 text-graphite-900 dark:text-graphite-100">{getNomeCompletoRelatorio(da.nome_solicitante || '')}</td>
                            <td className="px-4 py-3 text-graphite-700 dark:text-graphite-300">{getNomeCompletoRelatorio(da.nome_solicitado || '')}</td>
                            <td className="px-4 py-3 text-xs text-graphite-500 dark:text-graphite-400">{formatarDataBR(da.data_solicitada)}</td>
                            <td className="px-4 py-3 text-xs text-graphite-500 dark:text-graphite-400">{formatarDataBR(da.data_folga_solicitado)}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                fill.status === 'signed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                                fill.status === 'pending' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                                fill.status === 'draft' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                                {fill.status === 'signed' ? 'Aprovada' : fill.status === 'pending' ? 'Aguardando' : fill.status === 'draft' ? 'Rascunho' : 'Cancelado'}
                              </span>
                              <a href={fill.autentique_link || '#'} target={fill.autentique_link ? '_blank' : '_self'} rel="noopener noreferrer"
                                onClick={!fill.autentique_link ? (e => e.preventDefault()) : undefined}
                                className="rounded-lg p-1 text-graphite-400 hover:bg-aviation-50 hover:text-aviation-600 dark:hover:bg-aviation-900/20"
                                title={fill.autentique_link ? "Ver documento" : "Sem documento"}>
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                              </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              {!isRelatorioRoute && assinados.length > 0 && (
                <div className="rounded-2xl border border-green-200 bg-green-50/50 overflow-hidden dark:border-green-800/30 dark:bg-green-900/10">
                  <div className="border-b border-green-200 px-5 py-4 dark:border-green-800/30">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-green-800 dark:text-green-300">
                      <CheckCircle className="h-4 w-4" /> Trocas Aprovadas ({assinados.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-green-200 bg-green-100/50 dark:border-green-800/30 dark:bg-green-900/20">
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-green-700 dark:text-green-400">Solicitante</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-green-700 dark:text-green-400">Solicitado</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-green-700 dark:text-green-400">Data Solicitada</th>
                          <th className="px-4 py-3 text-left text-[10px] font-bold uppercase text-green-700 dark:text-green-400">Data a Trabalhar</th>
                          <th className="px-4 py-3 text-center text-[10px] font-bold uppercase text-green-700 dark:text-green-400">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assinados.map((fill, idx, arr) => {
                          const da = fill.filled_data as Record<string, string>;
                          return (
                            <tr key={fill.id} className={`border-b border-green-100 dark:border-green-800/20 ${idx === arr.length - 1 ? 'border-b-0' : ''}`}>
                              <td className="px-4 py-3 text-green-900 dark:text-green-100">{getNomeCompletoRelatorio(da.nome_solicitante || '')}</td>
                              <td className="px-4 py-3 text-green-800 dark:text-green-300">{getNomeCompletoRelatorio(da.nome_solicitado || '')}</td>
                              <td className="px-4 py-3 text-xs text-green-600 dark:text-green-400">{formatarDataBR(da.data_solicitada)}</td>
                              <td className="px-4 py-3 text-xs text-green-600 dark:text-green-400">{formatarDataBR(da.data_folga_solicitado)}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center gap-1 rounded-full bg-green-200 px-2 py-0.5 text-[10px] font-bold text-green-800 dark:bg-green-800/40 dark:text-green-300">
                                  <CheckCircle className="h-3 w-3" /> Aprovada
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {alfabetico.length === 0 && (
                <div className="rounded-xl border border-dashed border-graphite-400 bg-graphite-50 py-12 text-center">
                  <p className="text-graphite-500">Nenhuma troca em {MONTH_NAMES[filterMonth]} de {filterYear}</p>
                </div>
              )}
            </div>
          );
        })()
      ) : filteredFills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-graphite-400 bg-graphite-50 py-12 text-center dark:border-graphite-500 dark:bg-graphite-800/50">
          <FileText className="mx-auto mb-3 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <p className="text-graphite-500 dark:text-graphite-400">Nenhuma troca em {MONTH_NAMES[filterMonth]} de {filterYear}</p>
          <p className="mt-1 text-sm text-graphite-400 dark:text-graphite-500">Clique em "Criar Troca" para registrar uma nova.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFills.map(fill => {
            const isExpanded = expandedFill === fill.id;
            const data = fill.filled_data as Record<string, string>;
            const nomeSol = data.nome_solicitante || '';
            const nomeSolic = data.nome_solicitado || '';
            const pessoaSol = getPessoaByNome(nomeSol);
            const pessoaSolic = getPessoaByNome(nomeSolic);
            const isExcessoLimite = excessoLimiteIds.has(fill.id);

            let dotColor = 'bg-yellow-500 dark:bg-yellow-400';
            let dotLabel = 'Rascunho';
            if (fill.status === 'signed') {
              dotColor = 'bg-green-500 dark:bg-green-400';
              dotLabel = 'Aprovada';
            } else if (fill.status === 'pending') {
              dotColor = 'bg-blue-500 dark:bg-blue-400';
              dotLabel = 'Aguardando';
            } else if (fill.status === 'cancelled') {
              dotColor = 'bg-red-500 dark:bg-red-400';
              dotLabel = 'Cancelado';
            }

            const displaySol = displayNomeGuerra(nomeSol);
            const displaySolic = displayNomeGuerra(nomeSolic);
            const cargoSolAbr = pessoaSol?.cargo || (data.funcao_solicitante || '').split(' - ')[0] || '';
            const cargoSolicAbr = pessoaSolic?.cargo || (data.funcao_solicitado || '').split(' - ')[0] || '';
            const cargoSolBadge = getCargoLabel(cargoSolAbr);
            const cargoSolicBadge = getCargoLabel(cargoSolicAbr);
            const turnoSol = pessoaSol?.turno || bombeirosList.find((b: any) => nomeSol.includes(b.nomeGuerra))?.turno || '';
            const turnoSolic = pessoaSolic?.turno || bombeirosList.find((b: any) => nomeSolic.includes(b.nomeGuerra))?.turno || '';
            const isFerista = pessoaSol?.equipe === 'Ferista' || pessoaSolic?.equipe === 'Ferista' || bombeirosList.some((b: any) => (nomeSol.includes(b.nomeGuerra) || nomeSolic.includes(b.nomeGuerra)) && b.equipe === 'Ferista');
            const turnosDiferentes = !isFerista && turnoSol && turnoSolic && turnoSol !== turnoSolic;
            const funcoesDiferentes = cargoSolAbr && cargoSolicAbr && cargoSolAbr !== cargoSolicAbr;

            return (
              <div key={fill.id} className={`rounded-xl border bg-white dark:bg-graphite-800 ${
                isExcessoLimite
                  ? 'border-red-500 ring-1 ring-red-300 dark:border-red-500 dark:ring-red-600'
                  : turnosDiferentes
                    ? 'border-orange-400 ring-1 ring-orange-200 dark:border-orange-500 dark:ring-orange-800/40'
                    : funcoesDiferentes
                      ? 'border-amber-400 ring-1 ring-amber-200 dark:border-amber-500 dark:ring-amber-800/40'
                      : 'border-graphite-200 dark:border-graphite-600'
              }`}>
                <div className="flex items-center justify-between p-4">
                  <button onClick={() => setExpandedFill(isExpanded ? null : fill.id)} className="flex flex-1 items-center gap-3 text-left">
                    <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotColor}`} title={dotLabel} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-graphite-900 dark:text-graphite-100 flex items-center gap-1.5 flex-wrap">
                        <span className="rounded-md bg-aviation-100 px-1.5 py-0.5 text-[9px] font-bold text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">{cargoSolAbr || '—'}</span>
                        <span>{pessoaSol?.nomeCompleto || nomeSol}</span>
                        <span className="text-graphite-400 text-xs">{'\u2192'}</span>
                        <span className="rounded-md bg-aviation-100 px-1.5 py-0.5 text-[9px] font-bold text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">{cargoSolicAbr || '—'}</span>
                        <span>{pessoaSolic?.nomeCompleto || nomeSolic}</span>
                        {isExcessoLimite && <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400"><AlertTriangle className="h-2.5 w-2.5" /> LIMITE</span>}
                        {data.troca_emergencial === 'SIM' && <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400"><AlertTriangle className="h-2.5 w-2.5" /> EMERG.</span>}
                        {turnosDiferentes && <span className="inline-flex items-center gap-0.5 rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"><AlertTriangle className="h-2.5 w-2.5" /> TURNOS</span>}
                        {funcoesDiferentes && <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><AlertTriangle className="h-2.5 w-2.5" /> FUNÇÕES</span>}
                      </div>
                      <div className="text-xs text-graphite-500 dark:text-graphite-400 mt-0.5">
                        Criado por: {data.criado_por || fill.filled_by || 'Desconhecido'}
                        {' '}&bull;{' '}
                        {formatarDataBR(fill.created_at)}
                        {!pessoaSol?.cargo && data.funcao_solicitante && <span className="ml-2 text-graphite-400">({getCargoLabel(data.funcao_solicitante)})</span>}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      fill.status === 'draft' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      fill.status === 'signed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                      fill.status === 'pending' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                      fill.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' :
                      'bg-graphite-100 text-graphite-600 dark:bg-graphite-700 dark:text-graphite-300'
                    }`}>
                      {fill.status === 'draft' ? 'Rascunho' : fill.status === 'signed' ? 'Aprovada' : fill.status === 'pending' ? 'Aguardando' : fill.status === 'cancelled' ? 'Cancelado' : fill.status}
                    </span>
                    {fill.status === 'draft' && draftCountdowns[fill.id] != null && (
                      <span className="text-[10px] text-yellow-600 dark:text-yellow-400" title="Tempo ate exclusao automatica">
                        Exclui em: {formatCountdown(draftCountdowns[fill.id])}
                      </span>
                    )}
                    <button onClick={() => setExpandedFill(isExpanded ? null : fill.id)} className="rounded p-1 text-graphite-400 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-graphite-700">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {canManageFill(fill) && fill.status === 'draft' && (
                      <button onClick={() => handleEditFill(fill)} title="Editar" className="rounded p-1 text-graphite-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400">
                        <Edit className="h-4 w-4" />
                      </button>
                    )}
                    {templateDoc && (
                      <button onClick={() => handleVisualizarPdf(fill)} title="Visualizar PDF" className="rounded p-1 text-graphite-400 hover:bg-graphite-100 hover:text-aviation-600 dark:hover:bg-graphite-700 dark:hover:text-aviation-400">
                        <Eye className="h-4 w-4" />
                      </button>
                    )}
                    {canManageFill(fill) && (
                      <button onClick={() => setArchiveConfirmFill(fill)} title="Arquivar" className="rounded p-1 text-graphite-400 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20 dark:hover:text-amber-400">
                        <Archive className="h-4 w-4" />
                      </button>
                    )}
                    {canManageFill(fill) && (
                      <button onClick={() => handleDeleteFill(fill.id)} title="Excluir" className="rounded p-1 text-graphite-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-graphite-100 px-4 py-4 dark:border-graphite-600">
                    {/* Warning banners */}
                    {isExcessoLimite && (
                      <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-400 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20 shadow-sm">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-200 dark:bg-red-800/50">
                          <AlertTriangle className="h-4 w-4 text-red-700 dark:text-red-300" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-red-800 dark:text-red-200 uppercase tracking-wider">Limite Excedido</p>
                          <p className="text-xs text-red-700 dark:text-red-300">Esta pessoa excedeu o limite de {MAX_TROCAS_PER_MONTH} trocas no mês.</p>
                        </div>
                      </div>
                    )}
                    {turnosDiferentes && (
                      <div className="mb-4 flex items-center gap-3 rounded-lg border border-orange-400 bg-orange-50 px-4 py-3 dark:border-orange-800 dark:bg-orange-900/20 shadow-sm">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-200 dark:bg-orange-800/50">
                          <AlertTriangle className="h-4 w-4 text-orange-700 dark:text-orange-300" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-orange-800 dark:text-orange-200 uppercase tracking-wider">Turnos Diferentes</p>
                          <p className="text-xs text-orange-700 dark:text-orange-300">Troca entre turnos diferentes ({pessoaSol?.turno} x {pessoaSolic?.turno}). Necessita autorização do gerente.</p>
                        </div>
                      </div>
                    )}
                    {funcoesDiferentes && (
                      <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/20 shadow-sm">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-200 dark:bg-amber-800/50">
                          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">Funções Diferentes</p>
                          <p className="text-xs text-amber-700 dark:text-amber-300">Troca entre funções diferentes ({cargoSolAbr} x {cargoSolicAbr}). Necessita autorização do gerente.</p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg border border-graphite-100 bg-graphite-50/50 p-3 dark:border-graphite-600 dark:bg-graphite-700/30">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-graphite-400 dark:text-graphite-500">Solicitante</span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-md bg-aviation-100 px-2 py-0.5 text-[10px] font-bold text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">{cargoSolAbr || '—'}</span>
                          <span className="text-sm font-bold uppercase text-graphite-900 dark:text-graphite-100">{pessoaSol?.nomeCompleto || nomeSol || '—'}</span>
                        </div>
                        <p className="mt-1 text-xs text-graphite-500">{pessoaSol?.equipe ? `Equipe ${pessoaSol.equipe}` : (() => { const b = bombeirosList.find((x: any) => nomeSol.includes(x.nomeGuerra)); return b?.equipe ? `Equipe ${b.equipe}` : ''; })()}</p>
                        <p className="mt-1.5 text-[10px] text-graphite-400">Vai tirar o plantão como: <span className="font-semibold text-graphite-700 dark:text-graphite-300">{cargoSolicAbr || '—'}</span></p>
                      </div>
                      <div className="rounded-lg border border-graphite-100 bg-graphite-50/50 p-3 dark:border-graphite-600 dark:bg-graphite-700/30">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-graphite-400 dark:text-graphite-500">Solicitado</span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="rounded-md bg-aviation-100 px-2 py-0.5 text-[10px] font-bold text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">{cargoSolicAbr || '—'}</span>
                          <span className="text-sm font-bold uppercase text-graphite-900 dark:text-graphite-100">{pessoaSolic?.nomeCompleto || nomeSolic || '—'}</span>
                        </div>
                        <p className="mt-1 text-xs text-graphite-500">{pessoaSolic?.equipe ? `Equipe ${pessoaSolic.equipe}` : (() => { const b = bombeirosList.find((x: any) => nomeSolic.includes(x.nomeGuerra)); return b?.equipe ? `Equipe ${b.equipe}` : ''; })()}</p>
                        <p className="mt-1.5 text-[10px] text-graphite-400">Vai tirar o plantão como: <span className="font-semibold text-graphite-700 dark:text-graphite-300">{cargoSolAbr || '—'}</span></p>
                      </div>
                      <div className="rounded-lg border border-graphite-100 bg-graphite-50/50 p-3 dark:border-graphite-600 dark:bg-graphite-700/30">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-graphite-400 dark:text-graphite-500">Datas</span>
                        {data.data_solicitada && <p className="mt-1 text-graphite-900 dark:text-graphite-100">Folga do Solicitante: {formatarDataBR(data.data_solicitada)}</p>}
                        {data.data_folga_solicitado && <p className="text-graphite-900 dark:text-graphite-100">Folga do Solicitado: {formatarDataBR(data.data_folga_solicitado)}</p>}
                        <p className="mt-1 text-xs text-graphite-500">Documento criado por {data.criado_por || fill.filled_by || 'Desconhecido'} em {formatarDataHoraBR(fill.created_at)}</p>
                      </div>
                      <div className="rounded-lg border border-graphite-100 bg-graphite-50/50 p-3 dark:border-graphite-600 dark:bg-graphite-700/30">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-graphite-400 dark:text-graphite-500">Status</span>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${
                            fill.status === 'signed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                            fill.status === 'pending' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                            fill.status === 'draft' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          }`}>
                            {fill.status === 'signed' && <CheckCircle className="h-3.5 w-3.5" />}
                            {fill.status === 'draft' ? 'Rascunho' : fill.status === 'signed' ? 'Aprovada' : fill.status === 'pending' ? 'Aguardando' : 'Cancelado'}
                          </span>
                          {data.troca_emergencial === 'SIM' && (
                            <button onClick={() => setShowJustificativaPopup(fill.id)} className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400">
                              <AlertTriangle className="h-3 w-3" /> Emergencial
                            </button>
                          )}
                        </div>
                        {violationFillIds.has(fill.id) && (
                          <div className="mt-2 rounded-lg border border-green-200 bg-green-50/80 p-2.5 text-center dark:border-green-800/40 dark:bg-green-900/20">
                            <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-green-700 dark:text-green-300">
                              <CheckCircle className="h-4 w-4" /> AUTORIZADO PELO EMBAIXADOR
                            </div>
                            {data.criada_no_lro === 'SIM' ? (
                              <>
                                <p className="text-[10px] text-green-600 dark:text-green-400">
                                  {data.data_autorizacao ? formatarDataBR(data.data_autorizacao) : formatarDataBR(fill.created_at)}
                                </p>
                                {(data.criado_por || fill.filled_by) && (
                                  <p className="text-[10px] font-semibold text-green-700 dark:text-green-300">
                                    Criado por {data.criado_por || fill.filled_by}
                                  </p>
                                )}
                              </>
                            ) : (
                              <p className="text-[10px] text-green-600 dark:text-green-400">
                                {data.data_autorizacao ? formatarDataBR(data.data_autorizacao) : formatarDataBR(fill.created_at)}
                                {data.autorizado_por ? ` · ${data.autorizado_por}` : ''}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {data.motivo_troca && (
                      <div className="mt-3 rounded-lg border border-graphite-200 bg-graphite-50 p-3 dark:border-graphite-600 dark:bg-graphite-700/50">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-graphite-400 dark:text-graphite-500">Motivo da Troca</span>
                        <p className="mt-1 text-sm text-graphite-900 dark:text-graphite-100">{data.motivo_troca}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showJustificativaPopup && (() => {
        const fill = filteredFills.find(f => f.id === showJustificativaPopup);
        const data = fill?.filled_data as Record<string, string> | undefined;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowJustificativaPopup(null)}>
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800" onClick={e => e.stopPropagation()}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/40">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Justificativa da Troca Emergencial</h3>
              </div>
              <p className="text-sm text-graphite-600 dark:text-graphite-300">{data?.justificativa_emergencial || 'Nenhuma justificativa informada.'}</p>
              <div className="mt-6 flex justify-end">
                <button onClick={() => setShowJustificativaPopup(null)} className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-200 dark:hover:bg-graphite-700">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showValidationPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowValidationPopup(null)}>
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Campos Obrigatorios</h3>
            </div>
            <p className="text-sm text-graphite-600 dark:text-graphite-300">{showValidationPopup}</p>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowValidationPopup(null)} className="rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700">
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">Excluir Troca</h3>
            </div>
            <p className="mb-6 text-sm text-graphite-600 dark:text-graphite-300">
              Tem certeza que deseja excluir esta troca? Esta acao nao pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeleteTargetId(null); }} className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-200 dark:hover:bg-graphite-700">
                Cancelar
              </button>
              <button onClick={confirmDeleteFill} className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                <Trash2 className="h-4 w-4" /> Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotifPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNotifPopup(null)}>
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-graphite-800" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                showNotifPopup.type === 'success' ? 'bg-green-100 dark:bg-green-900/40' :
                showNotifPopup.type === 'error' ? 'bg-red-100 dark:bg-red-900/40' :
                'bg-blue-100 dark:bg-blue-900/40'
              }`}>
                {showNotifPopup.type === 'success' ? <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" /> :
                 showNotifPopup.type === 'error' ? <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" /> :
                 <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
              </div>
              <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">
                {showNotifPopup.type === 'success' ? 'Sucesso' : showNotifPopup.type === 'error' ? 'Erro' : 'Aviso'}
              </h3>
            </div>
            <p className="text-sm text-graphite-600 dark:text-graphite-300">{showNotifPopup.msg}</p>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowNotifPopup(null)} className="rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700">
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

export default Trocas;
