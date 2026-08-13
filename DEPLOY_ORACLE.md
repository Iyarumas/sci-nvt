# Deploy Oracle Always Free

Este projeto pode rodar na VM Oracle usando Docker Compose com:

- Caddy na porta 80/443 para servir o front-end e encaminhar `/api/*` para o NestJS.
- Backend NestJS em rede interna Docker.
- PostgreSQL em rede interna Docker com volume persistente.
- Volume persistente para arquivos/PDFs do backend.

## 1. Liberar Portas Na Oracle

No painel da Oracle Cloud, libere entrada TCP para:

- `22` para SSH
- `80` para HTTP
- `443` para HTTPS quando usar domínio

Regra de ingress na VCN/Security List ou Network Security Group:

```text
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 80
```

E outra regra:

```text
Source CIDR: 0.0.0.0/0
IP Protocol: TCP
Destination Port Range: 443
```

Não exponha a porta `5432` do PostgreSQL publicamente.

Na própria VM, libere o firewall local.

Ubuntu:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

Oracle Linux:

```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

## 2. Acessar A VM

No Windows PowerShell:

```powershell
ssh -i "C:\caminho\para\sua-chave.key" ubuntu@SEU_IP_PUBLICO
```

Se a imagem for Oracle Linux, o usuário costuma ser:

```powershell
ssh -i "C:\caminho\para\sua-chave.key" opc@SEU_IP_PUBLICO
```

## 3. Instalar Docker Na VM

Ubuntu:

```bash
sudo apt update
sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker "$USER"
newgrp docker
docker run hello-world
```

Oracle Linux:

```bash
sudo dnf install -y docker-engine docker-cli docker-compose-plugin git
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
newgrp docker
docker run hello-world
```

## 4. Enviar O Projeto Para A VM

Opção simples via `tar` e `scp` a partir do Windows PowerShell:

```powershell
cd "C:\Users\Guilherme Cardias\Desktop\Projetos\sci-nvt"
tar --exclude=".git" --exclude="node_modules" --exclude="frontend/dist" --exclude="backend/dist" --exclude=".env" -czf sci-nvt-deploy.tar.gz .
scp -i "C:\caminho\para\sua-chave.key" .\sci-nvt-deploy.tar.gz ubuntu@SEU_IP_PUBLICO:/home/ubuntu/
ssh -i "C:\caminho\para\sua-chave.key" ubuntu@SEU_IP_PUBLICO
```

Na VM:

```bash
mkdir -p ~/sci-nvt
tar -xzf ~/sci-nvt-deploy.tar.gz -C ~/sci-nvt
cd ~/sci-nvt
```

Use `opc@SEU_IP_PUBLICO` e `/home/opc/` se sua imagem for Oracle Linux.

## 5. Configurar Produção

Na VM:

```bash
cp .env.production.example .env.production
nano .env.production
```

Para testar pelo IP público:

```env
APP_SITE_ADDRESS=:80
FRONTEND_ORIGIN=http://SEU_IP_PUBLICO
PUBLIC_API_URL=http://SEU_IP_PUBLICO/api
VITE_API_BASE_URL=/api
```

Troque também:

```env
POSTGRES_PASSWORD=uma_senha_forte_sem_espacos
DATABASE_URL=postgresql://sescinc:uma_senha_forte_sem_espacos@postgres:5432/sescinc
```

Quando tiver domínio apontando para o IP da VM:

```env
APP_SITE_ADDRESS=sistema.seudominio.com
FRONTEND_ORIGIN=https://sistema.seudominio.com
PUBLIC_API_URL=https://sistema.seudominio.com/api
VITE_API_BASE_URL=/api
```

## 6. Subir Aplicação

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm backend npm run db:migrate
docker compose --env-file .env.production -f docker-compose.prod.yml logs -f
```

Teste:

```bash
curl http://localhost/api/health
```

No navegador:

```text
http://SEU_IP_PUBLICO
```

## 7. Levar Os Dados Locais Para A VM

No Windows, exporte os dados do PostgreSQL local:

```powershell
npm.cmd run db:export:local
```

Copie o arquivo gerado em `backend/database/backups/` para a VM:

```powershell
scp -i "C:\caminho\para\sua-chave.key" "C:\Users\Guilherme Cardias\Desktop\Projetos\sci-nvt\backend\database\backups\local-public-data-YYYYMMDD-HHMMSS.sql" ubuntu@SEU_IP_PUBLICO:/home/ubuntu/sci-nvt/local-public-data.sql
```

Na VM, restaure:

```bash
cd ~/sci-nvt
sh deploy/restore-data.sh local-public-data.sql
```

## 8. Operação

Ver logs:

```bash
npm run prod:logs
```

Atualizar depois de enviar uma nova versão:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm backend npm run db:migrate
```

Parar:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down
```

Backup manual na VM:

```bash
mkdir -p backups
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres pg_dump -U sescinc -d sescinc --schema=public --data-only --column-inserts --no-owner --no-privileges --exclude-table-data=public.schema_migrations > backups/sescinc-$(date +%Y%m%d-%H%M%S).sql
```

## 9. Deploy Automático Pelo GitHub Actions

O workflow fica em `.github/workflows/deploy-oracle.yml` e roda em todo push na branch `main`.

No GitHub, crie este secret em:

`Settings` → `Secrets and variables` → `Actions` → `New repository secret`

```text
Name: ORACLE_SSH_KEY
Value: conteúdo completo da chave privada .key
```

Fluxo do deploy automático:

```text
push na main
→ GitHub Actions conecta na VM por SSH
→ inicializa/atualiza o repositório em /home/ubuntu/sci-nvt
→ roda git fetch/reset para a versão enviada
→ sobe o PostgreSQL
→ executa migrations
→ rebuilda backend e front-end
→ reinicia a stack Docker
```

O workflow preserva o arquivo `.env.production` existente na VM.

### Corrigir erro `Load key ... error in libcrypto`

Esse erro indica que a chave privada chegou invalida ao runner do GitHub Actions, geralmente por copia sem quebras de linha ou por uso acidental do arquivo `.pub`.

Forma recomendada: usar um secret Base64.

No PowerShell do Windows, gere o valor e copie para a area de transferencia:

```powershell
$key = Get-Content -Raw "C:\Users\Guilherme Cardias\Desktop\Projetos\sci-nvt\backend\storage\ssh-key-2026-08-12.key"
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($key)) | Set-Clipboard
```

Depois crie ou atualize o secret no GitHub:

```text
Name: ORACLE_SSH_KEY_B64
Value: cole o conteudo que foi para a area de transferencia
```

Se usar `ORACLE_SSH_KEY_B64`, ele tem prioridade sobre `ORACLE_SSH_KEY`.
