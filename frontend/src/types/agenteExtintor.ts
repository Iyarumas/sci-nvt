export type ProdutoAgenteExtintor = 'LGE' | 'Pó Químico Seco' | 'Nitrogênio';
export type TipoAgenteExtintor = 'Agente Extintor Principal' | 'Agente Extintor Complementar' | 'Agente Propelente';
export type DosagemAgenteExtintor = '' | '1%' | '3%' | '6%';
export type ClasseAgenteExtintor = '' | 'AV' | 'AR' | 'HC';
export type ComposicaoAgenteExtintor = '' | 'MONOFOSFATO DE AMÔNIA' | 'BICARBONATO DE SÓDIO';
export type UnidadeAgenteExtintor = 'L' | 'kg' | 'BAR' | 'cilindro' | 'unidade';
export type StatusAgenteExtintor = 'Disponível' | 'Baixo estoque' | 'Vencido' | 'Em manutenção' | 'Fora de uso';

export const PRODUTO_AGENTE_EXTINTOR_OPTIONS: { value: ProdutoAgenteExtintor; label: string }[] = [
  { value: 'LGE', label: 'LGE' },
  { value: 'Pó Químico Seco', label: 'Pó Químico Seco' },
  { value: 'Nitrogênio', label: 'Nitrogênio' },
];

export const TIPO_AGENTE_EXTINTOR_OPTIONS: { value: TipoAgenteExtintor; label: string }[] = [
  { value: 'Agente Extintor Principal', label: 'Agente Extintor Principal' },
  { value: 'Agente Extintor Complementar', label: 'Agente Extintor Complementar' },
  { value: 'Agente Propelente', label: 'Agente Propelente' },
];

export const DOSAGEM_AGENTE_EXTINTOR_OPTIONS: { value: DosagemAgenteExtintor; label: string }[] = [
  { value: '', label: 'Selecione...' },
  { value: '1%', label: '1%' },
  { value: '3%', label: '3%' },
  { value: '6%', label: '6%' },
];

export const CLASSE_AGENTE_EXTINTOR_OPTIONS: { value: ClasseAgenteExtintor; label: string }[] = [
  { value: '', label: 'Selecione...' },
  { value: 'AV', label: 'AV' },
  { value: 'AR', label: 'AR' },
  { value: 'HC', label: 'HC' },
];

export const COMPOSICAO_AGENTE_EXTINTOR_OPTIONS: { value: ComposicaoAgenteExtintor; label: string }[] = [
  { value: '', label: 'Selecione...' },
  { value: 'MONOFOSFATO DE AMÔNIA', label: 'MONOFOSFATO DE AMÔNIA' },
  { value: 'BICARBONATO DE SÓDIO', label: 'BICARBONATO DE SÓDIO' },
];

export const UNIDADE_AGENTE_EXTINTOR_OPTIONS: { value: UnidadeAgenteExtintor; label: string }[] = [
  { value: 'L', label: 'Litros' },
  { value: 'kg', label: 'Quilogramas' },
  { value: 'BAR', label: 'BAR' },
  { value: 'cilindro', label: 'Cilindros' },
  { value: 'unidade', label: 'Unidades' },
];

export const STATUS_AGENTE_EXTINTOR_OPTIONS: { value: StatusAgenteExtintor; label: string; color: string }[] = [
  { value: 'Disponível', label: 'Disponível', color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
  { value: 'Baixo estoque', label: 'Baixo estoque', color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' },
  { value: 'Vencido', label: 'Vencido', color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
  { value: 'Em manutenção', label: 'Em manutenção', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
  { value: 'Fora de uso', label: 'Fora de uso', color: 'bg-graphite-100 text-graphite-600 dark:bg-graphite-700 dark:text-graphite-300' },
];

export function tipoPorProduto(produto: ProdutoAgenteExtintor): TipoAgenteExtintor {
  if (produto === 'Pó Químico Seco') return 'Agente Extintor Complementar';
  if (produto === 'Nitrogênio') return 'Agente Propelente';
  return 'Agente Extintor Principal';
}

export function unidadePadraoPorProduto(produto: ProdutoAgenteExtintor): UnidadeAgenteExtintor {
  if (produto === 'Pó Químico Seco') return 'kg';
  if (produto === 'Nitrogênio') return 'BAR';
  return 'L';
}

function normalizarTexto(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizarProdutoAgenteExtintor(value: unknown): ProdutoAgenteExtintor {
  const texto = normalizarTexto(value);
  if (texto.includes('pqs') || texto.includes('po quimico') || texto.includes('pq')) return 'Pó Químico Seco';
  if (texto.includes('nitrogenio')) return 'Nitrogênio';
  return 'LGE';
}

export function normalizarTipoAgenteExtintor(value: unknown, produto: ProdutoAgenteExtintor): TipoAgenteExtintor {
  const texto = normalizarTexto(value);
  if (texto.includes('complementar')) return 'Agente Extintor Complementar';
  if (texto.includes('propelente')) return 'Agente Propelente';
  if (texto.includes('principal')) return 'Agente Extintor Principal';
  return tipoPorProduto(produto);
}

export function normalizarUnidadeAgenteExtintor(value: unknown, produto: ProdutoAgenteExtintor): UnidadeAgenteExtintor {
  const raw = String(value || '').trim();
  if (raw === 'L' || raw === 'kg' || raw === 'BAR' || raw === 'cilindro' || raw === 'unidade') return raw;
  return unidadePadraoPorProduto(produto);
}

export function normalizarStatusAgenteExtintor(value: unknown): StatusAgenteExtintor {
  const texto = normalizarTexto(value);
  if (texto === 'baixo estoque') return 'Baixo estoque';
  if (texto === 'vencido') return 'Vencido';
  if (texto === 'em manutencao') return 'Em manutenção';
  if (texto === 'fora de uso') return 'Fora de uso';
  return 'Disponível';
}

export interface AgenteExtintor {
  id: string;
  marcaAgente: string;
  produto: ProdutoAgenteExtintor;
  tipo: TipoAgenteExtintor;
  dosagem: DosagemAgenteExtintor;
  classe: ClasseAgenteExtintor;
  quantidade: number;
  unidade: UnidadeAgenteExtintor;
  lote: string;
  validade: string;
  validadeEnsaioLaboratorial: string;
  validadeEnsaioFogo: string;
  fabricacao: string;
  composicao: ComposicaoAgenteExtintor;
  testeHidrostatico: string;
  validadeTesteHidrostatico: string;
  validadeCilindro: string;
  localizacao: string;
  status: StatusAgenteExtintor;
  observacoes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
