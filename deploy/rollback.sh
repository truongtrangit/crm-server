#!/usr/bin/env bash

set -e

ENV_FILE=${1:-deploy.prod.env}

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Env file not found: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

: "${SERVER:?SERVER is required}"
: "${PASSWORD:?PASSWORD is required}"
: "${REMOTE_DIR:?REMOTE_DIR is required}"

echo "⏪ Rollback..."

sshpass -p "$PASSWORD" ssh \
  -o StrictHostKeyChecking=no \
  "${SERVER}" << EOF

set -e

cd ${REMOTE_DIR}

if [ ! -f previous.version ]; then
  echo "❌ previous.version not found"
  exit 1
fi

PREVIOUS=\$(cat previous.version)

echo "Rollback version: \$PREVIOUS"

echo "\$PREVIOUS" > current.version

VERSION=\$PREVIOUS docker compose up -d

sleep 10

curl -fsS http://localhost:3000/health > /dev/null

echo "✅ Rollback success"

EOF
