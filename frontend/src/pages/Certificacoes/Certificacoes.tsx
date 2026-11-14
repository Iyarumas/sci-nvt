import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Award, Plus, Search, ChevronDown, ChevronUp, X, Eye,
  Shield, GraduationCap, Car, FileText, Upload, Trash2, BadgeCheck, Lock,
} from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { PageTitle } from '../../components/layout/PageTitle';
import { useAuth } from '../../context/AuthContext';
import type { Bombeiro, Equipe } from '../../types/bombeiro';
import { EQUIPE_OPTIONS } from '../../types/bombeiro';
import { listarBombeiros } from '../../services/bombeiroService';
import { NR_OPTIONS } from '../../types/certificacao';
import type { CertificacaoNR } from '../../types/certificacao';
import {
  listarCertificacoes, criarCertificacao,
} from '../../services/certificacaoService';
import { CURSO_OPTIONS } from '../../types/certificacaoCurso';
import type { CertificacaoCurso } from '../../types/certificacaoCurso';
import {
  listarCertificacoesCursos, criarCertificacaoCurso,
} from '../../services/certificacaoCursoService';
import { temCategoriaD } from '../../utils/validacaoCursos';
import {
  canGerenciarCertificacoes,
  canVisualizarCertificacoes,
  equipeEscopoCertificacoes,
  podeVerCertificacoesBase,
  podeVerDadosPessoaisBase,
  resolverContextoOperacional,
} from '../../utils/permissoes';
import { dataLocalISO, formatarDataBR, hojeLocalISO } from '../../utils/datas';
import { PageTour } from '../../components/ui/PageTour';
import { isAdministradorSistema } from '../../utils/permissoes';
import {
  arquivosDoServidor, avaliarArquivo, avaliarPessoa, documentosExemplo, lerConfig, salvarConfig,
  type ArquivoDrive, type ConfigDocumentos, type DocumentoAvaliado,
} from './regrasDrive';
import {
  abrirArquivoDrive, buscarDocumentosDrive, informarDataDrive, vincularTipoDrive, lerConfigDrive, salvarConfigDrive, type DocumentosDriveApi,
} from '../../services/driveDocumentosService';
import { completarConfig, lerConfigLocal } from './regrasDrive';
import { listarSubstituicoesTemporarias } from '../../services/substituicaoTemporariaService';
import type { SubstituicaoTemporaria } from '../../types/substituicaoTemporaria';
import { avaliarArquivo as avaliarParaVer } from './regrasDrive';
import type { ExemploArquivo } from './DriveDocumentos';
import { CrachaValidade, InfoCredencial, alertaCursosAsur, PastasDrive, ResumoDrive, TIPO_CRACHA, ValidadeDocumentos, VisualizadorDocumento } from './DriveDocumentos';

const NR_COLORS: Record<string, string> = {
  'NR-1': 'from-slate-500 to-slate-600',
  'NR-5': 'from-blue-500 to-blue-600',
  'NR-6': 'from-emerald-500 to-emerald-600',
  'NR-10': 'from-yellow-500 to-amber-600',
  'NR-12': 'from-red-500 to-red-600',
  'NR-18': 'from-orange-500 to-orange-600',
  'NR-20': 'from-rose-500 to-rose-600',
  'NR-20 II': 'from-rose-400 to-rose-500',
  'NR-23': 'from-red-600 to-red-700',
  'NR-26': 'from-teal-500 to-teal-600',
  'NR-33': 'from-indigo-500 to-indigo-600',
  'NR-34': 'from-purple-500 to-purple-600',
  'NR-35': 'from-cyan-500 to-cyan-600',
};

const CERTIFICACOES_TOUR_STEPS = [
  {
    selector: 'main h1',
    title: 'Certificações',
    body: 'Esta tela concentra certificados NR e cursos operacionais dos bombeiros.',
    detail: 'Ela ajuda a controlar validade, anexar comprovantes e verificar requisitos para funções como BA-CE, BA-LR, CRS e Motorista CCI.',
  },
  {
    selector: 'main input, main select',
    title: 'Busca e equipe',
    body: 'Pesquise o funcionário pelo nome e, quando tiver permissão, filtre por equipe.',
    detail: 'BA-CE e BA-LR visualizam conforme a equipe efetiva. Administrador e GS conseguem olhar todas as equipes e gerenciar os certificados.',
  },
  {
    selector: 'main p',
    title: 'Resumo da tela',
    body: 'O resumo mostra quantos funcionários, NRs e cursos estão carregados na tela.',
    detail: 'Use esse número para confirmar se o filtro selecionado está mostrando o conjunto esperado antes de revisar vencimentos.',
  },
  {
    selector: 'main .space-y-3',
    title: 'Cards dos funcionários',
    body: 'Cada card mostra a pessoa, equipe, cargo, CNH/CVE quando aplicável, NRs e cursos cadastrados.',
    detail: 'Os selos de validade mostram se um certificado está válido, próximo do vencimento ou vencido. Certificados vitalícios aparecem sem cobrança de validade.',
  },
  {
    selector: 'main button',
    title: 'Adicionar NR ou curso',
    body: 'Os botões de adicionar abrem formulários inline dentro do próprio funcionário.',
    detail: 'Para NR, escolha a NR, emissão, validade, empresa certificadora e anexo. Para cursos, escolha o curso, datas, se é vitalício quando permitido e anexe PDF ou imagem do certificado.',
  },
  {
    selector: 'main iframe, main img, main button',
    title: 'Visualizar comprovante',
    body: 'Quando um certificado tem anexo, o botão de visualização abre o arquivo em modal.',
    detail: 'Use essa visualização para conferir se o documento anexado corresponde ao curso ou NR antes de considerar o cadastro correto.',
  },
];

function getDefaultValidade(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return dataLocalISO(d);
}

function getStatusValidade(dataValidade: string): { label: string; color: string } {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const validade = new Date(dataValidade + 'T00:00:00');
  const dias = Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  if (dias < 0) return { label: 'Vencida', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' };
  if (dias <= 90) return { label: 'Próximo ao vencimento', color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' };
  return { label: 'Válida', color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' };
}

function isPdf(arquivo: string): boolean {
  return arquivo.startsWith('data:application/pdf');
}

/* ───────── Dropzone de Arquivo ───────── */

function FileDropzone({ value, onChange, label }: { value: string; onChange: (v: string, tipo: 'image' | 'pdf') => void; label: string }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const tipo: 'image' | 'pdf' = file.type === 'application/pdf' ? 'pdf' : 'image';
      onChange(reader.result as string, tipo);
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <label className="block mb-1 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">{label}</label>
      {value ? (
        <div className="relative">
          {isPdf(value) ? (
            <div className="flex items-center gap-3 rounded-xl border border-graphite-200 bg-graphite-50 p-4 dark:border-border-dark dark:bg-surface-card">
              <FileText className="h-8 w-8 text-red-500" />
              <span className="text-xs text-graphite-600 dark:text-graphite-300 truncate">PDF anexado</span>
            </div>
          ) : (
            <img src={value} className="w-full rounded-xl object-contain max-h-48" alt="Certificado" />
          )}
          <button onClick={() => onChange('', 'image')} className="absolute top-2 right-2 rounded-lg bg-red-500 p-1 text-white hover:bg-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors ${
            dragging
              ? 'border-aviation-400 bg-aviation-50/50 dark:bg-aviation-900/10'
              : 'border-graphite-300 dark:border-border-dark hover:border-aviation-400 hover:bg-aviation-50/30'
          }`}
        >
          <Upload className={`mb-2 h-8 w-8 ${dragging ? 'text-aviation-500' : 'text-graphite-400'}`} />
          <p className="text-xs font-medium text-graphite-500 dark:text-graphite-400">Arraste ou clique para selecionar</p>
          <p className="mt-1 text-[10px] text-graphite-400 dark:text-graphite-500">PDF ou imagem (JPG, PNG)</p>
          <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }} />
        </div>
      )}
    </div>
  );
}

/* ───────── Modal de Arquivo ───────── */

function ArquivoModal({ arquivo, onClose, title }: { arquivo: string; onClose: () => void; title: string }) {
  if (!arquivo) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-3xl" onClick={e => e.stopPropagation()}>
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-surface-elevated">
          <div className="flex items-center justify-between border-b border-graphite-200 px-6 py-4 dark:border-border-dark">
            <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{title}</h3>
            <button onClick={onClose} className="rounded-xl p-1.5 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-5 w-5" /></button>
          </div>
          <div className="p-6">
            {isPdf(arquivo) ? (
              <iframe src={arquivo} className="w-full h-[70vh] rounded-xl" title={title} />
            ) : (
              <img src={arquivo} className="w-full rounded-xl object-contain max-h-[70vh]" alt={title} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── Formulário NR ───────── */

function NRFormInline({ funcionarioId, funcionarioNome, onSave, onCancel }: {
  funcionarioId: string; funcionarioNome: string;
  onSave: (data: Omit<CertificacaoNR, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}) {
  const hoje = hojeLocalISO();
  const [form, setForm] = useState({
    nrNumero: '', nrNome: '', dataEmissao: hoje,
    dataValidade: getDefaultValidade(), empresa: 'Grupo MedMais',
    arquivo: '', tipoArquivo: 'image' as 'image' | 'pdf',
  });

  const input = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100';
  const label = 'block mb-1 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

  function handleNR(numero: string) {
    const nr = NR_OPTIONS.find(n => n.numero === numero);
    setForm(f => ({ ...f, nrNumero: numero, nrNome: nr?.nome || '' }));
  }

  return (
    <tr className="bg-aviation-50/50 dark:bg-aviation-900/10">
      <td className="px-4 py-4" colSpan={4}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={label}>NR *</label>
            <select value={form.nrNumero} onChange={e => handleNR(e.target.value)} className={input}>
              <option value="">Selecione</option>
              {NR_OPTIONS.map(nr => <option key={nr.numero} value={nr.numero}>{nr.numero} — {nr.nome}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Data de Emissão</label>
            <input type="date" value={form.dataEmissao} onChange={e => setForm(f => ({ ...f, dataEmissao: e.target.value }))} className={input} />
          </div>
          <div>
            <label className={label}>Data de Validade *</label>
            <input type="date" value={form.dataValidade} onChange={e => setForm(f => ({ ...f, dataValidade: e.target.value }))} className={input} />
          </div>
          <div>
            <label className={label}>Empresa Certificadora</label>
            <input value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} className={input} placeholder="Grupo MedMais" />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <FileDropzone value={form.arquivo} onChange={(v, tipo) => setForm(f => ({ ...f, arquivo: v, tipoArquivo: tipo }))} label="Arquivo do Certificado" />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-graphite-300 bg-white px-3 py-1.5 text-xs font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
          <button onClick={() => onSave({
            funcionarioId, funcionarioNome, nrNumero: form.nrNumero, nrNome: form.nrNome,
            dataEmissao: form.dataEmissao, dataValidade: form.dataValidade,
            empresa: form.empresa, arquivo: form.arquivo, tipoArquivo: form.tipoArquivo,
          })} disabled={!form.nrNumero || !form.dataValidade}
            className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-aviation-600 to-aviation-700 px-3 py-1.5 text-xs font-medium text-white shadow-md transition-all hover:from-aviation-500 hover:to-aviation-600 disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ───────── Formulário Curso ───────── */

function CursoFormInline({ funcionarioId, funcionarioNome, onSave, onCancel }: {
  funcionarioId: string; funcionarioNome: string;
  onSave: (data: Omit<CertificacaoCurso, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}) {
  const hoje = hojeLocalISO();
  const [form, setForm] = useState({
    cursoTipo: '', cursoNome: '', dataEmissao: hoje,
    dataValidade: getDefaultValidade(), semValidade: false,
    empresa: 'Grupo MedMais', arquivo: '', tipoArquivo: 'image' as 'image' | 'pdf',
  });

  const input = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100';
  const label = 'block mb-1 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';
  const cursosInternos = CURSO_OPTIONS.filter(c => c.categoria === 'interno');
  const cursosAsur = CURSO_OPTIONS.filter(c => c.categoria === 'asur');

  const cursosSemValidade = ['chefeEquipe', 'motoristaCCI'];

  function handleCurso(tipo: string) {
    const c = CURSO_OPTIONS.find(o => o.tipo === tipo);
    const semValidade = cursosSemValidade.includes(tipo);
    setForm(f => ({
      ...f, cursoTipo: tipo, cursoNome: c?.nome || '',
      semValidade,
      dataValidade: semValidade ? '' : getDefaultValidade(),
    }));
  }

  return (
    <tr className="bg-purple-50/50 dark:bg-purple-900/10">
      <td className="px-4 py-4" colSpan={4}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={label}>Curso *</label>
            <select value={form.cursoTipo} onChange={e => handleCurso(e.target.value)} className={input}>
              <option value="">Selecione</option>
              <optgroup label="Cursos Internos">
                {cursosInternos.map(c => <option key={c.tipo} value={c.tipo}>{c.nome}</option>)}
              </optgroup>
              <optgroup label="Cursos ASUR">
                {cursosAsur.map(c => <option key={c.tipo} value={c.tipo}>{c.nome}</option>)}
              </optgroup>
            </select>
          </div>
          <div>
            <label className={label}>Data de Emissão</label>
            <input type="date" value={form.dataEmissao} onChange={e => setForm(f => ({ ...f, dataEmissao: e.target.value }))} className={input} />
          </div>
          {!cursosSemValidade.includes(form.cursoTipo) ? (
            <div>
              <label className={label}>{form.semValidade ? 'Sem data de validade' : 'Data de Validade'}</label>
              {form.semValidade ? (
                <input type="text" readOnly value="Sem validade — Vitalício"
                  className={`${input} cursor-default opacity-70`} />
              ) : (
                <input type="date" value={form.dataValidade} onChange={e => setForm(f => ({ ...f, dataValidade: e.target.value }))} className={input} />
              )}
              <label className="mt-1 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.semValidade}
                  onChange={e => setForm(f => ({ ...f, semValidade: e.target.checked }))}
                  className="h-3.5 w-3.5 rounded border-graphite-300 text-purple-600 focus:ring-purple-500" />
                <span className="text-[11px] text-graphite-500 dark:text-graphite-400">Curso sem validade</span>
              </label>
            </div>
          ) : (
            <div />
          )}
          <div>
            <label className={label}>Empresa Certificadora</label>
            <input value={form.empresa} onChange={e => setForm(f => ({ ...f, empresa: e.target.value }))} className={input} placeholder="Grupo MedMais" />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <FileDropzone value={form.arquivo} onChange={(v, tipo) => setForm(f => ({ ...f, arquivo: v, tipoArquivo: tipo }))} label="Arquivo do Certificado" />
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-graphite-300 bg-white px-3 py-1.5 text-xs font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">Cancelar</button>
          <button onClick={() => onSave({
            funcionarioId, funcionarioNome, cursoTipo: form.cursoTipo, cursoNome: form.cursoNome,
            dataEmissao: form.dataEmissao, dataValidade: form.semValidade ? '' : form.dataValidade,
            semValidade: form.semValidade, empresa: form.empresa, arquivo: form.arquivo, tipoArquivo: form.tipoArquivo,
          })} disabled={!form.cursoTipo}
            className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 px-3 py-1.5 text-xs font-medium text-white shadow-md transition-all hover:from-purple-500 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus className="h-3.5 w-3.5" /> Adicionar Curso
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ───────── Cursos do Cadastro (cadastro + Drive) ───────── */

type CorRequisito = 'green' | 'orange' | 'red' | 'gray';

const COR_REQUISITO: Record<CorRequisito, { card: string; icone: string; texto: string }> = {
  green: { card: 'border-green-200 bg-green-50/50 dark:border-green-800/40 dark:bg-green-900/10', icone: 'bg-gradient-to-br from-green-500 to-green-600 text-white', texto: 'text-green-600 dark:text-green-400' },
  orange: { card: 'border-orange-200 bg-orange-50/50 dark:border-orange-800/40 dark:bg-orange-900/10', icone: 'bg-gradient-to-br from-orange-500 to-orange-600 text-white', texto: 'text-orange-600 dark:text-orange-400' },
  red: { card: 'border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-900/10', icone: 'bg-gradient-to-br from-red-500 to-red-600 text-white', texto: 'text-red-600 dark:text-red-400' },
  gray: { card: 'border-graphite-200 bg-graphite-50/50 dark:border-border-dark dark:bg-surface-card/50', icone: 'bg-graphite-200 text-graphite-400 dark:bg-graphite-700 dark:text-graphite-500', texto: 'text-graphite-400 dark:text-graphite-500' },
};

interface Requisito { titulo: string; cor: CorRequisito; texto: string; detalhe?: string; icone: 'curso' | 'carro' }

function CardRequisito({ titulo, cor, texto, detalhe, icone }: Requisito) {
  const estilo = COR_REQUISITO[cor];
  const Icone = icone === 'carro' ? Car : BadgeCheck;
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 ${estilo.card}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${estilo.icone}`}>
        <Icone className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-graphite-900 dark:text-graphite-100">{titulo}</p>
        <p className={`text-[10.5px] font-medium leading-snug ${estilo.texto}`}>{texto}</p>
        {detalhe && <p className="text-[10px] leading-snug text-graphite-500 dark:text-graphite-400">{detalhe}</p>}
      </div>
    </div>
  );
}

/**
 * Chefe de Equipe, Motorista/Condutor CCI, CNH D/E e CVE. Quem tem pasta no Drive: vale o certificado
 * na pasta; marcado no cadastro sem o certificado na pasta fica laranja ("falta o certificado").
 * Sem pasta no Drive: vale o cadastro. CNH AD, D, AE ou E com CVE = pode dirigir os veículos da SCI.
 */
function requisitosDoCadastro(f: Bombeiro, porPasta: Map<string, DocumentoAvaliado[]>, pastaNoDrive = false): Requisito[] {
  const noDrive = (tipo: string) => {
    for (const docs of porPasta.values()) {
      // Só conta certificado de verdade: o bloco de notas de "falta" (que vira "Não tem" quando o
      // curso não é obrigatório) não é o curso.
      const doc = docs.find(d => d.tipo === tipo && d.situacao !== 'falta' && d.situacao !== 'gs'
        && d.arquivos.some(a => !a.marcadorFalta));
      if (doc) return doc;
    }
    return undefined;
  };
  const venceu = (doc?: DocumentoAvaliado) => doc?.situacao === 'vencido';
  const validadeDe = (doc?: DocumentoAvaliado) => (doc && doc.vencimento ? doc.texto : undefined);

  const categoria = (f.cnhCategoria || '').toUpperCase();
  const catDE = temCategoriaD(categoria);
  const cnhDoc = noDrive('CNH');
  const cveDoc = noDrive('CVE');
  // Marcado no cadastro, mas a pasta do Drive não tem o certificado: não conta como "possui".
  const semCertificado = (noCadastro: boolean | undefined, doc?: DocumentoAvaliado) => pastaNoDrive && !!noCadastro && !doc;
  const possui = (noCadastro: boolean | undefined, doc?: DocumentoAvaliado) => !!doc || (!!noCadastro && !pastaNoDrive);
  const FALTA_CERTIFICADO = { cor: 'orange' as const, texto: 'Falta o certificado na pasta', detalhe: 'Marcado no cadastro' };
  const temCVE = possui(f.cursoCVE, cveDoc) && !venceu(cveDoc);
  const cnhOk = catDE && !venceu(cnhDoc);

  const chefeDoc = noDrive('CHEFE DE EQUIPE (BA-CE)');
  const temChefe = possui(f.cursoChefeEquipe, chefeDoc);
  const cargoExigeChefe = f.cargo === 'BA-CE' || f.cargo === 'BA-LR';

  const motoristaDoc = noDrive('MOTORISTA CONDUTOR (BA-MC)');
  const temMotorista = possui(f.cursoMotoristaCCI, motoristaDoc);
  const podeDirigirCRS = !temMotorista && cnhOk && temCVE;

  return [
    {
      titulo: 'Chefe de Equipe', icone: 'curso',
      ...(semCertificado(f.cursoChefeEquipe, chefeDoc) ? FALTA_CERTIFICADO : {
        cor: temChefe ? 'green' : cargoExigeChefe ? 'red' : 'gray',
        texto: temChefe ? 'Possui o curso' : 'Não possui',
      }),
    },
    {
      titulo: 'Motorista/Condutor CCI', icone: 'carro',
      ...(semCertificado(f.cursoMotoristaCCI, motoristaDoc) ? FALTA_CERTIFICADO : {
        cor: temMotorista ? 'green' : podeDirigirCRS ? 'orange' : f.cargo === 'BA-MC' ? 'red' : 'gray',
        texto: temMotorista ? 'Possui o curso' : podeDirigirCRS ? 'Não possui · pode dirigir o CRS' : 'Não possui',
      }),
    },
    {
      titulo: 'CNH Categoria D/E', icone: 'carro',
      cor: !catDE ? 'gray' : venceu(cnhDoc) ? 'red' : temCVE ? 'green' : 'orange',
      texto: !catDE
        ? (categoria ? `Categoria ${categoria} · não é D/E` : 'Não possui')
        : venceu(cnhDoc) ? `Categoria ${categoria} · CNH vencida`
          : temCVE ? `Categoria ${categoria} · pode dirigir os veículos da SCI` : `Categoria ${categoria} · falta o CVE para dirigir`,
      detalhe: catDE ? validadeDe(cnhDoc) : undefined,
    },
    {
      titulo: 'CVE', icone: 'curso',
      ...(semCertificado(f.cursoCVE, cveDoc) ? FALTA_CERTIFICADO : {
        cor: venceu(cveDoc) ? 'red' : temCVE ? 'green' : catDE ? 'red' : 'gray',
        texto: venceu(cveDoc) ? 'Vencido' : temCVE ? 'Possui' : 'Não possui',
        detalhe: validadeDe(cveDoc),
      }),
    },
  ];
}

/** Credencial do card: data do cadastro; o arquivo (para abrir) vem da pasta do Drive, se houver. */
function credencialDoCadastro(f: Bombeiro, porPasta: Map<string, DocumentoAvaliado[]>, config: ConfigDocumentos, hojeISO: string) {
  const noDrive = [...porPasta.values()].flat().find(d => d.tipo === TIPO_CRACHA && d.situacao !== 'falta');
  if (noDrive) return noDrive;
  if (!f.credencialValidade) return undefined;
  const avaliado = avaliarArquivo({
    id: `${f.id}-credencial`, pastaId: '06', nomeArquivo: '', tipo: TIPO_CRACHA, formato: 'outro',
    dataCurso: null, validadePropria: f.credencialValidade,
  }, config, hojeISO);
  return { ...avaliado, arquivo: null, arquivos: [] };
}

/* ───────── Card Funcionário ───────── */

/** Documentos simulados só no computador de desenvolvimento (nunca no servidor). */
const EXEMPLO_PERMITIDO = import.meta.env.DEV;

const FAIXA_PIOR: Record<string, string> = {
  vencido: 'before:bg-red-500', vence: 'before:bg-amber-500', emdia: 'before:bg-emerald-500', neutro: 'before:bg-graphite-300', falta: 'before:bg-red-500',
};

function FuncionarioCard({
  funcionario, certNR, certCurso, canManage,
  onAddNR, onAddCurso, onViewArquivo,
  arquivosDrive, configDrive, hojeISO, onAbrirDrive, semDrive, afastadoInss,
}: {
  funcionario: Bombeiro; certNR: CertificacaoNR[]; certCurso: CertificacaoCurso[];
  canManage: boolean; onAddNR: (id: string, nome: string) => void;
  onAddCurso: (id: string, nome: string) => void; onViewArquivo: (arquivo: string, title: string) => void;
  arquivosDrive: ArquivoDrive[]; configDrive: ConfigDocumentos; hojeISO: string;
  onAbrirDrive: (doc: DocumentoAvaliado, pessoaNome: string) => void;
  /** Google Drive não ligado neste servidor: não mostra os blocos nem cobra documentos. */
  semDrive?: boolean;
  /** Afastado pelo INSS hoje (substituição temporária aprovada ou pasta do Drive marcada "- INSS"). */
  afastadoInss?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [mostrarAnexados, setMostrarAnexados] = useState(false);
  const [infoCredencial, setInfoCredencial] = useState(false);
  const resumoDrive = useMemo(() => avaliarPessoa(arquivosDrive, configDrive, hojeISO, funcionario.cargo),
    [arquivosDrive, configDrive, hojeISO, funcionario.cargo]);
  const temAnexados = certNR.length + certCurso.length > 0;
  const paraConferir = arquivosDrive.filter(a => a.avisoTipo === 'conferir').length;
  const credencial = credencialDoCadastro(funcionario, resumoDrive.porPasta, configDrive, hojeISO);
  const cursosInternos = CURSO_OPTIONS.filter(c => c.categoria === 'interno');
  const cursosAsur = CURSO_OPTIONS.filter(c => c.categoria === 'asur');
  const certInternos = certCurso.filter(c => cursosInternos.some(ci => ci.tipo === c.cursoTipo));
  const certAsur = certCurso.filter(c => cursosAsur.some(cm => cm.tipo === c.cursoTipo));

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-graphite-200 bg-white shadow-sm transition-shadow before:absolute before:inset-y-0 before:left-0 before:w-1 hover:shadow-md dark:border-border-dark dark:bg-surface-card ${FAIXA_PIOR[resumoDrive.pior]}`}>
      <button onClick={() => setExpanded(!expanded)}
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 px-5 py-4 text-left md:grid-cols-[auto_minmax(0,1fr)_12.5rem_minmax(0,1fr)] md:gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aviation-500 to-aviation-700 text-sm font-bold text-white shadow-md shadow-aviation-500/20">
          {funcionario.foto ? <img src={funcionario.foto} className="h-full w-full rounded-xl object-cover" />
            : funcionario.nomeGuerra?.charAt(0)?.toUpperCase() || funcionario.nomeCompleto.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2 font-bold text-graphite-900 dark:text-graphite-100">
            <span className="truncate">{funcionario.nomeCompleto}</span>
            {afastadoInss && (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                Afastamento INSS
              </span>
            )}
          </p>
          <p className="text-xs text-graphite-500 dark:text-graphite-400">{funcionario.nomeGuerra} · Equipe {funcionario.equipe}</p>
        </div>
        {/* Crachá numa coluna de largura fixa no meio do card: fica alinhado em todas as pessoas */}
        <div className="flex md:w-[12.5rem] md:justify-self-center">
          <CrachaValidade
            doc={credencial}
            alertaAsur={alertaCursosAsur(resumoDrive.porPasta.get('02') ?? [], credencial?.vencimento ?? null)}
            iniciais={(funcionario.nomeGuerra || funcionario.nomeCompleto).slice(0, 2).toUpperCase()}
            onInfo={() => setInfoCredencial(true)} />
        </div>
        <div className="flex items-center justify-end gap-2">
          {paraConferir > 0 && (
            <span title="Nome do arquivo não condiz com o certificado"
              className="rounded-full border border-dashed border-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:border-amber-600 dark:text-amber-300">
              {paraConferir} conferir
            </span>
          )}
          <ResumoDrive contagem={resumoDrive.contagem} />
          {expanded ? <ChevronUp className="h-4 w-4 text-graphite-400" /> : <ChevronDown className="h-4 w-4 text-graphite-400" />}
        </div>
      </button>
      {infoCredencial && (
        <InfoCredencial pessoaNome={funcionario.nomeCompleto} credencial={credencial}
          docsAsur={resumoDrive.porPasta.get('02') ?? []} onClose={() => setInfoCredencial(false)} />
      )}

      {expanded && (
        <div className="border-t border-graphite-200 px-5 py-4 dark:border-border-dark">

          {/* ── Cursos do Cadastro: junta o que está no cadastro com o que está no Drive ── */}
          <div className="mb-4">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">
              <GraduationCap className="h-3.5 w-3.5" /> Cursos do Cadastro
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {requisitosDoCadastro(funcionario, resumoDrive.porPasta, !semDrive && arquivosDrive.length > 0).map(r => (
                <CardRequisito key={r.titulo} {...r} />
              ))}
            </div>
          </div>

          {/* ── Documentos do Google Drive, um bloco por pasta ── */}
          <div className="mb-4">
            {semDrive ? (
              <p className="rounded-xl border border-dashed border-graphite-200 py-3 text-center text-xs text-graphite-400 dark:border-border-dark">
                Os documentos do Google Drive ainda não estão disponíveis.
              </p>
            ) : (
              <PastasDrive arquivos={arquivosDrive} config={configDrive} hojeISO={hojeISO} cargo={funcionario.cargo}
                onAbrir={(doc: DocumentoAvaliado) => onAbrirDrive(doc, funcionario.nomeCompleto)} />
            )}
          </div>

          {temAnexados && (
            <button type="button" onClick={() => setMostrarAnexados(v => !v)}
              className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-graphite-500 hover:text-graphite-700 dark:text-graphite-400 dark:hover:text-graphite-200">
              {mostrarAnexados ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Anexados no sistema ({certNR.length + certCurso.length})
            </button>
          )}

          {mostrarAnexados && (<>
          {/* ── Cursos Anexados Internos ── */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-purple-500 dark:text-purple-400">
                <GraduationCap className="h-3.5 w-3.5" /> Cursos Anexados
              </h4>
              {canManage && (
                <button onClick={() => onAddCurso(funcionario.id, funcionario.nomeCompleto)}
                  className="flex items-center gap-1 rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1 text-[10px] font-medium text-purple-700 transition-all hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              )}
            </div>
            {certInternos.length === 0 ? (
              <p className="text-center text-xs text-graphite-400 py-3">Nenhum curso interno anexado.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {certInternos.map(cert => {
                  const status = cert.semValidade ? null : getStatusValidade(cert.dataValidade);
                  return (
                    <button key={cert.id} onClick={() => onViewArquivo(cert.arquivo, cert.cursoNome)}
                      className="group flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50/30 p-3 text-left transition-all hover:border-purple-300 hover:shadow-md dark:border-purple-800/40 dark:bg-purple-900/10 dark:hover:border-purple-600">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-sm">
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-graphite-900 dark:text-graphite-100">{cert.cursoNome}</p>
                        <p className="text-[10px] text-graphite-500 dark:text-graphite-400">{cert.empresa || '—'}</p>
                        <div className="mt-1 flex items-center gap-2">
                          {cert.semValidade ? (
                            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">Vitalício</span>
                          ) : status ? (
                            <>
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${status.color}`}>{status.label}</span>
                              <span className="text-[9px] text-graphite-400">{formatarDataBR(cert.dataValidade)}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      {cert.arquivo && <Eye className="h-3.5 w-3.5 shrink-0 text-purple-300 transition-colors group-hover:text-purple-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Cursos Anexados ASUR ── */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-500 dark:text-teal-400">
                <GraduationCap className="h-3.5 w-3.5" /> Cursos ASUR
              </h4>
              {canManage && (
                <button onClick={() => onAddCurso(funcionario.id, funcionario.nomeCompleto)}
                  className="flex items-center gap-1 rounded-lg border border-teal-300 bg-teal-50 px-2.5 py-1 text-[10px] font-medium text-teal-700 transition-all hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-900/20 dark:text-teal-300">
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              )}
            </div>
            {certAsur.length === 0 ? (
              <p className="text-center text-xs text-graphite-400 py-3">Nenhum curso ASUR anexado.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {certAsur.map(cert => {
                  const status = cert.semValidade ? null : getStatusValidade(cert.dataValidade);
                  return (
                    <button key={cert.id} onClick={() => onViewArquivo(cert.arquivo, cert.cursoNome)}
                      className="group flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50/30 p-3 text-left transition-all hover:border-teal-300 hover:shadow-md dark:border-teal-800/40 dark:bg-teal-900/10 dark:hover:border-teal-600">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-sm">
                        <GraduationCap className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-graphite-900 dark:text-graphite-100">{cert.cursoNome}</p>
                        <p className="text-[10px] text-graphite-500 dark:text-graphite-400">{cert.empresa || '—'}</p>
                        <div className="mt-1 flex items-center gap-2">
                          {cert.semValidade ? (
                            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">Vitalício</span>
                          ) : status ? (
                            <>
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${status.color}`}>{status.label}</span>
                              <span className="text-[9px] text-graphite-400">{formatarDataBR(cert.dataValidade)}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      {cert.arquivo && <Eye className="h-3.5 w-3.5 shrink-0 text-teal-300 transition-colors group-hover:text-teal-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── NRs ── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">
                <Shield className="h-3.5 w-3.5" /> Normas Regulamentadoras
              </h4>
              {canManage && (
                <button onClick={() => onAddNR(funcionario.id, funcionario.nomeCompleto)}
                  className="flex items-center gap-1 rounded-lg border border-aviation-300 bg-aviation-50 px-2.5 py-1 text-[10px] font-medium text-aviation-700 transition-all hover:bg-aviation-100 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300">
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              )}
            </div>
            {certNR.length === 0 ? (
              <p className="text-center text-xs text-graphite-400 py-3">Nenhuma NR cadastrada.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {certNR.map(cert => {
                  const gradient = NR_COLORS[cert.nrNumero] || 'from-gray-500 to-gray-600';
                  const status = getStatusValidade(cert.dataValidade);
                  return (
                    <button key={cert.id} onClick={() => onViewArquivo(cert.arquivo, cert.nrNumero)}
                      className="group flex items-center gap-3 rounded-xl border border-graphite-200 bg-white p-3 text-left transition-all hover:border-aviation-300 hover:shadow-md dark:border-border-dark dark:bg-surface-card dark:hover:border-aviation-600">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} text-xs font-black text-white shadow-sm`}>
                        {cert.nrNumero.replace('NR-', '')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-graphite-900 dark:text-graphite-100">{cert.nrNumero}</p>
                        <p className="truncate text-[10px] text-graphite-500 dark:text-graphite-400">{cert.nrNome}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${status.color}`}>{status.label}</span>
                          <span className="text-[9px] text-graphite-400">{formatarDataBR(cert.dataValidade)}</span>
                        </div>
                      </div>
                      {cert.arquivo && <Eye className="h-3.5 w-3.5 shrink-0 text-graphite-300 transition-colors group-hover:text-aviation-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          </>)}
        </div>
      )}
    </div>
  );
}

/* ───────── Página principal ───────── */

export function Certificacoes() {
  const { user } = useAuth();
  const [certNR, setCertNR] = useState<CertificacaoNR[]>([]);
  const [certCurso, setCertCurso] = useState<CertificacaoCurso[]>([]);
  const [termo, setTermo] = useState('');
  const [equipeFiltro, setEquipeFiltro] = useState<Equipe | ''>('');
  const [formNR, setFormNR] = useState<string | null>(null);
  const [formCurso, setFormCurso] = useState<string | null>(null);
  const [funcNome, setFuncNome] = useState('');
  const [arquivoModal, setArquivoModal] = useState<{ arquivo: string; title: string } | null>(null);
  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [canViewCertificacoes, setCanViewCertificacoes] = useState(() => podeVerCertificacoesBase(user));
  const [canManageCertificacoes, setCanManageCertificacoes] = useState(() => podeVerDadosPessoaisBase(user));
  const [equipeEscopo, setEquipeEscopo] = useState<Equipe | null>(null);
  const [permissoesReady, setPermissoesReady] = useState(false);
  const [aba, setAba] = useState<'pessoas' | 'validade'>('pessoas');
  const [configDrive, setConfigDrive] = useState<ConfigDocumentos>(() => lerConfig());
  const [docAberto, setDocAberto] = useState<{ doc: DocumentoAvaliado; pessoaNome: string } | null>(null);
  const hojeISO = hojeLocalISO();
  const podeEditarValidade = isAdministradorSistema(user);
  // Certificações que o administrador pode escolher ao vincular um arquivo (Nº padrão, prazos e cadastradas).
  const tiposDisponiveisDrive = useMemo(() => {
    const tipos = new Set<string>(Object.keys(configDrive.prazos));
    for (const pasta of Object.values(configDrive.padroes ?? {})) for (const t of Object.values(pasta)) tipos.add(t);
    for (const d of configDrive.adicionados ?? []) tipos.add(d.tipo);
    return [...tipos].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  }, [configDrive]);

  // A configuração que vale é a do banco (uma para todos). O navegador guarda só uma cópia.
  const [configSalva, setConfigSalva] = useState<{ estado: 'ok' | 'salvando' | 'erro'; em: string | null; por: string | null }>(
    { estado: 'ok', em: null, por: null },
  );
  const esperaSalvar = useRef<number | null>(null);

  useEffect(() => {
    if (!permissoesReady || !canViewCertificacoes) return;
    let cancelado = false;
    lerConfigDrive().then(async resposta => {
      if (cancelado) return;
      const doBanco = completarConfig(resposta.config);
      if (doBanco) {
        setConfigDrive(doBanco);
        salvarConfig(doBanco);
        setConfigSalva({ estado: 'ok', em: resposta.atualizadoEm, por: resposta.atualizadoPor });
      } else if (podeEditarValidade) {
        // Banco ainda vazio: leva para lá o que este administrador já tinha ajustado no navegador.
        const local = lerConfigLocal() ?? configDrive;
        await salvarConfigDrive(local);
        if (!cancelado) setConfigSalva({ estado: 'ok', em: new Date().toISOString(), por: null });
      }
    }).catch(() => { /* sem servidor: fica a cópia do navegador */ });
    return () => { cancelado = true; };
  }, [permissoesReady, canViewCertificacoes]);

  function mudarConfigDrive(config: ConfigDocumentos) {
    setConfigDrive(config);
    salvarConfig(config);
    if (!podeEditarValidade) return;
    setConfigSalva(s => ({ ...s, estado: 'salvando' }));
    if (esperaSalvar.current) window.clearTimeout(esperaSalvar.current);
    esperaSalvar.current = window.setTimeout(() => {
      salvarConfigDrive(config)
        .then(() => setConfigSalva({ estado: 'ok', em: new Date().toISOString(), por: null }))
        .catch(() => setConfigSalva(s => ({ ...s, estado: 'erro' })));
    }, 700);
  }

  // Documentos do Google Drive (lidos pelo servidor). Sem Drive configurado, a tela usa dados de exemplo.
  const [drive, setDrive] = useState<DocumentosDriveApi | null>(null);
  const [driveEstado, setDriveEstado] = useState<'carregando' | 'drive' | 'exemplo' | 'erro'>('carregando');

  async function carregarDrive(atualizar = false, silencioso = false) {
    if (!silencioso) setDriveEstado('carregando');
    try {
      const resposta = await buscarDocumentosDrive(atualizar);
      setDrive(resposta);
      setDriveEstado(resposta.configurado ? 'drive' : 'exemplo');
    } catch {
      if (!silencioso) setDriveEstado('erro');
    }
  }

  // Enquanto o servidor lê as datas dos PDFs, a tela se atualiza sozinha a cada 20 segundos.
  useEffect(() => {
    if (!drive?.leituraDatas?.lendo) return;
    const t = window.setTimeout(() => carregarDrive(false, true), 20_000);
    return () => window.clearTimeout(t);
  }, [drive]);

  useEffect(() => { if (permissoesReady && canViewCertificacoes) carregarDrive(); }, [permissoesReady, canViewCertificacoes]);

  const arquivosDrivePorPessoa = useMemo(() => {
    const mapa = new Map<string, ArquivoDrive[]>();
    const doDrive = new Map((drive?.pessoas ?? []).map(p => [p.bombeiroId, p]));
    for (const b of bombeiros) {
      const arquivos = driveEstado === 'drive'
        ? (doDrive.has(b.id) ? arquivosDoServidor(doDrive.get(b.id)!.arquivos, doDrive.get(b.id)!.pasta, configDrive) : [])
        : driveEstado === 'exemplo' && EXEMPLO_PERMITIDO ? documentosExemplo(b.id, hojeISO) : [];
      // CNH e credencial: a validade é a que está no cadastro da pessoa.
      const doCadastro: Record<string, string> = { CNH: b.cnhValidade, [TIPO_CRACHA]: b.credencialValidade };
      mapa.set(b.id, arquivos.map(a => (a.tipo in doCadastro ? { ...a, validadePropria: doCadastro[a.tipo] || null } : a)));
    }
    return mapa;
  }, [bombeiros, hojeISO, drive, driveEstado, configDrive]);

  // Sem Drive (e fora do computador de desenvolvimento): nada de documentos simulados nem de "Falta".
  const semDrive = driveEstado !== 'drive' && !(driveEstado === 'exemplo' && EXEMPLO_PERMITIDO);
  const configSemDrive = useMemo(() => ({ ...configDrive, obrigatorios: [] }), [configDrive]);

  // Para a aba Validade: quem tem cada documento (pasta|tipo) — permite ver um nome estranho antes de decidir.
  const exemplosPorTipo = useMemo(() => {
    const mapa = new Map<string, ExemploArquivo[]>();
    const nomes = new Map(bombeiros.map(b => [b.id, b.nomeCompleto]));
    for (const [pessoaId, arquivos] of arquivosDrivePorPessoa) {
      for (const arquivo of arquivos) {
        const chave = `${arquivo.pastaId}|${arquivo.tipo}`;
        mapa.set(chave, [...(mapa.get(chave) ?? []), { arquivo, pessoaNome: nomes.get(pessoaId) ?? '' }]);
      }
    }
    return mapa;
  }, [arquivosDrivePorPessoa, bombeiros]);

  // Afastados pelo INSS hoje: substituição temporária aprovada com motivo INSS (ou INSS Indeterminado)
  // em vigor, ou a pasta do Drive com "- INSS" no nome.
  const [substituicoesInss, setSubstituicoesInss] = useState<SubstituicaoTemporaria[]>([]);
  useEffect(() => {
    if (!permissoesReady || !canViewCertificacoes) return;
    listarSubstituicoesTemporarias()
      .then(lista => setSubstituicoesInss(lista.filter(s => s.motivo === 'INSS' || s.motivo === 'INSS Indeterminado')))
      .catch(() => setSubstituicoesInss([]));
  }, [permissoesReady, canViewCertificacoes]);
  const afastadosInss = useMemo(() => {
    const ids = new Set<string>();
    for (const s of substituicoesInss) {
      if (s.status !== 'Aprovada' || !s.funcionarioId) continue;
      const comecou = !s.dataInicio || s.dataInicio <= hojeISO;
      const naoTerminou = !s.dataFim || s.motivo === 'INSS Indeterminado' || s.dataFim >= hojeISO;
      if (comecou && naoTerminou) ids.add(s.funcionarioId);
    }
    for (const p of drive?.pessoas ?? []) if (/\s-\s*INSS\b/i.test(p.pasta)) ids.add(p.bombeiroId);
    return ids;
  }, [substituicoesInss, drive, hojeISO]);

  const tiposDoDrive = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const arquivos of arquivosDrivePorPessoa.values()) {
      for (const a of arquivos) if (!vistos.has(a.tipo)) vistos.set(a.tipo, a.pastaId);
    }
    return [...vistos].map(([tipo, pastaId]) => ({ tipo, pastaId }))
      .sort((a, b) => a.pastaId.localeCompare(b.pastaId) || a.tipo.localeCompare(b.tipo, 'pt-BR', { numeric: true }));
  }, [arquivosDrivePorPessoa]);

  const podeFiltrar = canManageCertificacoes;

  useEffect(() => {
    let cancelled = false;
    setCanViewCertificacoes(podeVerCertificacoesBase(user));
    setCanManageCertificacoes(podeVerDadosPessoaisBase(user));
    setEquipeEscopo(null);
    setPermissoesReady(false);

    resolverContextoOperacional(user)
      .then(contexto => {
        if (cancelled) return;
        const canManage = canGerenciarCertificacoes(contexto);
        const canView = canVisualizarCertificacoes(contexto);
        setCanManageCertificacoes(canManage);
        setCanViewCertificacoes(canView);
        setEquipeEscopo(equipeEscopoCertificacoes(contexto));
        setEquipeFiltro(canManage ? '' : (contexto.equipe || ''));
        setPermissoesReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        const canViewBase = podeVerCertificacoesBase(user);
        setCanManageCertificacoes(podeVerDadosPessoaisBase(user));
        setCanViewCertificacoes(canViewBase);
        setEquipeEscopo(null);
        setPermissoesReady(true);
      });

    return () => { cancelled = true; };
  }, [user]);

  async function carregar() {
    if (!canViewCertificacoes) {
      setBombeiros([]);
      setCertNR([]);
      setCertCurso([]);
      return;
    }

    if (!canManageCertificacoes && !equipeEscopo) {
      setBombeiros([]);
      setCertNR([]);
      setCertCurso([]);
      return;
    }

    const paramsBombeiros = canManageCertificacoes ? undefined : { equipe: equipeEscopo as Equipe };
    const lista = await listarBombeiros(paramsBombeiros);
    const funcionarioIds = lista.map(b => b.id);
    const filtroCertificacoes = canManageCertificacoes ? undefined : { funcionarioIds };
    const [nrs, cursos] = await Promise.all([
      listarCertificacoes(filtroCertificacoes),
      listarCertificacoesCursos(filtroCertificacoes),
    ]);
    setBombeiros(lista);
    setCertNR(nrs);
    setCertCurso(cursos);
  }

  useEffect(() => { carregar(); }, [canViewCertificacoes, canManageCertificacoes, equipeEscopo]);

  const filtrados = useMemo(() => {
    let result = bombeiros;
    if (canManageCertificacoes && equipeFiltro) {
      result = result.filter(b => b.equipe === equipeFiltro);
    }
    if (termo) {
      const t = termo.toLowerCase();
      result = result.filter(b => b.nomeCompleto.toLowerCase().includes(t) || b.nomeGuerra.toLowerCase().includes(t));
    }
    return result;
  }, [bombeiros, termo, equipeFiltro, canManageCertificacoes]);

  if (!permissoesReady) {
    return (
      <PageContainer>
        <PageTitle icon={Award} title="Certificações" />
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" />
        </div>
      </PageContainer>
    );
  }

  if (!canViewCertificacoes) {
    return (
      <PageContainer>
        <PageTitle icon={Award} title="Certificações" />
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Lock className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Acesso restrito</h3>
          <p className="text-sm text-graphite-400">Somente Administradores, GS, BA-CE e BA-LR podem visualizar certificações.</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageTitle icon={Award} title="Certificações" />

      {driveEstado === 'exemplo' && !EXEMPLO_PERMITIDO ? (
        <div className="mb-4 rounded-xl border border-graphite-200 bg-white px-4 py-2.5 text-xs text-graphite-600 dark:border-border-dark dark:bg-surface-card dark:text-graphite-300">
          O Google Drive ainda não está ligado neste servidor; os documentos das pastas aparecem assim que for configurado.
        </div>
      ) : driveEstado === 'exemplo' ? (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/15 dark:text-amber-300">
          <strong>Dados de exemplo.</strong> Os documentos abaixo são simulados enquanto o sistema não está ligado ao Google Drive.
        </div>
      ) : (
        <div className={`mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-4 py-2.5 text-xs ${
          driveEstado === 'erro'
            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-900/15 dark:text-red-300'
            : 'border-graphite-200 bg-white text-graphite-600 dark:border-border-dark dark:bg-surface-card dark:text-graphite-300'
        }`}>
          <span className="flex-1">
            {driveEstado === 'carregando' && 'Lendo os documentos no Google Drive…'}
            {driveEstado === 'erro' && 'Não foi possível ler o Google Drive agora.'}
            {driveEstado === 'drive' && drive && (<>
              <strong>Google Drive</strong> · {drive.pessoas.length} pasta(s) ligadas ao cadastro
              {drive.atualizadoEm && ` · lido às ${new Date(drive.atualizadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
              {drive.leituraDatas?.lendo && (
                <span className="ml-1 text-aviation-700 dark:text-aviation-300">
                  · lendo as datas dos PDFs: {drive.leituraDatas.feitos} de {drive.leituraDatas.total}
                </span>
              )}
              {drive.semVinculo.length > 0 && (
                <span className="ml-1 font-semibold text-amber-700 dark:text-amber-400" title={drive.semVinculo.map(s => s.pasta).join('\n')}>
                  · {drive.semVinculo.length} pasta(s) sem pessoa ligada
                </span>
              )}
            </>)}
          </span>
          <button type="button" onClick={() => carregarDrive(true)} disabled={driveEstado === 'carregando'}
            className="rounded-lg border border-graphite-300 bg-white px-2.5 py-1 font-medium text-graphite-700 hover:border-aviation-400 disabled:opacity-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
            Atualizar
          </button>
        </div>
      )}

      {podeEditarValidade && (
        <div role="tablist" className="mb-5 inline-flex rounded-xl border border-graphite-200 bg-graphite-50 p-1 dark:border-border-dark dark:bg-surface-card">
          {([['pessoas', 'Pessoas'], ['validade', 'Validade dos documentos']] as const).map(([id, rotulo]) => (
            <button key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                aba === id ? 'bg-white text-graphite-900 shadow-sm dark:bg-surface-elevated dark:text-graphite-100' : 'text-graphite-500 hover:text-graphite-800 dark:text-graphite-400 dark:hover:text-graphite-200'
              }`}>
              {rotulo}
            </button>
          ))}
        </div>
      )}

      {aba === 'validade' && podeEditarValidade ? (<>
        <p className={`mb-3 text-xs ${configSalva.estado === 'erro' ? 'font-semibold text-red-600 dark:text-red-400' : 'text-graphite-500 dark:text-graphite-400'}`}>
          {configSalva.estado === 'salvando' && 'Salvando…'}
          {configSalva.estado === 'erro' && 'Não foi possível salvar no servidor. A alteração ficou só neste navegador; tente de novo.'}
          {configSalva.estado === 'ok' && (configSalva.em
            ? `Salvo para todos os administradores · ${new Date(configSalva.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${configSalva.por ? ` por ${configSalva.por}` : ''}`
            : 'As alterações valem para todos os administradores.')}
        </p>
        <ValidadeDocumentos config={configDrive} onChange={mudarConfigDrive}
          encontrados={driveEstado === 'drive' ? tiposDoDrive : EXEMPLO_PERMITIDO ? undefined : []}
          exemplos={exemplosPorTipo}
          onVer={ex => setDocAberto({ doc: { ...avaliarParaVer(ex.arquivo, configDrive, hojeISO), arquivos: [ex.arquivo] }, pessoaNome: ex.pessoaNome })} />
      </>) : (<>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
            <input type="text" value={termo} onChange={e => setTermo(e.target.value)} placeholder="Pesquisar funcionário..."
              className="w-full rounded-xl border border-graphite-300 bg-white py-2.5 pl-10 pr-4 text-sm text-graphite-900 placeholder-graphite-400 outline-none transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100" />
          </div>
          {podeFiltrar && (
            <select value={equipeFiltro} onChange={e => setEquipeFiltro(e.target.value as Equipe | '')}
              className="rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 outline-none transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100">
              <option value="">Todas as equipes</option>
              {EQUIPE_OPTIONS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          )}
        </div>
        <p className="text-sm text-graphite-500 dark:text-graphite-400">
          {filtrados.length} funcionário(s)
        </p>
      </div>

      {filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card">
          <Award className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
          <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum funcionário encontrado</h3>
          <p className="text-sm text-graphite-400">Cadastre bombeiros primeiro para gerenciar certificações.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(b => (
            <div key={b.id}>
              <FuncionarioCard
                funcionario={b} certNR={certNR.filter(c => c.funcionarioId === b.id)}
                certCurso={certCurso.filter(c => c.funcionarioId === b.id)} canManage={canManageCertificacoes}
                onAddNR={(id, nome) => { setFormNR(id); setFormCurso(null); setFuncNome(nome); }}
                onAddCurso={(id, nome) => { setFormCurso(id); setFormNR(null); setFuncNome(nome); }}
                onViewArquivo={(arquivo, title) => setArquivoModal({ arquivo, title })}
                arquivosDrive={arquivosDrivePorPessoa.get(b.id) ?? []} configDrive={semDrive ? configSemDrive : configDrive} hojeISO={hojeISO}
                semDrive={semDrive}
                afastadoInss={afastadosInss.has(b.id)}
                onAbrirDrive={(doc, pessoaNome) => setDocAberto({ doc, pessoaNome })}
              />
              {canManageCertificacoes && formNR === b.id && (
                <div className="mt-2 overflow-hidden rounded-2xl border border-aviation-200 bg-white shadow-lg dark:border-aviation-700 dark:bg-surface-card">
                  <div className="flex items-center justify-between border-b border-graphite-200 px-4 py-3 dark:border-border-dark">
                    <h4 className="text-sm font-bold text-graphite-900 dark:text-graphite-100">Adicionar NR — {funcNome}</h4>
                    <button onClick={() => setFormNR(null)} className="rounded-lg p-1 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="p-4">
                    <NRFormInline funcionarioId={b.id} funcionarioNome={b.nomeCompleto} onSave={async d => { if (!canManageCertificacoes) return; await criarCertificacao(d); await carregar(); setFormNR(null); }} onCancel={() => setFormNR(null)} />
                  </div>
                </div>
              )}
              {canManageCertificacoes && formCurso === b.id && (
                <div className="mt-2 overflow-hidden rounded-2xl border border-purple-200 bg-white shadow-lg dark:border-purple-700 dark:bg-surface-card">
                  <div className="flex items-center justify-between border-b border-graphite-200 px-4 py-3 dark:border-border-dark">
                    <h4 className="text-sm font-bold text-graphite-900 dark:text-graphite-100">Adicionar Curso — {funcNome}</h4>
                    <button onClick={() => setFormCurso(null)} className="rounded-lg p-1 text-graphite-400 hover:bg-graphite-100 dark:hover:bg-surface-hover"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="p-4">
                    <CursoFormInline funcionarioId={b.id} funcionarioNome={b.nomeCompleto} onSave={async d => { if (!canManageCertificacoes) return; await criarCertificacaoCurso(d); await carregar(); setFormCurso(null); }} onCancel={() => setFormCurso(null)} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      </>)}

      {docAberto && <VisualizadorDocumento doc={docAberto.doc} pessoaNome={docAberto.pessoaNome} onClose={() => setDocAberto(null)}
        carregar={driveEstado === 'drive' ? (arquivo => abrirArquivoDrive(arquivo.id)) : undefined}
        onInformarData={driveEstado === 'drive' && canManageCertificacoes ? async (arquivo, data) => {
          await informarDataDrive(arquivo.id, data);
          setDocAberto(null);
          await carregarDrive();
        } : undefined}
        onVincularTipo={driveEstado === 'drive' && podeEditarValidade ? async (arquivo, tipo) => {
          await vincularTipoDrive(arquivo.id, tipo);
          setDocAberto(null);
          await carregarDrive();
        } : undefined}
        tiposDisponiveis={tiposDisponiveisDrive}
        config={configDrive} />}
      {arquivoModal && <ArquivoModal arquivo={arquivoModal.arquivo} title={arquivoModal.title} onClose={() => setArquivoModal(null)} />}
      <PageTour
        steps={CERTIFICACOES_TOUR_STEPS}
        targetAttribute="data-certificacoes-tour"
        title="Abrir tutorial de Certificações"
        detailLabel="Validação"
      />
    </PageContainer>
  );
}

export default Certificacoes;
