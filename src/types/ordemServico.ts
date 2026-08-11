export interface OrdemServico {
  id: string;
  numero: string;
  dataEmissao: string;
  dataConclusao: string;
  solicitanteId: string;
  solicitanteNome: string;
  solicitanteCargo: string;
  equipe: string;
  local: string;
  descricao: string;
  imagem: string;
  prioridade: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  status: 'Aberta' | 'Manutenção' | 'Concluída' | 'Cancelada';
  motivoManutencao: string;
  manutencaoPor: string;
  manutencaoPorCargo: string;
  manutencaoEmpresa: string;
  manutencaoEmpresaPessoa: string;
  dataManutencao: string;
  motivoCancelamento: string;
  canceladoPor: string;
  canceladoPorCargo: string;
  dataCancelamento: string;
  finalizadoPor: string;
  finalizadoPorCargo: string;
  empresaFinalizacao: string;
  finalizacaoEmpresaPessoa: string;
  finalizacaoDescricao: string;
  dataFinalizacao: string;
  observacoes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type OrdemServicoInput = Omit<OrdemServico, 'id' | 'createdAt' | 'updatedAt'>;
