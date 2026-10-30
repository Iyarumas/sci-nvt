-- O front-end forcava as funcoes de 'serra' (desenvolvedor) e 'admin' (admin) no navegador.
-- Agora a funcao vem somente do banco/servidor, entao gravamos essas funcoes no cadastro
-- para que essas contas continuem com o mesmo acesso.
UPDATE usuarios SET role = 'desenvolvedor', updated_at = now()
WHERE username = 'serra' AND role IS DISTINCT FROM 'desenvolvedor';

UPDATE usuarios SET role = 'admin', updated_at = now()
WHERE username = 'admin' AND role IS DISTINCT FROM 'admin';
