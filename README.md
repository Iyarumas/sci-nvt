# SCI NVT - Sistema de Controle de Incidentes e Gestão Operacional

Sistema web completo para gestão operacional do Corpo de Bombeiros, desenvolvido com React, TypeScript e Supabase.

## 🚀 Funcionalidades

### 📊 Dashboard
- Visão geral com KPIs (bombeiros, ocorrências, férias, certificações)
- Gráficos de distribuição por equipe e categoria
- Timeline de ocorrências e treinamentos
- Alertas de certificações próximas ao vencimento

### 👥 Cadastro
- **Bombeiros**: CRUD completo com foto, cargo, equipe, cursos
- **APOC**: Cadastro de pessoal MOTIVA
- **Equipamentos**: 11 categorias de equipamentos
- **Extintores**: Controle de agentes extintores
- **Hidrantes**: Gestão de pontos de água
- **Viaturas**: Cadastro de viaturas operacionais
- **Documentos**: Templates de documentos com campos dinâmicos

### 📋 Escalas
- **Escala Diária**: Criação de escalas com guarnições, rádio e trocas
- **Escala Mensal**: Geração automática com rodízio de rádio, faxina e responsabilidades
  - Exportação em PDF e PNG
  - Impressão em formato paisagem (landscape)
  - Auto-preenchimento com efetivo real do mês

### 🏖️ Férias
- Controle de períodos aquisitivos
- Escala anual por equipe
- Aprovação/rejeição de escalas
- Quadro de efetivos mensal
- Feiristas e substituições automáticas

### 🔄 Substituições
- Registro de substituições temporárias
- Aprovação por gerente
- Notificações de limite de trocas
- Integração com escala diária

### 📝 Ocorrências
- Registro de ocorrências (BONA/RAE)
- Categorias e status personalizados
- Listagem com filtros

### 📄 Documentos
- Geração de PDF com templates
- Campos customizáveis
- Assinatura digital (Autentique)
- Ordem de Serviço
- Trocas de Serviço

### 📚 Treinamentos
- TP/EPR com 4 tempos (CALÇA+BOTA, EPR, TP/COMP, TP/EPR)
- Posicionamento para Intervenção
- Exercício de Tempo Resposta
- Controle de participantes

### 🎓 Certificações
- Certificações NR (Normas Regulamentadoras)
- Cursos Motiva
- Alertas de vencimento
- Badges por status

### 📈 Estatísticas
- Visão Geral com gráficos interativos
- Treinamentos por período
- Certificações por equipe
- Desempenho operacional
- Gráficos Recharts (barras, pizza, área, linha)

### 🔔 Notificações
- Alertas de férias, EPIs, certificações e substituições
- Chat interno entre usuários

## 🛠️ Tecnologias

| Tecnologia | Versão | Função |
|---|---|---|
| React | 19.x | Framework front-end |
| TypeScript | 6.x | Tipagem estática |
| Vite | 8.x | Build tool |
| Tailwind CSS | 4.x | Estilização |
| Supabase | 2.x | Backend/Banco de dados |
| React Router | 7.x | Roteamento |
| Recharts | 3.x | Gráficos |
| Lucide React | 1.x | Ícones |
| html-to-image | 1.x | Exportação PNG |
| Redux Toolkit | 2.x | Gerenciamento de estado |

## 📦 Instalação

```bash
# Clone o repositório
git clone https://github.com/anomalyco/projetonovo.git
cd projetonovo

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais do Supabase

# Inicie o servidor de desenvolvimento
npm run dev
```

## 🏗️ Build para produção

```bash
npm run build
npm run preview
```

## ☁️ Deploy

### Vercel (recomendado)

```bash
npm i -g vercel
vercel --prod
```

O projeto já inclui `vercel.json` configurado para SPA (Single Page Application).

## 🔐 Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

## 📁 Estrutura do Projeto

```
src/
├── components/       # Componentes reutilizáveis
│   ├── documentos/   # Componentes para documentos/PDF
│   ├── layout/       # Layout (Sidebar, Header, etc.)
│   └── ui/           # Componentes de UI (SearchSelect, Tooltip, etc.)
├── context/          # Contextos React (Auth, Sidebar)
├── data/             # Templates de documentos
├── hooks/            # Custom hooks
├── lib/              # Configuração Supabase
├── pages/            # Páginas da aplicação
│   ├── AgentesExtintores/
│   ├── APOC/
│   ├── Bombeiros/
│   ├── Certificacoes/
│   ├── Checklists/
│   ├── Configuracoes/
│   ├── Dashboard/
│   ├── Documentos/
│   ├── EPIs/
│   ├── Equipamentos/
│   ├── Escalas/
│   ├── Estatisticas/
│   ├── Ferias/
│   ├── Funcionarios/
│   ├── Hidrantes/
│   ├── Inspecoes/
│   ├── Login/
│   ├── Ocorrencias/
│   ├── Perfil/
│   ├── RegistrosDiarios/
│   ├── Relatorios/
│   ├── Treinamentos/
│   └── Usuarios/
├── services/         # Serviços (API, localStorage)
├── types/            # Tipos TypeScript
└── utils/            # Utilitários (validação de cursos, etc.)
```

## 👥 Sistema de Roles

| Role | Acesso |
|---|---|
| **Desenvolvedor** | Acesso total ao sistema |
| **Administrador** | Gestão de usuários, exclusão de escalas aprovadas |
| **Gerente** | Aprovação de escalas, visualização de todas as equipes |
| **Chefe de Equipe** | Gestão da própria equipe |
| **Líder de Resgate** | Visualização da própria equipe |

## 📄 Licença

MIT
