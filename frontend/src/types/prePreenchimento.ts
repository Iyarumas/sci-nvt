/** Tela em que o pré-preenchimento aparece. Cada modelo vale para uma tela só. */
export type TelaPrePreenchimento = 'ocorrencias' | 'inspecoes' | 'solicitacoes';

export const TELAS_PRE_PREENCHIMENTO: { value: TelaPrePreenchimento; label: string }[] = [
  { value: 'ocorrencias', label: 'LRO/Ocorrências' },
  { value: 'inspecoes', label: 'Inspeções' },
  { value: 'solicitacoes', label: 'Solicitações' },
];

export function nomeDaTela(tela: TelaPrePreenchimento): string {
  return TELAS_PRE_PREENCHIMENTO.find(t => t.value === tela)?.label || tela;
}

/** Modelo de Tipo e Descrição cadastrado pelo administrador para padronizar os registros. */
export interface PrePreenchimento {
  id: string;
  tela: TelaPrePreenchimento;
  tipo: string;
  descricao: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
