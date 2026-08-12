export interface CertificacaoCurso {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  cursoTipo: string;
  cursoNome: string;
  dataEmissao: string;
  dataValidade: string;
  semValidade: boolean;
  empresa: string;
  arquivo: string;
  tipoArquivo: 'image' | 'pdf';
  createdAt: string;
  updatedAt: string;
}

export const CURSO_OPTIONS = [
  { tipo: 'chefeEquipe', nome: 'Chefe de Equipe', categoria: 'interno' as const },
  { tipo: 'motoristaCCI', nome: 'Motorista/Condutor de CCI', categoria: 'interno' as const },
  { tipo: 'cva', nome: 'CVA - Curso de Veículo de Emergência', categoria: 'interno' as const },
  { tipo: 'apam', nome: 'APAM - Acesso e Permanência na Área de Manobras', categoria: 'motiva' as const },
  { tipo: 'avsec', nome: 'AVSEC - Conscientização com AVSEC', categoria: 'motiva' as const },
  { tipo: 'compliance', nome: 'COMPLIANCE - Bate Papo com Terceiros', categoria: 'motiva' as const },
  { tipo: 'cvaMotiva', nome: 'CVA - Condução de Veículos na Área Operacional', categoria: 'motiva' as const },
  { tipo: 'integracao', nome: 'INTEGRAÇÃO - Saúde e Segurança do Trabalho para Terceiros', categoria: 'motiva' as const },
  { tipo: 'riscoFauna', nome: 'RISCO FAUNA - Gerenciamento do Risco da Fauna', categoria: 'motiva' as const },
  { tipo: 'sgso', nome: 'SGSO - Segurança Operacional Geral e Básico', categoria: 'motiva' as const },
] as const;
