import { useState, useRef, useEffect } from 'react';
import { Search, Check, X } from 'lucide-react';
import { listarAtivos } from '../../services/bombeiroService';
import { listarAPOCs } from '../../services/apocService';

export interface AtivoItem {
  id: string;
  nomeGuerra: string;
  nomeCompleto: string;
  cargo?: string;
  equipe?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  cargo?: string;
  equipe?: string;
  valueField?: 'id' | 'nomeGuerra' | 'nomeCompleto';
  disabledIds?: Set<string>;
  disabledTooltip?: string;
  showCargo?: boolean;
  showEquipe?: boolean;
  displayMode?: 'default' | 'operational';
  options?: AtivoItem[];
}

export function SearchSelect({ value, onChange, placeholder, className = '', cargo, equipe, valueField = 'nomeGuerra', disabledIds, disabledTooltip, showCargo, showEquipe, displayMode = 'default', options }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const [ativos, setAtivos] = useState<AtivoItem[]>([]);

  useEffect(() => {
    if (options) {
      let lista = options;
      if (cargo) lista = lista.filter(b => b.cargo === cargo);
      if (equipe) lista = lista.filter(b => b.equipe === equipe);
      setAtivos(lista);
      return;
    }
    async function carregar() {
      let lista: AtivoItem[];
      if (cargo === 'APOC') {
        lista = (await listarAPOCs()).map(a => ({ id: a.id, nomeGuerra: a.nomeGuerra, nomeCompleto: a.nomeCompleto }));
      } else {
        const bombeiros = (await listarAtivos({ equipe, cargo })).map(b => ({
          id: b.id, nomeGuerra: b.nomeGuerra, nomeCompleto: b.nomeCompleto, cargo: b.cargo, equipe: b.equipe,
        }));
        if (cargo) {
          lista = bombeiros;
        } else {
          const apocs = (await listarAPOCs()).map(a => ({ id: a.id, nomeGuerra: a.nomeGuerra, nomeCompleto: a.nomeCompleto }));
          lista = [...bombeiros, ...apocs];
        }
      }
      setAtivos(lista);
    }
    carregar();
  }, [cargo, equipe, options]);

  const filtered = ativos.filter(b =>
    b.nomeGuerra.toLowerCase().includes(search.toLowerCase()) ||
    b.nomeCompleto.toLowerCase().includes(search.toLowerCase()) ||
    (b.cargo || '').toLowerCase().includes(search.toLowerCase()) ||
    (b.equipe || '').toLowerCase().includes(search.toLowerCase())
  );

  const getValue = (b: AtivoItem) => b[valueField];
  const getLabel = (b: AtivoItem) => valueField === 'nomeCompleto' ? b.nomeCompleto : b.nomeGuerra;
  const getDisplayLabel = (b: AtivoItem) => {
    if (displayMode === 'operational') {
      return [b.cargo, b.nomeGuerra, b.equipe].filter(Boolean).join(' · ');
    }
    return showCargo && b.cargo ? `${b.cargo} ${getLabel(b)}` : getLabel(b);
  };
  const selected = ativos.find(b => getValue(b) === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={triggerRef} className={`relative ${className}`}>
      <div
        onClick={() => setOpen(prev => !prev)}
        className="flex cursor-pointer items-center rounded-xl border-2 border-graphite-300 bg-white/80 px-3 py-2.5 text-sm font-medium transition-all duration-200 hover:border-aviation-500 hover:bg-aviation-50/30 dark:border-graphite-600 dark:bg-surface-card/80 dark:text-graphite-100 dark:hover:border-aviation-400 dark:hover:bg-aviation-900/20"
      >
        <Search className="mr-2 h-4 w-4 text-aviation-500 shrink-0" />
        <span className={value ? 'text-graphite-900 dark:text-graphite-100 truncate font-semibold' : 'text-graphite-400 italic truncate'}>
          {selected ? getDisplayLabel(selected) : placeholder || 'Selecione...'}
        </span>
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-2xl border-2 border-graphite-200 bg-white shadow-xl shadow-black/10 dark:border-graphite-600 dark:bg-surface-elevated" style={{ maxHeight: 260, overflowY: 'auto' }}>
          <div className="p-2">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Digite para pesquisar..." autoFocus
              className="w-full rounded-xl border-2 border-graphite-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-graphite-400 transition-all focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/20 dark:border-graphite-600 dark:bg-surface-card dark:text-graphite-100 dark:focus:border-aviation-400"
              style={{ borderColor: open ? undefined : undefined }} />
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-sm text-graphite-400 dark:text-graphite-500">Nenhum resultado</p>
            ) : (
              filtered.map(b => {
                const isDisabled = disabledIds?.has(b.id) || false;
                const itemValue = getValue(b);
                const isSelected = itemValue === value;
                return (
                  <button key={b.id} type="button" disabled={isDisabled}
                    title={isDisabled ? (disabledTooltip || 'Pessoa já selecionada em outro slot') : undefined}
                    onClick={() => { if (!isDisabled) { onChange(itemValue); setOpen(false); setSearch(''); } }}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-all ${
                      isDisabled
                        ? 'cursor-not-allowed opacity-40 bg-graphite-50 text-red-500 dark:bg-graphite-800/50 dark:text-red-400'
                        : isSelected
                          ? 'bg-aviation-100 text-aviation-800 shadow-sm ring-1 ring-aviation-400 dark:bg-aviation-900/30 dark:text-aviation-200 dark:ring-aviation-600'
                          : 'text-graphite-800 hover:bg-aviation-50 hover:text-aviation-700 dark:text-graphite-200 dark:hover:bg-aviation-900/20 dark:hover:text-aviation-300'
                    }`}>
                    <span className="flex-1 truncate">
                      <span className={`font-semibold ${isDisabled ? 'line-through' : ''}`}>
                        {displayMode === 'operational' ? getDisplayLabel(b) : `${showCargo && b.cargo ? `${b.cargo} ` : ''}${b.nomeGuerra}`}
                      </span>
                      {displayMode !== 'operational' && (
                        <span className={`ml-2 text-xs ${isDisabled ? 'text-red-400' : 'text-graphite-400 dark:text-graphite-500'}`}>{b.nomeCompleto}{showEquipe && b.equipe ? ` · ${b.equipe}` : ''}</span>
                      )}
                    </span>
                    {isDisabled && <X className="h-4 w-4 shrink-0 text-red-400" />}
                    {!isDisabled && isSelected && <Check className="h-4 w-4 shrink-0 text-aviation-600 dark:text-aviation-400" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
