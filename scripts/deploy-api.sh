#!/usr/bin/env bash

set -euo pipefail

REMOTE_HOST="${MARKGIT_API_SSH_HOST:-penguin}"
REMOTE_DIR="${MARKGIT_API_REMOTE_DIR:-/home/ubuntu/projects/markgit}"
SERVICE_NAME="${MARKGIT_API_SERVICE:-markgit-api}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

rsync -az --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude ".next" \
  --exclude ".next.stale-*" \
  --exclude "packages/*/dist" \
  --exclude ".env" \
  --exclude "packages/web/.env.local" \
  "$ROOT_DIR/" "${REMOTE_HOST}:${REMOTE_DIR}/"

if [[ -f "${ROOT_DIR}/.env" ]]; then
  ssh "${REMOTE_HOST}" "sudo mkdir -p /etc/markgit && sudo chown ubuntu:ubuntu /etc/markgit"
  scp "${ROOT_DIR}/.env" "${REMOTE_HOST}:/tmp/${SERVICE_NAME}.env"
  ssh "${REMOTE_HOST}" "sudo mv /tmp/${SERVICE_NAME}.env /etc/markgit/api.env && sudo chown root:root /etc/markgit/api.env && sudo chmod 600 /etc/markgit/api.env"
fi

scp "${ROOT_DIR}/ops/systemd/${SERVICE_NAME}.service" "${REMOTE_HOST}:/tmp/${SERVICE_NAME}.service"

ssh "${REMOTE_HOST}" "
  set -euo pipefail
  sudo mv /tmp/${SERVICE_NAME}.service /etc/systemd/system/${SERVICE_NAME}.service
  sudo chown root:root /etc/systemd/system/${SERVICE_NAME}.service
  corepack prepare pnpm@9.13.1 --activate
  cd '${REMOTE_DIR}'
  corepack pnpm install --frozen-lockfile
  corepack pnpm --filter @tolty/api build
  sudo systemctl daemon-reload
  sudo systemctl enable ${SERVICE_NAME}
  sudo systemctl restart ${SERVICE_NAME}
  sudo systemctl --no-pager --full status ${SERVICE_NAME}
"
