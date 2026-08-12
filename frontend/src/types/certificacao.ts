export interface CertificacaoNR {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  nrNumero: string;
  nrNome: string;
  dataEmissao: string;
  dataValidade: string;
  empresa: string;
  arquivo: string;
  tipoArquivo: 'image' | 'pdf';
  createdAt: string;
  updatedAt: string;
}

export const NR_OPTIONS = [
  { numero: 'NR-1', nome: 'Disposições Gerais' },
  { numero: 'NR-5', nome: 'CIPA' },
  { numero: 'NR-6', nome: 'Equipamentos de Proteção Individual (EPI)' },
  { numero: 'NR-10', nome: 'Segurança em Instalações e Serviços em Eletricidade' },
  { numero: 'NR-12', nome: 'Segurança no Trabalho em Máquinas e Equipamentos' },
  { numero: 'NR-18', nome: 'Condições e Meio Ambiente de Trabalho na Indústria da Construção' },
  { numero: 'NR-20', nome: 'Líquidos e Gases Combustíveis' },
  { numero: 'NR-20 II', nome: 'Líquidos e Gases Combustíveis - Programa' },
  { numero: 'NR-23', nome: 'Proteção e Combate a Incêndio' },
  { numero: 'NR-26', nome: 'Sinalização de Segurança' },
  { numero: 'NR-33', nome: 'Segurança e Saúde nos Trabalhos em Espaços Confinados' },
  { numero: 'NR-34', nome: 'Condições e Meio Ambiente de Trabalho na Indústria da Construção Naval' },
  { numero: 'NR-35', nome: 'Trabalho em Altura' },
] as const;
