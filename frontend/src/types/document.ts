export interface Document {
  id: string;
  name: string;
  description: string | null;
  category: string;
  template_pdf_url: string | null;
  template_pdf_pages: number;
  template_pdf_width: number;
  template_pdf_height: number;
  active: boolean;
  source_module: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type SourceModule =
  | 'trocas' | 'ferias' | 'epis' | 'certificacoes' | 'ocorrencias'
  | 'ordem_servico' | 'lro' | 'ptrba'
  | 'taf' | 'tpepr' | 'checklists'
  | 'exercicio_posicionamento' | 'exercicio_tempo_resposta' | 'dds';

export const SOURCE_MODULE_OPTIONS: { value: SourceModule; label: string }[] = [
  { value: 'trocas', label: 'Trocas de Serviço' },
  { value: 'ferias', label: 'Férias' },
  { value: 'epis', label: 'EPIs' },
  { value: 'certificacoes', label: 'Certificações' },
  { value: 'ocorrencias', label: 'Ocorrências (BONA / REA)' },
  { value: 'ordem_servico', label: 'Ordens de Serviço' },
  { value: 'lro', label: 'LRO' },
  { value: 'ptrba', label: 'PTR-BA' },
  { value: 'taf', label: 'TAF' },
  { value: 'tpepr', label: 'TP/EPR' },
  { value: 'exercicio_posicionamento', label: 'Exercício de Posicionamento' },
  { value: 'exercicio_tempo_resposta', label: 'Exercício de Tempo Resposta' },
  { value: 'dds', label: 'DDS' },
  { value: 'checklists', label: 'Checklists' },
];

export type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox' | 'signature' | 'line';

export type DataSource =
  | 'manual'
  | 'solicitante.nome'
  | 'solicitante.cpf'
  | 'solicitante.matricula'
  | 'solicitante.funcao'
  | 'solicitante.equipe'
  | 'solicitado.nome'
  | 'solicitado.cpf'
  | 'solicitado.matricula'
  | 'solicitado.funcao'
  | 'solicitado.equipe'
  | 'chefe_equipe.nome'
  | 'chefe_equipe.funcao'
  | 'gerente.nome'
  | 'gerente.funcao'
  | 'data_atual'
  | 'hora_atual'
  | 'autentique_assinatura';

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  manual: 'Preenchimento manual',
  'solicitante.nome': 'Nome do Solicitante',
  'solicitante.cpf': 'CPF do Solicitante',
  'solicitante.matricula': 'Matrícula do Solicitante',
  'solicitante.funcao': 'Função do Solicitante',
  'solicitante.equipe': 'Equipe do Solicitante',
  'solicitado.nome': 'Nome do Solicitado',
  'solicitado.cpf': 'CPF do Solicitado',
  'solicitado.matricula': 'Matrícula do Solicitado',
  'solicitado.funcao': 'Função do Solicitado',
  'solicitado.equipe': 'Equipe do Solicitado',
  'chefe_equipe.nome': 'Nome do Chefe de Equipe',
  'chefe_equipe.funcao': 'Função do Chefe de Equipe',
  'gerente.nome': 'Nome do Gerente',
  'gerente.funcao': 'Função do Gerente',
  data_atual: 'Data Atual',
  hora_atual: 'Hora Atual',
  autentique_assinatura: 'Data Assinatura (Autentique)',
};

export const DATA_SOURCE_GROUPS = [
  {
    label: 'Solicitante',
    sources: ['solicitante.nome', 'solicitante.cpf', 'solicitante.matricula', 'solicitante.funcao', 'solicitante.equipe'] as DataSource[],
  },
  {
    label: 'Solicitado',
    sources: ['solicitado.nome', 'solicitado.cpf', 'solicitado.matricula', 'solicitado.funcao', 'solicitado.equipe'] as DataSource[],
  },
  {
    label: 'Chefe de Equipe',
    sources: ['chefe_equipe.nome', 'chefe_equipe.funcao'] as DataSource[],
  },
  {
    label: 'Gerente',
    sources: ['gerente.nome', 'gerente.funcao'] as DataSource[],
  },
  {
    label: 'Sistema',
    sources: ['data_atual', 'hora_atual'] as DataSource[],
  },
  {
    label: 'Autentique',
    sources: ['autentique_assinatura'] as DataSource[],
  },
];

export interface DocumentField {
  id: string;
  document_id: string;
  field_name: string;
  field_label: string;
  field_type: FieldType;
  required: boolean;
  placeholder: string | null;
  options: string[] | null;
  order_index: number;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  font_size: number;
  data_source: DataSource;
  is_signature: boolean;
  signer_role: string | null;
  read_only: boolean;
  conditional_on: string | null;
  created_at: string;
}

export interface DocumentSigner {
  id: string;
  document_id: string;
  signer_name: string;
  signer_role: string;
  order_index: number;
  required: boolean;
  created_at: string;
}

export interface DocumentFill {
  id: string;
  document_id: string;
  filled_by: string | null;
  filled_data: Record<string, any>;
  status: 'draft' | 'pending' | 'signed' | 'cancelled' | 'archived';
  autentique_document_id: string | null;
  autentique_link: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentWithFields extends Document {
  document_fields: DocumentField[];
  document_signers: DocumentSigner[];
}

export type DocumentCategory = 'operacional' | 'administrativo' | 'treinamento' | 'geral';
