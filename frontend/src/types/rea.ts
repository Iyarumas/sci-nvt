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
  { key: 'servicosMedicos', label: '(c) Servicos Medicos' },
  { key: 'ambulancias', label: '(d) Ambulancias' },
  { key: 'carroPipa', label: '(e) Carro Pipa' },
  { key: 'outros', label: '(f) Outros' },
] as const;

export const REA_AGENTES_EXTINTORES = [
  { key: 'poQuimico', label: '(a) Po Quimico' },
  { key: 'co2', label: '(b) CO2' },
  { key: 'lge', label: '(c) LGE' },
  { key: 'aguaEspuma', label: '(d) Agua para producao de espuma' },
  { key: 'aguaOutrosUsos', label: '(e) Agua para outros usos' },
  { key: 'outros', label: '(f) Outros (especificar)' },
] as const;

export const REA_EXTINTOR_CAMPOS = [
  { key: 'quantidade', label: 'Quantidade Aproximada (L)' },
  { key: 'razao', label: 'Razao de Descarga (L/min)' },
  { key: 'tempo', label: 'Tempo de descarga (MIN)' },
  { key: 'ordem', label: 'Ordem de emprego' },
  { key: 'suficiente', label: 'Quantidade suficiente' },
] as const;

export const REA_FORM_SECTIONS: ReaFormSection[] = [
  {
    title: '1. Generalidades',
    fields: [
      { key: 'aerodromo', label: '1.1 Aerodromo' },
      { key: 'cidade', label: '1.2 Cidade' },
      { key: 'dataAcidente', label: '1.3 Data do Acidente', type: 'date' },
      { key: 'horaLocalAcidente', label: '1.4 Hora Local do Acidente', type: 'time' },
      { key: 'acidentePeriodo', label: '1.5 Acidente ocorrido durante', type: 'radio', options: ['Dia', 'Noite'] },
      { key: 'tipoAeronave', label: '1.6 Tipo da Aeronave' },
      { key: 'matricula', label: '1.7 Matricula' },
      { key: 'empresa', label: '1.8 Empresa' },
      { key: 'propositoOperacao', label: '1.9 Proposito da operacao' },
      { key: 'combustivel', label: '1.10 Combustivel' },
      { key: 'alertaDadoPor', label: '1.11 Alerta dado por' },
      { key: 'horaAlerta', label: '1.12 Hora do Alerta', type: 'time' },
    ],
  },
  {
    title: '2. Fase da Operacao',
    fields: [
      { key: 'faseOperacao', label: 'Fase da operacao', type: 'radio', options: ['Pouso', 'Decolagem', 'Taxi', 'Estacionamento'], colSpan: 4 },
    ],
  },
  {
    title: '3. Condicoes Meteorologicas',
    fields: [
      { key: 'visibilidade', label: '3.1 Visibilidade' },
      { key: 'teto', label: '3.2 Teto' },
      { key: 'temperatura', label: '3.3 Temperatura', numeric: true },
      { key: 'direcaoVento', label: '3.4 Direcao do Vento' },
      { key: 'velocidadeVento', label: '3.5 Velocidade do Vento', colSpan: 2, numeric: true },
      { key: 'condicoesGeraisTempo', label: '3.6 Condicoes Gerais do Tempo', colSpan: 2 },
    ],
  },
  {
    title: '4. Ocupantes e Vitimas',
    fields: [
      { key: 'totalPessoasBordo', label: '4.1 Total de Pessoas a Bordo', numeric: true },
      { key: 'salvasSemAjudaFeridos', label: '4.2 Salvas sem ajuda - Feridos', numeric: true },
      { key: 'salvasSemAjudaIlesos', label: '4.2 Salvas sem ajuda - Ilesos', numeric: true },
      { key: 'resgatadasVivasFeridos', label: '4.3 Resgatadas Vivas - Feridos', numeric: true },
      { key: 'resgatadasVivasIlesos', label: '4.3 Resgatadas Vivas - Ilesos', numeric: true },
      { key: 'mortosPassageiros', label: '4.4 Mortos - Passageiros', numeric: true },
      { key: 'mortosTripulantes', label: '4.4 Mortos - Tripulantes', numeric: true },
      { key: 'vitimasTerraMortos', label: '4.5 Vitimas em Terra - Mortos', numeric: true },
      { key: 'vitimasTerraFeridos', label: '4.5 Vitimas em Terra - Feridos', numeric: true },
      { key: 'obitos24hOcupantes', label: '4.6 Obitos 24h - Ocupantes', numeric: true },
      { key: 'obitos24hVitimasTerra', label: '4.6 Obitos 24h - Vitimas em Terra', numeric: true },
      { key: 'mortosVitimasFogo', label: '4.7 Mortos vitimas de fogo', colSpan: 2, numeric: true },
    ],
  },
  {
    title: '5. Dados Horarios',
    fields: [
      { key: 'intervaloAvisoPrevio', label: '5.1 Aviso previo - anuncio ate contato', type: 'textarea', rows: 2, colSpan: 2 },
      { key: 'intervaloSemAvisoPrevio', label: '5.2 Sem aviso previo - acidente ate alerta SCI', type: 'textarea', rows: 2, colSpan: 2 },
      { key: 'tempoPrimeirosCci', label: '5.3 Alerta/contato ate chegada dos primeiros CCI', type: 'textarea', rows: 2, colSpan: 2 },
      { key: 'tempoDemaisCci', label: '5.4 Alerta/contato ate chegada dos demais CCI', type: 'textarea', rows: 2, colSpan: 2 },
      { key: 'tempoFogoControlado', label: '5.5 Chegada CCI ate fogo controlado', type: 'textarea', rows: 2, colSpan: 2 },
      { key: 'tempoExtincaoFogo', label: '5.6 Chegada CCI ate extincao do fogo', type: 'textarea', rows: 2, colSpan: 2 },
      { key: 'tempoSaidaUltimoSobrevivente', label: '5.7 Chegada CCI ate saida do ultimo sobrevivente', type: 'textarea', rows: 2, colSpan: 2 },
      { key: 'tempoRemocaoUltimosCadaveres', label: '5.8 Chegada CCI ate remocao dos ultimos cadaveres', type: 'textarea', rows: 2, colSpan: 2 },
    ],
  },
  {
    title: '7. Descricao da Ocorrencia',
    fields: [
      { key: 'descricaoEmergencia', label: '7.1 Descricao da Emergencia', type: 'textarea', rows: 5, colSpan: 4 },
      { key: 'relatoCondensadoIncendio', label: '7.2 Relato condensado do incendio', type: 'textarea', rows: 4, colSpan: 4 },
      { key: 'descricaoCondicoesResgate', label: '7.3 Descricao do incendio e condicoes de resgate na chegada dos CCI', type: 'textarea', rows: 4, colSpan: 4 },
    ],
  },
  {
    title: '8. Operacoes de Combate a Incendio',
    fields: [
      { key: 'condutaOperacoesExtincao', label: '8.1 Conduta das operacoes de extincao', type: 'textarea', rows: 4, colSpan: 4 },
    ],
  },
  {
    title: '9. Evacuacao',
    fields: [
      { key: 'descricaoEvacuacao', label: '9.1 Descricao da evacuacao dos ocupantes', type: 'textarea', rows: 4, colSpan: 4 },
      { key: 'numeroVitimasTrasladadas', label: '9.2 Numero de vitimas trasladadas', numeric: true },
      { key: 'salaPrimeirosSocorros', label: '9.2 Sala de primeiros socorros', numeric: true },
      { key: 'hospitais', label: '9.2 Hospitais', numeric: true },
      { key: 'necroterios', label: '9.2 Necroterios', numeric: true },
    ],
  },
  {
    title: '10. Outros Detalhes',
    fields: [
      { key: 'outrosDetalhesImportantes', label: '10.1 Comunicacoes utilizadas e condicoes do terreno', type: 'textarea', rows: 4, colSpan: 4 },
      { key: 'dificuldadesLocalizarAtingir', label: '10.2 Dificuldades em localizar ou atingir o local', type: 'textarea', rows: 4, colSpan: 4 },
    ],
  },
  {
    title: '11. Eficiencia das Operacoes',
    fields: [
      { key: 'avaliacaoEficiencia', label: '11.1 Avaliacao geral da eficiencia das operacoes', type: 'textarea', rows: 4, colSpan: 4 },
      { key: 'aeronaveDestruidaAcidente', label: '11.2 Destruida - Pelo Acidente' },
      { key: 'aeronaveDestruidaIncendio', label: '11.2 Destruida - Pelo Incendio' },
      { key: 'aeronaveGravementeDanificadaAcidente', label: '11.2 Gravemente danificada - Pelo Acidente' },
      { key: 'aeronaveGravementeDanificadaIncendio', label: '11.2 Gravemente danificada - Pelo Incendio' },
      { key: 'aeronavePoucosDanosAcidente', label: '11.2 Poucos danos - Pelo Acidente' },
      { key: 'aeronavePoucosDanosIncendio', label: '11.2 Poucos danos - Pelo Incendio' },
      { key: 'aeronaveIncolumeAcidente', label: '11.2 Incolume - Pelo Acidente' },
      { key: 'aeronaveIncolumeIncendio', label: '11.2 Incolume - Pelo Incendio' },
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
    title: '13. Observacoes Gerais',
    fields: [
      { key: 'informacoesNaoPassadasChefe', label: '13.1 Informacoes ou dados nao passados ao Chefe de Equipe', type: 'textarea', rows: 3, colSpan: 4 },
    ],
  },
  {
    title: '14. Responsavel pelo Relatorio',
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
