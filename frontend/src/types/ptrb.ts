export interface PTRBParticipante {
  funcao: string;
  nomeCompleto: string;
  nomeGuerra?: string;
  situacao: string;
}

export interface PTRB {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
  data: string;
  horaInicio: string;
  horaTermino: string;
  duracao: string;
  horas: number;
  equipe: string;
  turno: string;
  participantes: PTRBParticipante[];
  observacoes: string;
  instrutor: string;
  assuntoMinistrado: string;
  descricao: string;
  informacoesComplementares: string;
  fotos: string[];
}

export const EQUIPES = ['Alfa', 'Bravo', 'Charlie', 'Delta', 'Ferista'] as const;
export const SITUACOES = ['A', 'INSTR', 'OC', 'P'] as const;
export const SITUACAO_DESCRICOES: Record<string, string> = {
  A: 'Ausente',
  INSTR: 'Instrutor',
  OC: 'Operador de Comunicações',
  P: 'Presente',
};
export const ASSUNTOS = [
  '01. FAMILIARIZAÇÃO COM O AERÓDROMO',
  '02. FAMILIARIZAÇÃO COM AS AERONAVES QUE OPERAM COM REGULARIDADE NO AERÓDROMO',
  '03. FAMILIARIZAÇÃO COM O(S) CCI EM OPERAÇÃO NO AERÓDROMO',
  '04. PROCEDIMENTOS DE SEGURANÇA NA EXECUÇÃO DE ATIVIDADES OPERACIONAIS',
  '05. CONDUÇÃO DE VEÍCULOS DE EMERGÊNCIA NA ÁREA OPERACIONAL DO AERÓDROMO',
  '06. SISTEMAS DE COMUNICAÇÃO E ALARME',
  '07. SISTEMAS DE COMBATE A INCÊNDIO',
  '08. EQUIPAMENTOS DE APOIO ÀS OPERAÇÕES DE RESGATE',
  '09. PROCEDIMENTOS DE APLICAÇÃO DE AGENTES EXTINTORES',
  '10. PROCEDIMENTOS DE ASSISTÊNCIA NA EVACUAÇÃO DE AERONAVES',
  '11. REABASTECIMENTO DO CCI COM ÁGUA',
  '12. EMERGÊNCIAS COM ARTIGOS PERIGOSOS',
  '13. PLANO DE EMERGÊNCIA EM AERÓDROMO (PLEM)',
  '14. PLANO CONTRAINCÊNDIO DE AERÓDROMO (PCINC)',
  '15. EQUIPAMENTOS DE PROTEÇÃO',
  '16. PRÁTICA DE TREINAMENTOS DE SOCORRO E URGÊNCIA',
  '17. OPERAÇÕES EM BAIXA VISIBILIDADE, QUANDO APLICÁVEL',
  '18. CONHECIMENTOS BÁSICOS PARA INSPEÇÃO DE CARRO CONTRAINCÊNDIO',
  '19. TEMPO RESPOSTA',
  '20. POSICIONAMENTO PARA INTERVENÇÃO',
  '21. EXERCÍCIO DE MANEABILIDADE',
  '22. EXERCÍCIO DE TP/EPR',
  '23. TESTE DE AGENTES EXTINTORES',
  '24. ATIVIDADE FÍSICA',
  '25. TEMA EXTRA - NÓS E AMARRAÇÕES',
  '26. TEMA EXTRA - RESGATE EM ALTURA',
  '27. TEMA EXTRA - TREINAMENTO EM SEGURANÇA DO TRABALHO',
  '28. TEMA EXTRA - RESGATE EM ESPAÇO CONFINADO',
  '29. TEMA EXTRA - RESGATE EM ESTRUTURAS COLAPSADAS',
  '30. TEMA EXTRA - MANEJO DE FAUNA',
  '31. TEMA EXTRA - ESTUDOS DO RBAC 153, RESOLUÇÃO E IS\'s',
] as const;

// Números marcados na coluna OC da tabela de referência.
export const NUMEROS_ASSUNTOS_PTRBA_APOC: readonly number[] = [1, 2, 6, 12, 13, 14, 17];

function numeroAssuntoPTRBA(assunto: string): number | null {
  const match = (assunto || '').match(/^\s*(\d{1,2})(?:\s*[.)-]|\s*$)/);
  return match ? Number(match[1]) : null;
}

function chaveAssuntoPTRBA(value: string): string {
  return (value || '').trim().replace(/^\d+\s*[.)-]\s*/, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

const ALIASES_ASSUNTOS_PTRBA: [string, string][] = [
  ['FAMILIARIZAÇÃO COM AERÓDROMO', ASSUNTOS[0]],
  ['FAMILIARIZAÇÃO COM OS CCI EM OPERAÇÃO NO AERÓDROMO', ASSUNTOS[2]],
  ['SISTEMA DE COMUNICAÇÃO E ALARME', ASSUNTOS[5]],
  ['SISTEMA DE COMBATE A INCÊNDIO', ASSUNTOS[6]],
  ['PRÁTICA DE TREINAMENTO DE SOCORRO DE URGÊNCIA', ASSUNTOS[15]],
  ['OPERAÇÃO EM BAIXA VISIBILIDADE', ASSUNTOS[16]],
  ['OPERAÇÕES EM BAIXA VISIBILIDADE', ASSUNTOS[16]],
  ['OPERAÇÃO EM BAIXA VISIBILIDADE, QUANDO APLICÁVEL', ASSUNTOS[16]],
  ['PLANO DE EMERGÊNCIA EM AERÓDROMO', ASSUNTOS[12]],
  ['PLANO CONTRAINCÊNDIO DE AERÓDROMO', ASSUNTOS[13]],
];
const TITULOS_ASSUNTOS_PTRBA = new Map<string, string>([
  ...ASSUNTOS.map(titulo => [chaveAssuntoPTRBA(titulo), titulo] as [string, string]),
  ...ALIASES_ASSUNTOS_PTRBA.map(([alias, titulo]) => [chaveAssuntoPTRBA(alias), titulo] as [string, string]),
]);

/** Somente para opções novas e cálculo/exibição de relatórios; não regrava históricos. */
export function canonicalizarAssuntoPTRBA(assunto: string): string {
  const titulo = TITULOS_ASSUNTOS_PTRBA.get(chaveAssuntoPTRBA(assunto));
  // Corrigir grafia não pode trocar o número usado para a contagem.
  return titulo && numeroAssuntoPTRBA(assunto) === numeroAssuntoPTRBA(titulo) ? titulo : assunto;
}

export function apocParticipaDoAssuntoPTRBA(assunto: string): boolean {
  const numero = numeroAssuntoPTRBA(assunto);
  return numero !== null && NUMEROS_ASSUNTOS_PTRBA_APOC.includes(numero);
}

export function participanteContaNoAssuntoPTRBA(participante: Pick<PTRBParticipante, 'funcao'>, assunto: string): boolean {
  return (participante.funcao || '').trim().toUpperCase() !== 'APOC' || apocParticipaDoAssuntoPTRBA(assunto);
}

/** Edição mantém o título salvo, mesmo se a opção atual tiver outra grafia. */
export function opcoesAssuntoPTRBA(assuntoAtual = ''): string[] {
  return assuntoAtual && !(ASSUNTOS as readonly string[]).includes(assuntoAtual)
    ? [assuntoAtual, ...ASSUNTOS]
    : [...ASSUNTOS];
}
