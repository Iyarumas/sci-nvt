# API Endpoints — SESCINC Manager

> **Data:** 2026-07-31
> **Total de serviços:** 45 ficheiros em `src/services/`
> **Comunicação com Supabase:** 34 ficheiros
> **Total de funções:** ~202
> **Serviços externos:** 1 (Autentique GraphQL)  
> **Cálculo puro:** 8 (escalaMensalGenerator, lroGenerator, pdfService, htmlPdfService, reaPdfService, ptrbaCompletoPdfService, tpeprPdfService, tempoRespostaPdfService)
> **Dead code (localStorage):** 10 ficheiros RTK store + notificacaoService (parcial)

---

## Transporte NestJS

Base URL local: `http://localhost:3333/api`

> **Atualizacao arquitetural (2026-08-11):** o front-end foi movido para `frontend/` e nao chama mais Supabase diretamente. Os services de `frontend/src/services/` continuam preservando os contratos abaixo, mas passam por `frontend/src/lib/supabase.ts`, um adapter HTTP que envia as operacoes para a API NestJS em `backend/`. O PostgreSQL local roda via `docker-compose.yml`; as migrations SQL foram copiadas para `backend/database/migrations/`.

| Endpoint | Metodo | Descricao |
|---|---|---|
| `/health` | GET | Health check da API; retorna o commit do build em `commit` |
| `/data/:table/query` | POST | Consulta tabelas permitidas com `select`, filtros, ordenacao, `limit`, `count` e `head` |
| `/data/:table/insert` | POST | Insere objeto ou lista de objetos em tabela permitida |
| `/data/:table/update` | POST | Atualiza registros com filtros obrigatorios |
| `/data/:table/delete` | POST | Exclui registros com filtros obrigatorios |
| `/rpc/:name` | POST | RPCs expostos: `verificar_senha`, `criar_usuario_com_hash`, `atualizar_senha`, `aprovar_escala_ferias_transacional` |
| `/storage/:bucket/upload` | POST | Upload local de PDFs/arquivos |
| `/storage/:bucket/list` | GET | Lista arquivos de um bucket/prefixo |
| `/storage/:bucket/file` | GET | Download/visualizacao de arquivo |
| `/storage/:bucket/remove` | POST | Remove arquivos |
| `/storage/:bucket/signed-url` | POST | Gera URL local temporaria compativel com o front |
| `/autentique/proxy` | POST | Proxy GraphQL Autentique para payload JSON |
| `/autentique/proxy/upload` | POST | Proxy GraphQL Autentique para upload multipart |

---

## Sumário

| # | Serviço | Tabelas | Funções | Estado Geral |
|---|---------|---------|---------|-------------|
| 1 | bombeiroService | `bombeiros` | 9 | ✅ |
| 2 | feriasService | `ferias`, `ferias_escala`, `ferias_escala_item` | 16 + 5 stubs | ✅ (+5 ❌ stubs) |
| 3 | substituicaoService | `substituicoes_ativas` | 7 | ⚠️ 2 bugs `.single()` |
| 4 | substituicaoTemporariaService | `substituicoes_temporarias` | 5 | ✅ |
| 5 | escalaService | `escalas_diarias` | 6 | ✅ |
| 6 | escalaMensalService | `escalas_mensais_config`, `escalas_mensais_geradas` | 7 | ✅ |
| 7 | ptrbService | `ptrb_registros` | 6 | ✅ |
| 7.1 | ptrbaCompletoService | `ptrba_completo_registros` | 5 | ✅ |
| 7.2 | ptrbaCompletoPdfService | — | 2 | ✅ |
| 8 | lroService | `registros_lro` | 6 | ✅ |
| 9 | lroDraftService | `lro_drafts` | 5 | ⚠️ 2 sem err check |
| 10 | ocorrenciaService | `ocorrencias_operacionais` | 4 | ⚠️ 1 sem err check |
| 10.1 | reaService | `rea_registros` | 5 | ✅ |
| 11 | chatService | `chat_mensagens` | 7 | ⚠️ 1 sem err check |
| 12 | documentoService | `documents`, `document_fields`, `document_signers`, `document_fills`, Storage | ~25 | ✅ |
| 13 | apocService | `apocs` | 7 | ✅ |
| 14 | viaturaService | `viaturas` | 4 | ✅ |
| 15 | extintorService | `extintores` | 4 | ✅ |
| 15.1 | agenteExtintorService | `agentes_extintores` | 4 | ✅ |
| 16 | hidranteService | `hidrantes` | 4 | ✅ |
| 17 | conferenciaService | `conferencias` | 2 | ✅ |
| 17.1 | checklistService | `checklists` | 4 | ✅ |
| 18 | certificacaoService | `certificacoes_nr` | 4 | ⚠️ 1 sem err check |
| 19 | certificacaoCursoService | `certificacoes_cursos` | 4 | ⚠️ 1 sem err check |
| 20 | equipamentoService | `equipamentos_operacionais` | 4 | ⚠️ atualizar retorna void |
| 21 | epiService | `epis` | 8 | ⚠️ erros silenciosos |
| 22 | epiEstoqueService | `epis_estoque` | 6 | ⚠️ erros silenciosos |
| 23 | conviteService | `convites` | 4 | ⚠️ fallback localStorage |
| 24 | usuarioService | `usuarios` + RPCs | 8 | ✅ senha via RPC hash; leituras sem colunas sensíveis |
| 25 | vigenciaSubstituicaoService | `vigencia_substituicoes` | 8 | ✅ |
| 26 | vagaPendenteService | `vagas_pendentes` | 4 | ✅ |
| 27 | exercicioPosicionamentoService | `exercicios_posicionamento` | 6 | ✅ |
| 28 | tempoRespostaService | `treinamentos_tempo_resposta` | 6 | ✅ |
| 28.1 | tempoRespostaPdfService | — | 2 | ✅ |
| 29 | tafService | `treinamentos_taf` | 6 | ✅ |
| 30 | tpeprService | `treinamentos_tpepr` | 6 | ✅ |
| 30.1 | tpeprPdfService | — | 2 | ✅ |
| 31 | ordemServicoService | `ordens_servico` | 5 | ✅ |
| 25 | autentiqueService | — (API externa) | 9 | ✅ |
| 26 | notificacaoService | — (computed + localStorage) | 4 | ⚠️ cache local |
| — | store/api/* (10 ficheiros) | — | ~50 | ❌ DEAD CODE (fakeBaseQuery localStorage) |

---

# 1. Bombeiros — `bombeiroService.ts`

**Tabela:** `bombeiros`  
**Ficheiro:** `src/services/bombeiroService.ts`  
**Tipo:** `src/types/bombeiro.ts` — `Bombeiro`

---

### listarBombeiros

**Método HTTP:** GET  
**REST equivalência:** `GET /rest/v1/bombeiros?select=*&order=created_at.desc` com filtros opcionais `equipe`, `cargo` e `ids`
**Query Params:** `equipe?: string`, `cargo?: string`, `ids?: string[]`
**Request Body:** —  
**Response:** `Bombeiro[]`  
**Estado:** ✅ OK  

**Payload Response:**
```json
[{
  "id": "uuid",
  "matricula": "string",
  "nomeCompleto": "string",
  "nomeGuerra": "string",
  "email": "string",
  "dataNascimento": "string (ISO date)",
  "idade": "number",
  "dataAdmissao": "string (ISO date)",
  "cargo": "BA-2 | BA-MC | BA-CE | BA-LR | BA-RE | GS | OC",
  "equipe": "Alfa | Bravo | Charlie | Delta | Ferista | Embaixador",
  "turno": "Diurno | Noturno | Ferista | Administrativo",
  "tipoSanguineo": "string",
  "cpf": "string",
  "rg": "string",
  "cnhNumero": "string",
  "cnhCategoria": "'' | A | B | C | D | E | AB | AC | AD | AE",
  "cnhValidade": "string (ISO date)",
  "credencialValidade": "string (ISO date)",
  "foto": "string (url)",
  "dataDesligamento": "string (ISO date)",
  "endereco": "string",
  "numeroEndereco": "string",
  "complemento": "string",
  "bairro": "string",
  "cep": "string",
  "uf": "string",
  "municipio": "string",
  "celular": "string",
  "sexo": "M | F",
  "cursoChefeEquipe": "boolean",
  "cursoMotoristaCCI": "boolean",
  "cursoCVE": "boolean",
  "createdAt": "string (ISO datetime)",
  "updatedAt": "string (ISO datetime)"
}]
```

---

### listarBombeirosPublico

**Método HTTP:** GET
**REST equivalência:** `GET /rest/v1/bombeiros?select=id,matricula,nome_completo,nome_guerra,cargo,equipe,turno,foto,cnh_categoria,cnh_validade,credencial_validade,tipo_sanguineo,data_desligamento,created_at,updated_at&order=created_at.desc`
**Query Params:** `equipe?: string`, `cargo?: string`
**Request Body:** —
**Response:** `Bombeiro[]` com campos pessoais sensíveis preenchidos como vazio no mapper
**Estado:** ✅ OK
**Uso:** listagem geral de funcionários para usuários sem permissão de dados pessoais, incluindo dados operacionais mínimos do modal limitado.

---

### buscarBombeiro

**Método HTTP:** GET  
**REST equivalência:** `GET /rest/v1/bombeiros?select=*&or=(nome_completo.ilike.%termo%,nome_guerra.ilike.%termo%,...)`  
**Query Params:** `termo: string` (path param da função)  
**Request Body:** —  
**Response:** `Bombeiro[]`  
**Estado:** ✅ OK  

---

### buscarBombeiroPublico

**Método HTTP:** GET
**REST equivalência:** `GET /rest/v1/bombeiros?select=id,matricula,nome_completo,nome_guerra,cargo,equipe,turno,foto,cnh_categoria,cnh_validade,credencial_validade,tipo_sanguineo,data_desligamento,created_at,updated_at&or=(nome_completo.ilike.%termo%,nome_guerra.ilike.%termo%,matricula.ilike.%termo%,equipe.ilike.%termo%)`
**Query Params:** `termo: string`
**Request Body:** —
**Response:** `Bombeiro[]` com campos pessoais sensíveis preenchidos como vazio no mapper
**Estado:** ✅ OK
**Uso:** busca pública na aba Funcionários > Todos, sem CPF/e-mail/RG/número da CNH.

---

### obterBombeiro

**Método HTTP:** GET  
**REST equivalência:** `GET /rest/v1/bombeiros?select=*&id=eq.{id}`  
**Query Params:** `id: string`  
**Request Body:** —  
**Response:** `Bombeiro | null`  
**Estado:** ✅ OK  

---

### listarAtivos

**Método HTTP:** GET  
**REST equivalência:** `GET /rest/v1/bombeiros?select=*&data_desligamento=eq.`  
**Query Params:** (nenhum)  
**Request Body:** —  
**Response:** `Bombeiro[]`  
**Estado:** ⚠️ BUG — filtra por `data_desligamento === ''` mas ativos têm `null` na BD. Deveria usar `.is('data_desligamento', null)`

---

### criarBombeiro

**Método HTTP:** POST  
**REST equivalência:** `POST /rest/v1/bombeiros`  
**Request Body:**
```json
{
  "matricula": "string",
  "nomeCompleto": "string",
  "nomeGuerra": "string",
  "email": "string",
  "dataNascimento": "string (ISO date)",
  "idade": "number",
  "dataAdmissao": "string (ISO date)",
  "cargo": "BA-2 | BA-MC | BA-CE | BA-LR | BA-RE | GS | OC",
  "equipe": "Alfa | Bravo | Charlie | Delta | Ferista | Embaixador",
  "turno": "Diurno | Noturno | Ferista | Administrativo",
  "tipoSanguineo": "string",
  "cpf": "string",
  "rg": "string",
  "cnhNumero": "string",
  "cnhCategoria": "'' | A | B | C | D | E | AB | AC | AD | AE",
  "cnhValidade": "string (ISO date)",
  "credencialValidade": "string",
  "foto": "string (url)",
  "dataDesligamento": "string",
  "endereco": "string",
  "numeroEndereco": "string",
  "complemento": "string",
  "bairro": "string",
  "cep": "string",
  "uf": "string",
  "municipio": "string",
  "celular": "string",
  "sexo": "M | F",
  "cursoChefeEquipe": "boolean",
  "cursoMotoristaCCI": "boolean",
  "cursoCVE": "boolean"
}
```
**Response:** `Bombeiro` (com id, createdAt, updatedAt preenchidos)  
**Estado:** ✅ OK  

---

### atualizarBombeiro

**Método HTTP:** PATCH  
**REST equivalência:** `PATCH /rest/v1/bombeiros?id=eq.{id}`  
**Request Body:** `Partial<Bombeiro>` (qualquer campo opcional)  
**Response:** `Bombeiro | null`  
**Estado:** ✅ OK  

---

### excluirBombeiro

**Método HTTP:** DELETE  
**REST equivalência:** `DELETE /rest/v1/bombeiros?id=eq.{id}`  
**Response:** `boolean`  
**Estado:** ✅ OK  

---

# 2. Férias — `feriasService.ts`

**Tabelas:** `ferias`, `ferias_escala`, `ferias_escala_item`  
**Ficheiro:** `src/services/feriasService.ts`  
**Tipos:** `src/types/ferias.ts` — `FeriasGozo`, `EscalaFerias`, `EscalaFeriasItem`

---

### listarFeriasGozo

**Método HTTP:** GET  
**REST equivalência:** `GET /rest/v1/ferias?select=*&order=created_at.desc`  
**Request Body:** —  
**Response:** `FeriasGozo[]` (com status corrigido automaticamente: se `dataFim < hoje` → `Gozadas`)  
**Estado:** ✅ OK  

**Payload Response:**
```json
[{
  "id": "uuid",
  "funcionarioId": "string",
  "funcionarioNome": "string",
  "equipe": "Alfa | Bravo | Charlie | Delta | Ferista | Embaixador",
  "periodoNumero": "number",
  "dataInicio": "string (ISO date)",
  "dataFim": "string (ISO date)",
  "dias": "number",
  "status": "Programadas | Em Gozo | Gozadas",
  "substitutoId": "string",
  "substitutoNome": "string",
  "funcaoSubstituicao": "BA-2 | BA-MC | BA-CE | BA-LR | BA-RE | GS | OC | ''",
  "observacoes": "string",
  "modificadoPor": "string",
  "bloqueado": "boolean",
  "createdAt": "string (ISO datetime)",
  "updatedAt": "string (ISO datetime)"
}]
```

---

### feriasPorFuncionario

**Método HTTP:** GET  
**REST equivalência:** `GET /rest/v1/ferias?select=*&funcionario_id=eq.{funcionarioId}&order=data_inicio.asc`  
**Query Params:** `funcionarioId: string`  
**Response:** `FeriasGozo[]`  
**Estado:** ✅ OK  

---

### criarFeriasGozo

**Método HTTP:** POST  
**REST equivalência:** `POST /rest/v1/ferias`  
**Request Body:**
```json
{
  "funcionarioId": "string",
  "funcionarioNome": "string",
  "equipe": "Equipe",
  "periodoNumero": "number",
  "dataInicio": "string (ISO date)",
  "dataFim": "string (ISO date)",
  "dias": "number",
  "status": "Programadas | Em Gozo | Gozadas",
  "substitutoId": "string",
  "substitutoNome": "string",
  "funcaoSubstituicao": "Cargo | ''",
  "observacoes": "string",
  "modificadoPor": "string",
  "bloqueado": "boolean"
}
```
**Response:** `FeriasGozo`  
**Estado:** ✅ OK  
**Regras:** valida datas/dias, bloqueia duplicidade `funcionarioId + periodoNumero`, exige substituto para cargos obrigatórios fora da equipe Ferista, valida BA-2/Ferista e aguarda a criação da cadeia de substituições antes de retornar sucesso.  
**Opções internas:** `cadeiaInput`, `bombeiros`, `gozosExistentes`, `processarCadeia`.  

---

### atualizarFeriasGozo

**Método HTTP:** PATCH  
**REST equivalência:** `PATCH /rest/v1/ferias?id=eq.{id}`  
**Request Body:** `Partial<FeriasGozo>`  
**Response:** `FeriasGozo | null`  
**Estado:** ✅ OK  

---

### excluirFeriasGozo

**Método HTTP:** DELETE  
**REST equivalência:** `DELETE /rest/v1/ferias?id=eq.{id}`  
**Response:** `boolean`  
**Estado:** ✅ OK  

---

### listarEscalas (ferias_escala)

**Método HTTP:** GET  
**REST equivalência:** `GET /rest/v1/ferias_escala?select=*&order=created_at.desc`  
**Query Params opcionais:** `equipe?: string`, `ano?: number`  
**Response:** `EscalaFerias[]`  
**Estado:** ✅ OK  

**Payload Response:**
```json
[{
  "id": "uuid",
  "equipe": "Alfa | Bravo | Charlie | Delta | Ferista",
  "ano": "number",
  "chefeId": "string",
  "chefeNome": "string",
  "status": "Rascunho | Enviado | Aprovado | Rejeitado",
  "observacoesRejeicao": "string",
  "aprovadoPor": "string",
  "aprovadoPorNome": "string",
  "aprovadoEm": "string (ISO datetime)",
  "enviadoEm": "string (ISO datetime)",
  "createdAt": "string (ISO datetime)",
  "updatedAt": "string (ISO datetime)"
}]
```

---

### obterEscala / criarEscala / atualizarEscala / excluirEscala

**Método:** GET / POST / PATCH / DELETE  
**REST equivalência:** `.../ferias_escala`  
**Estado:** ✅ OK  
**Regra:** `criarEscala` é idempotente por `equipe + ano` e retorna a escala existente quando já houver registro para o mesmo par.  

---

### enviarEscala / aprovarEscala / rejeitarEscala

Wrappers que atualizam o `status` da `ferias_escala`.  
**Estado:** ✅ OK  

---

### aprovarEscalaEGerarGozos

**Método:** POST (lógica: aprova escala + itera itens + cria registos na tabela `ferias`)  
**Request Body:** `id: string`, `aprovadoPor: string`, `aprovadoPorNome: string`  
**Response:** `EscalaFerias | null`  
**Estado:** ✅ OK  
**Nota:** Para cada item enviado e não rejeitado, cria um `FeriasGozo` na tabela `ferias`, aguarda a cadeia de substituições e só aprova a escala após sucesso. Se já existe gozo para o mesmo funcionário + período, vincula o item ao gozo existente.
**RPC preferencial:** `aprovar_escala_ferias_transacional(p_escala_id, p_aprovado_por, p_aprovado_por_nome, p_manter_status)` faz geração de gozos, vigências e aprovação numa transação. O app usa fallback client-side se a RPC ainda não existir no banco.

---

### listarItensEscala / criarItemEscala / atualizarItemEscala / excluirItemEscala

**Tabela:** `ferias_escala_item`  
**Estado:** ✅ OK  
**Regras:** criação/edição validam datas, dias, duplicidade por escala/funcionário/período, sobreposição no mesmo funcionário, gozo já existente, substituto obrigatório e cadeia até Ferista quando o substituto direto não é Ferista.  

**Payload `EscalaFeriasItem`:**
```json
{
  "id": "uuid",
  "escalaId": "uuid",
  "mes": "number (1-12)",
  "funcionarioId": "string",
  "funcionarioNome": "string",
  "funcao": "Cargo",
  "dias": "number",
  "dataInicio": "string (ISO date)",
  "dataFim": "string (ISO date)",
  "substitutoId": "string",
  "substitutoNome": "string",
  "funcaoSubstituicao": "Cargo | ''",
  "feristaId": "string",
  "feristaNome": "string",
  "periodoNumero": "number",
  "rejeitado": "boolean",
  "motivoRejeicao": "string",
  "rejeitadoPor": "string",
  "rejeitadoEm": "string (ISO datetime)",
  "enviado": "boolean",
  "createdAt": "string (ISO datetime)"
}
```

---

### rejeitarItemEscala / enviarItemEscala / aprovarItemEscala

Wrappers para atualizar campos do item.  
**Estado:** ✅ OK  

---

### alertasFerias

**Método:** Cálculo puro (sem chamada Supabase)  
**Input:** `Bombeiro[]`  
**Output:** `FeriasAlerta[]` — alertas de vencimento de período aquisitivo  
**Estado:** ✅ OK  

---

### ❌ STUBS (Legacy — não fazem nada)

| Função | Comportamento |
|--------|--------------|
| `listarFerias()` | Retorna `[]` |
| `alertasVencimento(_meses)` | Retorna `Promise.resolve([])` |
| `criarFerias(data)` | Retorna o input inalterado |
| `atualizarFerias(_id, data)` | Retorna o input inalterado |
| `excluirFerias(_id)` | Não faz nada (void) |

---

# 3. Substituições Ativas — `substituicaoService.ts`

**Tabela:** `substituicoes_ativas`  
**Ficheiro:** `src/services/substituicaoService.ts`  
**Tipo:** `src/types/ferias.ts` — `SubstituicaoAtiva`

---

### listarSubstituicoes

**Método HTTP:** GET  
**Estado:** ✅ OK  

**Payload Response:**
```json
[{
  "id": "uuid",
  "feriasId": "string",
  "funcionarioId": "string",
  "funcionarioNome": "string",
  "substitutoId": "string",
  "substitutoNome": "string",
  "funcaoSubstituicao": "BA-2 | ...",
  "dataInicio": "string (ISO date)",
  "dataFim": "string (ISO date)",
  "ativa": "boolean",
  "createdAt": "string (ISO datetime)"
}]
```

---

### substituicoesAtivas

GET com filtro `ativa=true`. ✅ OK

### substituicaoPorSubstituto / substituicaoPorFuncionario

**Estado:** ⚠️ BUG — usam `.single()` em queries que podem retornar múltiplas linhas. Se uma pessoa tiver mais de 1 substituição ativa, a query CRASHA com erro PGRST116.

### criarSubstituicao / encerrarSubstituicao / excluirSubstituicao

✅ OK (exceto excluir que não verifica erro)

---

# 4. Substituições Temporárias — `substituicaoTemporariaService.ts`

**Tabela:** `substituicoes_temporarias`  
**Ficheiro:** `src/services/substituicaoTemporariaService.ts`  
**Tipo:** `src/types/substituicaoTemporaria.ts` — `SubstituicaoTemporaria`

---

### listarSubstituicoesTemporarias

**Método HTTP:** GET  
**Estado:** ✅ OK  

**Payload Response:**
```json
[{
  "id": "uuid",
  "funcionarioId": "string",
  "funcionarioNome": "string",
  "funcionarioCargo": "string",
  "substitutoId": "string",
  "substitutoNome": "string",
  "substitutoCargo": "string",
  "tipo": "Substituição | Extra | Afastamento",
  "motivo": "Atestado Medico | INSS | INSS Indeterminado | Falecimento Conjuge | ... | Outro",
  "motivoOutro": "string",
  "plantaoExtra": "Sim | Nao | ''",
  "dataInicio": "string (ISO date)",
  "dataFim": "string (ISO date)",
  "dias": "number",
  "status": "Pendente | Aprovada | Rejeitada",
  "observacoesRejeicao": "string",
  "criadoPor": "string",
  "criadoPorNome": "string",
  "aprovadoPor": "string",
  "aprovadoPorNome": "string",
  "aprovadoEm": "string (ISO datetime)",
  "cadeiaSubstituicao": [{
    "tipo": "cadeia | extra",
    "pessoaId": "string",
    "pessoaNome": "string",
    "pessoaCargo": "string",
    "pessoaEquipe": "string",
    "cargoOriginal": "string",
    "cargoVacante": "string",
    "substituindoNome": "string",
    "dataPlantao": "string opcional (ISO date, apenas extra)",
    "funcionarioId": "string opcional (apenas extra)",
    "funcionarioNome": "string opcional (apenas extra)",
    "funcionarioCargo": "string opcional (apenas extra)",
    "funcionarioEquipe": "string opcional (apenas extra)",
    "equipePlantao": "string opcional (apenas extra)",
    "substituindoId": "string opcional (apenas extra, quando o afastado estava cobrindo férias)",
    "substituindoCargo": "string opcional (apenas extra, quando o afastado estava cobrindo férias)",
    "substituindoCoberturaNome": "string opcional (apenas extra, quando o afastado estava cobrindo férias)",
    "substitutoId": "string opcional (apenas extra)",
    "substitutoNome": "string opcional (apenas extra)",
    "substitutoCargo": "string opcional (apenas extra)",
    "cargoExercido": "string opcional (apenas extra)",
    "plantaoExtra": "boolean opcional"
  }],
  "createdAt": "string (ISO datetime)",
  "updatedAt": "string (ISO datetime)"
}]
```

### criarSubstituicaoTemporaria / atualizar / aprovar / rejeitar / excluir

✅ OK  
**Regras:** criação e aprovação bloqueiam mesma pessoa como substituto, datas/dias inválidos, motivo `Outro` sem descrição, motivos de afastamento/atestado `Atestado Medico`, `INSS` e `INSS Indeterminado` sem descrição, `Extra` legado sem resposta de plantão extra e sobreposição com substituições pendentes/aprovadas. Ao editar uma movimentação aprovada, ela volta para `Pendente`, limpa os dados de aprovação e desativa vigências antigas até nova aprovação. `Atestado Medico` inicia com o prazo padrão sugerido, mas permite alterar a quantidade de dias e pode incluir CID opcional gravado em `motivoOutro`; o CID nunca é obrigatório. `plantaoExtra` é exibido na UI como `Sim | Nao | ''`, mas persiste em `plantao_extra` como `BOOLEAN` (`Sim` → `true`; `Nao`/vazio → `false`). A tela de criação não oferece mais o tipo `Extra`: plantões extras de atestado são registrados dentro de `Afastamento/Atestados`, com cada dia em `cadeia_substituicao` como `{ tipo: "extra", dataPlantao, funcionarioId, substitutoId, cargoExercido, equipePlantao }`, descrição em `motivoOutro` e `plantaoExtra = Sim`. Se a pessoa afastada estiver cobrindo férias por uma vigência ativa, `equipePlantao` e `cargoExercido` usam a equipe/função efetiva do dia; isso cobre feristas atuando em outras equipes. `INSS Indeterminado` usa `dataFim = 9999-12-31` como sentinela técnica e o campo `dias` representa a janela inicial de extras cadastrada pelo usuário. `Substituição` aprovada gera vigência direta em `vigencia_substituicoes` com origem `substituicao`, fazendo o substituto herdar cargo/equipe do substituído durante o período. `Afastamento/Atestados` com extras não gera corrente nem vigência automática; a tela de funcionários deriva o status `Afastado` de afastamentos aprovados e vigentes, e a Escala Diária aplica os extras por data e equipe efetiva.

---

# 5. Escalas Diárias — `escalaService.ts`

**Tabela:** `escalas_diarias`  
**Ficheiro:** `src/services/escalaService.ts`  
**Tipo:** `src/types/escala.ts` — `EscalaDiaria`

---

### listarEscalas

**Método HTTP:** GET  
**Estado:** ✅ OK  

**Payload Response:**
```json
[{
  "id": "uuid",
  "createdBy": "string",
  "createdAt": "string",
  "updatedAt": "string",
  "equipe": "string",
  "chefeEquipe": "string",
  "dataPlantao": "string (ISO date)",
  "horarioInicio": "string",
  "horarioTermino": "string",
  "turno": "string",
  "guarnicoes": {
    "cci02": { "baMc": "string", "baCe": "string", "ba2": "string" },
    "cci03": { "baMc": "string", "ba2_1": "string", "ba2_2": "string" },
    "crs": { "baMc": "string", "baLr": "string", "baRe1": "string", "baRe2": "string" }
  },
  "bds": { "funcao": "string", "nomeGuerra": "string", "assunto": "string opcional" },
  "ptr1": { "funcao": "string", "nomeGuerra": "string", "assunto": "string opcional" },
  "ptr2": { "funcao": "string", "nomeGuerra": "string", "assunto": "string opcional" },
  "ptr3": { "funcao": "string", "nomeGuerra": "string", "assunto": "string opcional" },
  "atestados": ["string"],
  "trocas": [{ "funcaoSaindo": "string", "nomeSaindo": "string", "funcaoEntrando": "string", "nomeEntrando": "string" }],
  "extras": [{
    "dataPlantao": "string (ISO date)",
    "equipePlantao": "string opcional",
    "funcionarioId": "string opcional",
    "substitutoId": "string opcional",
    "funcaoSaindo": "string",
    "nomeSaindo": "string",
    "nomeSaindoCompleto": "string opcional",
    "funcaoEntrando": "string",
    "nomeEntrando": "string",
    "nomeEntrandoCompleto": "string opcional",
    "cargoOriginalEntrando": "string opcional"
  }],
  "radio": [{ "funcao": "string", "nomeGuerra": "string", "horarioInicio": "string", "horarioFim": "string" }]
}]
```

### criarEscala / atualizarEscala / excluirEscala

✅ OK  
**Regras:** criação é idempotente por `equipe + dataPlantao`; criação/edição validam se a equipe está prevista para o dia pelo helper `equipesNoDia`, bloqueiam duplicidade de escala diária e impedem a mesma pessoa em múltiplos slots operacionais incompatíveis. A escala diária possui quatro slots de instrução: `bds`, `ptr1`, `ptr2` e `ptr3`; os slots `ptr1`/`ptr2`/`ptr3` podem guardar o `assunto` selecionado da lista padrão do PTR-BA para aparecer nos detalhes e na impressão. `atestados` e `extras` são preenchidos automaticamente a partir de `Afastamento/Atestados` aprovados no dia, usando a equipe efetiva do extra/vigência quando a pessoa afastada estiver cobrindo férias em outra equipe; `extras` também substitui o afastado nas guarnições pelo nome de guerra de quem fará o plantão extra.

---

# Integridade Operacional — RPCs

### aprovar_escala_ferias_transacional

**Tipo:** RPC PostgreSQL  
**Migration:** `supabase/migrations/038_aprovar_escala_ferias_rpc.sql`  
**Parâmetros:** `p_escala_id uuid`, `p_aprovado_por text`, `p_aprovado_por_nome text`, `p_manter_status boolean`  
**Response:** JSON com `escalaId`, `gozosCriados`, `itensVinculados`, `statusAtualizado`  
**Estado:** ✅ pronto para aplicar via migration  

### operational_integrity_violations

**Tipo:** RPC PostgreSQL  
**Migration:** `supabase/migrations/037_operational_integrity_constraints.sql`  
**Response:** lista duplicidades legadas em férias, escala anual, escala diária e substituições temporárias.  
**Estado:** ✅ pronto para aplicar via migration  

---

# 6. Escalas Mensais — `escalaMensalService.ts`

**Tabelas:** `escalas_mensais_config`, `escalas_mensais_geradas`  
**Ficheiro:** `src/services/escalaMensalService.ts`  
**Tipo:** `src/types/escalaMensal.ts` — `EscalaMensalConfig`, `EscalaMensalCompleta`

---

### listarCompletas

**Método:** GET (join manual entre 2 tabelas)  
**Estado:** ✅ OK  

**Payload Response:**
```json
[{
  "config": {
    "id": "uuid",
    "equipe": "string",
    "mes": "number",
    "ano": "number",
    "paridade": "par | impar",
    "pessoas": [{
      "id": "string",
      "nome": "string",
      "nomeGuerra": "string",
      "funcao": "chefe | lider | ba-mc | ba-2",
      "veiculo": "crs | cciF2 | cciF3",
      "funcaoNoVeiculo": "BaMc | BaCe | BaLr | Ba2 | Ba2-1 | Ba2-2",
      "isRadioFixo": "boolean"
    }],
    "faxinaManual": [{ "local": "string", "pessoaNome": "string", "pessoaNomeGuerra": "string" }],
    "responsabilidadesManual": [{ "descricao": "string", "pessoaNome": "string", "pessoaNomeGuerra": "string" }],
    "radioManual": {
      "comunicante": { "pessoaNome": "string", "pessoaNomeGuerra": "string" },
      "antesMeiaNoite": [{ "pessoaNome": "string", "pessoaNomeGuerra": "string" }],
      "depoisMeiaNoite": [{ "pessoaNome": "string", "pessoaNomeGuerra": "string" }]
    },
    "createdAt": "string",
    "updatedAt": "string"
  },
  "paradas": [{
    "dia": "number",
    "data": "string (ISO date)",
    "veiculos": { "crs": {...}, "cciF2": {...}, "cciF3": {...} },
    "radio": [{ "horario": "string", "horarioFim": "string", "pessoaNome": "string", "pessoaNomeGuerra": "string", "fixo": "boolean" }]
  }],
  "faxinaMensal": [{ "local": "string", "pessoaNome": "string", "pessoaNomeGuerra": "string" }],
  "responsabilidades": [{ "descricao": "string", "pessoaNome": "string", "pessoaNomeGuerra": "string" }]
}]
```

### salvarConfig / salvarCompleta / excluirConfig / obterCompleta

✅ UPSERT lógico (verifica existência antes de inserir ou atualizar)

**Regra de geraÃ§Ã£o:** `paridade` fica como referÃªncia/compatibilidade, mas os dias gerados sÃ£o calculados pela sequÃªncia 12x36 em `src/utils/equipes.ts` (`equipesNoDia`), a partir de 21/07/2026 = Alfa + Bravo. Em julho/2026, Alfa/Bravo caem nos dias Ã­mpares e Charlie/Delta nos pares; nos meses seguintes a sequÃªncia continua sem assumir paridade fixa.
**Faxina:** quando a tela envia `config.faxinaManual`, `gerarEscalaMensal` usa esses responsÃ¡veis nos locais selecionados e completa os demais pela rotaÃ§Ã£o automÃ¡tica.

**Responsabilidades:** quando a tela envia `config.responsabilidadesManual`, `gerarEscalaMensal` substitui apenas as responsabilidades selecionadas e mantem as demais automaticas. Checklist do almoxarifado e acompanhamento de manutencoes usam o mesmo responsavel; limpeza dos CCI fica como texto fixo informando que cada motorista faz o seu carro.
**Radio:** quando a tela envia `config.radioManual`, o comunicante fica no primeiro e no ultimo horario; os quatro nomes antes e os quatro depois do divisor do turno alternam a cada plantao e avancam uma posicao para o proximo horario a cada par de plantoes. No turno noturno o divisor e a meia-noite; no diurno e o meio-dia. Pessoas exercendo BA-CE ou BA-LR nao entram nos selects manuais de radio. Horarios diurnos: 07:00-08:00, 08:00-09:00, 09:00-10:00, 10:00-11:00, 11:00-12:00, 12:00-13:30, 13:30-15:00, 15:00-16:30, 16:30-18:00, 18:00-19:00.

### clonarConfig / gerarNomesMes / novaConfigId

✅ Funções utilitárias puras

---

# 7. PTR-BA — `ptrbService.ts`

**Tabela:** `ptrb_registros`  
**Ficheiro:** `src/services/ptrbService.ts`  
**Tipo:** `src/types/ptrb.ts` — `PTRB`

---

### listarPTRBs

**Método HTTP:** GET  
**Estado:** ✅ OK  

**Payload Response:**
```json
[{
  "id": "uuid",
  "createdBy": "string",
  "createdAt": "string",
  "updatedAt": "string",
  "data": "string (ISO date)",
  "horaInicio": "string",
  "horaTermino": "string",
  "duracao": "string",
  "horas": "number",
  "equipe": "string",
  "turno": "string",
  "participantes": [{ "funcao": "string", "nomeCompleto": "string", "situacao": "A | INSTR | OC | P" }],
  "observacoes": "string",
  "instrutor": "string",
  "assuntoMinistrado": "string (código 01-24)",
  "descricao": "string",
  "informacoesComplementares": "string",
  "fotos": ["string (base64 ou url)"]
}]
```

### criarPTRB / atualizarPTRB / excluirPTRB

✅ OK  

---

# 7.1. PTR-BA Completo — `ptrbaCompletoService.ts`

**Tabela:** `ptrba_completo_registros`
**Ficheiro:** `src/services/ptrbaCompletoService.ts`
**Tipo:** `src/types/ptrbaCompleto.ts` — `PTRBACompleto`

---

### listarPTRBACompletos

**Método HTTP:** GET
**REST equivalência:** `GET /rest/v1/ptrba_completo_registros?select=*&order=data.desc&order=created_at.desc` com filtros opcionais `equipe`, `ano`, `dataGte`, `dataLte`, `createdBy`
**Query Params:** `equipe?: string`, `ano?: string`, `dataGte?: string`, `dataLte?: string`, `createdBy?: string`
**Request Body:** —
**Response:** `PTRBACompleto[]`
**Estado:** ✅ OK

**Payload Response:**
```json
[{
  "id": "uuid",
  "createdBy": "string",
  "createdAt": "string (ISO datetime)",
  "updatedAt": "string (ISO datetime)",
  "data": "string (ISO date)",
  "equipe": "Alfa | Bravo | Charlie | Delta",
  "identificacaoAeroporto": "string",
  "observacoes": "string",
  "chefeEquipe": "string",
  "participantes": [{ "funcao": "string", "nomeCompleto": "string", "situacao": "P | A | EO | OC | INSTR. 1 | INSTR. 2 | INSTR. 3 | INSTR. 1-2 | INSTR. 2-3 | INSTR. 1-3" }],
  "evidencias": [{ "horaInicio": "string", "horaTermino": "string", "assunto": "string", "imagem": "string (base64/url)", "descricao": "string" }]
}]
```

### obterPTRBACompleto / criarPTRBACompleto / atualizarPTRBACompleto / excluirPTRBACompleto

**Método:** GET / POST / PATCH / DELETE
**REST equivalência:** `.../ptrba_completo_registros`
**Estado:** ✅ OK
**Regras:** a tela permite visualização geral, mas criação/edição/exclusão apenas para a equipe efetiva do usuário, ou globalmente para Administradores/GS. O download usa `ptrbaCompletoPdfService.ts` e gera PDF client-side com o layout do modelo PTR-BA completo.

---

# 8. LRO — `lroService.ts`

**Tabela:** `registros_lro`  
**Ficheiro:** `src/services/lroService.ts`  
**Tipo:** `src/types/lro.ts` — `LRO`

---

### listarLROs

**Método HTTP:** GET  
**Estado:** ✅ OK  

**Payload Response (campos principais):**
```json
[{
  "id": "uuid",
  "createdBy": "string",
  "equipe": "string",
  "turno": "string",
  "dataEntrada": "string (ISO date)",
  "dataSaida": "string (ISO date)",
  "chefeEquipe": "string",
  "apoc": "string",
  "cci02Slots": "array",
  "cci03Slots": "array",
  "crsSlots": "array",
  "apoioOutrosSlots": "array",
  "substituicoesAtivo": "boolean",
  "substituicoes": "array",
  "instrucoes": "string",
  "faisca2": "object",
  "faisca3": "object",
  "faiscaRT": "object",
  "crs": "object",
  "situacaoCentralFaisca": "string",
  "situacaoComunicacao": "string",
  "situacaoTPEPR": "string",
  "situacaoAgentesExtintores": "string",
  "situacaoEquipamentos": "string",
  "situacaoEdificacoes": "string",
  "inspecoesTecnicas": "string",
  "emergenciasAeronauticas": "string",
  "outrasOcorrencias": "string",
  "assinatura": "string"
}]
```

### criarLRO / atualizarLRO / excluirLRO

✅ OK  

---

# 9. LRO Drafts — `lroDraftService.ts`

**Tabela:** `lro_drafts`  
**Ficheiro:** `src/services/lroDraftService.ts`

---

### listarDrafts / obterDraft / salvarDraft / atualizarStatus / excluirDraft

**Estado:** ✅ OK (exceto `atualizarStatus` e `excluirDraft` que não verificam erro após operação)

**Payload `LRODraft`:**
```json
{
  "id": "uuid",
  "equipe": "string",
  "data_plantao": "string (ISO date)",
  "status": "rascunho | aguardando | assinado | cancelado | finalizado | arquivado",
  "autentique_doc_id": "string | undefined",
  "dados": "object (conteúdo do draft)",
  "created_by": "string",
  "created_at": "string",
  "updated_at": "string",
  "expires_at": "string"
}
```

---

# 10. Ocorrências — `ocorrenciaService.ts`

**Tabela:** `ocorrencias_operacionais`  
**Ficheiro:** `src/services/ocorrenciaService.ts`  
**Tipo:** `src/types/ocorrencia.ts` — `Ocorrencia`

---

### listarOcorrencias / criarOcorrencia / atualizarOcorrencia

✅ OK  

### excluirOcorrencia

⚠️ BUG — não verifica erro após `delete()`

**Payload `Ocorrencia`:**
```json
{
  "id": "uuid",
  "createdBy": "string",
  "tipoDocumento": "BONA | REA",
  "numero": "string",
  "data": "string (ISO date)",
  "hora": "string",
  "equipe": "string",
  "turno": "string",
  "categoria": "Outros | ...",
  "titulo": "string",
  "descricao": "string",
  "local": "string",
  "envolvidos": "string",
  "acoesTomadas": "string",
  "status": "Aberta | ...",
  "fotos": ["string (compatibilidade; BONA não usa fotos na tela/documento)"],
  "bonaDados": {
    "aeroporto": "string",
    "areaEvento": "string",
    "tipoOcorrencia": "string",
    "bombeiros": [{ "nome": "string", "funcao": "string" }],
    "vitimasFatais": "string",
    "vitimasFeridas": "string",
    "acionamento": "string (HH:mm)",
    "saida": "string (HH:mm)",
    "chegadaLocal": "string (HH:mm)",
    "terminoOcorrencia": "string (HH:mm)",
    "retornoSci": "string (HH:mm)",
    "tempoGastoAtendimento": "string (HH:mm)",
    "descricaoOcorrencia": "string",
    "descricaoAtuacaoEquipe": "string",
    "veiculosUtilizados": "string",
    "agentesLge": "string",
    "agentesPq": "string",
    "outrosRecursosUtilizados": "string"
  }
}
```

**Nota de compatibilidade:** registros antigos com `tipo_documento = "RAE"` são normalizados para `REA` no service.
**Fluxo BONA:** registros BONA ficam com `status = "Aberta"` após salvar e viram `status = "Fechada"` somente quando aprovados nos detalhes do documento; após aprovado, a tela bloqueia alteração do conteúdo, mantém a visualização do documento e libera a impressão somente para BONA finalizado. Apenas administrador do sistema pode excluir BONA aprovado e editar seu número para reaproveitar uma sequência.
**Numeração BONA:** a UI inicia a sequência nova em `BONA-064/{ano}` porque os números 1 a 63 foram emitidos em sistema anterior; quando houver BONA maior no ano corrente, usa o maior número cadastrado + 1. No PDF MMS.BR.BA.FOR.003 aparece somente o número curto da ocorrência.
**Campos BONA:** `bona_dados` guarda os campos específicos do formulário oficial MMS.BR.BA.FOR.003. O service mantém compatibilidade preenchendo `local` com `areaEvento`, `titulo` com `tipoOcorrencia`, `categoria` com a categoria correspondente quando existir (senão `Outros`), `envolvidos` a partir da tabela de bombeiros, `acoes_tomadas` com `descricaoAtuacaoEquipe` e `descricao` com `descricaoOcorrencia`. A tela do BONA não exibe upload de fotos e preenche os bombeiros com o efetivo operacional da equipe/data, considerando trocas, férias e substituições.
**Uso no LRO:** BONA com `numero` iniciado por `BONA` fica listado em BONA/REA e alimenta IX. Ocorrências Não Aeronáuticas com `hora - número BONA - tipo - descrição`; não aparece na tela LRO/Ocorrências. Registros criados em LRO/Ocorrências usam `numero` vazio, `titulo` como tipo, `local` como data do turno e alimentam XII. Outras Ocorrências com `data - hora - equipe - tipo - descrição`. Ao marcar um LRO como `finalizado`, as ocorrências operacionais incluídas no texto final do LRO são atualizadas para `status = "Fechada"` e ficam bloqueadas para edição/exclusão na tela LRO/Ocorrências. Ao excluir um LRO finalizado/assinado/arquivado, as ocorrências vinculadas a ele voltam para `status = "Aberta"`, exceto quando ainda estão vinculadas a outro LRO finalizado/assinado/arquivado.

**`listarOcorrencias` — Query Params adicionais:** `numeroPrefixo?: string` — filtra por `numero like 'prefixo%'` (ex: `'BONA'` traz só BONAs, excluindo registros do LRO/Ocorrências que usam `numero` vazio). **REST equivalência:** `GET /rest/v1/ocorrencias_operacionais?select=*&numero=like.BONA%25&order=data.desc`

---

# 10.1 REA — `reaService.ts`

**Tabela:** `rea_registros`  
**Ficheiro:** `src/services/reaService.ts`  
**Tipo:** `src/types/rea.ts` — `ReaRegistro`

---

### listarReas

**Método HTTP:** GET  
**REST equivalência:** `GET /rest/v1/rea_registros?select=*&order=created_at.desc`  
**Query Params opcionais:** `status`, `equipe`, `dataGte`, `dataLte`  
**Request Body:** —  
**Response:** `ReaRegistro[]`  
**Estado:** ✅ OK  

### obterRea

**Método HTTP:** GET  
**REST equivalência:** `GET /rest/v1/rea_registros?select=*&id=eq.{id}`  
**Request Body:** —  
**Response:** `ReaRegistro | null`  
**Estado:** ✅ OK  

### criarRea

**Método HTTP:** POST  
**REST equivalência:** `POST /rest/v1/rea_registros`  
**Request Body:** `ReaRegistroInput`  
**Response:** `ReaRegistro`  
**Estado:** ✅ OK  

### atualizarRea

**Método HTTP:** PATCH  
**REST equivalência:** `PATCH /rest/v1/rea_registros?id=eq.{id}`  
**Request Body:** `Partial<ReaRegistroInput>`  
**Response:** `ReaRegistro | null`  
**Estado:** ✅ OK  

### excluirRea

**Método HTTP:** DELETE  
**REST equivalência:** `DELETE /rest/v1/rea_registros?id=eq.{id}`  
**Response:** `boolean`  
**Estado:** ✅ OK  

**Payload `ReaRegistro`:**
```json
{
  "id": "uuid",
  "createdBy": "string",
  "createdAt": "string (ISO datetime)",
  "updatedAt": "string (ISO datetime)",
  "numero": "REA-001/2026",
  "status": "Aberta | Fechada",
  "equipe": "string",
  "aerodromo": "string",
  "cidade": "string",
  "dataAcidente": "string (ISO date)",
  "horaAcidente": "string",
  "matricula": "string",
  "empresa": "string",
  "dados": {
    "aerodromo": "string",
    "cidade": "string",
    "dataAcidente": "string",
    "horaLocalAcidente": "string",
    "acidentePeriodo": "Dia | Noite | ''",
    "tipoAeronave": "string",
    "matricula": "string",
    "empresa": "string",
    "...": "demais campos do formulário MMS.BR.BA.FOR.001"
  }
}
```

---

# 11. Chat — `chatService.ts`

**Tabela:** `chat_mensagens`  
**Ficheiro:** `src/services/chatService.ts`  
**Tipo:** `src/types/chat.ts` — `ChatMensagem`

---

### listarMensagens / mensagensGerais / mensagensPrivadas / conversaCom / contarNaoLidas

✅ OK  

`mensagensGerais`, `mensagensPrivadas` e `conversaCom` retornam em ordem cronológica crescente para exibição direta no painel de chat.

### enviarMensagem

✅ OK  

### marcarLida

⚠️ BUG — não verifica erro após `update()`

**Payload `ChatMensagem`:**
```json
{
  "id": "uuid",
  "de": "string (username)",
  "deNome": "string",
  "para": "string | null",
  "paraNome": "string | null",
  "texto": "string",
  "lida": "boolean",
  "createdAt": "string (ISO datetime)"
}
```

---

# 12. Documentos — `documentoService.ts`

**Tabelas:** `documents`, `document_fields`, `document_signers`, `document_fills`  
**Storage:** Bucket `document-pdfs`  
**Ficheiro:** `src/services/documentoService.ts`  
**Tipo:** `src/types/document.ts` — `Document`, `DocumentField`, `DocumentSigner`, `DocumentFill`

Completo — ~25 funções CRUD + Storage. **O serviço mais completo do sistema.**  
**Estado:** ✅ OK  

---

### listarDocumentos

**Método HTTP:** GET  
**REST:** `GET /rest/v1/documents?select=*&active=eq.true&order=created_at.desc`

**Payload `Document`:**
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "category": "string",
  "template_pdf_url": "string | null",
  "active": "boolean",
  "created_at": "string (ISO datetime)",
  "updated_at": "string (ISO datetime)"
}
```

---

### buscarDocumento

GET com joins: busca `document` + `document_fields` + `document_signers` em paralelo. ✅ OK

**Payload `DocumentWithFields`:**
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "category": "string",
  "template_pdf_url": "string",
  "active": "boolean",
  "created_at": "string",
  "updated_at": "string",
  "document_fields": [{
    "id": "uuid",
    "document_id": "uuid",
    "field_name": "string",
    "field_label": "string",
    "field_type": "text | select | date | textarea",
    "required": "boolean",
    "placeholder": "string",
    "options": "jsonb | null",
    "order_index": "number",
    "page": "number",
    "x": "number",
    "y": "number",
    "width": "number",
    "height": "number",
    "font_size": "number",
    "data_source": "manual | ...",
    "is_signature": "boolean",
    "signer_role": "string | null",
    "read_only": "boolean",
    "conditional_on": "string | null",
    "created_at": "string"
  }],
  "document_signers": [{
    "id": "uuid",
    "document_id": "uuid",
    "signer_name": "string",
    "signer_role": "string",
    "order_index": "number",
    "required": "boolean",
    "created_at": "string"
  }]
}
```

---

### criarDocumento / atualizarDocumento / excluirDocumento

✅ OK  

### criarCampo / criarCamposEmLote / sincronizarCamposTemplate / atualizarCampo / excluirCampo / listarCampos

✅ OK  

### criarSignatario / atualizarSignatario / excluirSignatario / listarSignatarios

✅ OK  

### criarPreenchimento / listarPreenchimentos / atualizarPreenchimento / excluirPreenchimento

✅ OK  

**Payload `DocumentFill`:**
```json
{
  "id": "uuid",
  "document_id": "uuid",
  "filled_by": "uuid | null",
  "filled_data": "jsonb",
  "status": "draft | pending | signed | cancelled | archived",
  "autentique_document_id": "string | null",
  "autentique_link": "string | null",
  "created_at": "string",
  "updated_at": "string"
}
```

---

### Storage: uploadPDF / getPdfDownloadUrl / getPdfBlob / excluirPdf / listarPdfsStorage

✅ OK (bucket `document-pdfs`, com signed URLs de 1h)

---

# 13. APOCs — `apocService.ts`

**Tabela:** `apocs`  
**Ficheiro:** `src/services/apocService.ts`  
**Tipo:** `src/types/apoc.ts` — `APOC`

---

### listarAPOCs / buscarAPOC / criarAPOC / atualizarAPOC / excluirAPOC

✅ OK

### listarAPOCsPublico

**Método HTTP:** GET
**REST equivalência:** `GET /rest/v1/apocs?select=id,nome_completo,nome_guerra,funcao,equipe,created_at,updated_at&order=created_at.desc`
**Query Params:** (nenhum)
**Request Body:** —
**Response:** `APOC[]` com `email` preenchido como vazio no mapper
**Estado:** ✅ OK
**Uso:** listagem geral de funcionários para usuários sem permissão de dados pessoais.

### buscarAPOCPublico

**Método HTTP:** GET
**REST equivalência:** `GET /rest/v1/apocs?select=id,nome_completo,nome_guerra,funcao,equipe,created_at,updated_at&or=(nome_completo.ilike.%termo%,nome_guerra.ilike.%termo%)`
**Query Params:** `termo: string`
**Request Body:** —
**Response:** `APOC[]` com `email` preenchido como vazio no mapper
**Estado:** ✅ OK
**Uso:** busca pública na aba Funcionários > Todos, sem e-mail.

**Payload `APOC`:**
```json
{
  "id": "uuid",
  "nomeCompleto": "string",
  "nomeGuerra": "string",
  "email": "string",
  "funcao": "APOC | APOC Lider",
  "equipe": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

# 14. Viaturas — `viaturaService.ts`

**Tabela:** `viaturas`  
**Ficheiro:** `src/services/viaturaService.ts`  
**Tipo:** `src/types/viatura.ts` — `Viatura`

---

### listarViaturas / criarViatura / atualizarViatura / excluirViatura

✅ OK  

**Payload `Viatura` (parcial — campos principais):**
```json
{
  "id": "uuid",
  "prefixo": "string",
  "placa": "string",
  "renavam": "string",
  "tipo": "CCI | CRS | Apoio | Administrativa",
  "tipoCCI": "CCI-2 | CCI-3",
  "categoriaCAT": "CAT A | CAT B",
  "status": "Operacional | Manutencao | Inativo",
  "marca": "string",
  "modelo": "string",
  "ano": "string",
  "quilometragem": "string",
  "horasMotor": "string",
  "capacidadeAgua": "string",
  "capacidadeLGE": "string",
  "observacoes": "string"
}
```

---

# 14.1. Panes de Viaturas — `viaturaPaneService.ts`

**Tabela:** `viatura_panes`  
**Ficheiro:** `src/services/viaturaPaneService.ts`  
**Tipo:** `src/types/viatura.ts` — `ViaturaPane`

---

### listarPanes / criarPane / atualizarPane / excluirPane / listarTodasPanes

✅ OK

**Payload `ViaturaPane`:**
```json
{
  "id": "uuid",
  "viaturaId": "uuid",
  "descricao": "string",
  "status": "Aberta | Resolvida",
  "criadoPor": "string",
  "criadoPorNome": "string",
  "resolvidaPor": "string",
  "resolvidaPorNome": "string",
  "dataResolucao": "string",
  "relatoConserto": "string",
  "createdAt": "string"
}
```

---

# 15. Extintores — `extintorService.ts`

**Tabela:** `extintores`  
**Ficheiro:** `src/services/extintorService.ts`  
**Tipo:** `src/types/extintor.ts` — `Extintor`

---

### listarExtintores / criarExtintor / atualizarExtintor / excluirExtintor

✅ OK  

**Payload `Extintor`:**
```json
{
  "id": "uuid",
  "numeroSerie": "string",
  "tipo": "ABC | BC | CO2 | ...",
  "capacidade": "string",
  "dataFabricacao": "string",
  "seloInmetro": "Sim | Nao",
  "numeroExtintor": "string",
  "localizacao": "string",
  "status": "Ativo | Vencido | Manutencao",
  "intervaloConferencia": "3 | 6 | 12",
  "observacoes": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

# 15.1. Agentes Extintores — `agenteExtintorService.ts`

**Tabela:** `agentes_extintores`
**Ficheiro:** `src/services/agenteExtintorService.ts`
**Tipo:** `src/types/agenteExtintor.ts` — `AgenteExtintor`

---

### listarAgentesExtintores / criarAgenteExtintor / atualizarAgenteExtintor / excluirAgenteExtintor

✅ OK

**Regras UI:** todos podem visualizar a listagem. Criar/editar/excluir fica restrito a Administradores/GS ou `BA-CE`/`BA-LR` exercendo função na equipa `Alfa`.

**Payload `AgenteExtintor`:**
```json
{
  "id": "uuid",
  "nome": "string",
  "tipo": "LGE | PQS | Nitrogenio | CO2 | Outro",
  "quantidade": 0,
  "unidade": "L | kg | cilindro | unidade",
  "lote": "string",
  "validade": "string (ISO date)",
  "localizacao": "string",
  "status": "Disponivel | Baixo estoque | Vencido | Em manutencao | Fora de uso",
  "observacoes": "string",
  "createdBy": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

# 16. Hidrantes — `hidranteService.ts`

**Tabela:** `hidrantes`  
**Ficheiro:** `src/services/hidranteService.ts`  
**Tipo:** `src/types/hidrante.ts` — `Hidrante`

---

### listarHidrantes / criarHidrante / atualizarHidrante / excluirHidrante

✅ OK  

**Payload `Hidrante`:**
```json
{
  "id": "uuid",
  "numero": "string",
  "tipo": "Seco | Molhado",
  "localizacao": "string",
  "pressao": "string",
  "status": "Ativo | Inativo | Manutencao",
  "intervaloConferencia": "3 | 6 | 12",
  "observacoes": "string"
}
```

---

# 17. Conferências — `conferenciaService.ts`

**Tabela:** `conferencias`  
**Ficheiro:** `src/services/conferenciaService.ts`  
**Tipo:** `src/types/conferencia.ts` — `Conferencia`

---

### listarConferencias / criarConferencia / atualizarConferencia / excluirConferencia

✅ OK

**Payload `Conferencia`:**
```json
{
  "id": "uuid",
  "tipo": "extintor | hidrante | ...",
  "itemId": "string",
  "itemNome": "string",
  "itemNumero": "string",
  "itemLocalizacao": "string",
  "dataConferencia": "string (ISO date)",
  "inspetorUsername": "string",
  "inspetorNomeGuerra": "string",
  "inspetorCargo": "string",
  "equipe": "Alfa | Bravo | Charlie | Delta | Ferista",
  "itens": [checklist items],
  "resultadoFinal": "Aprovado | Reprovado | ...",
  "observacoes": "string",
  "dataProximaInspecao": "string (ISO date)"
}
```

**Uso no LRO:** em registros de `Solicitação` e `Inspeção Operacional`, `itemNome` guarda o tipo informado no formulário e `dataProximaInspecao` guarda a data do turno. O gerador de LRO usa esses campos para preencher, respectivamente, XIII. Solicitações e X. Inspeções no formato `data - hora - equipe - tipo - descrição`.

---

# 17.1. Checklists — `checklistService.ts`

**Tabela:** `checklists`
**Ficheiro:** `src/services/checklistService.ts`
**Tipo:** `src/types/checklist.ts` — `Checklist`

---

### listarChecklists / criarChecklist / atualizarChecklist / excluirChecklist

✅ OK

O front usa o adapter HTTP em `/data/checklists/*`. A tabela mantém os campos fixos `titulo`, `descricao`, `tipo`, `created_by`, `created_at` e `updated_at`; o conteúdo editável do checklist fica em `itens` como JSONB para permitir modelos quinzenais e personalizados sem migration a cada alteração.

**Payload `Checklist`:**
```json
{
  "id": "uuid",
  "titulo": "string",
  "descricao": "string",
  "tipo": "quinzenal | personalizado",
  "data": "string (ISO date)",
  "equipe": "Alfa | Bravo | Charlie | Delta | Ferista",
  "responsavel": "string",
  "status": "pendente | concluido",
  "payload": {
    "mes": 8,
    "ano": 2026,
    "quinzena": "1 | 2",
    "colunas": [
      { "id": "dia-1", "label": "01", "type": "check", "dia": 1, "fixa": true }
    ],
    "linhas": [
      {
        "id": "modelo-1",
        "secao": "ESTAÇÕES DE RÁDIO",
        "quantidade": "1",
        "item": "Rádio fixo",
        "valores": { "dia-1": false }
      }
    ]
  },
  "createdBy": "string"
}
```

**JSONB `itens` na tabela:**
```json
{
  "meta": {
    "data": "2026-08-01",
    "equipe": "Delta",
    "responsavel": "Alexandre",
    "status": "pendente",
    "mes": 8,
    "ano": 2026,
    "quinzena": "1"
  },
  "colunas": [],
  "linhas": []
}
```

---

# 18. Certificações NR — `certificacaoService.ts`

**Tabela:** `certificacoes_nr`  
**Ficheiro:** `src/services/certificacaoService.ts`  
**Tipo:** `src/types/certificacao.ts` — `CertificacaoNR`

---

### listarCertificacoes

**Método HTTP:** GET
**REST equivalência:** `GET /rest/v1/certificacoes_nr?select=*` com filtro opcional `funcionario_id=in.(...)`
**Query Params:** `funcionarioIds?: string[]`
**Response:** `CertificacaoNR[]`
**Estado:** ✅ OK

### certificacoesPorFuncionario / criarCertificacao / atualizarCertificacao

✅ OK  

### excluirCertificacao

⚠️ BUG — não verifica erro após `delete()`

**Payload `CertificacaoNR`:**
```json
{
  "id": "uuid",
  "funcionarioId": "string",
  "funcionarioNome": "string",
  "nrNumero": "string",
  "nrNome": "string",
  "dataEmissao": "string (ISO date)",
  "dataValidade": "string (ISO date)",
  "empresa": "string",
  "arquivo": "string (url)",
  "tipoArquivo": "image | pdf",
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

# 19. Certificações Cursos — `certificacaoCursoService.ts`

**Tabela:** `certificacoes_cursos`  
**Ficheiro:** `src/services/certificacaoCursoService.ts`  
**Tipo:** `src/types/certificacaoCurso.ts` — `CertificacaoCurso`

---

### listarCertificacoesCursos

**Método HTTP:** GET
**REST equivalência:** `GET /rest/v1/certificacoes_cursos?select=*` com filtro opcional `funcionario_id=in.(...)`
**Query Params:** `funcionarioIds?: string[]`
**Response:** `CertificacaoCurso[]`
**Estado:** ✅ OK

### certificacoesCursosPorFuncionario / criarCertificacaoCurso

✅ OK  

### excluirCertificacaoCurso

⚠️ BUG — não verifica erro após `delete()`

**Payload `CertificacaoCurso`:**
```json
{
  "id": "uuid",
  "funcionarioId": "string",
  "funcionarioNome": "string",
  "cursoTipo": "string",
  "cursoNome": "string",
  "dataEmissao": "string (ISO date)",
  "dataValidade": "string (ISO date)",
  "semValidade": "boolean",
  "empresa": "string",
  "arquivo": "string (url)",
  "tipoArquivo": "image | pdf"
}
```

---

# 20. Equipamentos — `equipamentoService.ts`

**Tabela:** `equipamentos_operacionais`  
**Ficheiro:** `src/services/equipamentoService.ts`  
**Tipo:** `src/types/equipamento.ts` — `Equipamento`

---

### listarEquipamentos / equipamentosPorCategoria / criarEquipamento

✅ OK  

### atualizarEquipamento

⚠️ BUG — retorna `void` em vez do registo atualizado. Não faz `.select()` após o update. Não verifica erro.

### excluirEquipamento

⚠️ BUG — não verifica erro após `delete()`

**Payload `Equipamento`:**
```json
{
  "id": "uuid",
  "nome": "string",
  "descricao": "string",
  "categoria": "dea | extintor | mangueira | ...",
  "marca": "string",
  "modelo": "string",
  "numeroSerie": "string",
  "dataAquisicao": "string",
  "dataValidade": "string",
  "vidaUtilMeses": "string",
  "responsavel": "string",
  "localizacao": "string",
  "status": "Operacional | Inativo | Manutencao",
  "observacoes": "string"
}
```

---

# 21. EPIs — `epiService.ts`

**Tabela:** `epis`  
**Ficheiro:** `src/services/epiService.ts`  
**Tipo:** `src/types/epi.ts` — `EPI`

---

### listarEPIs / criarEPI / atualizarEPI / excluirEPI

⚠️ **Todas as funções usam `console.error()` silencioso — erros não são propagados.** Retornam `[]` ou `null` em vez de lançar exceção.

### pagarEPI / enviarAutentiqueEPI / assinarEPI / devolverEPI

✅ OK (wrappers para `atualizarEPI`)

**Payload `EPI`:**
```json
{
  "id": "uuid",
  "createdBy": "string",
  "createdAt": "string",
  "updatedAt": "string",
  "nome": "string",
  "descricao": "string",
  "colaborador": "string",
  "colaboradorId": "string",
  "entreguePor": "string",
  "ca": "string",
  "dataPagamento": "string (ISO date)",
  "dataValidade": "string (ISO date)",
  "fornecedor": "string",
  "notas": "string",
  "status": "pago | enviado_autentique | assinado | devolvido",
  "dataEnvioAutentique": "string",
  "dataAssinatura": "string",
  "dataDevolucao": "string",
  "dataFabricacao": "string",
  "tamanho": "string",
  "numeroSerie": "string",
  "estado": "Novo | Usado"
}
```

---

# 22. EPIs Estoque — `epiEstoqueService.ts`

**Tabela:** `epis_estoque`  
**Ficheiro:** `src/services/epiEstoqueService.ts`  
**Tipo:** `src/types/epi.ts` — `EPIEstoque`

---

### listarEstoque / criarEstoque / atualizarEstoque / excluirEstoque

⚠️ **Erros silenciosos** (mesmo padrão do epiService)

### baixarEstoque / reporEstoque

⚠️ **Ineficiente** — faz `listarEstoque()` completa para encontrar o item por id em vez de fazer query direta.

**Payload `EPIEstoque`:**
```json
{
  "id": "uuid",
  "nome": "string",
  "descricao": "string",
  "ca": "string",
  "fornecedor": "string",
  "quantidade": "number",
  "dataFabricacao": "string",
  "tempoValidadeMeses": "number",
  "dataValidade": "string",
  "tamanho": "string",
  "numeroSerie": "string",
  "estado": "Novo | Usado",
  "notas": "string",
  "createdBy": "string",
  "createdAt": "string",
  "updatedAt": "string"
}
```

---

# 23. Convites — `conviteService.ts`

**Tabela:** `convites`  
**Ficheiro:** `src/services/conviteService.ts`  
**Tipo:** Definição inline — `Convite`

---

### criarConvite / validarConvite / usarConvite / listarConvites

⚠️ **Fallback para localStorage se Supabase falhar.** Em ambiente sem conectividade, os convites existem apenas no browser.

**Payload `Convite`:**
```json
{
  "codigo": "string (8 chars alfanuméricos)",
  "usado": "boolean",
  "createdAt": "string (ISO datetime)",
  "expiresAt": "string (ISO datetime, +2h)",
  "usadoEm": "string (ISO datetime) | undefined",
  "registradoPor": "string | undefined"
}
```

---

# 24. Usuários — `usuarioService.ts`

**Tabela:** `usuarios`  
**RPCs:** `verificar_senha`, `criar_usuario_com_hash`, `atualizar_senha`  
**Ficheiro:** `src/services/usuarioService.ts`  
**Tipo:** Definição inline — `Usuario`

---

### listarUsuarios

GET ✅ OK  

**Payload `Usuario`:**
```json
{
  "id": "uuid",
  "username": "string",
  "name": "string",
  "role": "desenvolvedor | admin | gerente | chefe_equipe | bombeiro | embaixador",
  "previousRole": "string | undefined",
  "personId": "string | undefined",
  "personType": "bombeiro | apoc | undefined",
  "createdAt": "string (ISO datetime)",
  "updatedAt": "string (ISO datetime)"
}
```

---

### buscarUsuarioPorUsername

GET com `.single()`. Trata erro `PGRST116` (não encontrado) corretamente. ✅ OK  

### verificarSenha

RPC `verificar_senha(p_username, p_password)`. Retorna `Usuario | null`. ✅ OK  

### criarUsuarioComHash

RPC `criar_usuario_com_hash(p_username, p_name, p_password, p_role, ...)`. ✅ OK  

### atualizarSenha

RPC `atualizar_senha(p_username, p_password)`. Retorna `boolean`. ✅ OK  

### criarUsuario

**Estado atual (2026-07-22):** usa `criarUsuarioComHash` e grava a senha via RPC `criar_usuario_com_hash`. Leituras normais usam `USER_SELECT` e não retornam colunas sensíveis (`password`, `senha_hash`). A migration `036_harden_usuario_sensitive_columns.sql` restringe `SELECT` direto da tabela `usuarios` às colunas públicas.

**Histórico:** este endpoint antes ignorava `password`; corrigido para usar RPC com hash.

### atualizarUsuario

**Estado atual (2026-07-22):** atualiza apenas campos permitidos (`name`, `role`, `previousRole`, `personId`, `personType`, `username`) e retorna `USER_SELECT` sem colunas sensíveis.

**Histórico:** antes aceitava campos duplicados; corrigido para mapear apenas camelCase esperado pelo serviço.

### excluirUsuario

✅ OK  

---

# 25. Vigência de Substituições — `vigenciaSubstituicaoService.ts`

**Tabela:** `vigencia_substituicoes`  
**Ficheiro:** `src/services/vigenciaSubstituicaoService.ts`  
**Tipo:** Definição inline — `VigenciaSubstituicao`

**Descrição:** Tabela central que regista quem está efetivamente a exercer cada função durante períodos de férias e substituições em cascata. Resolve o problema de: A (férias) → B substitui A → vaga de B → C substitui B.

---

### listarVigencias

**Método HTTP:** GET  
**REST equivalência:** `GET /rest/v1/vigencia_substituicoes?select=*&order=nivel_cascata.asc`  
**Query Params opcionais:** `equipe?`, `dataInicio?`, `dataFim?`, `ativa?`, `substitutoId?`, `feriasId?`  
**Request Body:** —  
**Response:** `VigenciaSubstituicao[]`  
**Estado:** ✅ OK  

**Payload Response:**
```json
[{
  "id": "uuid",
  "substitutoId": "string (quem está a substituir)",
  "substitutoNome": "string",
  "cargoOriginalSubstituto": "string (cargo real da pessoa)",
  "cargoExercido": "string (cargo que está a exercer)",
  "funcionarioOriginalId": "string (quem está a ser coberto)",
  "funcionarioOriginalNome": "string",
  "cargoOriginalFuncionario": "string",
  "equipe": "string (equipa onde está efetivo)",
  "dataInicio": "string (ISO date)",
  "dataFim": "string (ISO date)",
  "nivelCascata": "number (1=substituto direto, 2+=cascata)",
  "motivo": "ferias | afastamento | substituicao | cascata",
  "feriasId": "string | '' (FK para o registo de férias original)",
  "ativa": "boolean",
  "createdAt": "string (ISO datetime)"
}]
```

---

### criarVigencia

**Método HTTP:** POST  
**REST equivalência:** `POST /rest/v1/vigencia_substituicoes`  
**Request Body:** `Omit<VigenciaSubstituicao, 'id' | 'createdAt'>`  
**Response:** `VigenciaSubstituicao`  
**Estado:** ✅ OK  

---

### desativarVigencias / desativarVigenciasPorSubstituto

**Método HTTP:** PATCH  
**REST equivalência:** `PATCH /rest/v1/vigencia_substituicoes?ferias_id=eq.{feriasId}`  
**Request Body:** `{ ativa: false }`  
**Estado:** ✅ OK  

---

### processarCascata

**Método:** Lógica (não é um endpoint REST direto)  
**Descrição:** Algoritmo que, dado um registo de férias com substituto:
1. Regista o substituto direto (nível 1) na `vigencia_substituicoes`
2. Verifica se o substituto também está de férias → regista o substituto do substituto (nível 2, cascata)
3. Se o substituto é de outra equipa, regista vaga pendente na equipa de origem

**Input:**
```json
{
  "id": "uuid (ferias.id)",
  "funcionarioId": "string",
  "funcionarioNome": "string",
  "equipe": "string",
  "substitutoId": "string",
  "substitutoNome": "string",
  "funcaoSubstituicao": "string",
  "dataInicio": "string (ISO date)",
  "dataFim": "string (ISO date)"
}
```

**Output:** `VigenciaSubstituicao[]` (todas as vigências criadas pela cascata)  
**Estado:** ✅ OK  

**Comportamento Detalhado:**
```
funcionario A (ex: BA-MC) sai de férias
  → B (ex: BA-2) é o substituto direto
  → Regista: B substitui A, B assume BA-MC (nível 1)
  → Verifica se B está de férias também
    → Se sim: C (substituto de B) assume BA-2, C fica na equipa (nível 2)
  → Se B é de outra equipa: regista vaga de B na equipa de origem
```

---

### resolverEfetivo

**Método:** Lógica (cálculo)  
**Descrição:** Devolve o efetivo REAL de uma equipa numa data específica, considerando todas as substituições.  
**Input:** `equipe: string`, `data: string (ISO date)`  
**Output:**
```json
{
  "efetivos": [{ "bombeiro": "Bombeiro", "cargoExercido": "string", "substituindo": "object | null", "emFerias": "boolean", "vigencias": "VigenciaSubstituicao[]" }],
  "substitutosExternos": [{ ... }]
}
```
**Estado:** ✅ OK  

---

### quemSubstitui

**Método HTTP:** GET (consulta)  
**REST equivalência:** `GET /rest/v1/vigencia_substituicoes?select=*&funcionario_original_id=eq.{bombeiroId}&ativa=eq.true`  
**Descrição:** Dado um bombeiro e uma data, retorna quem o está a substituir (se aplicável).  
**Estado:** ✅ OK  

---

# 26. Vagas Pendentes — `vagaPendenteService.ts`

**Tabela:** `vagas_pendentes`  
**Ficheiro:** `src/services/vagaPendenteService.ts`

**Descrição:** Regista vagas deixadas por substitutos que saíram da sua função original para cobrir férias. Quando um BA-2 de outra equipa substitui um BA-MC, a vaga de BA-2 precisa de ser preenchida.

---

### listarVagasPendentes

**Método HTTP:** GET  
**REST equivalência:** `GET /rest/v1/vagas_pendentes?select=*&order=created_at.desc`  
**Query Params opcionais:** `equipe?`, `resolvido?`  
**Response:** `VagaPendente[]`  
**Estado:** ✅ OK  

**Payload:**
```json
[{
  "id": "uuid",
  "equipe": "string (equipa onde a vaga existe)",
  "cargo": "string (cargo vago)",
  "dataInicio": "string (ISO date)",
  "dataFim": "string (ISO date)",
  "funcionarioAusenteId": "string (quem saiu)",
  "funcionarioAusenteNome": "string",
  "motivo": "ferias | cascata | outra_equipe",
  "cadeiaFeriasId": "string (ferias_id original)",
  "preenchidoPorId": "string | '' (quem preencheu)",
  "preenchidoPorNome": "string | ''",
  "resolvido": "boolean",
  "createdAt": "string (ISO datetime)"
}]
```

### criarVagaPendente / resolverVaga / tentarPreencherVagasAuto

✅ OK  

---

# 27. Autentique — `autentiqueService.ts`

**API externa:** Autentique (assinatura digital) via GraphQL  
**Proxy:** `/api/autentique-proxy` (Vercel serverless)  
**Ficheiro:** `src/services/autentiqueService.ts`

---

### criarDocumento / criarDocumentoComPasta

**Método:** GraphQL Mutation `createDocument` com upload de PDF  
**Estado:** ✅ OK  

### criarPasta / listarPastas / buscarOuCriarPasta

**Método:** GraphQL Mutation/Query  
**Estado:** ✅ OK  

### garantirEstruturaPastas

Cria hierarquia: `Sistema SCI / {tipo} / {ano} / {mes}`  
**Estado:** ✅ OK  

### buscarDocumento / listarDocumentos / listarDocumentosDaPasta

**Método:** GraphQL Queries  
**Estado:** ✅ OK  

### sincronizarStatusDocumento / sincronizarStatusDocumentoPorID

Polling do estado do documento no Autentique. Actualiza `document_fills.status`.  
**Estado:** ✅ OK  

---

# 28. Notificações — `notificacaoService.ts`

**Ficheiro:** `src/services/notificacaoService.ts`  
**Tipo:** Computed — busca dados reais via serviços, guarda resultado em localStorage

---

### getStored / saveStored / marcarLida / marcarTodasLidas / getNaoLidas / limparLidas

⚠️ **Operam exclusivamente em localStorage** (`sescinc-notificacoes`). As notificações são calculadas chamando serviços reais (`listarAtivos`, `listarEPIs`, etc.) e os resultados são cacheados localmente.

---

# Anexo A — Bugs Conhecidos

**Estado atual (2026-07-22):** os itens antigos sobre `usuarioService.criarUsuario`, `usuarioService.atualizarUsuario`, `substituicaoService` com `.single()`, `bombeiroService.listarAtivos` e `equipamentoService.atualizarEquipamento` já foram corrigidos no código atual. As pendências reais ainda devem ser revisadas antes de uma limpeza final deste anexo.

| # | Severidade | Ficheiro | Função | Problema |
|---|---|---|---|---|
| 1 | ✅ RESOLVIDO | `usuarioService.ts` | `criarUsuario` | Usa RPC `criar_usuario_com_hash`; login com usuário criado via serviço funciona |
| 2 | ✅ RESOLVIDO | `substituicaoService.ts` | `substituicaoPorSubstituto`, `substituicaoPorFuncionario` | Queries usam `.maybeSingle()` e tratam erro com `handleSupabaseError` |
| 3 | ✅ RESOLVIDO | `bombeiroService.ts` | `listarAtivos` | Filtro considera `data_desligamento` nulo ou vazio |
| 4 | ✅ RESOLVIDO | `equipamentoService.ts` | `atualizarEquipamento` | Retorna registro atualizado via `.select().single()` |
| 5 | 🟡 MÉDIO | `epiEstoqueService.ts:110,117` | `baixarEstoque`, `reporEstoque` | Faz `listarEstoque()` completo para encontrar item por id |
| 6 | 🟡 MÉDIO | `epiService.ts`, `epiEstoqueService.ts` | Vários | Erros silenciosos (`console.error` em vez de `handleSupabaseError`) |
| 7 | 🟢 LEVE | `certificacaoService.ts`, `certificacaoCursoService.ts`, `ocorrenciaService.ts`, `equipamentoService.ts`, `lroDraftService.ts`, `chatService.ts`, `substituicaoService.ts` | `excluir*`, `atualizarStatus`, `marcarLida` | Não verificam erro após operação de escrita |
| 8 | ✅ RESOLVIDO | `usuarioService.ts` | `atualizarUsuario` | Mapeia apenas campos permitidos e retorna `USER_SELECT` |

---

# Anexo B — Dead Code

### Store RTK Query (10 ficheiros)

Todos em `src/store/api/*.ts`. Usam `fakeBaseQuery()` com localStorage. **Nunca são chamados por nenhum componente.**

| Ficheiro | `createApi` com | Storage Key |
|----------|----------------|-------------|
| `baseApi.ts` | `fakeBaseQuery()` | — (base) |
| `bombeiroApi.ts` | `fakeBaseQuery()` | `sescinc-bombeiros` |
| `apocApi.ts` | `fakeBaseQuery()` | `sescinc-apoc` |
| `viaturaApi.ts` | `fakeBaseQuery()` | `sescinc-viaturas` |
| `epiApi.ts` | `fakeBaseQuery()` | `sescinc-epis` |
| `ocorrenciaApi.ts` | `fakeBaseQuery()` | `sescinc-ocorrencias` |
| `lroApi.ts` | `fakeBaseQuery()` | `sescinc-lros` |
| `ptrbApi.ts` | `fakeBaseQuery()` | `sescinc-ptrbs` |
| `escalaApi.ts` | `fakeBaseQuery()` | `sescinc-escalas-diarias` |
| `feriasApi.ts` | `fakeBaseQuery()` | `sescinc-ferias` |
| `certificacaoApi.ts` | `fakeBaseQuery()` | `sescinc-certificacoes` |
| `chatApi.ts` | `fakeBaseQuery()` | `sescinc-chat` |

### Stubs em feriasService.ts

`listarFerias()`, `alertasVencimento()`, `criarFerias()`, `atualizarFerias()`, `excluirFerias()` — funções legacy que não interagem com a BD.

---

# 27. Exercício de Posicionamento — `exercicioPosicionamentoService.ts`

**Tabela:** `exercicios_posicionamento`  
**Ficheiro:** `src/services/exercicioPosicionamentoService.ts`  
**Tipo:** `src/types/exercicioPosicionamento.ts` — `ExercicioPosicionamento`

**Migration:** `supabase/migrations/033_exercicios_posicionamento.sql` + `backend/database/migrations/055_aprovacao_posicionamento_tempo_resposta.sql` + `backend/database/migrations/056_exercicio_posicionamento_gerente.sql`

---

### listarExercicios

**Método HTTP:** GET  
**REST equivalência:** `GET /rest/v1/exercicios_posicionamento?select=*&order=numero.desc`  
**Request Body:** —  
**Filtros opcionais:** `equipe`, `ano`  
**Response:** `ExercicioPosicionamento[]`  
**Estado:** ✅ OK  

**Payload Response:**
```json
[{
  "id": "uuid",
  "equipe": "Alfa",
  "numero": 1,
  "ano": "2026",
  "data": "2026-07-21",
  "hora": "14:30",
  "local": "Pátio de Manobras",
  "faisca2BaMc": "João",
  "faisca2BaCe": "Maria",
  "faisca2Ba2": "Pedro",
  "faisca2Tempo": "01:30",
  "faisca3BaMc": "Carlos",
  "faisca3Ba21": "Ana",
  "faisca3Ba22": "Lucas",
  "faisca3Tempo": "02:15",
  "crsBaMc": "Paulo",
  "crsBaLr": "José",
  "crsBaRe1": "Rita",
  "crsBaRe2": "Sara",
  "crsTempo": "01:45",
  "operadorComunicacoes": "APOC João",
  "observacoes": "...",
  "coordenacaoTwrCoeSci": "...",
  "comunicacaoFraseologia": "...",
  "procedimentosPcinc": "...",
  "feedbackTwr": "...",
  "resumoExercicio": "...",
  "acionamento": "...",
  "deslocamentoVtrs": "...",
  "tempoResposta": "...",
  "feedbackSci": "...",
  "consideracoesFinais": "...",
  "sistemaAlarmes": "...",
  "visibilidadeSuperficie": "...",
  "feedbackCoe": "...",
  "chefeEquipe": "Chefe",
  "gerente": "GS",
  "status": "Rascunho",
  "aprovadoPor": "",
  "aprovadoPorNome": "",
  "aprovadoEm": "",
  "createdAt": "2026-07-21T14:30:00.000Z",
  "updatedAt": "2026-07-21T14:30:00.000Z"
}]
```

---

### obterExercicio

**Método HTTP:** GET  
**REST equivalência:** `GET /rest/v1/exercicios_posicionamento?select=*&id=eq.{id}`  
**Request Body:** —  
**Response:** `ExercicioPosicionamento \| null`  
**Estado:** ✅ OK  

---

### obterProximoNumero

**Método HTTP:** GET (custom)  
**REST equivalência:** `GET /rest/v1/exercicios_posicionamento?select=numero&ano=eq.{ano}&order=numero.desc&limit=1`  
**Request Body:** —  
**Parâmetros:** `ano: string`  
**Response:** `number` (último número + 1, ou 1 se for o primeiro do ano)  
**Estado:** ✅ OK  

---

### criarExercicio

**Método HTTP:** POST  
**REST equivalência:** `POST /rest/v1/exercicios_posicionamento`  
**Request Body:** `ExercicioPosicionamentoInput`
**Response:** `ExercicioPosicionamento` (created)  
**Estado:** ✅ OK  

---

### atualizarExercicio

**Método HTTP:** PATCH  
**REST equivalência:** `PATCH /rest/v1/exercicios_posicionamento?id=eq.{id}`  
**Request Body:** `Partial<ExercicioPosicionamentoInput>`
**Response:** `ExercicioPosicionamento \| null` (updated)  
**Estado:** ✅ OK  

---

### excluirExercicio

**Método HTTP:** DELETE  
**REST equivalência:** `DELETE /rest/v1/exercicios_posicionamento?id=eq.{id}`  
**Request Body:** —  
**Response:** `boolean`  
**Estado:** ✅ OK  

**Mapping snake_case ↔ camelCase:** ✅ Completo (inclui `gerente`, `status`, `aprovadoPor`, `aprovadoPorNome`, `aprovadoEm`)

**PDF:** `exercicioPosicionamentoPdfService.ts` gera client-side o formulário MMS.BR.BA.FOR.006 para visualização e impressão após aprovação.

---

# 28. Treinamento Tempo Resposta — `tempoRespostaService.ts`

**Tabela:** `treinamentos_tempo_resposta`  
**Ficheiro:** `src/services/tempoRespostaService.ts`  
**Tipo:** `src/types/tempoResposta.ts` — `TreinamentoTempoResposta`

**Migration:** `supabase/migrations/034_treinamentos_tempo_resposta.sql` + `backend/database/migrations/055_aprovacao_posicionamento_tempo_resposta.sql`

---

### listarTreinos

**Método HTTP:** GET  
**REST equivalência:** `GET /rest/v1/treinamentos_tempo_resposta?select=*&order=numero.desc`  
**Filtros opcionais:** `equipe`, `ano`  
**Response:** `TreinamentoTempoResposta[]`  
**Estado:** ✅ OK  

---

### obterTreino

**Método HTTP:** GET (by id)  
**Estado:** ✅ OK  

---

### obterProximoNumero

**Método HTTP:** GET (custom)  
**Parâmetros:** `ano: string`  
**Response:** `number`  
**Estado:** ✅ OK  

---

### criarTreino

**Método HTTP:** POST  
**Request Body:** `TreinamentoTempoRespostaInput`
**Estado:** ✅ OK  

---

### atualizarTreino

**Método HTTP:** PATCH  
**Request Body:** `Partial<TreinamentoTempoRespostaInput>`
**Estado:** ✅ OK  

---

### excluirTreino

**Método HTTP:** DELETE  
**Estado:** ✅ OK  

**Mapping snake_case ↔ camelCase:** ✅ Completo (inclui `status`, `aprovadoPor`, `aprovadoPorNome`, `aprovadoEm`)

**PDF:** `tempoRespostaPdfService.ts` gera client-side o formulário MMS.BR.BA.FOR.005 para visualização e impressão após aprovação.

---

# 29. TAF — `tafService.ts`

**Tabela:** `treinamentos_taf`  
**Ficheiro:** `src/services/tafService.ts`  
**Tipo:** `src/types/taf.ts` — `TreinamentoTAF`  
**Migration:** `supabase/migrations/035_treinamentos_taf.sql` + `backend/database/migrations/053_aprovacao_treinamentos_taf_tpepr.sql`

**Controle de aprovação:** registros novos entram como `Rascunho`. O formulário pode salvar rascunho ou aprovar; quando `status = "Aprovado"`, edição/exclusão ficam bloqueadas no front para a equipe e liberadas somente para `admin`/`desenvolvedor`. PDF só pode ser gerado com registro aprovado.

**Campos de aprovação:** `status`, `aprovadoPor`, `aprovadoPorNome`, `aprovadoEm`.

**Funções:** `listarTAFs`, `obterTAF`, `obterProximoNumero`, `criarTAF`, `atualizarTAF`, `excluirTAF` — todas ✅ OK

---

# 30. TP/EPR — `tpeprService.ts`

**Tabela:** `treinamentos_tpepr`
**Ficheiro:** `src/services/tpeprService.ts`
**Tipo:** `src/types/tpepr.ts` — `TreinamentoTPEPR`
**Migration:** `supabase/migrations/045_treinamentos_tpepr.sql` + `backend/database/migrations/053_aprovacao_treinamentos_taf_tpepr.sql`

**Controle de aprovação:** registros novos entram como `Rascunho`. O formulário pode salvar rascunho ou aprovar; quando `status = "Aprovado"`, edição/exclusão ficam bloqueadas no front para a equipe e liberadas somente para `admin`/`desenvolvedor`. PDF só pode ser gerado com registro aprovado.

**Funções:** `listarTPEPRs`, `obterTPEPR`, `obterProximoNumeroTPEPR`, `criarTPEPR`, `atualizarTPEPR`, `excluirTPEPR` — todas ✅ OK

**Payload Response:**
```json
[{
  "id": "uuid",
  "createdBy": "string",
  "createdAt": "string (ISO datetime)",
  "updatedAt": "string (ISO datetime)",
  "equipe": "Alfa | Bravo | Charlie | Delta",
  "numero": "number",
  "ano": "string",
  "data": "string (ISO date)",
  "hora": "string",
  "turno": "Diurno | Noturno | string",
  "observacoes": "string",
  "chefeEquipe": "string",
  "status": "Rascunho | Aprovado",
  "aprovadoPor": "string",
  "aprovadoPorNome": "string",
  "aprovadoEm": "string (ISO datetime)",
  "participantes": [{
    "pessoaId": "string",
    "nomeCompleto": "string",
    "nomeGuerra": "string",
    "funcao": "BA-CE | BA-LR | BA-MC | BA-2",
    "primeiraTomada": "string (MM:SS)",
    "segundaTomada": "string (MM:SS)",
    "terceiraTomada": "string (MM:SS)",
    "quartaTomada": "string (MM:SS)"
  }]
}]
```

**Regras:** participantes são normalizados e exibidos em ordem hierárquica `BA-CE → BA-LR → BA-MC → BA-2`. A quarta tomada é calculada pelo frontend antes de salvar: `(3ª tomada - 2ª tomada) + 20%`.

---

# 31. Ordens de Serviço — `ordemServicoService.ts`

**Tabela:** `ordens_servico`  
**Ficheiro:** `src/services/ordemServicoService.ts`  
**Tipo:** `src/types/ordemServico.ts` — `OrdemServico`, `OrdemServicoInput`  
**Migration:** `backend/database/migrations/048_ordens_servico.sql` + `backend/database/migrations/049_ordens_servico_empresa_pessoa.sql`

**Funções:** `listarOrdensServico`, `obterOrdemServico`, `criarOrdemServico`, `atualizarOrdemServico`, `excluirOrdemServico` — todas ✅ OK

**REST equivalência:**
- `GET /rest/v1/ordens_servico?select=*&order=created_at.desc`
- `GET /rest/v1/ordens_servico?select=*&id=eq.{id}`
- `POST /rest/v1/ordens_servico`
- `PATCH /rest/v1/ordens_servico?id=eq.{id}`
- `DELETE /rest/v1/ordens_servico?id=eq.{id}`

**Mapping snake_case ↔ camelCase:** ✅ Completo para emissão, manutenção, cancelamento, finalização e observações.

---

# Anexo C — Funções sem Supabase (Cálculo Puro / Externo)

| Ficheiro | Descrição |
|----------|-----------|
| `escalaMensalGenerator.ts` | Algoritmo de geração de escala mensal (plantões, rádio, faxina) |
| `lroGenerator.ts` | Geração de HTML/PDF para LRO |
| `pdfService.ts` | Manipulação de PDF com pdf-lib (ler campos, preencher, templates) |
| `htmlPdfService.ts` | HTML → PDF com html-to-image + jspdf |
| `reaPdfService.ts` | Preenchimento do PDF-template REA com pdf-lib |
| `ptrbaCompletoPdfService.ts` | Geração client-side do PDF PTR-BA completo com jspdf |
| `tpeprPdfService.ts` | Geração client-side do PDF TP/EPR em A4 paisagem com área de assinaturas em branco |
| `autentiqueService.ts` | API externa Autentique (GraphQL) — sem Supabase |
| `menuData.ts` | Configuração estática do menu de navegação |
