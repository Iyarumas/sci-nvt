export type ReaStatus = 'Aberta' | 'Fechada';

export type ReaDados = Record<string, string>;

export interface ReaRegistro {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  numero: string;
  status: ReaStatus;
  equipe: string;
  aerodromo: string;
  cidade: string;
  dataAcidente: string;
  horaAcidente: string;
  matricula: string;
  empresa: string;
  dados: ReaDados;
}

export type ReaRegistroInput = Omit<ReaRegistro, 'id' | 'createdAt' | 'updatedAt' | 'aerodromo' | 'cidade' | 'dataAcidente' | 'horaAcidente' | 'matricula' | 'empresa'>;

export type ReaFieldType = 'text' | 'date' | 'time' | 'textarea' | 'radio' | 'checkbox';

export interface ReaFormField {
  key: string;
  label: string;
  type?: ReaFieldType;
  rows?: number;
  colSpan?: 1 | 2 | 3 | 4;
  options?: string[];
  numeric?: boolean;
}

export interface ReaFormSection {
  title: string;
  fields: ReaFormField[];
}

export const REA_STATUS: ReaStatus[] = ['Aberta', 'Fechada'];

export const REA_RECURSO_LINHAS = [
  { key: 'cci', label: '(a) CCI' },
  { key: 'bombeiros', label: '(b) Bombeiros' },
  { key: 'servicosMedicos', label: '(c) Serviços Médicos' },
  { key: 'ambulancias', label: '(d) Ambulâncias' },
  { key: 'carroPipa', label: '(e) Carro Pipa' },
  { key: 'outros', label: '(f) Outros' },
] as const;

export const REA_AGENTES_EXTINTORES = [
  { key: 'poQuimico', label: '(a) Pó Químico' },
  { key: 'co2', label: '(b) CO2' },
  { key: 'lge', label: '(c) LGE' },
  { key: 'aguaEspuma', label: '(d) Água para produção de espuma' },
  { key: 'aguaOutrosUsos', label: '(e) Água para outros usos' },
  { key: 'outros', label: '(f) Outros (especificar)' },
] as const;

export const REA_EXTINTOR_CAMPOS = [
  { key: 'quantidade', label: 'Quantidade Aproximada (L)' },
  { key: 'razao', label: 'Razão de Descarga (L/min)' },
  { key: 'tempo', label: 'Tempo de descarga (MIN)' },
  { key: 'ordem', label: 'Ordem de emprego' },
  { key: 'suficiente', label: 'Quantidade suficiente' },
] as const;

export const REA_FORM_SECTIONS: ReaFormSection[] = [
  {
    title: '1. Generalidades',
    fields: [
      { key: 'aerodromo', label: '1.1 Aeródromo' },
      { key: 'cidade', label: '1.2 Cidade' },
      { key: 'dataAcidente', label: '1.3 Data do Acidente', type: 'date' },
      { key: 'horaLocalAcidente', label: '1.4 Hora Local do Acidente', type: 'time' },
      { key: 'acidentePeriodo', label: '1.5 Acidente ocorrido durante', type: 'radio', options: ['Dia', 'Noite'] },
      { key: 'tipoAeronave', label: '1.6 Tipo da Aeronave' },
      { key: 'matricula', label: '1.7 Matrícula' },
      { key: 'empresa', label: '1.8 Empresa' },
      { key: 'propositoOperacao', label: '1.9 Propósito da operação' },
      { key: 'combustivel', label: '1.10 Combustível' },
      { key: 'alertaDadoPor', label: '1.11 Alerta dado por' },
      { key: 'horaAlerta', label: '1.12 Hora do Alerta', type: 'time' },
    ],
  },
  {
    title: '2. Fase da Operação',
    fields: [
      { key: 'faseOperacao', label: 'Fase da operação', type: 'radio', options: ['Pouso', 'Decolagem', 'Taxi', 'Estacionamento'], colSpan: 4 },
    ],
  },
  {
    title: '3. Condições Meteorológicas',
    fields: [
      { key: 'visibilidade', label: '3.1 Visibilidade' },
      { key: 'teto', label: '3.2 Teto' },
      { key: 'temperatura', label: '3.3 Temperatura', numeric: true },
      { key: 'direcaoVento', label: '3.4 Direção do Vento' },
      { key: 'velocidadeVento', label: '3.5 Velocidade do Vento', colSpan: 2, numeric: true },
      { key: 'condicoesGeraisTempo', label: '3.6 Condições Gerais do Tempo', colSpan: 2 },
    ],
  },
  {
    title: '4. Ocupantes e Vítimas',
    fields: [
      { key: 'totalPessoasBordo', label: '4.1 Total de Pessoas a Bordo', numeric: true },
      { key: 'salvasSemAjudaFeridos', label: '4.2 Salvas sem ajuda - Feridos', numeric: true },
      { key: 'salvasSemAjudaIlesos', label: '4.2 Salvas sem ajuda - Ilesos', numeric: true },
      { key: 'resgatadasVivasFeridos', label: '4.3 Resgatadas Vivas - Feridos', numeric: true },
      { key: 'resgatadasVivasIlesos', label: '4.3 Resgatadas Vivas - Ilesos', numeric: true },
      { key: 'mortosPassageiros', label: '4.4 Mortos - Passageiros', numeric: true },
      { key: 'mortosTripulantes', label: '4.4 Mortos - Tripulantes', numeric: true },
      { key: 'vitimasTerraMortos', label: '4.5 Vítimas em Terra - Mortos', numeric: true },
      { key: 'vitimasTerraFeridos', label: '4.5 Vítimas em Terra - Feridos', numeric: true },
      { key: 'obitos24hOcupantes', label: '4.6 Óbitos 24h - Ocupantes', numeric: true },
      { key: 'obitos24hVitimasTerra', label: '4.6 Óbitos 24h - Vítimas em Terra', numeric: true },
      { key: 'mortosVitimasFogo', label: '4.7 Mortos vítimas de fogo', colSpan: 2, numeric: true },
    ],
  },
  {
    title: '5. Dados Horários',
    fields: [
      { key: 'intervaloAvisoPrevio', label: '5.1 Aviso prévio - anúncio até contato', type: 'textarea', rows: 2, colSpan: 2 },
      { key: 'intervaloSemAvisoPrevio', label: '5.2 Sem aviso prévio - acidente até alerta SCI', type: 'textarea', rows: 2, colSpan: 2 },
      { key: 'tempoPrimeirosCci', label: '5.3 Alerta/contato até chegada dos primeiros CCI', type: 'textarea', rows: 2, colSpan: 2 },
      { key: 'tempoDemaisCci', label: '5.4 Alerta/contato até chegada dos demais CCI', type: 'textarea', rows: 2, colSpan: 2 },
      { key: 'tempoFogoControlado', label: '5.5 Chegada CCI até fogo controlado', type: 'textarea', rows: 2, colSpan: 2 },
      { key: 'tempoExtincaoFogo', label: '5.6 Chegada CCI até extinção do fogo', type: 'textarea', rows: 2, colSpan: 2 },
      { key: 'tempoSaidaUltimoSobrevivente', label: '5.7 Chegada CCI até saída do último sobrevivente', type: 'textarea', rows: 2, colSpan: 2 },
      { key: 'tempoRemocaoUltimosCadaveres', label: '5.8 Chegada CCI até remoção dos últimos cadáveres', type: 'textarea', rows: 2, colSpan: 2 },
    ],
  },
  {
    title: '7. Descrição da Ocorrência',
    fields: [
      { key: 'descricaoEmergencia', label: '7.1 Descrição da Emergência', type: 'textarea', rows: 5, colSpan: 4 },
      { key: 'relatoCondensadoIncendio', label: '7.2 Relato condensado do incêndio', type: 'textarea', rows: 4, colSpan: 4 },
      { key: 'descricaoCondicoesResgate', label: '7.3 Descrição do incêndio e condições de resgate na chegada dos CCI', type: 'textarea', rows: 4, colSpan: 4 },
    ],
  },
  {
    title: '8. Operações de Combate a Incêndio',
    fields: [
      { key: 'condutaOperacoesExtincao', label: '8.1 Conduta das operações de extinção', type: 'textarea', rows: 4, colSpan: 4 },
    ],
  },
  {
    title: '9. Evacuação',
    fields: [
      { key: 'descricaoEvacuacao', label: '9.1 Descrição da evacuação dos ocupantes', type: 'textarea', rows: 4, colSpan: 4 },
      { key: 'numeroVitimasTrasladadas', label: '9.2 Número de vítimas trasladadas', numeric: true },
      { key: 'salaPrimeirosSocorros', label: '9.2 Sala de primeiros socorros', numeric: true },
      { key: 'hospitais', label: '9.2 Hospitais', numeric: true },
      { key: 'necroterios', label: '9.2 Necrotérios', numeric: true },
    ],
  },
  {
    title: '10. Outros Detalhes',
    fields: [
      { key: 'outrosDetalhesImportantes', label: '10.1 Comunicações utilizadas e condições do terreno', type: 'textarea', rows: 4, colSpan: 4 },
      { key: 'dificuldadesLocalizarAtingir', label: '10.2 Dificuldades em localizar ou atingir o local', type: 'textarea', rows: 4, colSpan: 4 },
    ],
  },
  {
    title: '11. Eficiência das Operações',
    fields: [
      { key: 'avaliacaoEficiencia', label: '11.1 Avaliação geral da eficiência das operações', type: 'textarea', rows: 4, colSpan: 4 },
      { key: 'aeronaveDestruidaAcidente', label: '11.2 Destruída - Pelo Acidente' },
      { key: 'aeronaveDestruidaIncendio', label: '11.2 Destruída - Pelo Incêndio' },
      { key: 'aeronaveGravementeDanificadaAcidente', label: '11.2 Gravemente danificada - Pelo Acidente' },
      { key: 'aeronaveGravementeDanificadaIncendio', label: '11.2 Gravemente danificada - Pelo Incêndio' },
      { key: 'aeronavePoucosDanosAcidente', label: '11.2 Poucos danos - Pelo Acidente' },
      { key: 'aeronavePoucosDanosIncendio', label: '11.2 Poucos danos - Pelo Incêndio' },
      { key: 'aeronaveIncolumeAcidente', label: '11.2 Incólume - Pelo Acidente' },
      { key: 'aeronaveIncolumeIncendio', label: '11.2 Incólume - Pelo Incêndio' },
    ],
  },
  {
    title: '12. Diagrama',
    fields: [
      { key: 'diagramaViasAcesso', label: '12.1 Local do Acidente e vias de acesso', type: 'textarea', rows: 3, colSpan: 4 },
      { key: 'diagramaLocalAcidente', label: '12.2 Local do Acidente', type: 'textarea', rows: 3, colSpan: 4 },
    ],
  },
  {
    title: '13. Observações Gerais',
    fields: [
      { key: 'informacoesNaoPassadasChefe', label: '13.1 Informações ou dados não passados ao Chefe de Equipe', type: 'textarea', rows: 3, colSpan: 4 },
    ],
  },
  {
    title: '14. Responsável pelo Relatório',
    fields: [
      { key: 'gerenteSescinc', label: 'Gerente do SESCINC', colSpan: 2 },
      { key: 'coordenadorPrevEmerg', label: 'Coord. de Prev. e Emerg.', colSpan: 2 },
    ],
  },
];

export function recursoReaKey(prefix: 'aerodromo' | 'externo', linha: string, indice: number, campo: 'tipo' | 'quant'): string {
  return `${prefix}_${linha}_${indice}_${campo}`;
}

export function agenteExtintorReaKey(linha: string, campo: string): string {
  return `agente_${linha}_${campo}`;
}

export function criarReaDadosVazios(): ReaDados {
  const dados: ReaDados = {};

  for (const section of REA_FORM_SECTIONS) {
    for (const field of section.fields) dados[field.key] = '';
  }

  for (const prefix of ['aerodromo', 'externo'] as const) {
    for (const linha of REA_RECURSO_LINHAS) {
      for (let indice = 1; indice <= 4; indice += 1) {
        dados[recursoReaKey(prefix, linha.key, indice, 'tipo')] = '';
        dados[recursoReaKey(prefix, linha.key, indice, 'quant')] = '';
      }
    }
  }

  for (const linha of REA_AGENTES_EXTINTORES) {
    for (const campo of REA_EXTINTOR_CAMPOS) {
      dados[agenteExtintorReaKey(linha.key, campo.key)] = '';
    }
  }

  return dados;
}
