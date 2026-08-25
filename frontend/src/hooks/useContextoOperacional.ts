import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  canAcessarDadosPessoais,
  canGerenciarEquipe,
  canVisualizarRelatoriosPtrBa as canVisualizarRelatoriosPtrBaPerm,
  canVisualizarRelatorios as canVisualizarRelatoriosPerm,
  isAdministradorSistema,
  podeVerDadosPessoaisBase,
  resolverContextoOperacional,
  type ContextoOperacionalPermissao,
} from '../utils/permissoes';

function contextoFallback(user: ReturnType<typeof useAuth>['user']): ContextoOperacionalPermissao {
  return {
    equipe: (user?.pessoa?.equipe as ContextoOperacionalPermissao['equipe']) || null,
    equipeFixa: (user?.pessoa?.equipe as ContextoOperacionalPermissao['equipeFixa']) || null,
    cargo: user?.pessoa?.funcao || null,
    cargoFixo: user?.pessoa?.funcao || null,
    canManageGlobal: podeVerDadosPessoaisBase(user),
    isAdministradorSistema: isAdministradorSistema(user),
    bombeiroId: user?.pessoa?.personType === 'bombeiro' ? user.pessoa.id || null : null,
    autorizadoRegistrosDiarios: false,
    autorizacaoRegistrosDiariosEquipe: null,
  };
}

export function useContextoOperacional() {
  const { user } = useAuth();
  const [contexto, setContexto] = useState<ContextoOperacionalPermissao>(() => contextoFallback(user));
  const [loadingContexto, setLoadingContexto] = useState(true);

  useEffect(() => {
    let active = true;
    setContexto(contextoFallback(user));
    setLoadingContexto(true);

    resolverContextoOperacional(user)
      .then(ctx => {
        if (active) setContexto(ctx);
      })
      .finally(() => {
        if (active) setLoadingContexto(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

  const canManageGlobal = useMemo(() => canAcessarDadosPessoais(contexto), [contexto]);
  const canManageEquipe = useCallback((equipe?: string | null) => canGerenciarEquipe(contexto, equipe), [contexto]);
  const canVisualizarRelatorios = useMemo(() => canVisualizarRelatoriosPerm(contexto), [contexto]);
  const canVisualizarRelatoriosPtrBa = useMemo(() => canVisualizarRelatoriosPtrBaPerm(contexto), [contexto]);

  return {
    user,
    contexto,
    loadingContexto,
    canManageGlobal,
    canManageEquipe,
    canVisualizarRelatorios,
    canVisualizarRelatoriosPtrBa,
    equipeEfetiva: contexto.equipe,
    equipeFixa: contexto.equipeFixa,
    equipeAutorizadaRegistrosDiarios: contexto.autorizacaoRegistrosDiariosEquipe,
  };
}
