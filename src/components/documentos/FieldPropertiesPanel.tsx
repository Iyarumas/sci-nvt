import { Trash2, Package } from 'lucide-react';
import type { DocumentField, FieldType } from '../../types/document';
import { DATA_SOURCE_LABELS, DATA_SOURCE_GROUPS } from '../../types/document';

interface Props {
  field: DocumentField | null;
  onUpdate: (id: string, updates: Partial<DocumentField>) => void;
  onDelete: (id: string) => void;
  onReturnToTray?: (id: string) => void;
}

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Seleção' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'signature', label: 'Assinatura' },
  { value: 'line', label: 'Linha' },
];

export function FieldPropertiesPanel({ field, onUpdate, onDelete, onReturnToTray }: Props) {
  if (!field) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 rounded-lg bg-graphite-100 p-3 dark:bg-graphite-800">
          <span className="text-2xl">↖</span>
        </div>
        <p className="text-sm text-graphite-500">
          Clique em um campo no PDF para editar suas propriedades
        </p>
        <p className="mt-2 text-xs text-graphite-400">
          Duplo-clique no PDF para adicionar um novo campo
        </p>
      </div>
    );
  }

  function handleChange(key: keyof DocumentField, value: unknown) {
    onUpdate(field!.id, { [key]: value });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-graphite-200 px-4 py-3 dark:border-graphite-700">
        <h4 className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">
          Propriedades do Campo
        </h4>
        <button onClick={() => onDelete(field.id)} className="rounded p-1 text-graphite-400 hover:bg-red-50 hover:text-red-500" title="Excluir campo">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {/* Nome do campo */}
        <div>
          <label className="mb-1 block text-xs font-medium text-graphite-600">Nome interno *</label>
          <input type="text" value={field.field_name} onChange={e => handleChange('field_name', e.target.value)}
            className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
        </div>

        {/* Label */}
        <div>
          <label className="mb-1 block text-xs font-medium text-graphite-600">Label (exibição) *</label>
          <input type="text" value={field.field_label} onChange={e => handleChange('field_label', e.target.value)}
            className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
        </div>

        {/* Tipo */}
        <div>
          <label className="mb-1 block text-xs font-medium text-graphite-600">Tipo</label>
          <select value={field.field_type} onChange={e => handleChange('field_type', e.target.value)}
            className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100">
            {FIELD_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* É assinatura? */}
        <div className="flex items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 dark:bg-purple-900/20">
          <input type="checkbox" checked={field.is_signature} onChange={e => {
            const isSig = e.target.checked;
            handleChange('is_signature', isSig);
            if (isSig) {
              handleChange('field_type', 'signature');
              handleChange('height', 40);
            }
          }} className="rounded" />
          <label className="text-sm font-medium text-graphite-700 dark:text-graphite-300">
            Campo de assinatura
          </label>
        </div>

        {/* Signer role (só aparece se is_signature) */}
        {field.is_signature && (
          <div>
            <label className="mb-1 block text-xs font-medium text-graphite-600">Signatário vinculado</label>
            <input type="text" value={field.signer_role || ''} onChange={e => handleChange('signer_role', e.target.value)}
              placeholder="Ex: solicitante, chefe, gerente"
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
          </div>
        )}

        {/* Fonte de dados (auto-fill) */}
        <div>
          <label className="mb-1 block text-xs font-medium text-graphite-600">Fonte de dados (auto-fill)</label>
          <select value={field.data_source} onChange={e => handleChange('data_source', e.target.value)}
            className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100">
            {DATA_SOURCE_GROUPS.map(group => (
              <optgroup key={group.label} label={group.label}>
                {group.sources.map(src => (
                  <option key={src} value={src}>{DATA_SOURCE_LABELS[src]}</option>
                ))}
              </optgroup>
            ))}
          </select>
          {field.data_source !== 'manual' && field.data_source !== 'autentique_assinatura' && (
            <p className="mt-1 text-xs text-aviation-600">
              Será preenchido automaticamente com os dados do funcionário selecionado
            </p>
          )}
          {field.data_source === 'autentique_assinatura' && (
            <p className="mt-1 text-xs text-purple-600">
              Será preenchido automaticamente pelo Autentique após a assinatura
            </p>
          )}
        </div>

        {/* Opções (select) */}
        {field.field_type === 'select' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-graphite-600">Opções (uma por linha)</label>
            <textarea rows={3} value={field.options?.join('\n') || ''}
              onChange={e => handleChange('options', e.target.value.split('\n').filter(Boolean))}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100"
              placeholder="Opção 1&#10;Opção 2" />
          </div>
        )}

        {/* Tamanho e posição */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-graphite-600">X</label>
            <input type="number" value={Math.round(field.x)} onChange={e => handleChange('x', Number(e.target.value))}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-graphite-600">Y</label>
            <input type="number" value={Math.round(field.y)} onChange={e => handleChange('y', Number(e.target.value))}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-graphite-600">Largura</label>
            <input type="number" value={Math.round(field.width)} onChange={e => handleChange('width', Math.max(30, Number(e.target.value)))}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-graphite-600">Altura</label>
            <input type="number" value={Math.round(field.height)} onChange={e => handleChange('height', Math.max(14, Number(e.target.value)))}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800" />
          </div>
        </div>

        {/* Tamanho da fonte */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-graphite-600">Tamanho da fonte</label>
            <input type="number" value={field.font_size} min={6} max={72}
              onChange={e => handleChange('font_size', Math.max(6, Number(e.target.value)))}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-graphite-600">Página</label>
            <input type="number" value={field.page} min={1}
              onChange={e => handleChange('page', Math.max(1, Number(e.target.value)))}
              className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800" />
          </div>
        </div>

        {/* Obrigatório */}
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={field.required} onChange={e => handleChange('required', e.target.checked)} className="rounded" />
          <label className="text-sm text-graphite-700 dark:text-graphite-300">Campo obrigatório</label>
        </div>

        {/* Placeholder */}
        <div>
          <label className="mb-1 block text-xs font-medium text-graphite-600">Placeholder</label>
          <input type="text" value={field.placeholder || ''} onChange={e => handleChange('placeholder', e.target.value || null)}
            className="w-full rounded-lg border border-graphite-200 bg-white px-3 py-2 text-sm dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100" />
        </div>

        {/* Devolver à bandeja */}
        {onReturnToTray && (field.x !== 0 || field.y !== 0) && (
          <button onClick={() => onReturnToTray(field.id)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-graphite-200 bg-graphite-50 px-3 py-2 text-sm font-medium text-graphite-700 hover:bg-graphite-100 dark:border-graphite-600 dark:bg-graphite-700 dark:text-graphite-300 dark:hover:bg-graphite-600">
            <Package className="h-4 w-4" /> Devolver a Bandeja
          </button>
        )}
      </div>
    </div>
  );
}
