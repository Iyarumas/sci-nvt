-- Permissões por ação (ex.: "ptrba.criar") com alcance Não / Própria equipe / Todas.
-- O padrão de cada função fica no código (backend/src/permissoes/permissoes.padrao.ts) e reproduz as
-- regras atuais; estas tabelas guardam só o que o administrador mudou.

-- Mudança no padrão de uma função.
CREATE TABLE IF NOT EXISTS permissao_funcao (
  funcao TEXT NOT NULL,
  acao TEXT NOT NULL,
  alcance TEXT NOT NULL,
  atualizado_por TEXT NOT NULL DEFAULT '',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (funcao, acao),
  CONSTRAINT permissao_funcao_alcance_valido CHECK (alcance IN ('nao', 'equipe', 'todas'))
);

-- Exceção de uma pessoa (usuário do sistema): vale no lugar do que a função dela permite.
CREATE TABLE IF NOT EXISTS permissao_usuario (
  usuario_id TEXT NOT NULL,
  acao TEXT NOT NULL,
  alcance TEXT NOT NULL,
  atualizado_por TEXT NOT NULL DEFAULT '',
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, acao),
  CONSTRAINT permissao_usuario_alcance_valido CHECK (alcance IN ('nao', 'equipe', 'todas'))
);
