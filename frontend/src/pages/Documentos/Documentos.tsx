import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText, Plus, Search, Eye, Loader2,
  ChevronDown, ChevronUp, Edit3, CheckCircle,
  Trash2, Download, Upload, Shield, Save, ArrowLeft,
  AlertTriangle, Package, Link, X, Send, HelpCircle,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { AnimatedPageTour, type AnimatedTourStep } from '../../components/ui/AnimatedPageTour';
import { PdfFieldEditor } from '../../components/documentos/PdfFieldEditor';
import { PdfPreview } from '../../components/documentos/PdfPreview';
import { FieldPropertiesPanel } from '../../components/documentos/FieldPropertiesPanel';
import { Autocomplete } from '../../components/documentos/Autocomplete';
import { GridGenerator } from '../../components/documentos/GridGenerator';
import {
  listarDocumentos, buscarDocumento, criarDocumento, atualizarDocumento,
  excluirDocumento, criarCampo, criarCamposEmLote, atualizarCampo, excluirCampo,
  criarSignatario, excluirSignatario,
  criarPreenchimento,
  uploadPDF, getPdfBlob, sincronizarCamposTemplate,
  listarPdfsStorage,
} from '../../services/documentoService';
import { preencherPdf, downloadPdf } from '../../services/pdfService';
import { criarDocumento as criarDocumentoAutentique } from '../../services/autentiqueService';
import type { AutentiqueSigner } from '../../services/autentiqueService';
import type { Document, DocumentWithFields, DocumentField, DocumentFill } from '../../types/document';
import { SOURCE_MODULE_OPTIONS } from '../../types/document';
import { useAuth } from '../../context/AuthContext';
import { listarBombeiros } from '../../services/bombeiroService';
import { listarAPOCs } from '../../services/apocService';
import { findTemplate } from '../../data/documentTemplates';
import { podeVerCadastroCompletoBase, resolverContextoOperacional } from '../../utils/permissoes';
import { formatarDataBR, hojeLocalISO } from '../../utils/datas';

type View = 'list' | 'admin' | 'manage' | 'fill' | 'grid';
type DocumentosTourStep = AnimatedTourStep & { view: 'list' | 'admin' };

const DOCUMENTOS_TOUR_STEPS: DocumentosTourStep[] = [
  {
    view: 'list',
    target: 'documentos-topo',
    title: 'Biblioteca de documentos',
    body: 'Esta página reúne os modelos de documentos usados pelo sistema. Aqui ficam templates operacionais, administrativos, de treinamento e outros formulários configuráveis.',
    detail: 'Use esta tela para conferir se o documento existe, visualizar o modelo, preencher quando aplicável ou entrar na configuração quando você tiver permissão.',
  },
  {
    view: 'list',
    target: 'documentos-busca',
    title: 'Busca por documento',
    body: 'A busca filtra os documentos pelo nome. Ela é útil quando a lista crescer ou quando você souber o formulário que precisa abrir.',
    detail: 'Digite parte do nome, como troca, checklist, ordem ou outro termo do modelo cadastrado.',
  },
  {
    view: 'list',
    target: 'documentos-lista',
    title: 'Cards dos modelos',
    body: 'Cada card mostra o nome, categoria, descrição e se existe PDF template vinculado. O selo verde indica que o documento já tem modelo PDF configurado.',
    detail: 'Quando o documento tem PDF e campos configurados, ele pode ser preenchido, pré-visualizado e usado para gerar um arquivo final.',
  },
  {
    view: 'list',
    target: 'documentos-lista',
    title: 'Ações do documento',
    body: 'Administradores podem editar, excluir e vincular o documento a um módulo de origem. Esse vínculo ajuda o sistema a saber onde aquele modelo será usado.',
    detail: 'Por exemplo: um template pode ser vinculado a trocas, LRO, treinamento ou outro módulo para manter os documentos organizados.',
  },
  {
    view: 'list',
    target: 'documentos-novo',
    title: 'Criar novo modelo',
    body: 'O botão Novo Documento abre o cadastro inicial de um template. Essa etapa cria a identificação do documento antes da configuração do PDF.',
    detail: 'Só quem tem permissão administrativa vê esta ação, porque ela altera a biblioteca de modelos do sistema.',
  },
  {
    view: 'admin',
    target: 'documentos-form',
    title: 'Dados básicos do modelo',
    body: 'Nesta tela você define nome, descrição e categoria. Esses dados aparecem depois na lista e ajudam a equipe a encontrar o documento correto.',
    detail: 'Use nomes claros, porque o nome do documento também orienta qual template e quais campos o sistema pode sincronizar.',
  },
  {
    view: 'admin',
    target: 'documentos-categoria',
    title: 'Categoria do documento',
    body: 'A categoria separa o documento em operacional, administrativo, treinamento ou geral.',
    detail: 'A categoria não preenche o PDF sozinha, mas deixa a biblioteca mais fácil de filtrar mentalmente e manter organizada.',
  },
  {
    view: 'admin',
    target: 'documentos-criar',
    title: 'Criar e configurar',
    body: 'Depois de criar, o sistema leva para a configuração do template, onde o PDF pode ser anexado e os campos podem ser posicionados.',
    detail: 'É nessa configuração que o documento passa a funcionar de verdade: campos, assinantes, autocomplete e geração do PDF dependem dessa etapa.',
  },
];

export function Documentos() {
  const { user } = useAuth();
  const [canManageDocumentos, setCanManageDocumentos] = useState(() => podeVerCadastroCompletoBase(user));
  const tutorialOrigemRef = useRef<{ view: View; selectedDoc: DocumentWithFields | null; pdfData: ArrayBuffer | null; scrollY: number } | null>(null);

  const [documentos, setDocumentos] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentWithFields | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<View>('list');
  const [expandedFill, setExpandedFill] = useState<string | null>(null);
  const [fills] = useState<DocumentFill[]>([]);

  // Admin
  const [newDocName, setNewDocName] = useState('');
  const [newDocDesc, setNewDocDesc] = useState('');
  const [newDocCategory, setNewDocCategory] = useState('operacional');

  // Editor
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signerRole, setSignerRole] = useState('');
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'props' | 'signers' | 'tray'>('props');

  // Funcionários (bombeiros + apocs)
  const [bombeirosList, setBombeirosList] = useState<any[]>([]);
  const [apocsList, setApocsList] = useState<any[]>([]);

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);

  // Preview modal
  const [previewDoc, setPreviewDoc] = useState<DocumentWithFields | null>(null);
  const [previewPdfData, setPreviewPdfData] = useState<ArrayBuffer | null>(null);
  const [previewLoading] = useState(false);
  const [showFilledPreview, setShowFilledPreview] = useState(false);
  const [filledPreviewUrl, setFilledPreviewUrl] = useState('');

  // Vincular dropdown
  const [vincularOpen, setVincularOpen] = useState<string | null>(null);
  const [notifPopup, setNotifPopup] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ msg: string; onConfirm: () => void; destructive?: boolean } | null>(null);

  // Trocar template modal
  const [showSwapTemplateModal, setShowSwapTemplateModal] = useState(false);

  // Storage PDF picker
  const [showStoragePicker, setShowStoragePicker] = useState(false);
  const [storagePdfs, setStoragePdfs] = useState<{ name: string; path: string; id: string }[]>([]);
  const [storageLoading, setStorageLoading] = useState(false);
  const [storageSearch, setStorageSearch] = useState('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState(0);

  const documentosTourSteps = canManageDocumentos
    ? DOCUMENTOS_TOUR_STEPS
    : DOCUMENTOS_TOUR_STEPS.filter(step => step.view === 'list');
  const currentTutorialStep = documentosTourSteps[tutorialStepIndex] || documentosTourSteps[0];

  useEffect(() => { loadDocumentos(); }, []);

  useEffect(() => {
    let cancelled = false;
    setCanManageDocumentos(podeVerCadastroCompletoBase(user));

    resolverContextoOperacional(user)
      .then(contexto => {
        if (!cancelled) setCanManageDocumentos(contexto.isAdministradorSistema || contexto.canManageGlobal);
      })
      .catch(() => {
        if (!cancelled) setCanManageDocumentos(podeVerCadastroCompletoBase(user));
      });

    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!canManageDocumentos && (view === 'admin' || view === 'manage')) {
      setView('list');
    }
  }, [canManageDocumentos, view]);

  useEffect(() => {
    if (!showTutorial || !currentTutorialStep) return;
    if (view !== currentTutorialStep.view) {
      setView(currentTutorialStep.view);
      setSelectedDoc(null);
      setPdfData(null);
    }
  }, [currentTutorialStep, showTutorial, view]);

  useEffect(() => {
    if (!showTutorial || tutorialStepIndex < documentosTourSteps.length) return;
    setTutorialStepIndex(Math.max(0, documentosTourSteps.length - 1));
  }, [documentosTourSteps.length, showTutorial, tutorialStepIndex]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (vincularOpen) {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-vincular-dropdown]')) {
          setVincularOpen(null);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [vincularOpen]);

  function abrirTutorialDocumentos() {
    tutorialOrigemRef.current = { view, selectedDoc, pdfData, scrollY: window.scrollY };
    setVincularOpen(null);
    setPreviewDoc(null);
    setPreviewPdfData(null);
    setTutorialStepIndex(0);
    setShowTutorial(true);
  }

  function fecharTutorialDocumentos() {
    const origem = tutorialOrigemRef.current;
    setShowTutorial(false);
    setTutorialStepIndex(0);
    if (origem) {
      setView(origem.view);
      setSelectedDoc(origem.selectedDoc);
      setPdfData(origem.pdfData);
      window.setTimeout(() => window.scrollTo({ top: origem.scrollY, behavior: 'smooth' }), 50);
    }
    tutorialOrigemRef.current = null;
  }

  function voltarTutorialDocumentos() {
    setTutorialStepIndex(index => Math.max(0, index - 1));
  }

  function avancarTutorialDocumentos() {
    if (tutorialStepIndex >= documentosTourSteps.length - 1) {
      fecharTutorialDocumentos();
      return;
    }
    setTutorialStepIndex(index => index + 1);
  }

  useEffect(() => {
    async function loadFuncionarios() {
      if (!canManageDocumentos) {
        setBombeirosList([]);
        setApocsList([]);
        return;
      }

      try {
        const [b, a] = await Promise.all([listarBombeiros(), listarAPOCs()]);
        setBombeirosList(b);
        setApocsList(a);
      } catch { /* ignore */ }
    }
    loadFuncionarios();
  }, [canManageDocumentos]);

  async function loadDocumentos() {
    try {
      setDocumentos(await listarDocumentos());
    } catch (err: any) {
      setNotifPopup({ msg: 'Erro inesperado ao carregar documentos. Contate o administrador.', type: 'error' });
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleVincular(docId: string, sourceModule: string) {
    if (!canManageDocumentos) return;
    try {
      await atualizarDocumento(docId, { source_module: sourceModule });
      setDocumentos(prev => prev.map(d => d.id === docId ? { ...d, source_module: sourceModule } : d));
      setVincularOpen(null);
      setNotifPopup({ msg: `Documento vinculado a ${SOURCE_MODULE_OPTIONS.find(m => m.value === sourceModule)?.label || sourceModule}!`, type: 'success' });
      setTimeout(() => setNotifPopup(null), 3000);
    } catch (e) {
      console.error('Erro ao vincular:', e);
      setNotifPopup({ msg: 'Erro ao vincular documento.', type: 'error' });
      setTimeout(() => setNotifPopup(null), 3000);
    }
  }

  async function handleDesvincular(docId: string) {
    if (!canManageDocumentos) return;
    try {
      await atualizarDocumento(docId, { source_module: null });
      setDocumentos(prev => prev.map(d => d.id === docId ? { ...d, source_module: null } : d));
      setVincularOpen(null);
    } catch (e) {
      console.error('Erro ao desvincular:', e);
      setNotifPopup({ msg: 'Erro ao desvincular documento.', type: 'error' });
    }
  }

  // ═══ DOCUMENTO ═══
  async function openManage(doc: Document) {
    if (!canManageDocumentos) return;
    try {
      const full = await buscarDocumento(doc.id);
      if (!full) return;
      const template = findTemplate(doc.name);
      if (template) {
        const synced = await sincronizarCamposTemplate(full, template.fields.map((tf, i) => ({
          document_id: full.id,
          field_name: tf.field_name,
          field_label: tf.field_label,
          field_type: tf.field_type,
          required: tf.required,
          placeholder: tf.placeholder,
          options: tf.options,
          order_index: i,
          page: 1,
          x: 0,
          y: 0,
          width: tf.width,
          height: tf.height,
          font_size: tf.font_size,
          data_source: tf.data_source,
          is_signature: tf.is_signature,
          signer_role: tf.signer_role,
          read_only: tf.read_only,
          conditional_on: tf.conditional_on,
        })));
        if (synced.length > 0) {
          full.document_fields = [...full.document_fields, ...synced];
        }
      }
      setSelectedDoc(full);
      setSelectedFieldId(null);
      await loadPdfData(full);
      setView('manage');
    } catch {
      setNotifPopup({ msg: 'Erro inesperado ao abrir configuracao. Contate o administrador.', type: 'error' });
    }
  }

  function closePreview() {
    setPreviewDoc(null);
    setPreviewPdfData(null);
  }

  function getAllFuncionarios() {
    return [
      ...bombeirosList.map(b => ({ label: b.nomeCompleto, sublabel: `${b.cargo} - ${b.email}`, _type: 'bombeiro' as const, _raw: b })),
      ...apocsList.map(a => ({ label: a.nomeCompleto, sublabel: `APOC - ${a.email}`, _type: 'apoc' as const, _raw: a })),
    ];
  }

  function getEmailByNome(nome: string): string | null {
    if (!nome) return null;
    const all = getAllFuncionarios();
    const match = all.find(f => f.label === nome || f._raw.nomeGuerra === nome);
    return match?._raw.email || null;
  }

  async function loadPdfData(doc: DocumentWithFields | null) {
    if (doc?.template_pdf_url) {
      try {
        const blob = await getPdfBlob(doc.template_pdf_url);
        if (blob) {
          const buf = await blob.arrayBuffer();
          setPdfData(buf);
          return;
        }
        console.warn('PDF blob retornou null para path:', doc.template_pdf_url);
      } catch (err) {
        console.error('Erro ao carregar PDF do storage:', err);
      }
    }
    setPdfData(null);
  }

  async function handleCreateDocument() {
    if (!canManageDocumentos) return;
    if (!newDocName.trim()) return;
    try {
      const doc = await criarDocumento({
        name: newDocName, description: newDocDesc || null,
        category: newDocCategory, template_pdf_url: null, active: true,
        template_pdf_pages: 0, template_pdf_width: 0, template_pdf_height: 0,
        created_by: user?.username || null, source_module: null,
      });

      const template = findTemplate(newDocName);
      if (template) {
        const fieldsToCreate = template.fields.map((tf, i) => ({
          document_id: doc.id,
          field_name: tf.field_name,
          field_label: tf.field_label,
          field_type: tf.field_type,
          required: tf.required,
          placeholder: tf.placeholder,
          options: tf.options,
          order_index: i,
          page: 1,
          x: 0,
          y: 0,
          width: tf.width,
          height: tf.height,
          font_size: tf.font_size,
          data_source: tf.data_source,
          is_signature: tf.is_signature,
          signer_role: tf.signer_role,
          read_only: tf.read_only,
          conditional_on: tf.conditional_on,
        }));
        await criarCamposEmLote(doc.id, fieldsToCreate);

        for (const ts of template.signers) {
          await criarSignatario({
            document_id: doc.id,
            signer_name: ts.signer_name,
            signer_role: ts.signer_role,
            order_index: ts.order_index,
            required: true,
          });
        }
      }

      setDocumentos(await listarDocumentos());
      setNewDocName(''); setNewDocDesc('');
      await openManage(doc);
    } catch {
      setNotifPopup({ msg: 'Erro inesperado ao criar documento. Contate o administrador.', type: 'error' });
    }
  }

  function handleDeleteDocument(id: string) {
    if (!canManageDocumentos) {
      setNotifPopup({ msg: 'Apenas administradores podem excluir documentos.', type: 'error' });
      return;
    }
    setConfirmModal({
      msg: 'Excluir este documento e todos os campos e signatarios?',
      destructive: true,
      onConfirm: async () => {
        try {
          await excluirDocumento(id);
          setSelectedDoc(null);
          setView('list');
          await loadDocumentos();
        } catch {
          setNotifPopup({ msg: 'Erro inesperado ao excluir documento. Contate o administrador.', type: 'error' });
        }
      }
    });
  }

  // ═══ TEMPLATE PATH ═══

  // ═══ TEMPLATE PATH ═══
  async function handleUploadPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedDoc) return;

    if (pdfData) {
      setPendingPdfFile(file);
      setShowConfirmModal(true);
    } else {
      await doUploadPdf(file);
    }
    if (e.target) e.target.value = '';
  }

  async function openStoragePicker() {
    setStorageLoading(true);
    setShowStoragePicker(true);
    try {
      const pdfs = await listarPdfsStorage();
      setStoragePdfs(pdfs);
    } catch {
      setNotifPopup({ msg: 'Erro ao listar PDFs do Storage.', type: 'error' });
    } finally {
      setStorageLoading(false);
    }
  }

  async function handleSelectStoragePdf(pdfPath: string) {
    if (!selectedDoc) return;
    setShowStoragePicker(false);
    setSaving(true);
    try {
      await atualizarDocumento(selectedDoc.id, { template_pdf_url: pdfPath });
      const existingFields = selectedDoc.document_fields;
      if (existingFields.length > 0) {
        await Promise.all(existingFields.map(f => atualizarCampo(f.id, { x: 0, y: 0 })));
      }
      const full = await buscarDocumento(selectedDoc.id);
      if (full) {
        setSelectedDoc(full);
        await loadPdfData(full);
      }
      setDocumentos(await listarDocumentos());
      setActiveTab('tray');
      setNotifPopup({ msg: 'Template vinculado com sucesso!', type: 'success' });
    } catch {
      setNotifPopup({ msg: 'Erro ao vincular PDF.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function doUploadPdf(file: File) {
    if (!selectedDoc) return;

    if (file.size > 4 * 1024 * 1024) {
      setNotifPopup({ msg: 'O arquivo e muito grande. O limite e de 4MB. Tente comprimir o PDF.', type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const key = await uploadPDF(selectedDoc.id, file);
      await atualizarDocumento(selectedDoc.id, { template_pdf_url: key });

      const existingFields = selectedDoc.document_fields;
      if (existingFields.length > 0) {
        await Promise.all(existingFields.map(f => atualizarCampo(f.id, { x: 0, y: 0 })));
      }

      const full = await buscarDocumento(selectedDoc.id);
      if (full) {
        setSelectedDoc(full);
        await loadPdfData(full);
      }
      setDocumentos(await listarDocumentos());
      setActiveTab('tray');
    } catch (err) {
      console.error('Erro no upload:', err);
      setNotifPopup({ msg: 'Erro inesperado ao fazer upload do PDF. Contate o administrador.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  function handleConfirmPdfSwap() {
    if (pendingPdfFile) {
      doUploadPdf(pendingPdfFile);
    }
    setPendingPdfFile(null);
    setShowConfirmModal(false);
  }

  function handleCancelPdfSwap() {
    setPendingPdfFile(null);
    setShowConfirmModal(false);
  }

  // ═══ CAMPOS ═══
  const handleFieldUpdate = useCallback((id: string, updates: Partial<DocumentField>) => {
    setSelectedDoc(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        document_fields: prev.document_fields.map(f => f.id === id ? { ...f, ...updates } : f),
      };
    });
  }, []);

  const handleFieldCommit = useCallback((id: string, updates: Partial<DocumentField>) => {
    atualizarCampo(id, updates).catch(err => console.error('Erro ao salvar campo:', err));
  }, []);

  const handleFieldAdd = useCallback((data: Omit<DocumentField, 'id' | 'created_at'>) => {
    criarCampo(data).then(field => {
      setSelectedDoc(prev => {
        if (!prev) return prev;
        return { ...prev, document_fields: [...prev.document_fields, field] };
      });
      setSelectedFieldId(field.id);
    }).catch(() => {});
  }, []);

  function handleFieldDelete(id: string) {
    setConfirmModal({
      msg: 'Excluir este campo?',
      destructive: true,
      onConfirm: async () => {
        try {
          await excluirCampo(id);
          setSelectedDoc(prev => {
            if (!prev) return prev;
            return { ...prev, document_fields: prev.document_fields.filter(f => f.id !== id) };
          });
          if (selectedFieldId === id) setSelectedFieldId(null);
        } catch {
          setNotifPopup({ msg: 'Erro inesperado ao excluir campo. Contate o administrador.', type: 'error' });
        }
      }
    });
  }

  async function handlePositionField(fieldId: string, page: number) {
    const pageFields = selectedDoc?.document_fields.filter(f => f.page === page && (f.x !== 0 || f.y !== 0)) || [];
    const maxX = pageFields.reduce((max, f) => Math.max(max, f.x + f.width), 50);
    const newY = 50 + (pageFields.length % 5) * 40;

    try {
      await atualizarCampo(fieldId, { x: maxX + 20, y: newY, page });
      setSelectedDoc(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          document_fields: prev.document_fields.map(f =>
            f.id === fieldId ? { ...f, x: maxX + 20, y: newY, page } : f
          ),
        };
      });
      setSelectedFieldId(fieldId);
      setActiveTab('props');
    } catch {
      setNotifPopup({ msg: 'Erro inesperado ao posicionar campo. Contate o administrador.', type: 'error' });
    }
  }

  async function handleDropFromTray(fieldId: string, x: number, y: number, page: number) {
    try {
      await atualizarCampo(fieldId, { x, y, page });
      setSelectedDoc(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          document_fields: prev.document_fields.map(f =>
            f.id === fieldId ? { ...f, x, y, page } : f
          ),
        };
      });
      setSelectedFieldId(fieldId);
      setActiveTab('props');
    } catch {
      setNotifPopup({ msg: 'Erro inesperado ao posicionar campo. Contate o administrador.', type: 'error' });
    }
  }

  async function handleReturnToTray(fieldId: string) {
    try {
      await atualizarCampo(fieldId, { x: 0, y: 0 });
      setSelectedDoc(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          document_fields: prev.document_fields.map(f =>
            f.id === fieldId ? { ...f, x: 0, y: 0 } : f
          ),
        };
      });
      setSelectedFieldId(null);
    } catch {
      setNotifPopup({ msg: 'Erro ao devolver campo para bandeja.', type: 'error' });
    }
  }

  // ═══ SIGNATÁRIOS ═══
  async function handleAddSigner() {
    if (!selectedDoc || !signerName.trim() || !signerRole.trim()) {
      setNotifPopup({ msg: 'Preencha nome e funcao do signatario', type: 'error' });
      return;
    }
    try {
      await criarSignatario({
        document_id: selectedDoc.id,
        signer_name: signerName,
        signer_role: signerRole,
        order_index: selectedDoc.document_signers.length + 1,
        required: true,
      });

      const roleSlug = signerRole.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
      const existingNames = new Set(selectedDoc.document_fields.map(f => f.field_name));

      const personFields: Omit<DocumentField, 'id' | 'created_at'>[] = [];
      const baseIdx = selectedDoc.document_fields.length;

      const fieldsToCreate = [
        { suffix: `nome_${roleSlug}`, label: `Nome Completo (${signerRole})`, type: 'text' as const, src: 'manual' as const, sig: false, ro: false, w: 200, h: 20 },
        { suffix: `cpf_${roleSlug}`, label: `CPF (${signerRole})`, type: 'text' as const, src: 'manual' as const, sig: false, ro: false, w: 120, h: 20 },
        { suffix: `email_${roleSlug}`, label: `Email (${signerRole})`, type: 'text' as const, src: 'manual' as const, sig: false, ro: false, w: 200, h: 20 },
        { suffix: `assinatura_${roleSlug}`, label: `Assinatura ${signerRole}`, type: 'signature' as const, src: 'manual' as const, sig: true, ro: false, w: 150, h: 30 },
        { suffix: `data_autentique_${roleSlug}`, label: `Data Assinatura ${signerRole}`, type: 'date' as const, src: 'autentique_assinatura' as const, sig: false, ro: true, w: 100, h: 18 },
      ];

      let idx = baseIdx;
      for (const f of fieldsToCreate) {
        if (!existingNames.has(f.suffix)) {
          personFields.push({
            document_id: selectedDoc.id,
            field_name: f.suffix,
            field_label: f.label,
            field_type: f.type,
            required: f.sig,
            placeholder: null,
            options: null,
            order_index: idx++,
            page: 1,
            x: 0,
            y: 0,
            width: f.w,
            height: f.h,
            font_size: 10,
            data_source: f.src,
            is_signature: f.sig,
            signer_role: f.sig ? signerRole : null,
            read_only: f.ro,
            conditional_on: null,
          });
        }
      }

      if (personFields.length > 0) {
        await criarCamposEmLote(selectedDoc.id, personFields);
      }

      const full = await buscarDocumento(selectedDoc.id);
      setSelectedDoc(full);
      setSignerName('');
      setSignerRole('');
      if (personFields.length > 0) {
        setNotifPopup({ msg: `${personFields.length} campo(s) criado(s) na bandeja para "${signerRole}"`, type: 'success' });
        setActiveTab('tray');
      }
    } catch {
      setNotifPopup({ msg: 'Erro inesperado ao adicionar signatario. Contate o administrador.', type: 'error' });
    }
  }

  function handleDeleteSigner(id: string) {
    if (!selectedDoc) return;
    setConfirmModal({
      msg: 'Remover signatario?',
      destructive: true,
      onConfirm: async () => {
        try {
          await excluirSignatario(id);
          setSelectedDoc(prev => {
            if (!prev) return prev;
            return { ...prev, document_signers: prev.document_signers.filter(s => s.id !== id) };
          });
        } catch {
          setNotifPopup({ msg: 'Erro inesperado ao remover signatario. Contate o administrador.', type: 'error' });
        }
      }
    });
  }

  // ═══ PREENCHIMENTO ═══
  function handleFieldChange(fieldName: string, value: string) {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  }

  function validateForm(): boolean {
    if (!selectedDoc) return false;
    for (const field of selectedDoc.document_fields.filter(f => !f.is_signature && !f.read_only)) {
      if (field.conditional_on) {
        const [depFieldName, depValue] = field.conditional_on.split('=');
        const depData = formData[depFieldName] || '';
        if (depData !== depValue) continue;
      }
      if (field.required && !formData[field.field_name]) {
        setNotifPopup({ msg: `Preencha o campo: ${field.field_label}`, type: 'error' });
        return false;
      }
    }
    return true;
  }

  function gerarDadosAleatorios(doc: DocumentWithFields): Record<string, string> {
    const dados: Record<string, string> = {};
    doc.document_fields.forEach(f => {
      if (f.is_signature) return;
      const fn = f.field_name;
      if (fn.startsWith('check_')) { dados[fn] = 'V'; return; }
      switch (f.field_type) {
        case 'date': dados[fn] = '2026-07-14'; break;
        case 'number': dados[fn] = '123'; break;
        case 'checkbox': dados[fn] = f.options?.[0] || 'SIM'; break;
        case 'select': dados[fn] = f.options?.[0] || 'Opcao'; break;
        case 'textarea': dados[fn] = 'Texto de exemplo para visualizacao de layout do documento.'; break;
        default:
          if (fn.includes('nome')) dados[fn] = 'Nome Exemplo';
          else if (fn.includes('cpf')) dados[fn] = '123.456.789-00';
          else if (fn.includes('email')) dados[fn] = 'exemplo@email.com';
          else if (fn.includes('funcao') || fn.includes('cargo')) dados[fn] = 'Funcao Exemplo';
          else if (fn.includes('data')) dados[fn] = '2026-07-14';
          else dados[fn] = 'Exemplo ' + fn;
      }
    });
    return dados;
  }

  async function handleVisualizarDoc() {
    if (!selectedDoc || !selectedDoc.template_pdf_url || !pdfData) {
      setNotifPopup({ msg: 'Envie um PDF template primeiro.', type: 'error' });
      setTimeout(() => setNotifPopup(null), 3000);
      return;
    }
    try {
      const dadosStr = gerarDadosAleatorios(selectedDoc);
      const pdfBlob = await preencherPdf(pdfData, dadosStr, selectedDoc.document_fields.map(f => ({
        field_name: f.field_name, x: f.x, y: f.y, width: f.width, height: f.height,
        font_size: f.font_size, is_signature: f.is_signature, field_type: f.field_type, page: f.page,
      })));
      const url = URL.createObjectURL(pdfBlob);
      setFilledPreviewUrl(url);
      setShowFilledPreview(true);
    } catch {
      setNotifPopup({ msg: 'Erro ao gerar visualizacao.', type: 'error' });
      setTimeout(() => setNotifPopup(null), 3000);
    }
  }

  async function handleGerarPdf() {
    if (!selectedDoc || !validateForm()) return;
    setSaving(true);
    try {
      const pdfKey = selectedDoc.template_pdf_url;
      if (!pdfKey) { setNotifPopup({ msg: 'PDF nao vinculado.', type: 'error' }); return; }
      const blob = await getPdfBlob(pdfKey);
      if (!blob) { setNotifPopup({ msg: 'PDF nao encontrado.', type: 'error' }); return; }
      const pdfBytes = await blob.arrayBuffer();
      const dadosStr: Record<string, string> = {};
      for (const [k, v] of Object.entries(formData)) dadosStr[k] = String(v || '');
      const pdfBlob = await preencherPdf(pdfBytes, dadosStr);
      const nome = `${selectedDoc.name.replace(/\s+/g, '_')}_${hojeLocalISO()}.pdf`;
      downloadPdf(pdfBlob, nome);
    } catch {
      setNotifPopup({ msg: 'Erro inesperado ao gerar PDF. Contate o administrador.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSendAutentique() {
    if (!selectedDoc || !validateForm()) return;
    setSaving(true);
    try {
      const pdfKey = selectedDoc.template_pdf_url;
      if (!pdfKey) { setNotifPopup({ msg: 'PDF nao vinculado.', type: 'error' }); return; }
      const blob = await getPdfBlob(pdfKey);
      if (!blob) { setNotifPopup({ msg: 'PDF nao encontrado.', type: 'error' }); return; }
      const pdfBytes = await blob.arrayBuffer();
      const dadosStr: Record<string, string> = {};
      for (const [k, v] of Object.entries(formData)) dadosStr[k] = String(v || '');
      const pdfBlob = await preencherPdf(pdfBytes, dadosStr);

      const nomeArquivo = `${selectedDoc.name.replace(/\s+/g, '_')}_${hojeLocalISO()}`;
      const signers: AutentiqueSigner[] = [];
      for (const signer of selectedDoc.document_signers) {
        const email = getEmailByNome(signer.signer_name);
        if (email) {
          signers.push({ email, action: 'SIGN' });
        } else {
          signers.push({ name: signer.signer_name, action: 'SIGN' });
        }
      }

      const result = await criarDocumentoAutentique(pdfBlob, nomeArquivo, signers, undefined, true);
      await criarPreenchimento({
        document_id: selectedDoc.id, filled_by: user?.username || null,
        filled_data: formData, status: 'pending',
        autentique_document_id: result.id,
        autentique_link: result.signatures[0]?.link?.short_link || null,
      });
      setNotifPopup({ msg: 'Enviado para assinatura no Autentique com sucesso!', type: 'success' });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setNotifPopup({ msg: `Erro ao enviar para Autentique: ${errMsg}`, type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setNotifPopup(null), 4000);
    }
  }

  async function handleSaveDraft() {
    if (!selectedDoc) return;
    try {
      await criarPreenchimento({
        document_id: selectedDoc.id, filled_by: user?.username || null,
        filled_data: formData, status: 'draft',
        autentique_document_id: null, autentique_link: null,
      });
      setNotifPopup({ msg: 'Rascunho salvo!', type: 'success' });
    } catch {
      setNotifPopup({ msg: 'Erro inesperado ao salvar rascunho. Contate o administrador.', type: 'error' });
    }
  }

  function renderFormField(field: DocumentField) {
    const value = formData[field.field_name] || '';
    const base = 'w-full rounded-lg border border-graphite-200 bg-white px-3 py-2.5 text-sm text-graphite-900 dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100';
    const readonlyBase = 'w-full rounded-lg border border-graphite-200 bg-graphite-50 px-3 py-2.5 text-sm text-graphite-500 dark:border-graphite-700 dark:bg-graphite-900 dark:text-graphite-400 cursor-not-allowed';
    const funcionarios = getAllFuncionarios();

    if (field.conditional_on) {
      const [depFieldName, depValue] = field.conditional_on.split('=');
      const depData = formData[depFieldName] || '';
      if (depData !== depValue) return null;
    }

    if (field.data_source === 'autentique_assinatura') {
      return (
        <input type="text" value="Preenchido pelo Autentique apos assinatura" readOnly
          className={readonlyBase + ' italic'} />
      );
    }

    if (field.read_only) {
      return <input type="text" value={value} readOnly className={readonlyBase} />;
    }

    switch (field.field_type) {
      case 'checkbox':
        return (
          <div className="flex gap-2">
            {field.options?.map(opt => (
              <label key={opt} className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                value === opt ? 'border-aviation-500 bg-aviation-50 dark:bg-aviation-900/30' : 'border-graphite-200 dark:border-graphite-700'
              }`}>
                <input
                  type="radio"
                  name={field.field_name}
                  value={opt}
                  checked={value === opt}
                  onChange={e => handleFieldChange(field.field_name, e.target.value)}
                  className="sr-only"
                />
                <span className={`h-4 w-4 rounded border-2 flex items-center justify-center ${
                  value === opt ? 'border-aviation-500 bg-aviation-500' : 'border-graphite-300 dark:border-graphite-600'
                }`}>
                  {value === opt && <span className="text-xs font-bold text-white">X</span>}
                </span>
                <span className="text-graphite-700 dark:text-graphite-300">{opt}</span>
              </label>
            ))}
          </div>
        );
      case 'select':
        return (
          <select value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} className={base}>
            <option value="">{field.placeholder || 'Selecione...'}</option>
            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
      case 'textarea':
        return <textarea value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder || ''} rows={3} className={base} />;
      case 'date':
        return <input type="date" value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} className={base} />;
      case 'number':
        return <input type="number" value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder || ''} className={base} />;
      case 'signature':
        return (
          <div className="flex items-center gap-2 rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/50 px-3 py-6 text-center dark:border-purple-700 dark:bg-purple-900/20">
            <span className="mx-auto text-sm text-purple-500">✎ Campo de assinatura</span>
          </div>
        );
      case 'line':
        return <hr className="border-graphite-300" />;
      default:
        if (field.data_source && field.data_source !== 'manual') {
          return (
            <Autocomplete
              value={value}
              onChange={val => handleFieldChange(field.field_name, val)}
              options={funcionarios}
              placeholder={field.placeholder || 'Digite para buscar...'}
              className={base}
            />
          );
        }
        return <input type="text" value={value} onChange={e => handleFieldChange(field.field_name, e.target.value)} placeholder={field.placeholder || ''} className={base} />;
    }
  }

  // ═══════════════════════════════
  // VIEW: LISTA
  // ═══════════════════════════════
  if (view === 'list') {
    return (
      <>
      {renderOverlays()}
      {previewDoc && renderPreviewModal()}
      <PageContainer>
        <div className="flex items-center justify-between" data-documentos-tour="documentos-topo">
          <PageTitle icon={FileText} title="Documentos" />
          {canManageDocumentos && (
            <button onClick={() => setView('admin')} className="flex items-center gap-2 rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700" data-documentos-tour="documentos-novo">
              <Plus className="h-4 w-4" /> Novo Documento
            </button>
          )}
        </div>
        <div className="mb-4" data-documentos-tour="documentos-busca">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
            <input type="text" placeholder="Buscar documentos..." value={search} onChange={e => setSearch(e.target.value)}
              className="w-full rounded-lg border border-graphite-200 bg-white py-2.5 pl-10 pr-4 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-aviation-500" /></div>
        ) : documentos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-graphite-300 bg-graphite-50 py-12 text-center dark:border-graphite-700 dark:bg-graphite-800/50" data-documentos-tour="documentos-lista">
            <FileText className="mx-auto mb-3 h-12 w-12 text-graphite-300" />
            <p className="text-graphite-500">Nenhum documento</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-documentos-tour="documentos-lista">
            {documentos.filter(d => d.name.toLowerCase().includes(search.toLowerCase())).map(doc => (
              <div key={doc.id} className="group rounded-xl border border-graphite-200 bg-white p-5 transition-all hover:border-aviation-300 hover:shadow-md dark:border-graphite-700 dark:bg-graphite-800">
                <div className="mb-3 flex items-center gap-3">
                  <div className="rounded-lg bg-aviation-50 p-2 dark:bg-aviation-900/30">
                    <FileText className="h-5 w-5 text-aviation-600 dark:text-aviation-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-graphite-900 dark:text-graphite-100">{doc.name}</h3>
                    <span className="text-xs text-graphite-500">{doc.category}</span>
                  </div>
                  {doc.template_pdf_url && <CheckCircle className="h-4 w-4 text-green-500" />}
                </div>
                {doc.description && <p className="text-sm text-graphite-600 dark:text-graphite-400">{doc.description}</p>}
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex gap-3">
                    {canManageDocumentos && (
                    <div className="relative" data-vincular-dropdown>
                      <button onClick={() => setVincularOpen(vincularOpen === doc.id ? null : doc.id)}
                        className={`flex items-center gap-1 text-xs ${
                          doc.source_module
                            ? 'text-green-600 hover:text-green-700 dark:text-green-400'
                            : 'text-aviation-600 hover:text-aviation-700 dark:text-aviation-400'
                        }`}>
                        <Link className="h-3 w-3" />
                        {doc.source_module
                          ? SOURCE_MODULE_OPTIONS.find(m => m.value === doc.source_module)?.label || doc.source_module
                          : 'Vincular'}
                      </button>
                      {vincularOpen === doc.id && (
                        <div className="absolute left-0 top-6 z-40 w-52 rounded-lg border border-graphite-200 bg-white py-1 shadow-lg dark:border-graphite-700 dark:bg-graphite-800">
                          {SOURCE_MODULE_OPTIONS.map(m => (
                            <button key={m.value} onClick={() => handleVincular(doc.id, m.value)}
                              className={`w-full px-3 py-2 text-left text-xs hover:bg-graphite-50 dark:hover:bg-graphite-700 ${
                                doc.source_module === m.value
                                  ? 'font-semibold text-green-600 dark:text-green-400'
                                  : 'text-graphite-700 dark:text-graphite-300'
                              }`}>
                              {m.label}
                            </button>
                          ))}
                          {doc.source_module && (
                            <>
                              <div className="my-1 border-t border-graphite-100 dark:border-graphite-700" />
                              <button onClick={() => handleDesvincular(doc.id)}
                                className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-graphite-700">
                                Desvincular
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    )}
                    {canManageDocumentos && (
                      <button onClick={() => openManage(doc)} className="flex items-center gap-1 text-xs text-graphite-500 hover:text-graphite-700">
                        <Edit3 className="h-3 w-3" /> Editar
                      </button>
                    )}
                  </div>
                  {canManageDocumentos && (
                    <button onClick={() => handleDeleteDocument(doc.id)} className="text-graphite-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageContainer>
      </>
    );
  }
  if (view === 'admin') {
    return (
      <>
      {renderOverlays()}
      <PageContainer>
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => setView('list')} className="rounded-lg border border-graphite-200 px-3 py-1.5 text-sm text-graphite-700 hover:bg-graphite-50 dark:border-graphite-700 dark:text-graphite-200 dark:hover:bg-graphite-700"><ArrowLeft className="inline h-4 w-4 mr-1" />Voltar</button>
          <PageTitle icon={Plus} title="Novo Documento" />
        </div>
        <div className="mx-auto max-w-xl rounded-xl border border-graphite-200 bg-white p-6 shadow-sm dark:border-graphite-700 dark:bg-graphite-800" data-documentos-tour="documentos-form">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Nome do Documento *</label>
              <input type="text" value={newDocName} onChange={e => setNewDocName(e.target.value)} placeholder="Ex: Formulário de Troca de Serviço"
                className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2.5 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Descrição</label>
              <input type="text" value={newDocDesc} onChange={e => setNewDocDesc(e.target.value)} placeholder="Descrição"
                className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2.5 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
            </div>
            <div data-documentos-tour="documentos-categoria">
              <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">Categoria</label>
              <select value={newDocCategory} onChange={e => setNewDocCategory(e.target.value)}
                className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2.5 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100">
                <option value="operacional">Operacional</option>
                <option value="administrativo">Administrativo</option>
                <option value="treinamento">Treinamento</option>
                <option value="geral">Geral</option>
              </select>
            </div>
            <button onClick={handleCreateDocument} disabled={!newDocName.trim()}
              data-documentos-tour="documentos-criar"
              className="flex items-center gap-2 rounded-lg bg-aviation-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-aviation-700 disabled:opacity-50">
              <Plus className="h-4 w-4" /> Criar e Configurar
            </button>
          </div>
        </div>
      </PageContainer>
      </>
    );
  }

  // ═══════════════════════════════
  // VIEW: EDITOR VISUAL (MANAGE)
  // ═══════════════════════════════
  if (view === 'manage' && selectedDoc) {
    const allFields = [...selectedDoc.document_fields].sort((a, b) => a.order_index - b.order_index);
    const positionedFields = allFields.filter(f => f.x !== 0 || f.y !== 0);
    const trayFields = allFields.filter(f => f.x === 0 && f.y === 0);
    const signers = [...selectedDoc.document_signers].sort((a, b) => a.order_index - b.order_index);
    const selectedField = allFields.find(f => f.id === selectedFieldId) || null;

    return (
      <>
        {renderOverlays()}
        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-graphite-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                  <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">
                  Trocar PDF Template
                </h3>
              </div>
              <p className="mb-2 text-sm text-graphite-600 dark:text-graphite-400">
                Tem certeza que deseja trocar o PDF deste documento?
              </p>
              <p className="mb-6 text-sm text-graphite-600 dark:text-graphite-400">
                Os campos existentes <strong>nao serao excluidos</strong>. Eles serao movidos para a aba
                <strong> Bandeja</strong> e voce podera redistribute-los no novo PDF ou exclui-los.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={handleCancelPdfSwap}
                  className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-700 dark:text-graphite-200 dark:hover:bg-graphite-700">
                  Cancelar
                </button>
                <button onClick={handleConfirmPdfSwap}
                  className="rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700">
                  Sim, Trocar PDF
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Swap Template Modal - sem PDF atual */}
        {showSwapTemplateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-graphite-800">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/30">
                  <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">
                  Trocar Template
                </h3>
              </div>
              <p className="mb-6 text-sm text-graphite-600 dark:text-graphite-400">
                Tem certeza que deseja trocar o template? O PDF atual sera removido e voce precisara selecionar um novo.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowSwapTemplateModal(false)}
                  className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-700 dark:text-graphite-200 dark:hover:bg-graphite-700">
                  Cancelar
                </button>
                <button onClick={() => {
                  setPdfData(null);
                  if (selectedDoc) atualizarDocumento(selectedDoc.id, { template_pdf_url: null });
                  setShowSwapTemplateModal(false);
                }}
                  className="rounded-lg bg-aviation-600 px-4 py-2 text-sm font-medium text-white hover:bg-aviation-700">
                  Sim, Trocar
                </button>
              </div>
            </div>
          </div>
        )}

        {showStoragePicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl dark:bg-graphite-800">
              <h3 className="mb-4 text-lg font-semibold text-graphite-900 dark:text-graphite-100">
                <FileText className="mr-2 inline h-5 w-5" /> Escolher PDF do Storage
              </h3>
              <input type="text" value={storageSearch} onChange={e => setStorageSearch(e.target.value)}
                placeholder="Buscar PDF..."
                className="mb-4 w-full rounded-lg border border-graphite-200 bg-white px-3 py-2.5 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
              <div className="max-h-80 overflow-y-auto">
                {storageLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-aviation-500" /></div>
                ) : storagePdfs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-graphite-500">Nenhum PDF encontrado no Storage.</p>
                ) : (
                  <div className="space-y-1">
                    {storagePdfs
                      .filter(p => p.name.toLowerCase().includes(storageSearch.toLowerCase()))
                      .map(pdf => (
                        <button key={pdf.id} onClick={() => handleSelectStoragePdf(pdf.path)}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-graphite-50 dark:hover:bg-graphite-700">
                          <FileText className="h-4 w-4 shrink-0 text-aviation-600" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-graphite-900 dark:text-graphite-100">{pdf.name}</p>
                            <p className="truncate text-[11px] text-graphite-400">{pdf.path}</p>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button onClick={() => { setShowStoragePicker(false); setStorageSearch(''); }}
                  className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-700 dark:text-graphite-200 dark:hover:bg-graphite-700">
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex h-[calc(100vh-4rem)] flex-col">
          {/* Toolbar */}
          <div className="flex items-center gap-3 border-b border-graphite-200 bg-white px-4 py-2 dark:border-graphite-700 dark:bg-graphite-800">
            <button onClick={() => { setView('list'); setSelectedDoc(null); setPdfData(null); }}
              className="rounded-lg border border-graphite-200 px-3 py-1.5 text-sm text-graphite-700 hover:bg-graphite-50 dark:border-graphite-700 dark:text-graphite-200 dark:hover:bg-graphite-700">
              <ArrowLeft className="inline h-4 w-4 mr-1" />Voltar
            </button>
            <PageTitle icon={Edit3} title={selectedDoc.name} />

            <div className="ml-auto flex items-center gap-2">
              <button onClick={handleVisualizarDoc}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                <Eye className="h-3 w-3" /> Visualizar
              </button>
              <button onClick={async () => {
                if (!selectedDoc) return;
                try {
                  for (const f of selectedDoc.document_fields) {
                    await atualizarCampo(f.id, { x: f.x, y: f.y, width: f.width, height: f.height, font_size: f.font_size, page: f.page });
                  }
                  setNotifPopup({ msg: 'Campos salvos com sucesso!', type: 'success' });
                  setTimeout(() => setNotifPopup(null), 3000);
                  setView('list');
                  setSelectedDoc(null);
                  setPdfData(null);
                  setDocumentos(await listarDocumentos());
                } catch {
                  setNotifPopup({ msg: 'Erro ao salvar campos.', type: 'error' });
                  setTimeout(() => setNotifPopup(null), 3000);
                }
              }}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700">
                <Save className="h-3 w-3" /> Salvar
              </button>
              {pdfData ? (
                <>
                  <button onClick={() => setShowSwapTemplateModal(true)}
                    className="flex items-center gap-2 rounded-lg border border-graphite-200 bg-white px-3 py-1.5 text-xs font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:bg-graphite-700 dark:text-graphite-200">
                    <Upload className="h-3 w-3" /> Trocar Template
                  </button>
                  <button onClick={async () => {
                    if (!selectedDoc) return;
                    setConfirmModal({
                      msg: 'Remover o PDF? O documento e os campos serao mantidos.',
                      onConfirm: async () => {
                        try {
                          const { excluirPdf } = await import('../../services/documentoService');
                          await excluirPdf(selectedDoc.id);
                          setPdfData(null);
                          const full = await buscarDocumento(selectedDoc.id);
                          if (full) setSelectedDoc(full);
                          setDocumentos(await listarDocumentos());
                          setNotifPopup({ msg: 'PDF removido com sucesso!', type: 'success' });
                        } catch {
                          setNotifPopup({ msg: 'Erro ao remover PDF.', type: 'error' });
                        }
                      },
                      destructive: true,
                    });
                  }}
                    className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-graphite-700 dark:text-red-400 dark:hover:bg-red-900/20">
                    <Trash2 className="h-3 w-3" /> Remover PDF
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input ref={pdfInputRef} type="file" accept=".pdf" onChange={handleUploadPdf} className="hidden" />
                    <button onClick={() => pdfInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-lg bg-aviation-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-aviation-700">
                      <Upload className="h-3 w-3" /> Enviar PDF
                    </button>
                  </div>
                  <button onClick={openStoragePicker}
                    className="flex items-center gap-2 rounded-lg border border-graphite-200 bg-white px-3 py-1.5 text-xs font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:bg-graphite-700 dark:text-graphite-200">
                    <FileText className="h-3 w-3" /> Escolher do Storage
                  </button>
                </div>
              )}
            </div>
          </div>

          {!pdfData ? (
            <div className="flex flex-1 flex-col items-center justify-center">
              <div className="rounded-xl border border-dashed border-graphite-300 bg-graphite-50 p-12 text-center dark:border-graphite-700 dark:bg-graphite-800/50">
                <FileText className="mx-auto mb-4 h-12 w-12 text-graphite-300" />
                <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Vincule o PDF template</h3>
                <p className="mb-4 text-sm text-graphite-500">Envie um PDF para usar como template deste documento</p>
                {trayFields.length > 0 && (
                  <p className="mb-4 text-sm text-amber-600">
                    <Package className="mr-1 inline h-4 w-4" />
                    {trayFields.length} campo(s) na bandeja aguardando posicionamento
                  </p>
                )}
                <div className="flex items-center justify-center gap-2">
                  <div className="relative">
                    <input ref={pdfInputRef} type="file" accept=".pdf" onChange={handleUploadPdf} className="hidden" />
                    <button onClick={() => pdfInputRef.current?.click()}
                      className="flex items-center gap-2 rounded-lg bg-aviation-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-aviation-700">
                      <Upload className="h-4 w-4" /> Enviar PDF
                    </button>
                  </div>
                  <button onClick={openStoragePicker}
                    className="flex items-center gap-2 rounded-lg border border-graphite-200 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-600 dark:bg-graphite-700 dark:text-graphite-200">
                    <FileText className="h-4 w-4" /> Escolher do Storage
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 overflow-hidden">
              {/* Editor area */}
              <div className="flex-1 overflow-auto bg-graphite-100 dark:bg-graphite-900">
                <PdfFieldEditor
                  pdfData={pdfData}
                  fields={positionedFields}
                  selectedFieldId={selectedFieldId}
                  onSelectField={setSelectedFieldId}
                  onUpdateField={handleFieldUpdate}
                  onCommitField={handleFieldCommit}
                  onAddField={handleFieldAdd}
                  onDropFromTray={handleDropFromTray}
                  onReturnToTray={handleReturnToTray}
                  documentId={selectedDoc.id}
                />
              </div>

              {/* Right panel */}
              <div className="w-80 border-l border-graphite-200 bg-white dark:border-graphite-700 dark:bg-graphite-800">
                <div className="flex h-full flex-col overflow-hidden">
                  {/* Tabs */}
                  <div className="flex border-b border-graphite-200 dark:border-graphite-700">
                    <button onClick={() => setActiveTab('props')}
                      className={`flex-1 px-3 py-2.5 text-xs font-medium ${activeTab === 'props' ? 'border-b-2 border-aviation-600 text-aviation-600' : 'text-graphite-500 hover:text-graphite-700'}`}>
                      Campo
                    </button>
                    <button onClick={() => setActiveTab('signers')}
                      className={`flex-1 px-3 py-2.5 text-xs font-medium ${activeTab === 'signers' ? 'border-b-2 border-aviation-600 text-aviation-600' : 'text-graphite-500 hover:text-graphite-700'}`}>
                      Signatários ({signers.length})
                    </button>
                    <button onClick={() => setActiveTab('tray')}
                      className={`flex-1 px-3 py-2.5 text-xs font-medium ${activeTab === 'tray' ? 'border-b-2 border-aviation-600 text-aviation-600' : 'text-graphite-500 hover:text-graphite-700'}`}>
                      Bandeja ({trayFields.length})
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {/* TAB: Propriedades do campo */}
                    {activeTab === 'props' && (
                      <FieldPropertiesPanel
                        field={selectedField}
                        onUpdate={handleFieldUpdate}
                        onDelete={handleFieldDelete}
                        onReturnToTray={handleReturnToTray}
                      />
                    )}

                    {/* TAB: Bandeja */}
                    {activeTab === 'tray' && (
                      <div className="space-y-3 p-4"
                        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fieldId = e.dataTransfer.getData('text/field-id');
                          if (fieldId) handleReturnToTray(fieldId);
                        }}
                      >
                        <h4 className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">
                          <Package className="mr-1 inline h-4 w-4" /> Bandeja de Campos
                        </h4>
                        <p className="text-xs text-graphite-500">
                          Campos não posicionados no PDF. Clique em "Posicionar" para colocar no PDF.
                        </p>

                        {trayFields.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-graphite-200 p-6 text-center dark:border-graphite-700">
                            <p className="text-sm text-graphite-400">Nenhum campo na bandeja</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {trayFields.map(field => (
                              <div key={field.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/field-id', field.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                }}
                                className={`rounded-lg border px-3 py-2 cursor-grab active:cursor-grabbing ${
                                  field.is_signature
                                    ? 'border-purple-200 bg-purple-50/50 dark:border-purple-700 dark:bg-purple-900/20'
                                    : 'border-graphite-200 bg-graphite-50 dark:border-graphite-700 dark:bg-graphite-800'
                                }`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <span className="block truncate text-sm font-medium text-graphite-900 dark:text-graphite-100">
                                      {field.field_name === 'check_troca_sim' ? '✓ Sim' : field.field_name === 'check_troca_nao' ? '✓ Nao' : field.field_name === 'check_deferido' ? '✓ Deferido' : field.field_name === 'check_indeferido' ? '✓ Indeferido' : `${field.is_signature ? '✎ ' : ''}${field.field_label}`}
                                    </span>
                                    <span className="block text-xs text-graphite-400">{field.field_name}</span>
                                  </div>
                                  <div className="ml-2 flex items-center gap-1">
                                    <button onClick={() => handlePositionField(field.id, field.page || 1)}
                                      className="rounded bg-aviation-100 px-2 py-1 text-xs font-medium text-aviation-700 hover:bg-aviation-200 dark:bg-aviation-900/30 dark:text-aviation-300">
                                      Posicionar
                                    </button>
                                    <button onClick={() => { setSelectedFieldId(field.id); setActiveTab('props'); }}
                                      className="rounded p-1 text-graphite-400 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-graphite-700">
                                      <Edit3 className="h-3.5 w-3.5" />
                                    </button>
                                    <button onClick={() => handleFieldDelete(field.id)}
                                      className="rounded p-1 text-graphite-400 hover:bg-red-50 hover:text-red-500">
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* TAB: Signatários */}
                    {activeTab === 'signers' && (
                      <div className="space-y-4 p-4">
                        <h4 className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">
                          <Shield className="mr-1 inline h-4 w-4" /> Signatários ({signers.length})
                        </h4>

                        <div className="space-y-2 rounded-lg border border-graphite-200 bg-graphite-50 p-3 dark:border-graphite-700 dark:bg-graphite-800/50">
                          <input type="text" value={signerName} onChange={e => setSignerName(e.target.value)}
                            placeholder="Nome do signatário"
                            className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
                          <input type="text" value={signerRole} onChange={e => setSignerRole(e.target.value)}
                            placeholder="Função (ex: Gestor, Solicitante)"
                            className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
                          <button onClick={handleAddSigner}
                            className="w-full rounded-lg bg-aviation-600 px-3 py-2 text-sm font-medium text-white hover:bg-aviation-700">
                            Adicionar Signatário
                          </button>
                        </div>

                        {signers.length > 0 && (
                          <div className="space-y-2">
                            {signers.map(s => (
                              <div key={s.id} className="flex items-center gap-2 rounded-lg border border-graphite-100 px-3 py-2 dark:border-graphite-700">
                                <span className="text-xs font-medium text-graphite-500">{s.order_index}º</span>
                                <div className="flex-1">
                                  <span className="text-sm text-graphite-900 dark:text-graphite-100">{s.signer_name}</span>
                                  <span className="block text-xs text-graphite-400">{s.signer_role}</span>
                                </div>
                                <button onClick={() => handleDeleteSigner(s.id)} className="text-graphite-400 hover:text-red-500">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {signers.length === 0 && (
                          <div className="rounded-lg border border-dashed border-graphite-200 bg-graphite-50 p-6 text-center dark:border-graphite-700 dark:bg-graphite-800/50">
                            <Shield className="mx-auto mb-2 h-8 w-8 text-graphite-300 dark:text-graphite-600" />
                            <p className="text-xs text-graphite-500 dark:text-graphite-400">
                              Nenhum signatário adicionado ainda.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </>
    );
  }

  // ═══════════════════════════════
  // VIEW: PREENCHIMENTO
  // ═══════════════════════════════
  if (view === 'fill' && selectedDoc) {
    const fields = [...selectedDoc.document_fields].sort((a, b) => a.order_index - b.order_index);
    const signers = [...selectedDoc.document_signers].sort((a, b) => a.order_index - b.order_index);
    const manualFields = fields.filter(f => !f.is_signature && f.field_type !== 'line' && f.data_source !== 'autentique_assinatura');
    const signatureFields = fields.filter(f => f.is_signature);
    const autentiqueFields = fields.filter(f => f.data_source === 'autentique_assinatura');

    return (
      <>
      {renderOverlays()}
      <PageContainer>
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => { setView('list'); setSelectedDoc(null); setPdfData(null); }}
            className="rounded-lg border border-graphite-200 px-3 py-1.5 text-sm hover:bg-graphite-50 dark:border-graphite-700">
            <ArrowLeft className="inline h-4 w-4 mr-1" />Voltar
          </button>
          <PageTitle icon={FileText} title={selectedDoc.name} />
        </div>
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="rounded-xl border border-graphite-200 bg-white p-6 shadow-sm dark:border-graphite-700 dark:bg-graphite-800">
            <h3 className="mb-4 text-lg font-semibold text-graphite-900 dark:text-graphite-100">Preencher Documento</h3>

            {manualFields.length > 0 && (
              <div className="space-y-4">
                {manualFields.map(field => (
                  <div key={field.id}>
                    <label className="mb-1 block text-sm font-medium text-graphite-700 dark:text-graphite-300">
                      {field.field_label}{field.required && <span className="ml-1 text-red-500">*</span>}
                    </label>
                    {renderFormField(field)}
                  </div>
                ))}
              </div>
            )}

            {signatureFields.length > 0 && (
              <div className="mt-6 space-y-3 border-t border-graphite-100 pt-4 dark:border-graphite-700">
                <h4 className="text-sm font-semibold text-graphite-700 dark:text-graphite-300">
                  <Shield className="mr-1 inline h-4 w-4" /> Assinaturas Necessárias
                </h4>
                {signatureFields.map(field => (
                  <div key={field.id} className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 dark:border-purple-700 dark:bg-purple-900/20">
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300">✎ {field.field_label}</span>
                    {field.signer_role && <span className="ml-2 text-xs text-purple-500">({field.signer_role})</span>}
                  </div>
                ))}
              </div>
            )}

            {autentiqueFields.length > 0 && (
              <div className="mt-6 space-y-3 border-t border-graphite-100 pt-4 dark:border-graphite-700">
                <h4 className="text-sm font-semibold text-graphite-700 dark:text-graphite-300">
                  Datas de Assinatura (Autentique)
                </h4>
                <p className="text-xs text-graphite-500 dark:text-graphite-400">
                  Estes campos serao preenchidos automaticamente pelo Autentique apos cada assinatura.
                </p>
                {autentiqueFields.map(field => (
                  <div key={field.id} className="flex items-center gap-2 rounded-lg border border-graphite-200 bg-graphite-50 p-3 dark:border-graphite-700 dark:bg-graphite-800/50">
                    <span className="text-sm text-graphite-700 dark:text-graphite-300">{field.field_label}</span>
                    <span className="rounded bg-graphite-200 px-2 py-0.5 text-xs text-graphite-500 dark:bg-graphite-700 dark:text-graphite-400">Aguardando assinatura</span>
                  </div>
                ))}
              </div>
            )}

            {!selectedDoc.template_pdf_url && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-900/20">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Este documento nao possui PDF configurado. Um administrador precisa fazer o upload do PDF template para que o preenchimento possa ser gerado.
                </p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button onClick={handleSaveDraft} className="flex items-center gap-2 rounded-lg border border-graphite-200 px-4 py-2.5 text-sm font-medium hover:bg-graphite-50 dark:border-graphite-700">
                <Save className="h-4 w-4" /> Salvar Rascunho
              </button>
              <button onClick={handleGerarPdf} disabled={!selectedDoc.template_pdf_url}
                className="flex items-center gap-2 rounded-lg bg-aviation-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-aviation-700 disabled:opacity-50">
                <Download className="h-4 w-4" /> Baixar PDF Preenchido
              </button>
              <button onClick={handleSendAutentique} disabled={!selectedDoc.template_pdf_url}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-purple-500/20 transition-all hover:shadow-xl hover:from-purple-500 hover:to-purple-600 active:scale-[0.98] disabled:opacity-50">
                <Send className="h-4 w-4" /> Enviar para Autentique
              </button>
            </div>
          </div>

          {signers.length > 0 && (
            <div className="rounded-xl border border-graphite-200 bg-white p-4 dark:border-graphite-700 dark:bg-graphite-800">
              <h4 className="mb-3 text-sm font-semibold text-graphite-900 dark:text-graphite-100"><Shield className="inline h-4 w-4 mr-1" /> Signatários</h4>
              <div className="space-y-1">
                {signers.map(s => (
                  <div key={s.id} className="flex items-center gap-2 text-sm text-graphite-600 dark:text-graphite-400">
                    <span className="font-medium text-graphite-900 dark:text-graphite-100">{s.order_index}º</span>
                    {s.signer_name} <span className="text-xs text-graphite-400">({s.signer_role})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {fills.length > 0 && (
            <div className="rounded-xl border border-graphite-200 bg-white p-4 dark:border-graphite-700 dark:bg-graphite-800">
              <h4 className="mb-3 text-sm font-semibold text-graphite-900 dark:text-graphite-100">Histórico</h4>
              <div className="space-y-2">
                {fills.map(fill => (
                  <div key={fill.id} className="rounded-lg border border-graphite-100 p-3 dark:border-graphite-700">
                    <button onClick={() => setExpandedFill(expandedFill === fill.id ? null : fill.id)} className="flex w-full items-center justify-between">
                      <span className="text-sm text-graphite-900 dark:text-graphite-100">{formatarDataBR(fill.created_at)}</span>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${fill.status === 'draft' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                          {fill.status === 'draft' ? 'Rascunho' : 'Pendente'}
                        </span>
                        {expandedFill === fill.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </button>
                    {expandedFill === fill.id && (
                      <div className="mt-3 border-t border-graphite-100 pt-3 dark:border-graphite-700">
                        <pre className="text-xs text-graphite-600 dark:text-graphite-400 whitespace-pre-wrap">{JSON.stringify(fill.filled_data, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PageContainer>
      </>
    );
  }

  if (view === 'grid') {
    return (
      <>
        {renderOverlays()}
        <PageContainer>
          <GridGenerator onBack={() => setView('list')} isAdmin={canManageDocumentos} />
        </PageContainer>
      </>
    );
  }

  function renderOverlays() {
    return (
      <>
        {notifPopup && (
          <div className={`fixed top-4 right-4 z-[100] flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            notifPopup.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {notifPopup.msg}
          </div>
        )}
        {confirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-graphite-800">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-graphite-900 dark:text-graphite-100">Confirmar</h3>
              <p className="mb-6 text-sm text-graphite-600 dark:text-graphite-400">{confirmModal.msg}</p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setConfirmModal(null)}
                  className="rounded-lg border border-graphite-200 px-4 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-50 dark:border-graphite-700 dark:text-graphite-200 dark:hover:bg-graphite-700">
                  Cancelar
                </button>
                <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {showFilledPreview && filledPreviewUrl && (
          <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-graphite-900">
            <div className="flex items-center justify-between border-b border-graphite-200 px-6 py-3 dark:border-graphite-700">
              <h2 className="text-lg font-semibold text-graphite-900 dark:text-graphite-100">
                Visualizar Documento Preenchido
              </h2>
              <button onClick={() => { setShowFilledPreview(false); URL.revokeObjectURL(filledPreviewUrl); setFilledPreviewUrl(''); }}
                className="rounded-lg border border-graphite-200 p-2 text-graphite-600 hover:bg-graphite-50 dark:border-graphite-600 dark:text-graphite-300 dark:hover:bg-graphite-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 bg-graphite-100 dark:bg-graphite-800">
              <iframe src={filledPreviewUrl} className="h-full w-full" title="Preview" />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={abrirTutorialDocumentos}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-aviation-200 bg-aviation-600 text-white shadow-2xl shadow-aviation-900/30 transition-all hover:scale-105 hover:bg-aviation-500 focus:outline-none focus:ring-4 focus:ring-aviation-300/40 dark:border-aviation-400/30"
          title="Abrir tutorial de Documentos"
        >
          <HelpCircle className="h-7 w-7" />
        </button>
        <AnimatedPageTour
          open={showTutorial}
          steps={documentosTourSteps}
          stepIndex={tutorialStepIndex}
          targetAttribute="data-documentos-tour"
          onBack={voltarTutorialDocumentos}
          onNext={avancarTutorialDocumentos}
          onClose={fecharTutorialDocumentos}
        />
      </>
    );
  }

  function renderPreviewModal() {
    if (!previewDoc) return null;
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-graphite-900">
        <div className="flex items-center gap-3 border-b border-graphite-200 bg-white px-4 py-2 dark:border-graphite-700 dark:bg-graphite-800">
          <button onClick={closePreview}
            className="rounded-lg border border-graphite-200 px-3 py-1.5 text-sm hover:bg-graphite-50 dark:border-graphite-700">
            <ArrowLeft className="inline h-4 w-4 mr-1" />Fechar
          </button>
          <PageTitle icon={Eye} title={previewDoc.name} />
          <div className="ml-auto flex items-center gap-2">
            {canManageDocumentos && (
              <button onClick={() => { closePreview(); openManage(previewDoc); }}
                className="flex items-center gap-2 rounded-lg border border-graphite-200 px-3 py-1.5 text-xs hover:bg-graphite-50 dark:border-graphite-700">
                <Edit3 className="h-3 w-3" /> Editar
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          {previewLoading ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-aviation-500" />
              <span className="ml-2 text-sm text-graphite-500">Carregando PDF...</span>
            </div>
          ) : !previewPdfData ? (
            <div className="flex flex-1 flex-col items-center justify-center">
              <FileText className="mb-4 h-16 w-16 text-graphite-300" />
              <h3 className="mb-2 text-xl font-semibold text-graphite-700 dark:text-graphite-300">Nenhum PDF para visualizar</h3>
              <p className="mb-4 text-sm text-graphite-500">Este documento ainda nao possui um PDF template configurado.</p>
              {canManageDocumentos && (
                <button onClick={() => { closePreview(); openManage(previewDoc); }}
                  className="inline-flex items-center gap-2 rounded-lg bg-aviation-600 px-6 py-3 text-sm font-medium text-white hover:bg-aviation-700">
                  <Upload className="h-4 w-4" /> Fazer Upload do PDF
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-1 overflow-auto bg-graphite-100 dark:bg-graphite-900">
              <PdfPreview pdfData={previewPdfData} fields={previewDoc.document_fields} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default Documentos;
