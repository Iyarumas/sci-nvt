export interface ItemChecklistPlantao {
  nome: string;
  ok: boolean;
  /** O que aparece quando não está OK (ex.: INOPERANTE). */
  observacao: string;
  /** Só o hidrômetro tem leitura (m³). */
  valor?: string;
}

export interface HorarioRadio {
  inicio: string;
  fim: string;
  nome: string;
}

export interface MovimentacaoPlantao {
  hora: string;
  descricao: string;
}

/**
 * Saída de viatura no plantão (ou mudança de km): vale a última de cada viatura.
 * Não vai na mensagem do WhatsApp; vira o km e o combustível FINAL no LRO.
 */
export interface SaidaViatura {
  /** Posição do início de plantão: faisca02, faisca03, faiscaRT ou crs. */
  chave: string;
  km: string;
  /** Só o CRS: km do tacógrafo. */
  tac: string;
  combustivel: string;
}

/** Teste de sirene: com hora, ou "Não houve" (aí a hora não é necessária). */
export interface TesteSirene {
  hora: string;
  naoHouve: boolean;
}

export interface DadosFimPlantao {
  checklist: ItemChecklistPlantao[];
  radio: HorarioRadio[];
  /** Feito pelo APOC no início do plantão. Plantões antigos não têm. */
  sireneApoc?: TesteSirene;
  /** Feito pela torre no fim do plantão. Plantões antigos não têm. */
  sireneTorre?: TesteSirene;
  /** Saídas de viaturas (km/combustível finais do LRO). Plantões antigos não têm. */
  saidasViaturas?: SaidaViatura[];
  movimentacoes: MovimentacaoPlantao[];
  despedida: string;
}

export interface FimPlantaoSalvo {
  id: string;
  data: string;
  equipe: string;
  dados: DadosFimPlantao;
  mensagem: string;
  token: string;
  tokenExpiraEm: string;
  criadoPor: string;
  atualizadoPor: string;
  atualizadoEm: string;
}

export const HIDROMETRO = 'HIDRÔMETRO';

export const CHECKLIST_PADRAO: readonly ItemChecklistPlantao[] = [
  { nome: 'CHECK LIST', ok: true, observacao: '' },
  { nome: 'EQUIPAMENTOS', ok: true, observacao: '' },
  { nome: 'CÂMERAS DE MONITORAMENTO', ok: true, observacao: '' },
  { nome: "CAIXAS D'ÁGUA E CISTERNAS", ok: true, observacao: '' },
  { nome: 'Ponto de captação de água (Anteparo)', ok: true, observacao: '' },
  { nome: HIDROMETRO, ok: true, observacao: '', valor: '' },
  { nome: 'Ar condicionado', ok: true, observacao: '' },
  { nome: 'Compressor para reabastecimento de cilindro de ar respirável', ok: true, observacao: '' },
  { nome: "PTR'S PREVISTOS", ok: true, observacao: '' },
];

export const DESPEDIDA_PADRAO = 'Bom trabalho/descanso a todos, Deus abençoe!🙏🤝🫡';
