# SESCINC Manager

Projeto separado em dois runtimes:

- `frontend/`: aplicacao React/Vite existente.
- `backend/`: API REST NestJS para PostgreSQL, storage local e proxy Autentique.

## Execucao local

1. Copie `.env.example` para `.env` e ajuste os valores.
2. Suba o banco:

```bash
pnpm run db:up
```

3. Instale dependencias e rode as migrations:

```bash
pnpm install
pnpm run db:migrate
```

4. Em terminais separados:

```bash
pnpm run dev:backend
pnpm run dev:frontend
```

O front usa `VITE_API_BASE_URL` para conversar com o NestJS. O banco local fica em PostgreSQL e o pgAdmin fica em `http://localhost:5050`.
