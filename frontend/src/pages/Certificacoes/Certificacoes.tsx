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

function getDefaultValidade(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split('T')[0];
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
  const hoje = new Date().toISOString().split('T')[0];
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
  const hoje = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({
    cursoTipo: '', cursoNome: '', dataEmissao: hoje,
    dataValidade: getDefaultValidade(), semValidade: false,
    empresa: 'Grupo MedMais', arquivo: '', tipoArquivo: 'image' as 'image' | 'pdf',
  });

  const input = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100';
  const label = 'block mb-1 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';
  const cursosInternos = CURSO_OPTIONS.filter(c => c.categoria === 'interno');
  const cursosMotiva = CURSO_OPTIONS.filter(c => c.categoria === 'motiva');

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
              <optgroup label="Cursos Motiva">
                {cursosMotiva.map(c => <option key={c.tipo} value={c.tipo}>{c.nome}</option>)}
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

/* ───────── Card Funcionário ───────── */

function FuncionarioCard({
  funcionario, certNR, certCurso, canManage,
  onAddNR, onAddCurso, onViewArquivo,
}: {
  funcionario: Bombeiro; certNR: CertificacaoNR[]; certCurso: CertificacaoCurso[];
  canManage: boolean; onAddNR: (id: string, nome: string) => void;
  onAddCurso: (id: string, nome: string) => void; onViewArquivo: (arquivo: string, title: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cursosInternos = CURSO_OPTIONS.filter(c => c.categoria === 'interno');
  const cursosMotiva = CURSO_OPTIONS.filter(c => c.categoria === 'motiva');
  const certInternos = certCurso.filter(c => cursosInternos.some(ci => ci.tipo === c.cursoTipo));
  const certMotiva = certCurso.filter(c => cursosMotiva.some(cm => cm.tipo === c.cursoTipo));

  return (
    <div className="rounded-2xl border border-graphite-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-border-dark dark:bg-surface-card">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-4 px-5 py-4 text-left">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-aviation-500 to-aviation-700 text-sm font-bold text-white shadow-md shadow-aviation-500/20">
          {funcionario.foto ? <img src={funcionario.foto} className="h-full w-full rounded-xl object-cover" />
            : funcionario.nomeGuerra?.charAt(0)?.toUpperCase() || funcionario.nomeCompleto.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-graphite-900 dark:text-graphite-100 truncate">{funcionario.nomeCompleto}</p>
          <p className="text-xs text-graphite-500 dark:text-graphite-400">{funcionario.nomeGuerra} · Equipe {funcionario.equipe}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-aviation-50 px-2.5 py-0.5 text-[10px] font-bold text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300">
            <Shield className="h-3 w-3" /> NRs {certNR.length}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            <GraduationCap className="h-3 w-3" /> Cursos {certInternos.length}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-[10px] font-bold text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
            <Award className="h-3 w-3" /> Motiva {certMotiva.length}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-graphite-400" /> : <ChevronDown className="h-4 w-4 text-graphite-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-graphite-200 px-5 py-4 dark:border-border-dark">

          {/* ── Cursos do Cadastro (cores dinâmicas) ── */}
          <div className="mb-4">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400">
              <GraduationCap className="h-3.5 w-3.5" /> Cursos do Cadastro
            </h4>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(() => {
                const cargoExigeChefe = funcionario.cargo === 'BA-CE' || funcionario.cargo === 'BA-LR';
                const temCursoChefe = funcionario.cursoChefeEquipe;
                const corChefe = temCursoChefe ? 'green' : (cargoExigeChefe ? 'red' : 'gray');
                const labelChefe = temCursoChefe ? 'Possui' : 'Não possui';
                return (
                  <div className={`flex items-center gap-3 rounded-xl border p-3 ${
                    corChefe === 'green' ? 'border-green-200 bg-green-50/50 dark:border-green-800/40 dark:bg-green-900/10' :
                    corChefe === 'red' ? 'border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-900/10' :
                    'border-graphite-200 bg-graphite-50/50 dark:border-border-dark dark:bg-surface-card/50'
                  }`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      corChefe === 'green' ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' :
                      corChefe === 'red' ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' :
                      'bg-graphite-200 text-graphite-400 dark:bg-graphite-700 dark:text-graphite-500'
                    }`}>
                      <BadgeCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-graphite-900 dark:text-graphite-100">Chefe de Equipe</p>
                      <p className={`text-[10px] font-medium ${
                        corChefe === 'green' ? 'text-green-600 dark:text-green-400' :
                        corChefe === 'red' ? 'text-red-600 dark:text-red-400' :
                        'text-graphite-400 dark:text-graphite-500'
                      }`}>{labelChefe}</p>
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const cargoExigeMotorista = funcionario.cargo === 'BA-MC';
                const temCursoMotorista = funcionario.cursoMotoristaCCI;
                const temCNHD = temCategoriaD(funcionario.cnhCategoria);
                const temCVE = funcionario.cursoCVE;
                const podeDirigirCRS = !temCursoMotorista && temCNHD && temCVE;
                const corMotorista = temCursoMotorista ? 'green' : (podeDirigirCRS ? 'orange' : (cargoExigeMotorista ? 'red' : 'gray'));
                const labelMotorista = temCursoMotorista ? 'Possui' : (podeDirigirCRS ? 'Pode dirigir CRS' : 'Não possui');
                return (
                  <div className={`flex items-center gap-3 rounded-xl border p-3 ${
                    corMotorista === 'green' ? 'border-green-200 bg-green-50/50 dark:border-green-800/40 dark:bg-green-900/10' :
                    corMotorista === 'orange' ? 'border-orange-200 bg-orange-50/50 dark:border-orange-800/40 dark:bg-orange-900/10' :
                    corMotorista === 'red' ? 'border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-900/10' :
                    'border-graphite-200 bg-graphite-50/50 dark:border-border-dark dark:bg-surface-card/50'
                  }`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      corMotorista === 'green' ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' :
                      corMotorista === 'orange' ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white' :
                      corMotorista === 'red' ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' :
                      'bg-graphite-200 text-graphite-400 dark:bg-graphite-700 dark:text-graphite-500'
                    }`}>
                      <Car className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-graphite-900 dark:text-graphite-100">Motorista/Condutor CCI</p>
                      <p className={`text-[10px] font-medium ${
                        corMotorista === 'green' ? 'text-green-600 dark:text-green-400' :
                        corMotorista === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                        corMotorista === 'red' ? 'text-red-600 dark:text-red-400' :
                        'text-graphite-400 dark:text-graphite-500'
                      }`}>{labelMotorista}</p>
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const temCNHD = temCategoriaD(funcionario.cnhCategoria);
                const temCVE = funcionario.cursoCVE;
                const corCNH = temCNHD ? (temCVE ? 'green' : 'orange') : 'gray';
                const labelCNH = temCNHD ? (temCVE ? 'Possui' : 'Possui CNH D/E') : 'Não possui';
                return (
                  <div className={`flex items-center gap-3 rounded-xl border p-3 ${
                    corCNH === 'green' ? 'border-green-200 bg-green-50/50 dark:border-green-800/40 dark:bg-green-900/10' :
                    corCNH === 'orange' ? 'border-orange-200 bg-orange-50/50 dark:border-orange-800/40 dark:bg-orange-900/10' :
                    'border-graphite-200 bg-graphite-50/50 dark:border-border-dark dark:bg-surface-card/50'
                  }`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      corCNH === 'green' ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' :
                      corCNH === 'orange' ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white' :
                      'bg-graphite-200 text-graphite-400 dark:bg-graphite-700 dark:text-graphite-500'
                    }`}>
                      <Car className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-graphite-900 dark:text-graphite-100">CNH Categoria D/E</p>
                      <p className={`text-[10px] font-medium ${
                        corCNH === 'green' ? 'text-green-600 dark:text-green-400' :
                        corCNH === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                        'text-graphite-400 dark:text-graphite-500'
                      }`}>{labelCNH}</p>
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const temCNHD = temCategoriaD(funcionario.cnhCategoria);
                const temCVE = funcionario.cursoCVE;
                const corCVE = temCVE ? 'green' : (temCNHD ? 'red' : 'gray');
                const labelCVE = temCVE ? 'Possui' : 'Não possui';
                return (
                  <div className={`flex items-center gap-3 rounded-xl border p-3 ${
                    corCVE === 'green' ? 'border-green-200 bg-green-50/50 dark:border-green-800/40 dark:bg-green-900/10' :
                    corCVE === 'red' ? 'border-red-200 bg-red-50/50 dark:border-red-800/40 dark:bg-red-900/10' :
                    'border-graphite-200 bg-graphite-50/50 dark:border-border-dark dark:bg-surface-card/50'
                  }`}>
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      corCVE === 'green' ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' :
                      corCVE === 'red' ? 'bg-gradient-to-br from-red-500 to-red-600 text-white' :
                      'bg-graphite-200 text-graphite-400 dark:bg-graphite-700 dark:text-graphite-500'
                    }`}>
                      <BadgeCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-graphite-900 dark:text-graphite-100">CVE</p>
                      <p className={`text-[10px] font-medium ${
                        corCVE === 'green' ? 'text-green-600 dark:text-green-400' :
                        corCVE === 'red' ? 'text-red-600 dark:text-red-400' :
                        'text-graphite-400 dark:text-graphite-500'
                      }`}>{labelCVE}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

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
                              <span className="text-[9px] text-graphite-400">{new Date(cert.dataValidade + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
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

          {/* ── Cursos Anexados Motiva ── */}
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-teal-500 dark:text-teal-400">
                <GraduationCap className="h-3.5 w-3.5" /> Cursos Motiva
              </h4>
              {canManage && (
                <button onClick={() => onAddCurso(funcionario.id, funcionario.nomeCompleto)}
                  className="flex items-center gap-1 rounded-lg border border-teal-300 bg-teal-50 px-2.5 py-1 text-[10px] font-medium text-teal-700 transition-all hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-900/20 dark:text-teal-300">
                  <Plus className="h-3 w-3" /> Adicionar
                </button>
              )}
            </div>
            {certMotiva.length === 0 ? (
              <p className="text-center text-xs text-graphite-400 py-3">Nenhum curso Motiva anexado.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {certMotiva.map(cert => {
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
                              <span className="text-[9px] text-graphite-400">{new Date(cert.dataValidade + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
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
                          <span className="text-[9px] text-graphite-400">{new Date(cert.dataValidade + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                      {cert.arquivo && <Eye className="h-3.5 w-3.5 shrink-0 text-graphite-300 transition-colors group-hover:text-aviation-500" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
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
          {filtrados.length} funcionário(s) · {certNR.length} NR(s) · {certCurso.length} curso(s)
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

      {arquivoModal && <ArquivoModal arquivo={arquivoModal.arquivo} title={arquivoModal.title} onClose={() => setArquivoModal(null)} />}
    </PageContainer>
  );
}

export default Certificacoes;
