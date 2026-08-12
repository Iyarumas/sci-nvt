import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { listarAtivos, listarBombeiros } from '../services/bombeiroService';
import { listarFeriasGozo } from '../services/feriasService';
import { listarSubstituicoesTemporarias } from '../services/substituicaoTemporariaService';
import { listarVigencias, type VigenciaSubstituicao } from '../services/vigenciaSubstituicaoService';
import type { Bombeiro } from '../types/bombeiro';
import type { FeriasGozo } from '../types/ferias';
import type { SubstituicaoTemporaria } from '../types/substituicaoTemporaria';

interface DataState {
  bombeiros: Bombeiro[];
  ativos: Bombeiro[];
  feriasGozo: FeriasGozo[];
  substituicoesTemporarias: SubstituicaoTemporaria[];
  vigencias: VigenciaSubstituicao[];
  loading: boolean;
  lastRefresh: number;
  refresh: () => Promise<void>;
}

const DataContext = createContext<DataState | null>(null);

const CACHE_TTL = 30000; // 30s

export function DataProvider({ children }: { children: ReactNode }) {
  const [bombeiros, setBombeiros] = useState<Bombeiro[]>([]);
  const [ativos, setAtivos] = useState<Bombeiro[]>([]);
  const [feriasGozo, setFeriasGozo] = useState<FeriasGozo[]>([]);
  const [substituicoesTemporarias, setSubstituicoesTemporarias] = useState<SubstituicaoTemporaria[]>([]);
  const [vigencias, setVigencias] = useState<VigenciaSubstituicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [b, a, f, s, v] = await Promise.all([
        listarBombeiros(),
        listarAtivos(),
        listarFeriasGozo(),
        listarSubstituicoesTemporarias(),
        listarVigencias({ ativa: true }),
      ]);
      setBombeiros(b);
      setAtivos(a);
      setFeriasGozo(f);
      setSubstituicoesTemporarias(s);
      setVigencias(v);
      setLastRefresh(Date.now());
    } catch (err) {
      console.error('DataContext refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <DataContext.Provider value={{
      bombeiros, ativos, feriasGozo, substituicoesTemporarias, vigencias,
      loading, lastRefresh, refresh,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
