import { useState, useEffect, useCallback } from 'react';
import { listarBombeiros } from '../services/bombeiroService';
import { listarFeriasGozo } from '../services/feriasService';
import {
  listarVigencias,
  type VigenciaSubstituicao,
} from '../services/vigenciaSubstituicaoService';
import type { Bombeiro } from '../types/bombeiro';

export interface MembroEfetivo {
  bombeiro: Bombeiro;
  cargoExercido: string;
  substituindo: {
    id: string;
    nome: string;
    cargo: string;
  } | null;
  emFerias: boolean;
}

interface CacheKey {
  equipe: string;
  dataInicio: string;
  dataFim: string;
}

const cache = new Map<string, { efetivos: MembroEfetivo[] }>();

function makeKey(equipe: string, dataInicio: string, dataFim: string): string {
  return `${equipe}|${dataInicio}|${dataFim}`;
}

export function useEfetivoEquipe(equipe: string, mes: number, ano: number) {
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const dataFim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

  const [loading, setLoading] = useState(false);
  const [efetivos, setEfetivos] = useState<MembroEfetivo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const key = makeKey(equipe, dataInicio, dataFim);

  const carregar = useCallback(async () => {
    if (!equipe) return;

    const cached = cache.get(key);
    if (cached) {
      setEfetivos(cached.efetivos);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [bombeiros, feriasGozo, vigencias] = await Promise.all([
        listarBombeiros(),
        listarFeriasGozo(),
        listarVigencias({
          equipe,
          dataInicio,
          dataFim,
          ativa: true,
        }),
      ]);

      const membros = bombeiros.filter(
        b => b.equipe === equipe && !b.dataDesligamento
      );

      const vigenciasPeriodo = vigencias.filter(v => {
        const vInicio = new Date(v.dataInicio);
        const vFim = new Date(v.dataFim);
        const mInicio = new Date(dataInicio);
        const mFim = new Date(dataFim);
        return vInicio <= mFim && vFim >= mInicio;
      });

      // Mapa: substitutoId → vigência
      const mapSubstituto = new Map<string, VigenciaSubstituicao>();
      for (const v of vigenciasPeriodo) {
        mapSubstituto.set(v.substitutoId, v);
      }

      // Mapa: funcionario_original_id → vigência
      const mapOriginal = new Map<string, VigenciaSubstituicao>();
      for (const v of vigenciasPeriodo) {
        mapOriginal.set(v.funcionarioOriginalId, v);
      }

      const feriasNoMes = new Set(
        feriasGozo
          .filter(g => {
            if (g.status === 'Gozadas') return false;
            const gInicio = new Date(g.dataInicio);
            const gFim = new Date(g.dataFim);
            const mInicio = new Date(dataInicio);
            const mFim = new Date(dataFim);
            return gInicio <= mFim && gFim >= mInicio;
          })
          .map(g => g.funcionarioId)
      );

      const result: MembroEfetivo[] = [];
      const processados = new Set<string>();

      for (const m of membros) {
        const vigenciaAtiva = mapSubstituto.get(m.id);

        if (vigenciaAtiva) {
          result.push({
            bombeiro: m,
            cargoExercido: vigenciaAtiva.cargoExercido || m.cargo,
            substituindo: {
              id: vigenciaAtiva.funcionarioOriginalId,
              nome: vigenciaAtiva.funcionarioOriginalNome,
              cargo: vigenciaAtiva.cargoOriginalFuncionario,
            },
            emFerias: false,
          });
        } else {
          const emFerias = feriasNoMes.has(m.id) || !!mapOriginal.get(m.id);
          result.push({
            bombeiro: m,
            cargoExercido: m.cargo,
            substituindo: null,
            emFerias,
          });
        }
        processados.add(m.id);
      }

      // Substitutos externos (de outras equipas)
      for (const v of vigenciasPeriodo) {
        if (v.equipe === equipe && !processados.has(v.substitutoId)) {
          const b = bombeiros.find(bb => bb.id === v.substitutoId);
          if (b) {
            result.push({
              bombeiro: b,
              cargoExercido: v.cargoExercido,
              substituindo: {
                id: v.funcionarioOriginalId,
                nome: v.funcionarioOriginalNome,
                cargo: v.cargoOriginalFuncionario,
              },
              emFerias: false,
            });
            processados.add(b.id);
          }
        }
      }

      cache.set(key, { efetivos: result });
      setEfetivos(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar efetivo';
      setError(msg);
      console.error('Erro useEfetivoEquipe:', err);
    } finally {
      setLoading(false);
    }
  }, [equipe, key, dataInicio, dataFim]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const refresh = useCallback(() => {
    cache.delete(key);
    carregar();
  }, [key, carregar]);

  return { efetivos, loading, error, refresh };
}
