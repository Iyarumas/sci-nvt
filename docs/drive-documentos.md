# Documentos do Google Drive na tela de Certificações

Situação da branch `feat/drive-documentos` (10/11/2026): **ligada ao Google Drive de verdade** (local), ainda não
está no ar. Frontend em `frontend/src/pages/Certificacoes/` (`regrasDrive.ts`, `DriveDocumentos.tsx`); servidor em
`backend/src/drive/`; tabela `drive_datas` (migração 084).

## Ligação com o Drive

- Conta de serviço do Google (projeto `sci-nvt`, sem faturamento), **Leitor** só na pasta principal
  ("Controle Documentos"). Variáveis: `GOOGLE_DRIVE_PASTA_RAIZ` e `GOOGLE_DRIVE_CREDENCIAIS_ARQUIVO` (caminho do
  .json) ou `GOOGLE_DRIVE_CREDENCIAIS_JSON`. A chave fica fora do repositório.
- `GET /api/drive/documentos`: lê as pastas (guarda 5 min; `?atualizar=1` lê de novo), liga cada pasta à pessoa
  do cadastro pelo nome (aceita erro pequeno de digitação; "GS - NOME" pelo cargo; ignora pasta PADRÃO) e respeita
  o acesso da tela (admin/GS tudo; BA-CE/BA-LR só a equipe do cadastro).
- `GET /api/drive/arquivo/:id`: abre o arquivo pelo servidor, só se ele estiver na pasta principal.
- Datas: o servidor lê o texto de cada PDF em segundo plano (pdf-parse) e acha a data do curso ("realizado em",
  "Data de Conclusão", "período de … a …", emissão); grava em `drive_datas` e só relê se o arquivo mudar.
  `POST /api/drive/data` = data informada à mão (admin/GS), para PDF sem texto.
- Bloco de notas (.txt) na pasta = documento faltando ("Falta · marcado na pasta"), menos em Cursos Extras.

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
- Nº padrão por pasta (01, 02 e 03 vieram do usuário) e "Juntar com…" para nomes escritos de jeitos diferentes.
- Prazos, obrigatórios, Nº e nomes juntados ainda ficam no navegador (localStorage): falta passar para o banco.

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
- **Curso escrito no certificado** (pastas 01 a 04, só PDF com texto; foto/escaneado segue pelo nome):
  o servidor guarda o começo do texto (`drive_datas.trecho`) e acha os cursos citados (NR em qualquer
  forma, catálogo de sinônimos em `backend/src/drive/curso-pdf.ts` e os nomes da aba Validade).
  - Bate com o nome do arquivo (ou o nome é mais específico, ex.: `NR 20 II`): nada muda.
  - Nome não diz nada conhecido e o certificado cita um só curso: liga sozinho a esse curso e avisa
    **Nome fora do padrão** (com o nome sugerido, ex.: `12 - NR 35`).
  - Nome e certificado apontam para cursos diferentes: fica o do nome e o card mostra **Conferir**
    ("o nome do documento não condiz com o documento que está na pasta com esse nome").
  - Só o **administrador** vincula (`POST /api/drive/tipo`, guardado em `drive_datas.tipo_informado`).
    O arquivo no Drive **não** é renomeado: depois de vincular, o aviso "Nome fora do padrão" continua
    para os chefes pedirem a correção; quando renomeiam, o aviso some sozinho.
- **ASO e cadastro** (ficha cadastral) faltando ficam **verdes** com "responsabilidade GS/Embaixador"
  (quem providencia não é a pessoa).
- **Credencial aeroportuária** não é obrigatória na pasta 06: quem cobra é o crachá do card (validade
  do cadastro).
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

1. Passar prazos/obrigatórios/Nº/nomes juntados para o banco (valer para todos os administradores).
2. Padrão das pastas 04, 05 e 06 (o usuário vai mandar) e os prazos reais em meses.
3. Ligar à mão as pastas que não casaram com o cadastro.
4. Colocar no ar: migração 084, variáveis do Drive e a chave .json no servidor (fora do repositório).
