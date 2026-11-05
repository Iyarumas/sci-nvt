-- Permissoes por funcao (BA-CE, BA-LR, GS...) e modulo do sistema.
-- So guarda o que o administrador alterou; o resto vem do padrao definido no codigo
-- (backend/src/permissoes/permissoes.padrao.ts), que reproduz as regras atuais.
CREATE TABLE IF NOT EXISTS permissoes_funcao (
  funcao TEXT NOT NULL,
  modulo TEXT NOT NULL,
  nivel TEXT NOT NULL,
  atualizado_por TEXT NOT NULL DEFAULT '',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (funcao, modulo),
  CONSTRAINT permissoes_funcao_nivel_valido CHECK (nivel IN ('nenhum', 'ver', 'equipe', 'tudo'))
);
