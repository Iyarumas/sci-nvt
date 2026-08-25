# Guia do Agente — SESCINC Manager

## Regras Principais do Sistema

### Fonte da Verdade
- **`API_ENDPOINTS.md`** é a fonte única da verdade para todas as interações com Supabase
- **`AGENTS.md`** (este ficheiro) é o guia geral do agente — **deve ser atualizado sempre que houver alterações na estrutura do projeto**
- **Skills em `.opencode/skills/`** contêm instruções especializadas para cada módulo

### Regra de Auto-Manutenção do AGENTS.md

Sempre que fizeres alterações que afetem a estrutura do projeto, deves atualizar o `AGENTS.md` automaticamente:

| Tipo de Alteração | Secção a Atualizar |
|------------------|-------------------|
| Nova página/rota | Secção "Domínios Principais — Telas e Rotas" |
| Novo ficheiro em `src/services/` | Nenhuma (já referenciado no `API_ENDPOINTS.md`) |
| Novo diretório em `src/pages/` | Secção "Estrutura do Projeto" |
| Novo componente em `src/components/` | Secção "Estrutura do Projeto" |
| Novo hook em `src/hooks/` | Secção "Estrutura do Projeto" |
| Novo tipo em `src/types/` | Secção "Estrutura do Projeto" |
| Novo padrão de UI | Secção "Padrões de UI" |
| Novo serviço externo | Secção "Estrutura do Projeto" |
| Nova skill | Secção "Skills Disponíveis" + "Regras de Combinação de Skills" |
| Nova migration | Nenhuma (já referenciado no `API_ENDPOINTS.md`) |

**Checklist de atualização:**
- [ ] Adicionei/removi rotas no routing? → Atualizar tabelas de rotas
- [ ] Criei/removi diretórios? → Atualizar árvore do projeto
- [ ] Mudei padrões de UI? → Atualizar exemplos de código
- [ ] Mudei skills? → Atualizar lista de skills + combinações

### Regra de Escopo e Seguranca Operacional

Antes de qualquer implementacao, classificar explicitamente o pedido em uma destas areas:

| Escopo | Quando usar | Pastas/arquivos comuns |
|--------|-------------|------------------------|
| `frontend` | Telas, componentes, rotas, estilos, validacoes de UI, services do React | `frontend/src/**`, `frontend/public/**`, `frontend/Dockerfile` |
| `backend` | API NestJS, DTOs, controllers, services, migrations, consultas SQL, storage local | `backend/src/**`, `backend/database/**`, `backend/scripts/**`, `backend/Dockerfile` |
| `infra/deploy` | Docker, PostgreSQL, Caddy, Oracle VM, GitHub Actions, variaveis de ambiente, dominio/HTTPS | `docker-compose*.yml`, `deploy/**`, `.github/workflows/**`, `.env*.example`, `DEPLOY_ORACLE.md` |
| `ambos` | Mudancas que alteram contrato entre tela e API, modelo de dados usado pelo front, ou fluxo completo | `frontend/**` + `backend/**` + documentacao de API |

Regras obrigatorias:
- Se o escopo nao estiver claro e houver risco de afetar producao, banco, autenticacao, deploy ou dados, fazer uma pergunta curta antes de editar.
- Em pedido apenas de `frontend`, nao alterar migrations, Docker, GitHub Actions, VM, Caddy ou banco sem necessidade comprovada.
- Em pedido apenas de `backend`, nao alterar layout/UX do front sem necessidade comprovada de integracao.
- Em pedido `infra/deploy`, tratar VM Oracle, Docker volumes, `.env.production`, dominio DuckDNS, HTTPS e workflow do GitHub Actions como area sensivel.
- Nunca expor publicamente PostgreSQL (`5432`), pgAdmin (`5050`), backend direto (`3333`) ou Docker daemon (`2375/2376`).
- O PostgreSQL de producao deve continuar interno no Docker; acesso externo ao sistema deve passar por Caddy em `80/443`.
- Nao apagar volumes Docker, dumps, storage de PDFs, banco de producao ou arquivos em `/home/ubuntu/sci-nvt` sem autorizacao explicita e plano de backup.
- Migrations devem ser progressivas, idempotentes quando possivel e sem perda de dados. Qualquer alteracao destrutiva precisa de backup e confirmacao do usuario.
- Nunca commitar secrets, chaves SSH, senhas, tokens, dumps com dados sensiveis ou `.env.production`; usar apenas `.env.example`/`.env.production.example` com placeholders.
- Antes de mudar contrato front/back, atualizar/consultar `API_ENDPOINTS.md` e validar chamadas afetadas.
- Depois de alteracoes que possam afetar producao, validar build/typecheck/lint conforme o escopo e, quando aplicavel, confirmar API health e rota principal do front.

### Arquitetura de Dados
```
Frontend components → frontend/src/services/*.ts → frontend/src/lib/supabase.ts (HTTP adapter) → backend NestJS → PostgreSQL
```

- ❌ **Não voltar a chamar Supabase diretamente no front-end** — `frontend/src/lib/supabase.ts` é apenas um adapter de compatibilidade HTTP
- ❌ **Não usar Redux/RTK Query** — o padrão do app continua `useState` + `useEffect` + services
- ✅ Usar `useState` + `useEffect` + chamadas diretas aos services
- ✅ Backend novo em `backend/` segue NestJS (`Modules`, `Controllers`, `Services`, `DTOs`)
- ✅ Banco local em PostgreSQL via `docker-compose.yml`
- ✅ DataContext está planeado mas ainda não implementado
- ✅ Error handling: usar `handleSupabaseError(err)` — **nunca** `console.error` silencioso

### Convenções de Código
- Front-end: nomes de ficheiros `camelCase.ts` para services/utils, `PascalCase.tsx` para componentes
- Front-end: tipos em `frontend/src/types/<dominio>.ts`
- Front-end: services em `frontend/src/services/<dominio>Service.ts`
- Front-end: páginas em `frontend/src/pages/<Dominio>/<Dominio>.tsx`
- Back-end: módulos em `backend/src/<dominio>/`, DTOs em `dto/`, services e controllers por domínio
- Tabelas: `snake_case` na BD → `camelCase` no TypeScript (usar helpers `rowTo*` / `*ToRow`)
- Comandos do projeto: usar `npm` na raiz (`npm run dev:frontend`, `npm run dev:backend`, `npm run db:migrate`, `npm run db:import:supabase -- -ReplaceLocalData`, `npm run db:export:local`, `npm run prod:up`, `npm run prod:migrate`); no PowerShell do Windows, preferir `npm.cmd` se `npm` cair no shim `npm.ps1`.

### Regras de Negócio — Corrente de Substituição (Férias)

```
Hierarquia: GS(0) → BA-CE(1) → BA-LR(2) → BA-MC(3) → BA-2(4) → Ferista(5)
```

- **Substituto obrigatório** para BA-CE, BA-LR, BA-MC, GS
- **BA-2** só pode ser substituído por BA-2 ou Ferista
- **Ferista** é fim de linha (não precisa de substituto)
- **Corrente**: A(férias) → B substitui A → C substitui B → D substitui C → ... até Ferista
- Cada substituto **herda o cargo** de quem está a substituir
- A corrente aparece na **Escala Diária** e no **LRO** (secção "Cadeia de Substituições")

Helpers em `src/types/ferias.ts`:
- `HIERARCHY` — array ordenado: GS, BA-CE, BA-LR, BA-MC, BA-2
- `getNextCargoNaCadeia(cargo)` — próximo cargo na hierarquia
- `isSubstitutoObrigatorio(cargo)` — se precisa de substituto
- `getCargosPermitidosSubstituto(cargo)` — cargos que podem substituir
- `EloCorrenteSubstituicao` — interface para elo da corrente

Serviço em `src/services/vigenciaSubstituicaoService.ts`:
- `processarCadeiaSubstituicao()` — novo algoritmo que cria a corrente completa na BD
- `calcularCorrenteSubstituicao()` — pré-visualiza a corrente (sem guardar)
- `resolverEfetivo()` — calcula o efetivo real considerando substituições (já existente)
- `processarCascata()` — mantida para compatibilidade (deprecated)

---

## Skills Disponíveis

### Como usar
Sempre que iniciares uma tarefa, carrega a skill correspondente:

```
rtk skill <nome-da-skill>
```

### Lista de Skills

| Skill | Comando | Quando Usar |
|-------|---------|-------------|
| Consistência de API | `rtk skill api-consistency` | Qualquer alteração que afete dados |
| Novo Endpoint API | `rtk skill api-endpoint` | Criar um novo endpoint Supabase |
| Desenvolvimento de Feature | `rtk skill feature` | Desenvolvimento completo de funcionalidade |
| Correção de Bug | `rtk skill bug-fix` | Investigar e corrigir bugs |
| Geração de PDF | `rtk skill pdf` | Trabalhos com PDF |
| Testes UI/QA | `rtk skill ui-qa` | Testar funcionalidades |
| Release Check | `rtk skill release-check` | Verificação pré-deploy |
| Bombeiros/APOCs | `rtk skill bombeiros-apocs` | CRUD de bombeiros e APOCs |
| Escalas | `rtk skill escalas` | Escalas diárias e mensais |
| Filtros/Relatórios | `rtk skill filtros-relatorios` | Padrões de filtro e relatório |
| LRO | `rtk skill lro` | Módulo LRO |
| PTR-BA | `rtk skill ptr-ba` | Módulo PTR-BA |

### Regras de Combinação de Skills

Podes combinar múltiplas skills carregando-as em sequência. A ordem importa:

| Combinação | Quando Usar |
|------------|-------------|
| `api-consistency` + `feature` | Criar nova feature que mexe com dados |
| `api-endpoint` + `feature` | Criar feature com nova tabela Supabase |
| `api-consistency` + `bug-fix` | Corrigir bug que afeta o fluxo de dados |
| `feature` + `pdf` | Feature que gera PDFs |
| `feature` + `ui-qa` | Feature que precisa de testes |
| `escalas` + `feature` | Feature específica de escalas |
| `ptr-ba` + `feature` | Feature específica de PTR-BA |
| `lro` + `pdf` | Geração de LRO em PDF |
| `bombeiros-apocs` + `api-endpoint` | Novo endpoint para bombeiros/APOCs |
| `filtros-relatorios` + `feature` | Feature com filtros e relatórios |
| `release-check` + `ui-qa` | Verificação final antes de deploy |
| `bug-fix` + `ui-qa` | Corrigir bug e verificar se funciona |

**Regra geral:** Carrega primeiro a skill mais específica do domínio, depois a skill genérica.

---

## Domínios Principais — Telas e Rotas

### Dashboard
| Rota | Tela | Descrição |
|------|------|-----------|
| `/` | Dashboard | Visão geral com KPIs e métricas operacionais |

### Tutoriais
| Rota | Tela | Descrição |
|------|------|-----------|
| `/tutorial/dia-a-dia` | Tutorial do Dia a Dia | Tutorial animado da rotina operacional do plantão, mostrando a sequência Escala Mensal → Escala Diária → PTR-BA → registros diários → Gerar LRO |

### Cadastro (Admin/Desenvolvedor)
| Rota | Tela | Descrição |
|------|------|-----------|
| `/cadastro/bombeiros` | Bombeiros | Cadastro de bombeiros e equipas operacionais |
| `/cadastro/apoc` | APOCs | Pessoal do Centro de Operações Aeroportuárias (MOTIVA) |
| `/cadastro/viaturas` | Viaturas | Cadastro de veículos operacionais |
| `/cadastro/equipamentos` | Equipamentos | Inventário de equipamentos |
| `/cadastro/extintores` | Extintores | Cadastro e manutenção de extintores |
| `/cadastro/agentes-extintores` | Agentes Extintores | Estoque de LGE, PQS, nitrogênio e demais agentes extintores |
| `/cadastro/hidrantes` | Hidrantes | Pontos de água e hidrantes |
| `/cadastro/documentos` | Gerenciar Documentos | Templates de documentos para preenchimento e assinatura |
| `/cadastro/ferias` | Férias | Controlo de férias, escala anual e substituições do efetivo; também aparece como item próprio na sidebar |
| `/usuarios` | Usuários | Gestão de utilizadores do sistema |

### Funcionários
| Rota | Tela | Descrição |
|------|------|-----------|
| `/funcionarios` | Todos | Visualizar todos os funcionários |
| `/funcionarios/substituicoes` | Substituições | Substituições temporárias de funcionários |
| `/epis` | EPIs | Controlo de Equipamentos de Proteção Individual |
| `/certificacoes` | Certificações | Certificações NR e cursos |

### Registos Diários
| Rota | Tela | Descrição |
|------|------|-----------|
| `/registros-diarios/ptr-ba` | PTR-BA por Instrução | Registro de PTR-BA por assunto ministrado |
| `/registros-diarios/ptr-ba-completo` | PTR-BA Completo | Relatório completo de registro PTR-BA com efetivo, evidências e download em PDF |
| `/registros-diarios/lro-ocorrencias` | LRO/Ocorrências | Registo de ocorrências do turno |
| `/registros-diarios/bona-rea` | BONA/REA | Registos de ocorrências operacionais — BONA e REA |
| `/registros-diarios/inspecoes` | Inspeções | Registos de inspeções operacionais |
| `/registros-diarios/solicitacoes` | Solicitações | Registos de solicitações operacionais |
| `/registros-diarios/inspecoes/check` | Check | Checklist de verificação de inspeção |
| `/registros-diarios/gerar-lro` | Gerar LRO | Gerar Livro de Registo Operacional; o admin marca como finalizado ou arquiva |
| `/registros-diarios/preview-lro` | Preview LRO | Pré-visualizar LRO antes de finalizar |

### Viaturas CCI
| Rota | Tela | Descrição |
|------|------|-----------|
| `/viaturas` | Viaturas CCI | Monitorização de viaturas do Centro de Controlo Integrado; lista todos os carros cadastrados e histórico de panes por viatura |

### Documentos
| Rota | Tela | Descrição |
|------|------|-----------|
| `/documentos` | Documentos | Listagem geral de documentos |
| `/documentos/trocas` | Trocas de Serviço | Formulário de Permuta de Serviço |
| `/checklists` | Checklists | Criação e aplicação de checklists operacionais, incluindo modelo quinzenal CHECK LIST TOTAL e modelos personalizados com colunas/linhas editáveis |
| `/escalas` | Escalas | Gestão de escalas de trabalho |
| `/relatorios/ordem-servico` | Ordens de Serviço | Controlo de ordens de serviço |

### Treinamentos
| Rota | Tela | Descrição |
|------|------|-----------|
| `/treinamentos` | Outros | Controlo geral de treinamentos e qualificações |
| `/treinamentos/tp-epr` | TP/EPR | Teste de Proficiência / Exame de Proficiência de Resgate |
| `/treinamentos/taf` | TAF | Teste de Aptidão Física |

### Estatísticas
| Rota | Tela | Descrição |
|------|------|-----------|
| `/estatisticas` | Estatísticas | Análise de dados e estatísticas operacionais |

### Relatórios
| Rota | Tela | Descrição |
|------|------|-----------|
| `/relatorios/lro` | LRO | Relatório de LRO |
| `/relatorios/bona` | BONA/REA | Boletim de Ocorrência Não Aeronáutico e Relatório de Registro de Emergências Aeronáuticas (puxa BONAs com `numero` BONA-... e REAs de `rea_registros`; não inclui ocorrências do LRO) |
| `/relatorios/ptr-ba` | PTR-BA | Relatório de PTR-BA | 
| `/relatorios/ptr-ba-registros` | PTR-BA Registros | Lista de todos os PTR-BAs (por instrução + completo) por ordem de data, com filtros de mês/ano/equipe e impressão |
| `/relatorios/exercicios` | Exercícios | Relatório de exercícios gerais |
| `/relatorios/exercicios/taf` | TAF | Relatório de TAF |
| `/relatorios/exercicios/tp-epr` | TP/EPR | Relatório de TP/EPR |
| `/relatorios/exercicios/posicionamento` | Exercício de Posicionamento | Relatório de Exercício de Posicionamento |
| `/relatorios/exercicios/tempo-resposta` | Tempo Resposta | Relatório de Tempo Resposta |
| `/relatorios/substituicoes` | Substituições | Relatório mensal de substituições, afastamentos e extras |
| `/relatorios/trocas` | Trocas | Registos de trocas de serviço |

### Arquivo (Admin/GS gerem; BA-CE/BA-LR visualizam)
| Rota | Tela | Descrição |
|------|------|-----------|
| `/arquivo/:tipo?` | Arquivo | Documentos arquivados por categoria (trocas, férias, EPIs, certificações, ocorrências, ordem_servico, lro, ptrba, treinamentos, dds, checklists) |

### Configurações / Perfil
| Rota | Tela | Descrição |
|------|------|-----------|
| `/configuracoes` | Configurações | Definições do sistema |
| `/perfil` | Perfil | Perfil do utilizador |

### Autenticação
| Rota | Tela | Descrição |
|------|------|-----------|
| `/login` | Login | Autenticação |
| `/cadastro/convite/:codigo` | Registro por Convite | Registo via código de convite |
| `/aguardando-funcao` | Aguardando Função | Ecrã de espera sem função atribuída |

---

## Estrutura do Projeto

```
/
├── backend/                # API NestJS + PostgreSQL + storage local
│   ├── database/
│   │   ├── migrations/     # Migrations SQL executadas por backend/scripts/migrate.mjs
│   │   ├── legacy-scripts/ # Scripts Supabase antigos preservados como referência
│   │   └── supabase-legacy/# Config/schema Supabase antigo preservado
│   ├── legacy-vercel-api/  # Funções Vercel antigas preservadas como referência
│   ├── scripts/            # Runner de migrations
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── autentique/     # Proxy Autentique GraphQL
│   │   ├── common/         # DTOs/utilitários compartilhados
│   │   ├── database/       # Pool PostgreSQL
│   │   ├── health/         # Health check
│   │   ├── resources/      # CRUD REST genérico por tabela permitida
│   │   ├── rpc/            # RPCs usados pelo front (login/hash/aprovação férias)
│   │   └── storage/        # Storage local de PDFs
│   ├── Dockerfile          # Imagem de produção da API NestJS
│   └── package.json
├── frontend/               # Aplicação React/Vite existente
│   ├── public/             # Assets estáticos
│   ├── scripts/            # Scripts de UI/teste que não acessam Supabase direto
│   ├── src/
│   │   ├── App.tsx         # Provider hierarchy (Auth → Theme → Sidebar → Router)
│   │   ├── main.tsx        # Entry point
│   │   ├── components/     # chat, documentos, layout, ui (inclui AnimatedPageTour/PageTour, DailyOperationsTutorial e ChefeVencimentosAlert)
│   │   ├── context/        # Auth, GlobalAlert, Theme, Sidebar
│   │   ├── data/           # Dados estáticos
│   │   ├── hooks/          # Hooks compartilhados
│   │   ├── lib/            # apiClient.ts + adapter HTTP supabase.ts + pdfjs
│   │   ├── pages/          # Páginas por domínio
│   │   │   └── Tutorial/   # Tutorial animado da rotina do plantão
│   │   ├── routes/         # React Router
│   │   ├── services/       # Services do front consumindo o adapter HTTP
│   │   ├── types/          # Interfaces TypeScript
│   │   └── utils/          # Regras/utilitários de UI/domínio ainda consumidos no front
│   ├── Dockerfile          # Build Vite + Caddy para produção
│   └── package.json
├── deploy/                 # Configuração e scripts de deploy em VPS/Oracle
│   ├── Caddyfile           # Front estático + reverse proxy para /api
│   ├── deploy-production.sh # Script executado pelo GitHub Actions para sincronizar main, buildar e validar produção
│   └── restore-data.sh     # Restore de dump SQL no PostgreSQL de produção
├── .github/
│   └── workflows/
│       └── deploy-oracle.yml # Deploy automático na VM Oracle via GitHub Actions
├── docker-compose.yml      # PostgreSQL + pgAdmin
├── docker-compose.prod.yml # Stack de produção: web + backend + PostgreSQL
├── .env.production.example # Template de variáveis para produção
├── DEPLOY_ORACLE.md        # Passo a passo de deploy na Oracle Always Free
├── package-lock.json       # Lockfile npm dos workspaces frontend/backend
├── AGENTS.md               # Este ficheiro — guia do agente
├── API_ENDPOINTS.md         # Fonte da verdade para contratos de dados/endpoints
├── CLAUDE.md               # Instruções RTK (histórico)
└── .opencode/
    └── skills/             # Skills especializadas
        ├── api-consistency/
        ├── api-endpoint/
        ├── bombeiros-apocs/
        ├── bug-fix/
        ├── escalas/
        ├── feature/
        ├── filtros-relatorios/
        ├── lro/
        ├── pdf/
        ├── ptr-ba/
        ├── release-check/
        └── ui-qa/
```

---

## Padrões de UI

### Layout de Página
```
<PageContainer>
  <PageTitle icon={IconComponent} title="..." subtitle="..." />
  <FilterBar />           {/* se necessário */}
  <StatsCards />           {/* se necessário */}
  <DataList />             {/* lista ou tabela */}
</PageContainer>
```

### Estilos de Card
```tsx
// Card padrão
<div className="rounded-2xl border border-graphite-200/60 bg-white/80 p-6 shadow-sm dark:border-border-dark dark:bg-surface-card">

// Card de estatísticas
<div className="rounded-xl border border-<color>-200 bg-<color>-50 p-3 text-center dark:border-<color>-800 dark:bg-<color>-900/20">

// Card de item na lista
<div className="rounded-xl border border-graphite-200 bg-white p-3 dark:border-border-dark dark:bg-surface-hover">
```

### Estilos de Input
```tsx
const inputCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark';

const selectCls = 'w-full rounded-xl border border-graphite-300 bg-white px-3 py-2.5 text-sm text-graphite-900 transition-all hover:border-graphite-400 focus:border-aviation-500 focus:ring-2 focus:ring-aviation-500/10 dark:border-border-dark dark:bg-surface-card dark:text-graphite-100 dark:hover:border-graphite-500 dark:focus:border-aviation-400/50 dark:focus:bg-surface-elevated dark:focus:ring-aviation-400/10 dark:scheme-dark';

const labelCls = 'block mb-1.5 text-xs font-semibold uppercase tracking-wider text-graphite-500 dark:text-graphite-400';
```

### Estilos de Botão
| Tipo | Classes |
|------|---------|
| Primary | `rounded-xl bg-gradient-to-r from-aviation-600 to-aviation-700 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-aviation-500/20` |
| Secondary | `rounded-xl border border-aviation-300 bg-white px-4 py-2.5 text-sm font-medium text-aviation-700 dark:border-aviation-700 dark:bg-aviation-900/20 dark:text-aviation-300` |
| Back/Voltar | `rounded-xl border border-graphite-300/60 bg-white/80 px-3 py-1.5 text-sm font-medium text-graphite-700 dark:border-border-dark dark:bg-surface-card dark:text-graphite-200` |
| Danger | `rounded-xl border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400` |
| Small Icon | `shrink-0 rounded-xl p-1.5 text-alert-red transition-all hover:bg-red-50 dark:hover:bg-red-900/20` |

### Ícones
Usar `lucide-react` para todos os ícones. Importar apenas os necessários:
```tsx
import { Calendar, Plus, Search, Pencil, Trash2, X, Save, User, Users, ChevronDown, ChevronRight, AlertTriangle, ArrowRightLeft, Check, Eye, FileText, BarChart3, Clock, CalendarDays, CheckCircle2, XCircle, Send, Sparkles, Copy, Printer, Radio, Shield, ClipboardList, Image } from 'lucide-react';
```

### Estado Vazio
```tsx
<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graphite-300 bg-white p-12 text-center dark:border-border-dark dark:bg-surface-card">
  <IconComponent className="mb-4 h-12 w-12 text-graphite-300 dark:text-graphite-600" />
  <h3 className="mb-2 text-lg font-semibold text-graphite-700 dark:text-graphite-300">Nenhum item encontrado</h3>
  <p className="text-sm text-graphite-400 dark:text-graphite-500">Mensagem descritiva aqui.</p>
</div>
```

### Estado de Carregamento
```tsx
<div className="flex items-center justify-center py-20">
  <div className="h-8 w-8 animate-spin rounded-full border-4 border-aviation-500 border-t-transparent" />
</div>
```

### Modal
```tsx
// Confirmações/alertas reutilizáveis
<AlertModal
  open={!!confirmDeleteId}
  title="Confirmar exclusão"
  message="Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita."
  variant="danger"
  confirmLabel="Excluir"
  loading={deleting}
  onClose={() => setConfirmDeleteId(null)}
  onConfirm={handleDelete}
/>

// Modal customizado
<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
  <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-elevated">
    {/* conteúdo */}
  </div>
</div>
```

### SearchSelect (Componente de Pesquisa)
Usar `<SearchSelect>` de `src/components/ui/SearchSelect` para seleção com pesquisa:
```tsx
<SearchSelect
  value={selectedValue}
  equipe={equipe}
  cargo={cargoFilter}
  showCargo={true}
  disabledIds={usedIds}
  onChange={handleChange}
  placeholder="Selecione..."
/>
```

---

## Checklist Rápido

### Antes de qualquer alteração
- [ ] Classifiquei o escopo: `frontend`, `backend`, `infra/deploy` ou `ambos`
- [ ] Se houver impacto em VM, Docker, banco, migrations, GitHub Actions, dominio/HTTPS ou dados de producao, confirmei o risco antes de editar
- [ ] Verifiquei que a mudanca nao abre portas internas (`5432`, `5050`, `3333`, `2375/2376`) nem expoe secrets
- [ ] Li `API_ENDPOINTS.md` para entender o estado atual
- [ ] Carreguei a skill adequada (preferir `rtk skill <nome>` quando disponível; se não existir, ler `.opencode/skills/<nome>/SKILL.md`)
- [ ] Identifiquei os domínios afetados (types, services, pages)

### Durante a implementação
- [ ] Types atualizados em `src/types/`
- [ ] Service segue o padrão (rowTo*, *ToRow, handleSupabaseError)
- [ ] Componente usa `useState` + `useEffect` (não RTK Query)
- [ ] snake_case ↔ camelCase mapeado corretamente
- [ ] `.select().single()` apenas em lookups únicos
- [ ] Error handling com `handleSupabaseError(err)` — sem `console.error` silencioso

### Depois da implementação
- [ ] `npm run typecheck` — sem erros de tipo
- [ ] `npm run lint` — sem erros de lint
- [ ] `API_ENDPOINTS.md` atualizado se houve alteração de API
- [ ] Testei o fluxo completo (criar, listar, editar, excluir)

### Antes de commit/push
- [ ] Se o push for para `main`, lembrei que isso dispara deploy automatico na VM Oracle
- [ ] Para mudancas de risco (`infra/deploy`, migrations, auth, banco), validei backup/plano de rollback antes do push
- [ ] `git status` — só os ficheiros esperados
- [ ] `git diff` — sem secrets ou debug code
- [ ] Mensagem de commit clara e concisa

---

## Conhecimento Permanente do Sistema

### Regime de Plantões

Referência: **21/07/2026** = Alfa + Bravo

| Dia (a partir de 21/07/2026) | Equipas em Serviço |
|------------------------------|-------------------|
| Dia 0 (21/07) | **Alfa** + **Bravo** |
| Dia 1 (22/07) | **Charlie** + **Delta** |
| Dia 2 (23/07) | **Alfa** + **Bravo** |
| ... | Alterna diariamente entre os pares |

**Helper**: `src/utils/equipes.ts` — `equipesNoDia(data)` devolve `['Alfa', 'Bravo']` ou `['Charlie', 'Delta']`; `horarioPlantaoPorEquipe(equipe)` devolve horários oficiais; `dataSaidaPlantao(equipe, data)` calcula saída do turno noturno.
**Regras operacionais**: `src/utils/regrasOperacionais.ts` centraliza validações puras de férias, escala anual, escala diária e substituições temporárias; `npm run test:domain` cobre os cenários críticos.
**Smoke E2E**: `npm run test:e2e:operational` valida login, sidebar e rotas críticas sem criar dados.

### Permissões por Cargo/Equipa Efetivos

**Helper**: `src/utils/permissoes.ts` — resolve cargo/equipa efetivos a partir de `vigencia_substituicoes` para aplicar permissões quando há férias, substituições temporárias ou cascatas.

| Área | Regra |
|------|-------|
| Cadastro completo | Administradores do sistema (`admin`/`desenvolvedor`) e bombeiros exercendo `GS` |
| Cadastro visível aos demais | Equipamentos, Extintores, Agentes Extintores, Hidrantes e Viaturas |
| Equipamentos e Viaturas | Criar/editar/excluir: Admin/GS ou `BA-CE`/`BA-LR` exercendo função na equipa `Bravo` |
| Extintores, Agentes Extintores e Hidrantes | Criar/editar/excluir: Admin/GS ou `BA-CE`/`BA-LR` exercendo função na equipa `Alfa` |
| Dados pessoais auxiliares | Listas de bombeiros/APOCs para vínculos ficam restritas a Admin/GS |
| Arquivo | Visualizar: Admin/GS/`BA-CE`/`BA-LR`; editar/excluir/restaurar: apenas Admin/GS |
| Funcionários > Todos | Todos visualizam a listagem; modal de detalhes e colunas pessoais: apenas Admin/GS |
| EPIs | Todos visualizam e operam estoque/pagamento/devolução; excluir EPI/estoque: apenas Admin/GS |
| Certificações | Admin/GS visualizam e editam tudo; `BA-CE`/`BA-LR` visualizam somente a equipe efetiva; demais cargos sem acesso |
| Férias | Botões de cadastro manual, bombeiros e aprovações: apenas Admin/GS; escalas e cards ficam globais para Admin/GS e por equipe efetiva para os demais; Quadro de Efetivos é visível a todos |
| Registos Diários (PTR-BA Completo, PTR-BA por Instrução, Gerar LRO) | Todos visualizam todas as equipes; criar/editar/excluir em qualquer equipe: apenas Admin/dev e `BA-CE`/`BA-LR` (trocas de plantão); `BA-CE`/`BA-LR` só alteram/excluem o que criaram (e o `BA-LR` também o que o `BA-CE` da equipe criou); bombeiros com `autorizadoRegistrosDiarios` no cadastro podem criar/editar apenas a equipe definida em `autorizacaoRegistrosDiariosEquipe`, mediante aprovação do BA-CE dessa equipe, inclusive para Feristas/apoios; essa autorização nunca libera exclusão e não acompanha troca/substituição; GS apenas visualiza; finalizar/arquivar LRO: apenas Admin/dev |
| Viaturas CCI | Todos visualizam |
| Documentos > Trocas | Todos visualizam; editar/excluir/arquivar/enviar: apenas quando a troca envolve a equipe efetiva, exceto Admin/GS |
| Documentos > Checklists | Todos visualizam e imprimem; modelo quinzenal/CHECK LIST TOTAL é alterado apenas por Admin/desenvolvedor; usuários podem criar e alterar seus próprios checklists personalizados |
| Documentos > Escalas | Todos visualizam; editar/excluir/salvar: apenas a equipe efetiva, exceto Admin/GS |
| Documentos > Ordens de Serviço | Todos visualizam; criar/editar/excluir: apenas a equipe efetiva, exceto Admin/GS |
| Treinamentos | Todos visualizam; registros com equipe podem ser criados/editados/excluídos apenas pela equipe efetiva, exceto Admin/GS; registros locais sem equipe usam `createdBy` e legados sem dono só são editáveis por Admin/GS |
| Relatórios | Relatórios gerais: acesso à sidebar e rotas diretas apenas para Admin/GS; exceção PTR-BA e PTR-BA Registros: Admin/GS/`BA-CE`/`BA-LR` e equipe `Embaixador` visualizam |

### Horários por Equipa

| Equipa | Horário | Turno |
|--------|---------|-------|
| Alfa | 07:00–19:00 | Diurno |
| Bravo | 19:00–07:00 | Noturno |
| Charlie | 07:00–19:00 | Diurno |
| Delta | 19:00–07:00 | Noturno |

### Validação de Cursos para Funções

| Função | Requisitos | Restrições |
|--------|-----------|------------|
| **BA-CE** (Chefe de Equipa) | `cursoChefeEquipe = true` | Sem curso → bloqueado |
| **BA-LR** (Líder de Resgate) | `cursoChefeEquipe = true` | Sem curso → bloqueado |
| **BA-MC (CRS)** | CNH Cat D ou E + `cursoCVE = true` + CNH válida + CVE válido | Sem CVE → bloqueado. Só pode CRS se não tiver MotoristaCCI |
| **BA-MC (CCI)** | CNH Cat D ou E + `cursoCVE = true` + `cursoMotoristaCCI = true` + CNH válida + CVE válido | Sem MotoristaCCI → bloqueado para CCI |

#### Alertas de Vencimento

| Documento | Antecedência do Aviso | Origem |
|-----------|----------------------|--------|
| CNH | ≤ 8 meses (240 dias) | `notificacaoService.ts` |
| CVE | ≤ 1 ano (365 dias) | `notificacaoService.ts` |

**Campos na BD**: `bombeiros.cnh_validade` (já existia), `bombeiros.cve_validade` (migration 032)

**Validação centralizada**: `src/utils/validacaoCursos.ts` — `validarCursoParaFuncao(bombeiro, funcao, veiculo?)`
