/**
 * Catálogo de permissões: cada tela tem as suas ações, e cada ação tem, por função, um alcance
 * (Não / Própria equipe / Todas). O padrão reproduz as regras que as telas usam hoje
 * (frontend/src/utils/permissoes.ts e as próprias páginas). O administrador muda pela tela
 * Permissões; a alteração por função fica em permissoes_funcao e a de uma pessoa em permissoes_usuario.
 * Administrador e Desenvolvedor têm acesso total e não entram na grade.
 */

export type Alcance = 'nao' | 'equipe' | 'todas';
export const ALCANCES: readonly Alcance[] = ['nao', 'equipe', 'todas'];

export const FUNCOES = ['GS', 'BA-CE', 'BA-LR', 'BA-MC', 'BA-RE', 'BA-2', 'OC'] as const;
export type Funcao = (typeof FUNCOES)[number];

export interface Celula { alcance: Alcance; observacao?: string }
type Linha = Record<Funcao, Celula>;

export interface AcaoCatalogo { chave: string; nome: string }
export interface TelaCatalogo { chave: string; nome: string; grupo: string; acoes: AcaoCatalogo[] }

/* ───────── Atalhos para montar o padrão ───────── */

const c = (alcance: Alcance, observacao?: string): Celula => ({ alcance, observacao });
const todas = (alcance: Alcance, observacao?: string): Linha =>
  Object.fromEntries(FUNCOES.map(f => [f, c(alcance, observacao)])) as Linha;
const com = (base: Linha, mudancas: Partial<Record<Funcao, Celula>>): Linha => ({ ...base, ...mudancas });

/** Todos veem. */
const VER_TODOS = todas('todas');
/** GS mexe em todas as equipes; qualquer pessoa da equipe mexe na própria equipe (regra das telas hoje). */
const GS_TODAS_EQUIPE = com(todas('equipe'), { GS: c('todas') });
/** Só o GS. */
const SO_GS = com(todas('nao'), { GS: c('todas') });
/** Ninguém da grade (hoje só administrador). */
const SO_ADMIN = todas('nao', 'Hoje só administrador.');
/** Envio para assinatura: chefia (GS, BA-CE, BA-LR) ou quem criou o documento. */
const ENVIO = com(todas('nao', 'Quem criou o documento também pode.'), {
  GS: c('todas'), 'BA-CE': c('todas'), 'BA-LR': c('todas'),
});
const BAIXAR_ASSINADO = todas('todas', 'Depois que a equipe assinou.');
const SEM_TRAVA = (obs = 'Hoje não há trava: qualquer função pode.') => todas('todas', obs);

/* ───────── Catálogo ───────── */

const acoes = (...lista: Array<[string, string]>): AcaoCatalogo[] => lista.map(([chave, nome]) => ({ chave, nome }));
const VER: [string, string] = ['ver', 'Ver'];
const CRIAR: [string, string] = ['criar', 'Criar'];
const EDITAR: [string, string] = ['editar', 'Editar'];
const EXCLUIR: [string, string] = ['excluir', 'Excluir'];
const ENVIAR: [string, string] = ['enviar_assinatura', 'Enviar para assinatura'];
const REENVIAR: [string, string] = ['reenviar', 'Reenviar avisos'];
const CANCELAR: [string, string] = ['cancelar_envio', 'Cancelar envio'];
const BAIXAR: [string, string] = ['baixar_pdf', 'Baixar PDF'];
const IMPRIMIR: [string, string] = ['imprimir', 'Imprimir'];
const CRUD = [VER, CRIAR, EDITAR, EXCLUIR];
/** Relatórios: lista do mês + PDF (1ª quinzena ou mês completo) + impressão. */
const RELATORIO = [VER, BAIXAR, IMPRIMIR];
const ASSINATURA = [ENVIAR, REENVIAR, CANCELAR, BAIXAR];

export const TELAS: readonly TelaCatalogo[] = [
  // Registros diários
  { grupo: 'Registros diários', chave: 'ptrba', nome: 'PTR-BA', acoes: acoes(...CRUD, ...ASSINATURA) },
  { grupo: 'Registros diários', chave: 'lro', nome: 'LRO', acoes: acoes(...CRUD, ['finalizar', 'Finalizar'], ['arquivar', 'Arquivar'], ...ASSINATURA) },
  { grupo: 'Registros diários', chave: 'lro_ocorrencias', nome: 'Ocorrências do LRO', acoes: acoes(...CRUD) },
  { grupo: 'Registros diários', chave: 'bona_rea', nome: 'BONA / REA', acoes: acoes(...CRUD, ...ASSINATURA) },
  { grupo: 'Registros diários', chave: 'inspecoes', nome: 'Inspeções', acoes: acoes(...CRUD) },
  { grupo: 'Registros diários', chave: 'solicitacoes', nome: 'Solicitações (inspeções)', acoes: acoes(...CRUD) },
  { grupo: 'Registros diários', chave: 'checklists', nome: 'Checklists', acoes: acoes(VER, EDITAR) },
  // Central do comunicante (OC)
  { grupo: 'Central do comunicante', chave: 'inicio_plantao', nome: 'Início de plantão', acoes: acoes(VER, ['preencher', 'Preencher / salvar'], ['qr_code', 'Gerar QR Code da mensagem']) },
  { grupo: 'Central do comunicante', chave: 'fim_plantao', nome: 'Fim de plantão', acoes: acoes(VER, ['preencher', 'Preencher / salvar'], ['qr_code', 'Gerar QR Code da mensagem']) },
  // Escalas e pessoal
  { grupo: 'Escalas e pessoal', chave: 'escala_diaria', nome: 'Escala diária', acoes: acoes(VER, CRIAR, EDITAR, IMPRIMIR) },
  { grupo: 'Escalas e pessoal', chave: 'escala_mensal', nome: 'Escala mensal', acoes: acoes(...CRUD, IMPRIMIR) },
  { grupo: 'Escalas e pessoal', chave: 'substituicoes', nome: 'Substituições e extras', acoes: acoes(VER, CRIAR, ['aprovar', 'Aprovar / rejeitar']) },
  { grupo: 'Escalas e pessoal', chave: 'ferias', nome: 'Férias', acoes: acoes(...CRUD, ['aprovar', 'Aprovar / rejeitar'], ['gerar_relatorio', 'Gerar relatório']) },
  { grupo: 'Escalas e pessoal', chave: 'funcionarios', nome: 'Funcionários (ficha)', acoes: acoes(VER, ['dados_pessoais', 'Ver dados pessoais']) },
  { grupo: 'Escalas e pessoal', chave: 'cadastro_pessoas', nome: 'Bombeiros e APOC (cadastro)', acoes: acoes(VER, CRIAR, EDITAR, ['desligar', 'Registrar desligamento'], EXCLUIR) },
  { grupo: 'Escalas e pessoal', chave: 'certificacoes', nome: 'Certificações', acoes: acoes(VER, ['abrir_documentos', 'Abrir documentos do Drive'], ['informar_data', 'Informar data do curso'], ['validade', 'Validade dos documentos']) },
  // Treinamentos e trocas
  { grupo: 'Treinamentos e trocas', chave: 'taf', nome: 'TAF', acoes: acoes(...CRUD, ...ASSINATURA) },
  { grupo: 'Treinamentos e trocas', chave: 'tpepr', nome: 'TP/EPR', acoes: acoes(...CRUD, ...ASSINATURA) },
  { grupo: 'Treinamentos e trocas', chave: 'posicionamento', nome: 'Exercício de Posicionamento', acoes: acoes(...CRUD, ...ASSINATURA) },
  { grupo: 'Treinamentos e trocas', chave: 'tempo_resposta', nome: 'Tempo Resposta', acoes: acoes(...CRUD, ...ASSINATURA) },
  { grupo: 'Treinamentos e trocas', chave: 'trocas', nome: 'Trocas de serviço', acoes: acoes(...CRUD, ENVIAR, REENVIAR, CANCELAR, ['arquivar', 'Arquivar'], BAIXAR) },
  // Materiais e cadastros
  { grupo: 'Materiais e cadastros', chave: 'epis', nome: 'EPIs', acoes: acoes(...CRUD) },
  { grupo: 'Materiais e cadastros', chave: 'viaturas_cci', nome: 'Viaturas CCI (panes)', acoes: acoes(...CRUD) },
  { grupo: 'Materiais e cadastros', chave: 'viaturas', nome: 'Viaturas (cadastro)', acoes: acoes(...CRUD) },
  { grupo: 'Materiais e cadastros', chave: 'equipamentos', nome: 'Equipamentos', acoes: acoes(...CRUD) },
  { grupo: 'Materiais e cadastros', chave: 'extintores', nome: 'Extintores', acoes: acoes(...CRUD) },
  { grupo: 'Materiais e cadastros', chave: 'hidrantes', nome: 'Hidrantes', acoes: acoes(...CRUD) },
  { grupo: 'Materiais e cadastros', chave: 'agentes_extintores', nome: 'Agentes extintores', acoes: acoes(...CRUD) },
  { grupo: 'Materiais e cadastros', chave: 'relatorios_agentes', nome: 'Relatórios de agentes extintores', acoes: acoes(VER, CRIAR, EDITAR, ['finalizar', 'Finalizar'], BAIXAR) },
  { grupo: 'Materiais e cadastros', chave: 'documentos_modelos', nome: 'Documentos (modelos)', acoes: acoes(VER, CRIAR, EDITAR) },
  { grupo: 'Materiais e cadastros', chave: 'ordem_servico', nome: 'Ordem de Serviço', acoes: acoes(...CRUD, IMPRIMIR) },
  // Relatórios e arquivo
  { grupo: 'Relatórios e arquivo', chave: 'rel_lro', nome: 'Relatório LRO', acoes: acoes(...RELATORIO) },
  { grupo: 'Relatórios e arquivo', chave: 'rel_bona', nome: 'Relatório BONA / REA', acoes: acoes(...RELATORIO) },
  { grupo: 'Relatórios e arquivo', chave: 'rel_ptrba', nome: 'Relatório PTR-BA (horas)', acoes: acoes(VER) },
  { grupo: 'Relatórios e arquivo', chave: 'rel_ptrba_registros', nome: 'Relatório PTR-BA Registros', acoes: acoes(...RELATORIO) },
  { grupo: 'Relatórios e arquivo', chave: 'rel_taf', nome: 'Relatório TAF', acoes: acoes(...RELATORIO) },
  { grupo: 'Relatórios e arquivo', chave: 'rel_tpepr', nome: 'Relatório TP/EPR', acoes: acoes(...RELATORIO) },
  { grupo: 'Relatórios e arquivo', chave: 'rel_posicionamento', nome: 'Relatório Posicionamento', acoes: acoes(...RELATORIO) },
  { grupo: 'Relatórios e arquivo', chave: 'rel_tempo_resposta', nome: 'Relatório Tempo Resposta', acoes: acoes(...RELATORIO) },
  { grupo: 'Relatórios e arquivo', chave: 'rel_trocas', nome: 'Relatório de trocas', acoes: acoes(...RELATORIO, ['folha_trocas', 'Só a folha de trocas']) },
  { grupo: 'Relatórios e arquivo', chave: 'rel_substituicoes', nome: 'Relatório de substituições', acoes: acoes(VER, ['imprimir_mensal', 'Imprimir mensal'], ['imprimir_individual', 'Imprimir individual']) },
  { grupo: 'Relatórios e arquivo', chave: 'arquivo', nome: 'Arquivo', acoes: acoes(VER) },
  { grupo: 'Relatórios e arquivo', chave: 'estatisticas', nome: 'Estatísticas', acoes: acoes(VER) },
];

/* ───────── Padrão (regras de hoje) ───────── */

const REGISTRO_DIARIO_CRIAR = com(todas('nao', 'Também quem tem autorização de registros diários.'), {
  'BA-CE': c('todas'), 'BA-LR': c('todas'),
});
const REGISTRO_DIARIO_ALTERAR = com(todas('nao'), {
  'BA-CE': c('equipe', 'O que ele criou.'),
  'BA-LR': c('equipe', 'O que ele criou e o que o BA-CE da equipe criou.'),
});
const CADASTRO_BRAVO = com(SO_GS, {
  'BA-CE': c('nao', 'Hoje o BA-CE da Bravo pode (usar exceção por pessoa).'),
  'BA-LR': c('nao', 'Hoje o BA-LR da Bravo pode (usar exceção por pessoa).'),
});
const CADASTRO_ALFA = com(SO_GS, {
  'BA-CE': c('nao', 'Hoje o BA-CE da Alfa pode (usar exceção por pessoa).'),
  'BA-LR': c('nao', 'Hoje o BA-LR da Alfa pode (usar exceção por pessoa).'),
});
const RELATORIO_GS = com(SO_GS, { 'BA-LR': c('nao', 'Hoje o BA-LR da Delta vê (usar exceção por pessoa).') });

/** PTR-BA (horas e registros): GS, BA-CE e BA-LR, como no menu hoje. */
const RELATORIO_PTRBA = com(SO_GS, { 'BA-CE': c('todas'), 'BA-LR': c('todas') });
/** Quem vê o relatório também baixa e imprime (pode separar pela grade). */
const relatorio = (base: Linha): Record<string, Linha> => ({ ver: base, baixar_pdf: base, imprimir: base });

/** Início/fim de plantão: o comunicante (OC) e a chefia da equipe preenchem; o GS só vê. */
const PLANTAO_OC = com(todas('nao'), {
  'BA-CE': c('equipe'), 'BA-LR': c('equipe'),
  OC: c('equipe', 'O comunicante preenche o plantão da equipe dele.'),
});

const treinamento = (): Record<string, Linha> => ({
  ver: VER_TODOS, criar: GS_TODAS_EQUIPE, editar: GS_TODAS_EQUIPE, excluir: GS_TODAS_EQUIPE,
  enviar_assinatura: ENVIO, reenviar: ENVIO, cancelar_envio: SO_ADMIN, baixar_pdf: BAIXAR_ASSINADO,
});

const PADRAO_POR_TELA: Record<string, Record<string, Linha>> = {
  ptrba: {
    ver: VER_TODOS, criar: REGISTRO_DIARIO_CRIAR, editar: REGISTRO_DIARIO_ALTERAR, excluir: REGISTRO_DIARIO_ALTERAR,
    enviar_assinatura: ENVIO, reenviar: ENVIO, cancelar_envio: SO_ADMIN, baixar_pdf: BAIXAR_ASSINADO,
  },
  lro: {
    ver: VER_TODOS, criar: REGISTRO_DIARIO_CRIAR, editar: REGISTRO_DIARIO_ALTERAR, excluir: REGISTRO_DIARIO_ALTERAR,
    finalizar: REGISTRO_DIARIO_ALTERAR, arquivar: SO_ADMIN,
    enviar_assinatura: ENVIO, reenviar: ENVIO, cancelar_envio: SO_ADMIN, baixar_pdf: BAIXAR_ASSINADO,
  },
  lro_ocorrencias: { ver: VER_TODOS, criar: REGISTRO_DIARIO_CRIAR, editar: REGISTRO_DIARIO_ALTERAR, excluir: REGISTRO_DIARIO_ALTERAR },
  bona_rea: {
    ver: VER_TODOS, criar: GS_TODAS_EQUIPE, editar: GS_TODAS_EQUIPE, excluir: GS_TODAS_EQUIPE,
    enviar_assinatura: ENVIO, reenviar: ENVIO, cancelar_envio: SO_ADMIN, baixar_pdf: BAIXAR_ASSINADO,
  },
  inspecoes: { ver: VER_TODOS, criar: GS_TODAS_EQUIPE, editar: GS_TODAS_EQUIPE, excluir: GS_TODAS_EQUIPE },
  solicitacoes: { ver: VER_TODOS, criar: GS_TODAS_EQUIPE, editar: GS_TODAS_EQUIPE, excluir: GS_TODAS_EQUIPE },
  checklists: { ver: VER_TODOS, editar: SEM_TRAVA('Checklists quinzenais/fixos: só administrador.') },
  inicio_plantao: { ver: VER_TODOS, preencher: PLANTAO_OC, qr_code: PLANTAO_OC },
  fim_plantao: { ver: VER_TODOS, preencher: PLANTAO_OC, qr_code: PLANTAO_OC },
  escala_diaria: { ver: VER_TODOS, criar: GS_TODAS_EQUIPE, editar: GS_TODAS_EQUIPE, imprimir: VER_TODOS },
  escala_mensal: { ver: VER_TODOS, criar: GS_TODAS_EQUIPE, editar: GS_TODAS_EQUIPE, excluir: GS_TODAS_EQUIPE, imprimir: VER_TODOS },
  substituicoes: {
    ver: VER_TODOS, criar: SEM_TRAVA(), aprovar: SO_GS,
  },
  ferias: {
    ver: VER_TODOS, criar: GS_TODAS_EQUIPE, editar: GS_TODAS_EQUIPE, excluir: SO_GS, aprovar: SO_GS, gerar_relatorio: SO_GS,
  },
  funcionarios: { ver: VER_TODOS, dados_pessoais: com(SO_GS, {}) },
  cadastro_pessoas: { ver: todas('todas', 'Sem dados pessoais.'), criar: SO_GS, editar: SO_GS, desligar: SO_GS, excluir: SO_GS },
  certificacoes: {
    ver: com(todas('nao'), { GS: c('todas'), 'BA-CE': c('equipe'), 'BA-LR': c('equipe') }),
    abrir_documentos: com(todas('nao'), { GS: c('todas'), 'BA-CE': c('equipe'), 'BA-LR': c('equipe') }),
    informar_data: SO_GS,
    validade: SO_ADMIN,
  },
  taf: treinamento(),
  tpepr: treinamento(),
  posicionamento: treinamento(),
  tempo_resposta: treinamento(),
  trocas: {
    ver: VER_TODOS,
    criar: com(todas('nao', 'Também quem tem autorização de registros diários.'), { GS: c('todas'), 'BA-CE': c('todas'), 'BA-LR': c('todas') }),
    editar: com(todas('nao'), { GS: c('todas'), 'BA-CE': c('todas'), 'BA-LR': c('todas') }),
    excluir: com(todas('nao'), { GS: c('todas'), 'BA-CE': c('todas'), 'BA-LR': c('todas') }),
    enviar_assinatura: ENVIO, reenviar: ENVIO, cancelar_envio: SO_ADMIN, arquivar: SO_ADMIN, baixar_pdf: BAIXAR_ASSINADO,
  },
  epis: { ver: VER_TODOS, criar: SEM_TRAVA(), editar: SEM_TRAVA(), excluir: SEM_TRAVA() },
  viaturas_cci: { ver: VER_TODOS, criar: SEM_TRAVA(), editar: SEM_TRAVA(), excluir: SEM_TRAVA() },
  viaturas: { ver: VER_TODOS, criar: CADASTRO_BRAVO, editar: CADASTRO_BRAVO, excluir: CADASTRO_BRAVO },
  equipamentos: { ver: VER_TODOS, criar: CADASTRO_BRAVO, editar: CADASTRO_BRAVO, excluir: CADASTRO_BRAVO },
  extintores: { ver: VER_TODOS, criar: CADASTRO_ALFA, editar: CADASTRO_ALFA, excluir: CADASTRO_ALFA },
  hidrantes: { ver: VER_TODOS, criar: CADASTRO_ALFA, editar: CADASTRO_ALFA, excluir: CADASTRO_ALFA },
  agentes_extintores: { ver: VER_TODOS, criar: CADASTRO_ALFA, editar: CADASTRO_ALFA, excluir: CADASTRO_ALFA },
  relatorios_agentes: { ver: VER_TODOS, criar: CADASTRO_ALFA, editar: CADASTRO_ALFA, finalizar: CADASTRO_ALFA, baixar_pdf: VER_TODOS },
  documentos_modelos: { ver: VER_TODOS, criar: SO_GS, editar: SO_GS },
  ordem_servico: { ver: VER_TODOS, criar: GS_TODAS_EQUIPE, editar: GS_TODAS_EQUIPE, excluir: GS_TODAS_EQUIPE, imprimir: VER_TODOS },
  rel_lro: relatorio(RELATORIO_GS),
  rel_bona: relatorio(RELATORIO_GS),
  rel_taf: relatorio(RELATORIO_GS),
  rel_tpepr: relatorio(RELATORIO_GS),
  rel_posicionamento: relatorio(RELATORIO_GS),
  rel_tempo_resposta: relatorio(RELATORIO_GS),
  rel_trocas: { ...relatorio(RELATORIO_GS), folha_trocas: RELATORIO_GS },
  rel_substituicoes: { ver: RELATORIO_GS, imprimir_mensal: RELATORIO_GS, imprimir_individual: RELATORIO_GS },
  rel_ptrba: { ver: RELATORIO_PTRBA },
  rel_ptrba_registros: relatorio(RELATORIO_PTRBA),
  arquivo: { ver: com(SO_GS, { 'BA-CE': c('todas'), 'BA-LR': c('todas') }) },
  estatisticas: { ver: VER_TODOS },
};

/** Chave da ação: "tela.acao" (ex.: "ptrba.criar"). */
export const chaveAcao = (tela: string, acao: string) => `${tela}.${acao}`;

/** Todas as ações do catálogo, com o padrão de cada função. */
export const PADRAO: Record<string, Linha> = Object.fromEntries(
  TELAS.flatMap(tela => tela.acoes.map(acao => {
    const linha = PADRAO_POR_TELA[tela.chave]?.[acao.chave] ?? SO_ADMIN;
    return [chaveAcao(tela.chave, acao.chave), linha];
  })),
);

export const ACOES_VALIDAS: ReadonlySet<string> = new Set(Object.keys(PADRAO));
