import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, CheckCircle2, Clock, Loader2, X } from 'lucide-react';
import { listarOcorrencias } from '../../services/ocorrenciaService';
import type { Ocorrencia } from '../../types/ocorrencia';
import {
  estadoTesteSirene,
  salvarTesteSirene,
  TITULO_TESTE_SIRENE,
  type EstadoTesteSirene,
  type TipoTesteSirene,
} from '../../utils/testesSirene';

const QUANDO: Record<TipoTesteSirene, string> = {
  apoc: 'Ao assumir o plantão',
  twr: 'Antes do término do plantão',
};

const input = 'w-full rounded-xl border border-graphite-300/60 bg-white/70 px-3 py-2.5 text-base sm:py-2 sm:text-sm transition-all focus:border-aviation-500/50 focus:ring-2 focus:ring-aviation-500/10 disabled:opacity-50 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:scheme-dark';

/**
 * Testes de sirene do plantão (APOC e TWR). Preenche a hora ou "Não houve"; ao preencher já vira ocorrência
 * do plantão (vai para o LRO e para o fim de plantão). Na Central fica o plantão inteiro; no fim de plantão
 * aparece só o que estiver pendente.
 */
export function TestesSirene({ equipe, dataPlantao, usuario, somentePendentes = false, onMudou }: {
  equipe: string;
  dataPlantao: string;
  usuario: string;
  somentePendentes?: boolean;
  onMudou?: () => void;
}) {
  const [estados, setEstados] = useState<Record<TipoTesteSirene, EstadoTesteSirene> | null>(null);
  const [salvando, setSalvando] = useState<TipoTesteSirene | null>(null);
  const [erro, setErro] = useState('');
  const [rascunho, setRascunho] = useState<Record<TipoTesteSirene, string>>({ apoc: '', twr: '' });
  const espera = useRef<Partial<Record<TipoTesteSirene, ReturnType<typeof setTimeout>>>>({});

  const carregar = useCallback(async () => {
    if (!equipe || !dataPlantao) return;
    const ocorrencias = await listarOcorrencias().catch(() => [] as Ocorrencia[]);
    const novos = {
      apoc: estadoTesteSirene(ocorrencias, 'apoc', equipe, dataPlantao),
      twr: estadoTesteSirene(ocorrencias, 'twr', equipe, dataPlantao),
    };
    setEstados(novos);
    setRascunho({ apoc: novos.apoc.hora, twr: novos.twr.hora });
  }, [equipe, dataPlantao]);

  useEffect(() => { void carregar(); }, [carregar]);

  async function gravar(tipo: TipoTesteSirene, hora: string, naoHouve: boolean) {
    if (!estados) return;
    setSalvando(tipo);
    setErro('');
    try {
      await salvarTesteSirene({ tipo, equipe, dataPlantao, hora, naoHouve, usuario, existente: estados[tipo].ocorrencia });
      await carregar();
      onMudou?.();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível lançar o teste.');
    } finally {
      setSalvando(null);
    }
  }

  function mudarHora(tipo: TipoTesteSirene, hora: string) {
    setRascunho(r => ({ ...r, [tipo]: hora }));
    clearTimeout(espera.current[tipo]);
    // A hora completa (HH:MM) grava sozinha, um instante depois de escolher.
    if (/^\d{2}:\d{2}$/.test(hora)) espera.current[tipo] = setTimeout(() => void gravar(tipo, hora, false), 700);
  }

  if (!estados) return null;
  const tipos = (['apoc', 'twr'] as const).filter(t => !somentePendentes || (!estados[t].ocorrencia));
  if (!tipos.length) return null;

  return (
    <section className={`rounded-2xl border p-5 ${somentePendentes
      ? 'border-amber-300 bg-amber-50/60 dark:border-amber-700/50 dark:bg-amber-900/10'
      : 'border-emerald-300/70 bg-white/80 dark:border-emerald-700/40 dark:bg-surface-card/80'}`}>
      <h2 className="flex items-center gap-2 font-bold text-graphite-900 dark:text-graphite-100">
        <BellRing className="h-4 w-4" /> {somentePendentes ? 'Falta lançar teste de sirene' : 'Testes de sirene'}
      </h2>
      <p className="mt-1 text-sm text-graphite-500 dark:text-graphite-400">
        {somentePendentes
          ? 'Preencha agora. Se ficar em branco, ao salvar o fim de plantão vai como "Não houve".'
          : 'Preencha cada um quando acontecer. Vai sozinho para o LRO e para o fim de plantão.'}
      </p>
      <div className="mt-3 divide-y divide-graphite-100 dark:divide-border-dark">
        {tipos.map(tipo => {
          const estado = estados[tipo];
          const lancado = !!estado.ocorrencia;
          return (
            <div key={tipo} className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_7rem_auto_7rem]">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-graphite-900 dark:text-graphite-100">{TITULO_TESTE_SIRENE[tipo]}</p>
                <p className="text-xs text-graphite-500 dark:text-graphite-400">{QUANDO[tipo]}</p>
              </div>
              <input type="time" aria-label={`Hora do ${TITULO_TESTE_SIRENE[tipo]}`} value={estado.naoHouve ? '' : rascunho[tipo]}
                disabled={estado.naoHouve || salvando === tipo} onChange={e => mudarHora(tipo, e.target.value)} className={input} />
              <button type="button" aria-pressed={estado.naoHouve} disabled={salvando === tipo}
                onClick={() => void gravar(tipo, '', !estado.naoHouve)}
                className={`col-span-1 flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors sm:min-h-0 sm:py-2 ${estado.naoHouve
                  ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-300'
                  : 'border-graphite-300/60 text-graphite-600 hover:bg-graphite-50 dark:border-border-dark dark:text-graphite-300 dark:hover:bg-surface-hover'}`}>
                <X className="h-4 w-4" /> Não houve
              </button>
              <span className="flex items-center gap-1 text-xs font-semibold">
                {salvando === tipo
                  ? <span className="flex items-center gap-1 text-graphite-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Lançando…</span>
                  : lancado
                    ? <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Lançado</span>
                    : <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300"><Clock className="h-3.5 w-3.5" /> Pendente</span>}
              </span>
            </div>
          );
        })}
      </div>
      {erro && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">{erro}</p>}
    </section>
  );
}
