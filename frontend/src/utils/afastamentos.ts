import type { SubstituicaoTemporaria } from '../types/substituicaoTemporaria';
import { normalizarDataISO, somarDiasISO } from './datas';

export interface GrupoAfastamento {
  id: string;
  atual: SubstituicaoTemporaria;
  periodos: SubstituicaoTemporaria[];
  dataInicio: string;
  dataFim: string;
}

function isInssIndeterminado(sub: SubstituicaoTemporaria): boolean {
  return sub.tipo === 'Afastamento' && sub.motivo === 'INSS Indeterminado';
}

/** Agrupa somente os períodos contínuos de um mesmo afastamento, sem alterar seu histórico. */
export function agruparAfastamentosIndeterminados(subs: SubstituicaoTemporaria[]): GrupoAfastamento[] {
  const indicesOriginais = new Map(subs.map((sub, index) => [sub.id, index]));
  const ordenados = [...subs].sort((a, b) =>
    normalizarDataISO(a.dataInicio).localeCompare(normalizarDataISO(b.dataInicio)) ||
    (indicesOriginais.get(a.id) ?? 0) - (indicesOriginais.get(b.id) ?? 0)
  );
  const grupos: SubstituicaoTemporaria[][] = [];
  const grupoPorPeriodo = new Map<string, SubstituicaoTemporaria[]>();

  for (const sub of ordenados) {
    const inicio = normalizarDataISO(sub.dataInicio);
    let anterior: SubstituicaoTemporaria | undefined;
    if (isInssIndeterminado(sub) && inicio) {
      const aprovadosAnteriores = ordenados.filter(item =>
        item.id !== sub.id &&
        grupoPorPeriodo.has(item.id) &&
        isInssIndeterminado(item) &&
        item.status === 'Aprovada' &&
        item.funcionarioId === sub.funcionarioId &&
        normalizarDataISO(item.dataInicio) < inicio
      );

      if (sub.status !== 'Rejeitada') {
        const vespera = somarDiasISO(inicio, -1);
        anterior = aprovadosAnteriores.findLast(item => normalizarDataISO(item.dataFim) === vespera);
      }
      if (!anterior && (sub.status === 'Pendente' || sub.status === 'Rejeitada')) {
        anterior = aprovadosAnteriores.findLast(item =>
          normalizarDataISO(item.dataFim) >= inicio
        );
      }
    }

    const grupoExistente = anterior ? grupoPorPeriodo.get(anterior.id) : undefined;
    const periodos = grupoExistente || [];
    if (!grupoExistente) grupos.push(periodos);
    periodos.push(sub);
    grupoPorPeriodo.set(sub.id, periodos);
  }

  // Mantém a ordem da listagem original e organiza o histórico dentro de cada card.
  return grupos
    .sort((a, b) =>
      Math.min(...a.map(sub => indicesOriginais.get(sub.id) ?? 0)) -
      Math.min(...b.map(sub => indicesOriginais.get(sub.id) ?? 0))
    )
    .map(periodos => {
      const aprovados = periodos.filter(sub => sub.status === 'Aprovada');
      const pendentes = periodos.filter(sub => sub.status === 'Pendente');
      const atual = aprovados.at(-1) || pendentes.at(-1) || periodos[periodos.length - 1];
      const inicioAfastamento = periodos.find(sub => sub.status !== 'Rejeitada') || periodos[0];
      return {
        id: periodos[0].id,
        atual,
        periodos,
        dataInicio: inicioAfastamento.dataInicio,
        dataFim: atual.dataFim,
      };
    });
}
