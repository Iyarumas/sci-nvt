import { useEffect, useState } from 'react';
import { FileText, Save, X } from 'lucide-react';
import {
  agenteExtintorReaKey,
  criarReaDadosVazios,
  REA_AGENTES_EXTINTORES,
  REA_EXTINTOR_CAMPOS,
  REA_FORM_SECTIONS,
  REA_RECURSO_LINHAS,
  REA_STATUS,
  recursoReaKey,
} from '../../types/rea';
import type { ReaDados, ReaFormField, ReaRegistro, ReaStatus } from '../../types/rea';
import { TIPO_DOCUMENTO } from '../../types/ocorrencia';
import type { TipoDocumento } from '../../types/ocorrencia';

interface ReaModalProps {
  registro?: ReaRegistro | null;
  numero: string;
  saving?: boolean;
  onSave: (data: { status: ReaStatus; dados: ReaDados }) => void;
  onSelectBona?: () => void;
  onCancel: () => void;
}

const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark';
const labelCls = 'block mb-1.5 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';

function spanClass(field: ReaFormField): string {
  if (field.colSpan === 4) return 'sm:col-span-4';
  if (field.colSpan === 3) return 'sm:col-span-3';
  if (field.colSpan === 2) return 'sm:col-span-2';
  return '';
}

const FASE_LEGACY_KEYS: Record<string, string> = {
  Pouso: 'fasePouso',
  Decolagem: 'faseDecolagem',
  Taxi: 'faseTaxi',
  Estacionamento: 'faseEstacionamento',
};

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function isLegacyMarked(value: string | undefined): boolean {
  return value === 'true' || value === 'Sim' || value === '1' || value === 'V';
}

function buildInitialDados(registro?: ReaRegistro | null): ReaDados {
  const dados = { ...criarReaDadosVazios(), ...registro?.dados };
  if (!dados.faseOperacao) {
    const legacyFase = Object.entries(FASE_LEGACY_KEYS).find(([, key]) => isLegacyMarked(dados[key]));
    if (legacyFase) dados.faseOperacao = legacyFase[0];
  }
  return dados;
}

function normalizeDadosForSave(dados: ReaDados): ReaDados {
  const normalized = { ...dados };
  for (const [fase, key] of Object.entries(FASE_LEGACY_KEYS)) {
    normalized[key] = normalized.faseOperacao === fase ? 'true' : '';
  }
  return normalized;
}

function ReaField({
  field,
  value,
  onChange,
}: {
  field: ReaFormField;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === 'textarea') {
    return (
      <div className={spanClass(field)}>
        <label className={labelCls}>{field.label}</label>
        <textarea
          value={value}
          onChange={e => onChange(field.numeric ? onlyDigits(e.target.value) : e.target.value)}
          rows={field.rows || 3}
          className={`${inputCls} resize-y`}
          inputMode={field.numeric ? 'numeric' : undefined}
        />
      </div>
    );
  }

  if (field.type === 'radio') {
    return (
      <div className={spanClass(field)}>
        <label className={labelCls}>{field.label}</label>
        <div className="flex flex-wrap gap-3 rounded-xl border border-graphite-200 bg-white px-3 py-2.5 dark:border-border-dark dark:bg-surface-card">
          {(field.options || []).map(option => (
            <label key={option} className="flex items-center gap-2 text-sm text-graphite-700 dark:text-graphite-200">
              <input
                type="radio"
                name={field.key}
                checked={value === option}
                onChange={() => onChange(option)}
                className="h-4 w-4 accent-aviation-600"
              />
              {option}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === 'checkbox') {
    return (
      <label className={`flex items-center gap-3 rounded-xl border border-graphite-200 bg-white px-3 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200 ${spanClass(field)}`}>
        <input
          type="checkbox"
          checked={value === 'true'}
          onChange={e => onChange(e.target.checked ? 'true' : '')}
          className="h-4 w-4 accent-aviation-600"
        />
        {field.label}
      </label>
    );
  }

  return (
    <div className={spanClass(field)}>
      <label className={labelCls}>{field.label}</label>
      <input
        type={field.numeric ? 'text' : field.type || 'text'}
        value={value}
        onChange={e => onChange(field.numeric ? onlyDigits(e.target.value) : e.target.value)}
        className={inputCls}
        inputMode={field.numeric ? 'numeric' : undefined}
        pattern={field.numeric ? '[0-9]*' : undefined}
      />
    </div>
  );
}

function ResourceTable({
  title,
  prefix,
  dados,
  setValue,
}: {
  title: string;
  prefix: 'aerodromo' | 'externo';
  dados: ReaDados;
  setValue: (key: string, value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-graphite-200 bg-white/80 p-4 dark:border-border-dark dark:bg-surface-card">
      <h4 className="mb-3 text-sm font-bold text-graphite-900 dark:text-graphite-100">{title}</h4>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] border-collapse text-xs">
          <thead>
            <tr className="bg-graphite-100 text-graphite-700 dark:bg-surface-hover dark:text-graphite-200">
              <th className="w-44 border border-graphite-200 px-2 py-2 text-left dark:border-border-dark">Item</th>
              {[1, 2, 3, 4].map(i => (
                <th key={i} className="border border-graphite-200 px-2 py-2 dark:border-border-dark" colSpan={2}>Registro {i}</th>
              ))}
            </tr>
            <tr className="bg-graphite-50 text-graphite-600 dark:bg-surface-card dark:text-graphite-300">
              <th className="border border-graphite-200 px-2 py-1 dark:border-border-dark" />
              {[1, 2, 3, 4].flatMap(i => [
                <th key={`tipo-${i}`} className="border border-graphite-200 px-2 py-1 dark:border-border-dark">Tipo</th>,
                <th key={`quant-${i}`} className="border border-graphite-200 px-2 py-1 dark:border-border-dark">Quant</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {REA_RECURSO_LINHAS.map(linha => (
              <tr key={linha.key}>
                <td className="border border-graphite-200 px-2 py-2 font-semibold text-graphite-700 dark:border-border-dark dark:text-graphite-200">{linha.label}</td>
                {[1, 2, 3, 4].flatMap(i => {
                  const tipoKey = recursoReaKey(prefix, linha.key, i, 'tipo');
                  const quantKey = recursoReaKey(prefix, linha.key, i, 'quant');
                  return [
                    <td key={tipoKey} className="border border-graphite-200 p-1 dark:border-border-dark">
                      <input value={dados[tipoKey] || ''} onChange={e => setValue(tipoKey, e.target.value)} className={`${inputCls} px-2 py-1.5 text-xs`} />
                    </td>,
                    <td key={quantKey} className="border border-graphite-200 p-1 dark:border-border-dark">
                      <input
                        value={dados[quantKey] || ''}
                        onChange={e => setValue(quantKey, onlyDigits(e.target.value))}
                        className={`${inputCls} px-2 py-1.5 text-xs`}
                        inputMode="numeric"
                        pattern="[0-9]*"
                      />
                    </td>,
                  ];
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExtinguisherTable({
  dados,
  setValue,
}: {
  dados: ReaDados;
  setValue: (key: string, value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-graphite-200 bg-white/80 p-4 dark:border-border-dark dark:bg-surface-card">
      <h4 className="mb-3 text-sm font-bold text-graphite-900 dark:text-graphite-100">6.3 Agentes Extintores usados e tecnicas empregadas</h4>
      <div className="overflow-x-auto">
        <table className="min-w-[760px] border-collapse text-xs">
          <thead>
            <tr className="bg-graphite-100 text-graphite-700 dark:bg-surface-hover dark:text-graphite-200">
              <th className="w-56 border border-graphite-200 px-2 py-2 text-left dark:border-border-dark">Agente</th>
              {REA_EXTINTOR_CAMPOS.map(campo => (
                <th key={campo.key} className="border border-graphite-200 px-2 py-2 dark:border-border-dark">{campo.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {REA_AGENTES_EXTINTORES.map(linha => (
              <tr key={linha.key}>
                <td className="border border-graphite-200 px-2 py-2 font-semibold text-graphite-700 dark:border-border-dark dark:text-graphite-200">{linha.label}</td>
                {REA_EXTINTOR_CAMPOS.map(campo => {
                  const key = agenteExtintorReaKey(linha.key, campo.key);
                  const numeric = campo.key !== 'suficiente';
                  return (
                    <td key={key} className="border border-graphite-200 p-1 dark:border-border-dark">
                      <input
                        value={dados[key] || ''}
                        onChange={e => setValue(key, numeric ? onlyDigits(e.target.value) : e.target.value)}
                        className={`${inputCls} px-2 py-1.5 text-xs`}
                        inputMode={numeric ? 'numeric' : undefined}
                        pattern={numeric ? '[0-9]*' : undefined}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ReaModal({ registro, numero, saving = false, onSave, onSelectBona, onCancel }: ReaModalProps) {
  const [dados, setDados] = useState<ReaDados>(() => buildInitialDados(registro));
  const [status, setStatus] = useState<ReaStatus>(registro?.status || 'Aberta');

  useEffect(() => {
    setDados(buildInitialDados(registro));
    setStatus(registro?.status || 'Aberta');
  }, [registro]);

  function setValue(key: string, value: string) {
    setDados(current => ({ ...current, [key]: value }));
  }

  const baseSections = REA_FORM_SECTIONS.slice(0, 5);
  const finalSections = REA_FORM_SECTIONS.slice(5);
  const statusBadge = status === 'Fechada'
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-8">
      <div className="flex max-h-[88vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl shadow-black/10 dark:bg-surface-elevated">
        <div className="flex items-center justify-between border-b border-graphite-200 px-6 py-4 dark:border-border-dark">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">{registro ? 'Editar Documento' : 'Novo Documento'}</h2>
            <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
              REA · {registro?.numero || numero}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadge}`}>
              {status}
            </span>
          </div>
          <button onClick={onCancel} className="rounded-lg p-1.5 text-graphite-400 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-graphite-200 bg-graphite-50 p-4 dark:border-border-dark dark:bg-surface-card">
            <label className={labelCls}>Tipo de Documento *</label>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(['BONA', 'REA'] as TipoDocumento[]).map(tipo => {
                const selected = tipo === 'REA';
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => {
                      if (tipo === 'BONA') onSelectBona?.();
                    }}
                    className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                      selected
                        ? 'border-aviation-500 bg-aviation-50 dark:border-aviation-400 dark:bg-aviation-900/20'
                        : 'border-graphite-200 bg-white hover:border-graphite-300 dark:border-border-dark dark:bg-surface-card dark:hover:border-graphite-600'
                    }`}
                  >
                    <FileText className={`h-5 w-5 shrink-0 ${selected ? 'text-aviation-600 dark:text-aviation-400' : 'text-graphite-400'}`} />
                    <div>
                      <p className="text-sm font-bold text-graphite-900 dark:text-graphite-100">{tipo}</p>
                      <p className="text-[11px] text-graphite-500 dark:text-graphite-400">{TIPO_DOCUMENTO[tipo]}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-graphite-200 bg-graphite-50 p-4 dark:border-border-dark dark:bg-surface-card">
            <label className={labelCls}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as ReaStatus)} className={inputCls}>
              {REA_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {baseSections.map(section => (
            <section key={section.title} className="rounded-xl border border-graphite-200 bg-white/80 p-4 dark:border-border-dark dark:bg-surface-card">
              <h3 className="mb-4 text-sm font-bold text-graphite-900 dark:text-graphite-100">{section.title}</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                {section.fields.map(field => (
                  <ReaField key={field.key} field={field} value={dados[field.key] || ''} onChange={value => setValue(field.key, value)} />
                ))}
              </div>
            </section>
          ))}

          <section className="space-y-4">
            <h3 className="text-sm font-bold text-graphite-900 dark:text-graphite-100">6. Servico de Salvamento e Combate a Incendio</h3>
            <ResourceTable title="6.1 Equipamentos e Pessoal do Aerodromo que tomaram parte na operacao" prefix="aerodromo" dados={dados} setValue={setValue} />
            <ResourceTable title="6.2 Equipamentos e Pessoal alheios ao Aerodromo que tomaram parte na operacao" prefix="externo" dados={dados} setValue={setValue} />
            <ExtinguisherTable dados={dados} setValue={setValue} />
          </section>

          {finalSections.map(section => (
            <section key={section.title} className="rounded-xl border border-graphite-200 bg-white/80 p-4 dark:border-border-dark dark:bg-surface-card">
              <h3 className="mb-4 text-sm font-bold text-graphite-900 dark:text-graphite-100">{section.title}</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                {section.fields.map(field => (
                  <ReaField key={field.key} field={field} value={dados[field.key] || ''} onChange={value => setValue(field.key, value)} />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-graphite-200 px-6 py-4 dark:border-border-dark">
          <button onClick={onCancel} className="rounded-xl border border-graphite-300 bg-white px-4 py-2.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200">
            Cancelar
          </button>
          <button
            onClick={() => onSave({ status, dados: normalizeDadosForSave(dados) })}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all hover:from-aviation-500 hover:to-aviation-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
