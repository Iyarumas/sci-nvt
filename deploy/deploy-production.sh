#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  printf '[deploy] %s\n' "$*"
}

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    printf '[deploy] Missing required environment variable: %s\n' "$name" >&2
    exit 1
  fi
}

require_env DEPLOY_PATH
require_env REPO_URL
require_env DEPLOY_BRANCH
require_env EXPECTED_SHA

mkdir -p "$DEPLOY_PATH"
cd "$DEPLOY_PATH"

if [ ! -d .git ]; then
  git init
fi

git config --global --add safe.directory "$DEPLOY_PATH" >/dev/null 2>&1 || true
git remote remove origin >/dev/null 2>&1 || true
git remote add origin "$REPO_URL"

auth_repo_url="$REPO_URL"
if [ -n "${GITHUB_TOKEN_VALUE:-}" ]; then
  auth_repo_url="$(printf '%s' "$REPO_URL" | sed "s#https://github.com/#https://x-access-token:${GITHUB_TOKEN_VALUE}@github.com/#")"
fi

log "Fetching $DEPLOY_BRANCH"
git fetch --prune --force "$auth_repo_url" "+refs/heads/$DEPLOY_BRANCH:refs/remotes/origin/$DEPLOY_BRANCH"
git reset --hard "refs/remotes/origin/$DEPLOY_BRANCH"
git checkout -B "$DEPLOY_BRANCH" "refs/remotes/origin/$DEPLOY_BRANCH"
git branch --set-upstream-to="origin/$DEPLOY_BRANCH" "$DEPLOY_BRANCH" >/dev/null 2>&1 || true
git clean -fd -e .env.production -e local-public-data.sql

export DEPLOY_COMMIT
DEPLOY_COMMIT="$(git rev-parse HEAD)"

if [ "$DEPLOY_COMMIT" != "$EXPECTED_SHA" ]; then
  printf '[deploy] VM checkout mismatch. Expected %s, got %s.\n' "$EXPECTED_SHA" "$DEPLOY_COMMIT" >&2
  exit 1
fi

if [ ! -f .env.production ]; then
  printf '[deploy] .env.production is missing in %s\n' "$DEPLOY_PATH" >&2
  exit 1
fi

log "Building and deploying $DEPLOY_COMMIT"
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres
docker compose --env-file .env.production -f docker-compose.prod.yml build backend web
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm backend npm run db:migrate
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --no-build --force-recreate backend web

backend_health=""
for _attempt in $(seq 1 30); do
  backend_health="$(docker compose --env-file .env.production -f docker-compose.prod.yml exec -T backend wget -qO- http://127.0.0.1:3333/api/health 2>/dev/null || true)"
  if printf '%s' "$backend_health" | grep -Fq "$DEPLOY_COMMIT"; then
    log "Backend health OK for $DEPLOY_COMMIT"
    break
  fi
  sleep 5
done

if ! printf '%s' "$backend_health" | grep -Fq "$DEPLOY_COMMIT"; then
  printf '[deploy] Backend did not report deployed commit %s.\n' "$DEPLOY_COMMIT" >&2
  printf '[deploy] Last /api/health response: %s\n' "${backend_health:-<empty>}" >&2
  docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=120 backend web >&2
  exit 1
fi

web_build_info="$(docker compose --env-file .env.production -f docker-compose.prod.yml exec -T web cat /srv/build-info.json 2>/dev/null || true)"
if ! printf '%s' "$web_build_info" | grep -Fq "$DEPLOY_COMMIT"; then
  printf '[deploy] Web container did not contain build-info for commit %s.\n' "$DEPLOY_COMMIT" >&2
  printf '[deploy] Last /srv/build-info.json: %s\n' "${web_build_info:-<empty>}" >&2
  docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=120 web >&2
  exit 1
fi

docker image prune -f
log "Deploy finished successfully for $DEPLOY_COMMIT"
