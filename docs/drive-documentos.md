# Documentos do Google Drive na tela de Certificações

Situação da branch `feat/drive-documentos` (10/11/2026): **tela pronta com dados de exemplo**, ainda sem ligação
com o Drive. Código em `frontend/src/pages/Certificacoes/` (`regrasDrive.ts` = regras e exemplo;
`DriveDocumentos.tsx` = blocos, visualizador, credencial e aba de validade).

## O que a tela já faz (com dados de exemplo)

- Card da pessoa: faixa com a pior situação, contadores e a **credencial** (validade do cadastro
  `credencialValidade`, com o tempo que falta). Clicar na credencial mostra só informações: validade e os cursos
  internos ASUR (pasta 02, base da credencial) vencidos, faltando ou vencendo.
- Cursos do Cadastro: cadastro **ou** documento no Drive. CURSO BACE = Chefe de Equipe, CURSO BAMC = Motorista
  Condutor; CNH AD/D/AE/E + CVE em dia = pode dirigir os veículos da SCI. CNH usa `cnhValidade` do cadastro.
- Nomes dos arquivos: ignora número da frente (inclusive `04B`), extensão, cópias `(1)`, nome da pessoa
  (credenciamento) e `desktop.ini`; abreviações conhecidas (PS = Primeiros Socorros). Arquivos repetidos do mesmo
  documento viram um card só (vale o de maior validade; o visualizador alterna entre eles).
- Amarelo com 3 meses; cursos ASUR com 4 meses. Cursos extras (pasta 04) aparecem como "Curso extra", sem prazo.
- Aba **Validade dos documentos** (só administrador): meses, obrigatório, **Adicionar documento** em cada pasta e
  **Ler pasta do computador** (lê só os nomes dos arquivos de uma pasta do Drive montado no Windows).
- Prazos e obrigatórios ficam por enquanto no navegador (localStorage); vão para o banco na ligação com o Drive.

## O que foi combinado

- Cada pessoa tem uma pasta no Google Drive, com estas subpastas (cada uma vira um bloco na tela,
  com o mesmo nome e na mesma ordem):
  1. `01 - Documentação Técnica` (formação, CAP BA, CBA, CNH, CVE, SBV…)
  2. `02 - Cursos Internos ASUR` (APAM, AVSEC, Compliance, CVA, SGSO, Fauna, Integração…)
  3. `03 - Cursos Med+` (todas as NRs; tem a subpasta `Institucionais`)
  4. `04 - Cursos Extras`
  5. `05 - Recursos Humanos` (cadastro, CTPS, ASO, BPC, comprovante, escolaridade, ficha EPI…)
  6. `06 - Credenciamento` (cópias com o nome da pessoa na frente; valem o prazo do original)
- O sistema liga a pasta à pessoa do cadastro pelo nome e lê os arquivos (o `desktop.ini` é ignorado).
- O tipo do documento sai do nome do arquivo, ignorando o número da frente (`05 - `), o nome da
  pessoa (credenciamento) e cópias (`(1)`). Qualquer NR é reconhecida (`NR 10`, `NR10 NAVEGANTES`…).
- Cada documento vira um card com a cor da validade e a data embaixo:
  - **vermelho**: vencido ("Venceu em …, há N dias");
  - **amarelo**: vence em até 3 meses ("Vence em …, faltam N dias");
  - **verde**: na validade ("Vence em …");
  - **cinza**: não vence, ou falta informar a data do curso.
  - O card da pessoa fica com a cor da pior situação; no topo, contadores por situação.
  - O que é obrigatório (lista da planilha de conferência) e não está na pasta aparece como **Falta**.
- Clicar no documento abre **dentro do sistema** (sem abrir o Drive e sem botão de baixar).
- Aba **Validade dos documentos** (só administrador): um prazo em **meses** por documento.
  - `0` = não vence; em branco = documento novo, ainda sem prazo (fica marcado para definir).
  - A lista se monta sozinha com tudo o que for encontrado nas pastas.
  - Vencimento = data do curso + meses. A data do curso o sistema tenta ler dentro do PDF; se não
    conseguir, alguém informa uma vez no card. CNH pode usar a data de validade da própria carteira.

## Acesso ao Drive (falta fazer)

Conta de serviço do Google, só leitura, com a pasta principal compartilhada com ela. A chave fica no
servidor (variáveis de ambiente), nunca no repositório nem no chat.

## Próximos passos

1. Usuário cria a conta de serviço (Leitor só na pasta principal) e passa o e-mail dela e o link da pasta.
2. Servidor: listar pastas/arquivos por pessoa e abrir arquivo (conferindo que está dentro da pasta principal).
3. Ligar a pasta à pessoa pelo nome; as que não casarem, o administrador liga uma vez na aba.
4. Tabelas no banco: prazos/obrigatórios/adicionados e data do curso por documento de cada pessoa.
5. Leitura da data dentro do PDF (foto: data informada no card).
6. Falta saber como as pastas das pessoas estão nomeadas (nome completo, de guerra, com número?).
