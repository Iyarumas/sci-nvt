import { useState, useRef, useEffect } from 'react';
import { Search } from 'lucide-react';

interface Option {
  label: string;
  sublabel?: string;
}

interface Props {
  value: string;
  onChange: (val: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
}

export function Autocomplete({ value, onChange, options, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [query, setQuery] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const filtered = options.filter(opt =>
    opt.label.toLowerCase().includes(query.toLowerCase())
  );

  function handleInput(v: string) {
    setQuery(v);
    setOpen(true);
    setHighlighted(-1);
  }

  function handleSelect(opt: Option) {
    setQuery(opt.label);
    onChange(opt.label);
    setOpen(false);
    setHighlighted(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true);
        setHighlighted(0);
        e.preventDefault();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      setHighlighted(h => Math.min(h + 1, filtered.length - 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setHighlighted(h => Math.max(h - 1, 0));
      e.preventDefault();
    } else if (e.key === 'Enter' && highlighted >= 0) {
      handleSelect(filtered[highlighted]);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlighted(-1);
    }
  }

  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const item = listRef.current.children[highlighted] as HTMLElement;
      item?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlighted]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        inputRef.current && !inputRef.current.contains(e.target as Node) &&
        listRef.current && !listRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery(value);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-graphite-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          onFocus={() => { setOpen(true); setHighlighted(-1); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`pl-9 ${className || 'w-full rounded-lg border border-graphite-200 bg-white px-3 py-2.5 text-sm text-graphite-900 dark:border-graphite-700 dark:bg-graphite-800 dark:text-graphite-100'}`}
          autoComplete="off"
        />
      </div>

      {open && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-graphite-200 bg-white shadow-lg dark:border-graphite-700 dark:bg-graphite-800"
        >
          {filtered.map((opt, i) => (
            <button
              key={i}
              onClick={() => handleSelect(opt)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                i === highlighted
                  ? 'bg-aviation-50 text-aviation-700 dark:bg-aviation-900/30 dark:text-aviation-300'
                  : 'text-graphite-700 hover:bg-graphite-50 dark:text-graphite-300 dark:hover:bg-graphite-700'
              }`}
            >
              <span className="font-medium">{opt.label}</span>
              {opt.sublabel && <span className="text-xs text-graphite-400">({opt.sublabel})</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
