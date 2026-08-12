# SESCINC Manager Frontend

Aplicacao React/Vite do SESCINC Manager.

O front nao acessa mais Supabase diretamente. Os services existentes passam por `src/lib/supabase.ts`, que agora e um adapter HTTP compatível com o padrao antigo e aponta para a API NestJS.

## Ambiente

```env
VITE_API_BASE_URL=http://localhost:3333/api
```

## Desenvolvimento

Na raiz do repositorio:

```bash
npm.cmd install
npm.cmd run dev:frontend
```

Para rodar a aplicacao completa, suba tambem o PostgreSQL e a API:

```bash
npm.cmd run db:up
npm.cmd run db:migrate
npm.cmd run dev:backend
```

## Estrutura

```text
src/
  components/
  context/
  data/
  hooks/
  lib/
    apiClient.ts
    supabase.ts
  pages/
  routes/
  services/
  types/
  utils/
```
