import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { capitalizarNome } from '../../utils/capitalize';
import type { APOC, FuncaoAPOC } from '../../types/apoc';
import { FUNCAO_APOC_OPTIONS, EQUIPE_APOC } from '../../types/apoc';

interface Props {
  apoc?: APOC | null;
  onSave: (data: Omit<APOC, 'id' | 'createdAt' | 'updatedAt'>) => void | Promise<void>;
  onClose: () => void;
  serverError?: string;
}

export function APOCForm({ apoc, onSave, onClose, serverError }: Props) {
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [nomeGuerra, setNomeGuerra] = useState('');
  const [email, setEmail] = useState('');
  const [funcao, setFuncao] = useState<FuncaoAPOC>('APOC');
  const [erro, setErro] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (apoc) {
      setNomeCompleto(apoc.nomeCompleto);
      setNomeGuerra(apoc.nomeGuerra);
      setEmail(apoc.email);
      setFuncao(apoc.funcao || 'APOC');
    }
  }, [apoc]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!nomeCompleto || !nomeGuerra || !email || !funcao) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }
    setErro('');
    setSubmitting(true);
    try {
      await onSave({
      nomeCompleto: capitalizarNome(nomeCompleto),
      nomeGuerra: capitalizarNome(nomeGuerra),
      email,
      funcao,
      equipe: EQUIPE_APOC,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-graphite-700";
  const selectClass = "w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-graphite-700";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 pt-10 pb-10">
      <div className="relative w-full max-w-xl rounded-2xl bg-white/95 shadow-2xl backdrop-blur-sm dark:bg-surface-elevated/95">
        <div className="flex items-center justify-between border-b border-graphite-200/60 px-6 py-4 dark:border-graphite-700">
          <div>
            <h2 className="text-lg font-bold text-graphite-900 dark:text-white">
              {apoc ? 'Editar APOC' : 'Novo APOC'}
            </h2>
            <p className="text-xs text-graphite-500 dark:text-graphite-400">Centro de Operações Aeroportuárias</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-graphite-700 dark:hover:text-graphite-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          {(erro || serverError) && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-alert-red dark:bg-red-900/20 dark:text-red-400">
              {erro || serverError}
            </div>
          )}

          <div className="rounded-xl border border-aviation-200/50 bg-aviation-50/50 px-4 py-3 dark:border-aviation-700/30 dark:bg-aviation-900/20">
            <p className="text-xs font-medium text-aviation-700 dark:text-aviation-300">Equipe: <strong>MOTIVA</strong> (preenchido automaticamente)</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-graphite-900 dark:text-graphite-100">Função *</label>
            <select value={funcao} onChange={e => setFuncao(e.target.value as FuncaoAPOC)} className={selectClass}>
              {FUNCAO_APOC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-graphite-900 dark:text-graphite-100">Nome Completo *</label>
            <input value={nomeCompleto} onChange={e => setNomeCompleto(e.target.value)} placeholder="Nome completo"
              className={inputClass} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-graphite-900 dark:text-graphite-100">Nome de Guerra *</label>
            <input value={nomeGuerra} onChange={e => setNomeGuerra(e.target.value)} placeholder="Nome de guerra"
              className={inputClass} />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-graphite-900 dark:text-graphite-100">E-mail *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com"
              className={inputClass} />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-graphite-200/60 pt-5 dark:border-graphite-700">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-graphite-300/60 bg-white/80 px-4 py-2.5 text-sm font-medium text-graphite-700 backdrop-blur-sm transition-all duration-200 hover:bg-graphite-50 hover:border-graphite-300 dark:border-graphite-600 dark:bg-graphite-800 dark:text-graphite-200 dark:hover:bg-graphite-700">
              Cancelar
            </button>
            <button type="submit" disabled={submitting}
              className="rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? 'Salvando...' : (apoc ? 'Salvar Alterações' : 'Cadastrar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
