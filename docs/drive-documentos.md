# Documentos do Google Drive na tela de Certificações

Situação da branch `feat/drive-documentos`: **só o plano**, nenhum código ainda (10/11/2026).

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

1. Conexão de leitura com o Drive (servidor) e listagem por pessoa.
2. Tabelas de prazo por documento e de data por documento de cada pessoa.
3. Tela de Certificações com os blocos por pasta e as cores.
4. Aba de validade para o administrador.
5. Leitura da data dentro do PDF.
