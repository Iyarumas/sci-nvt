/**
 * Permissões padrão por função e módulo. Reproduzem as regras que hoje estão
 * espalhadas nas telas (frontend/src/utils/permissoes.ts e nas próprias páginas).
 * O administrador pode alterar qualquer célula pela tela Permissões; a alteração
 * fica na tabela permissoes_funcao e vale no lugar do padrão.
 */

export type NivelPermissao = 'nenhum' | 'ver' | 'equipe' | 'tudo';

export const NIVEIS: readonly NivelPermissao[] = ['nenhum', 'ver', 'equipe', 'tudo'];

export const FUNCOES = ['GS', 'BA-CE', 'BA-LR', 'BA-MC', 'BA-RE', 'BA-2', 'OC'] as const;
export type Funcao = (typeof FUNCOES)[number];

export interface ModuloPermissao {
  chave: string;
  nome: string;
  descricao: string;
  /** Algumas telas não fazem sentido por equipe; nelas o nível "equipe" não aparece. */
  porEquipe: boolean;
}

export const MODULOS: readonly ModuloPermissao[] = [
  { chave: 'inicio_plantao', nome: 'Início de plantão', descricao: 'Informações do comunicante e mensagem do dia', porEquipe: true },
  { chave: 'fim_plantao', nome: 'Fim de plantão', descricao: 'Relatório de serviço do comunicante para o chefe', porEquipe: true },
  { chave: 'registros_diarios', nome: 'Registros diários', descricao: 'PTR-BA, LRO e ocorrências do LRO', porEquipe: true },
  { chave: 'escalas', nome: 'Escalas', descricao: 'Escala diária e mensal', porEquipe: true },
  { chave: 'substituicoes', nome: 'Substituições', descricao: 'Substituições e extras', porEquipe: true },
  { chave: 'ferias', nome: 'Férias', descricao: 'Férias e escala anual', porEquipe: true },
  { chave: 'bona_rea', nome: 'BONA / REA', descricao: 'Ocorrências BONA e REA', porEquipe: true },
  { chave: 'inspecoes', nome: 'Inspeções', descricao: 'Inspeções e solicitações', porEquipe: true },
  { chave: 'treinamentos', nome: 'Treinamentos', descricao: 'TAF, TP-EPR, Posicionamento e Tempo Resposta', porEquipe: true },
  { chave: 'epis', nome: 'EPIs', descricao: 'Controle de EPIs e estoque', porEquipe: true },
  { chave: 'viaturas_cci', nome: 'Viaturas CCI', descricao: 'Panes e situação das viaturas', porEquipe: false },
  { chave: 'cadastro_pessoas', nome: 'Bombeiros e APOC', descricao: 'Cadastro completo do efetivo', porEquipe: false },
  { chave: 'certificacoes', nome: 'Certificações', descricao: 'Cursos, NRs e documentos', porEquipe: true },
  { chave: 'arquivo', nome: 'Arquivo', descricao: 'Documentos gerados pelo sistema', porEquipe: true },
  { chave: 'relatorios', nome: 'Relatórios', descricao: 'BONA, LRO, exercícios e trocas', porEquipe: true },
  { chave: 'relatorios_ptrba', nome: 'Relatório de PTR-BA', descricao: 'Relatórios de PTR-BA', porEquipe: true },
  { chave: 'equipamentos_viaturas', nome: 'Equipamentos e viaturas', descricao: 'Cadastro de equipamentos e viaturas', porEquipe: false },
  { chave: 'extintores_hidrantes', nome: 'Extintores e hidrantes', descricao: 'Extintores, agentes extintores e hidrantes', porEquipe: false },
];

export interface CelulaPadrao {
  nivel: NivelPermissao;
  /** Como a regra funciona hoje, quando ela não cabe só no nível. */
  observacao?: string;
}

const TODOS = (nivel: NivelPermissao, observacao?: string): Record<Funcao, CelulaPadrao> =>
  Object.fromEntries(FUNCOES.map(funcao => [funcao, { nivel, observacao }])) as Record<Funcao, CelulaPadrao>;

const SEM_TRAVA = 'Hoje não há nenhuma trava: qualquer função pode criar, editar e excluir.';

export const PADRAO: Record<string, Record<Funcao, CelulaPadrao>> = {
  inicio_plantao: {
    ...TODOS('ver'),
    GS: { nivel: 'ver' },
    'BA-CE': { nivel: 'equipe' },
    'BA-LR': { nivel: 'equipe' },
    OC: { nivel: 'equipe', observacao: 'O comunicante preenche o início de plantão da equipe dele.' },
  },
  fim_plantao: {
    ...TODOS('ver'),
    GS: { nivel: 'ver' },
    'BA-CE': { nivel: 'equipe' },
    'BA-LR': { nivel: 'equipe' },
    OC: { nivel: 'equipe', observacao: 'O comunicante preenche o relatório de serviço da equipe dele.' },
  },
  registros_diarios: {
    ...TODOS('ver'),
    GS: { nivel: 'ver' },
    'BA-CE': { nivel: 'equipe', observacao: 'Cria em qualquer equipe; edita e exclui o que criou.' },
    'BA-LR': { nivel: 'equipe', observacao: 'Cria em qualquer equipe; edita e exclui o que criou e o que o BA-CE da equipe criou.' },
  },
  escalas: { ...TODOS('ver'), GS: { nivel: 'tudo' } },
  substituicoes: TODOS('tudo', SEM_TRAVA),
  ferias: { ...TODOS('ver'), GS: { nivel: 'tudo' } },
  bona_rea: { ...TODOS('ver'), GS: { nivel: 'tudo' } },
  inspecoes: { ...TODOS('ver'), GS: { nivel: 'tudo' } },
  treinamentos: { ...TODOS('ver'), GS: { nivel: 'tudo' } },
  epis: TODOS('tudo', SEM_TRAVA),
  viaturas_cci: TODOS('tudo', SEM_TRAVA),
  cadastro_pessoas: { ...TODOS('ver', 'Vê o cadastro sem dados pessoais.'), GS: { nivel: 'tudo' } },
  certificacoes: {
    ...TODOS('nenhum'),
    GS: { nivel: 'tudo' },
    'BA-CE': { nivel: 'ver', observacao: 'Vê só a própria equipe.' },
    'BA-LR': { nivel: 'ver', observacao: 'Vê só a própria equipe.' },
  },
  arquivo: { ...TODOS('nenhum'), GS: { nivel: 'tudo' }, 'BA-CE': { nivel: 'ver' }, 'BA-LR': { nivel: 'ver' } },
  relatorios: {
    ...TODOS('nenhum'),
    GS: { nivel: 'ver' },
    'BA-LR': { nivel: 'ver', observacao: 'Hoje só o BA-LR da equipe Delta.' },
  },
  relatorios_ptrba: {
    ...TODOS('nenhum', 'Hoje toda a equipe Embaixador também vê.'),
    GS: { nivel: 'ver' },
    'BA-CE': { nivel: 'ver' },
    'BA-LR': { nivel: 'ver' },
  },
  equipamentos_viaturas: {
    ...TODOS('ver'),
    GS: { nivel: 'tudo' },
    'BA-CE': { nivel: 'equipe', observacao: 'Hoje só o BA-CE da equipe Bravo.' },
    'BA-LR': { nivel: 'equipe', observacao: 'Hoje só o BA-LR da equipe Bravo.' },
  },
  extintores_hidrantes: {
    ...TODOS('ver'),
    GS: { nivel: 'tudo' },
    'BA-CE': { nivel: 'equipe', observacao: 'Hoje só o BA-CE da equipe Alfa.' },
    'BA-LR': { nivel: 'equipe', observacao: 'Hoje só o BA-LR da equipe Alfa.' },
  },
};
