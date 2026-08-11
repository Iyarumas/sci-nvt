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
export const ASSUNTOS = [
  '01. FAMILIARIZAÇÃO COM AERÓDROMO',
  '02. FAMILIARIZAÇÃO COM AS AERONAVES QUE OPERAM COM REGULARIDADE NO AERÓDROMO',
  '03. FAMILIARIZAÇÃO COM OS CCI EM OPERAÇÃO NO AERÓDROMO',
  '04. PROCEDIMENTOS DE SEGURANÇA NA EXECUÇÃO DE ATIVIDADES OPERACIONAIS',
  '05. CONDUÇÃO DE VEÍCULOS DE EMERGÊNCIA NA ÁREA OPERACIONAL DO AERÓDROMO',
  '06. SISTEMA DE COMUNICAÇÃO E ALARME',
  '07. SISTEMA DE COMBATE A INCÊNDIO',
  '08. EQUIPAMENTOS DE APOIO ÀS OPERAÇÕES DE RESGATE',
  '09. PROCEDIMENTOS DE APLICAÇÃO DE AGENTES EXTINTORES',
  '10. PROCEDIMENTOS DE ASSISTÊNCIA NA EVACUAÇÃO DE AERONAVES',
  '11. REABASTECIMENTO DO CCI COM ÁGUA',
  '12. EMERGÊNCIAS COM ARTIGOS PERIGOSOS',
  '13. PLANO DE EMERGÊNCIA EM AERÓDROMO (PLEM)',
  '14. PLANO CONTRAINCÊNDIO DE AERÓDROMO (PCINC)',
  '15. EQUIPAMENTOS DE PROTEÇÃO',
  '16. PRÁTICA DE TREINAMENTO DE SOCORRO DE URGÊNCIA',
  '17. OPERAÇÃO EM BAIXA VISIBILIDADE',
  '18. CONHECIMENTOS BÁSICOS PARA INSPEÇÃO DE CARRO CONTRAINCÊNDIO',
  '19. TEMPO RESPOSTA',
  '20. POSICIONAMENTO PARA INTERVENÇÃO',
  '21. EXERCÍCIO DE MANEABILIDADE',
  '22. EXERCÍCIO DE TP/EPR',
  '23. TESTE DE AGENTES EXTINTORES',
  '24. ATIVIDADE FÍSICA',
] as const;
