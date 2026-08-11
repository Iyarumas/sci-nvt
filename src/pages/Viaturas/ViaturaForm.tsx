import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { capitalizarNome } from '../../utils/capitalize';
import type { Viatura, TipoViatura, StatusViatura } from '../../types/viatura';
import { TIPO_VIATURA_OPTIONS, STATUS_VIATURA_OPTIONS } from '../../types/viatura';

interface Props {
  viatura?: Viatura | null;
  onSave: (data: Partial<Viatura>) => void;
  onClose: () => void;
}

function formatPlaca(value: string) {
  const raw = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7);
  if (raw.length <= 3) return raw;
  return raw.slice(0, 3) + '-' + raw.slice(3);
}

const inputClass = "w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated";
const selectClass = "w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-sm transition-all duration-200 hover:border-graphite-300/70 focus:border-aviation-500/50 focus:bg-white focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated";
const labelClass = "mb-1 block text-xs font-medium text-graphite-600 dark:text-graphite-400";
const span2 = "md:col-span-2";

export function ViaturaForm({ viatura, onSave, onClose }: Props) {
  const [prefixo, setPrefixo] = useState('');
  const [placa, setPlaca] = useState('');
  const [tipo, setTipo] = useState<TipoViatura>('CCI');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [ano, setAno] = useState('');
  const [cor, setCor] = useState('');
  const [situacao, setSituacao] = useState<StatusViatura>('Operacional');
  const [equipe, setEquipe] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (viatura) {
      setPrefixo(viatura.prefixo);
      setPlaca(viatura.placa);
      setTipo(viatura.tipo);
      setMarca(viatura.marca);
      setModelo(viatura.modelo);
      setAno(viatura.ano);
      setSituacao(viatura.status);
      setObservacoes(viatura.observacoes);
    }
  }, [viatura]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prefixo || !placa || !tipo || !marca || !modelo) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }
    setErro('');
    onSave({
      prefixo: prefixo.toUpperCase(),
      placa: placa.toUpperCase(),
      tipo,
      marca: capitalizarNome(marca),
      modelo: capitalizarNome(modelo),
      ano,
      status: situacao,
      observacoes,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex h-full max-h-full w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl dark:bg-surface-elevated">
        <div className="flex shrink-0 items-center justify-between border-b border-graphite-200 px-6 py-4 dark:border-border-dark">
          <div>
            <h2 className="text-lg font-bold text-graphite-900 dark:text-graphite-100">
              {viatura ? 'Editar Viatura' : 'Nova Viatura'}
            </h2>
            <p className="text-xs text-graphite-400">Cadastro de viatura operacional</p>
          </div>
          <button onClick={onClose}
            className="rounded-xl p-1.5 text-graphite-400 transition-all duration-200 hover:bg-graphite-100 hover:text-graphite-600 dark:hover:bg-surface-hover dark:hover:text-graphite-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {erro && <p className="text-sm text-alert-red">{erro}</p>}

            <fieldset>
              <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-aviation-600 dark:text-aviation-400">
                Dados da Viatura
              </legend>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-3">
                <div>
                  <label className={labelClass}>Prefixo *</label>
                  <input value={prefixo} onChange={e => setPrefixo(e.target.value)} placeholder="Ex: CCI-01"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Placa *</label>
                  <input value={placa} onChange={e => setPlaca(formatPlaca(e.target.value))} placeholder="ABC-1234"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Tipo *</label>
                  <select value={tipo} onChange={e => setTipo(e.target.value as TipoViatura)} className={selectClass}>
                    {TIPO_VIATURA_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Marca *</label>
                  <input value={marca} onChange={e => setMarca(e.target.value)} placeholder="Ex: Mercedes-Benz"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Modelo *</label>
                  <input value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Ex: Sprinter"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Ano</label>
                  <input value={ano} onChange={e => setAno(e.target.value)} placeholder="Ex: 2024"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Cor</label>
                  <input value={cor} onChange={e => setCor(e.target.value)} placeholder="Ex: Branco"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Situação</label>
                  <select value={situacao} onChange={e => setSituacao(e.target.value as StatusViatura)} className={selectClass}>
                    {STATUS_VIATURA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Equipe Responsável</label>
                  <input value={equipe} onChange={e => setEquipe(e.target.value)} placeholder="Ex: Alfa"
                    className={inputClass} />
                </div>
                <div className={span2}>
                  <label className={labelClass}>Observações</label>
                  <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações sobre a viatura..."
                    rows={2}
                    className={`${inputClass} resize-none`} />
                </div>
              </div>
            </fieldset>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-graphite-200 px-6 py-4 dark:border-border-dark">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-graphite-300/60 bg-white/80 px-5 py-2.5 text-sm font-medium text-graphite-700 backdrop-blur-sm transition-all duration-200 hover:bg-graphite-50 hover:border-graphite-300 dark:border-border-dark dark:bg-surface-card/80 dark:text-graphite-200 dark:hover:bg-surface-hover/50">
              Cancelar
            </button>
            <button type="submit"
              className="rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-aviation-500/30 hover:from-aviation-500 hover:to-aviation-600 active:scale-[0.98]">
              {viatura ? 'Salvar Alterações' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
