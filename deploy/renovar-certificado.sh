#!/bin/sh
# Deploy hook of certbot (HU-42): after each issue or renewal of the Let's
# Encrypt certificate, copies it to deploy/tls and reloads nginx, without
# restarting anything. certbot runs it as root with RENEWED_LINEAGE set to
# /etc/letsencrypt/live/<domain>. docs/manual-operacion.md, section 4.
set -eu

REPO="$(cd "$(dirname "$0")/.." && pwd)"
: "${RENEWED_LINEAGE:?run it as certbot --deploy-hook}"

# install follows the symbolic links of live/ and copies the real files
install -m 644 "$RENEWED_LINEAGE/fullchain.pem" "$REPO/deploy/tls/fullchain.pem"
install -m 600 "$RENEWED_LINEAGE/privkey.pem" "$REPO/deploy/tls/privkey.pem"

cd "$REPO"
# Before the first start with HTTPS there is no frontend to reload yet
if docker compose ps --status running --services | grep -qx frontend; then
  docker compose exec -T frontend nginx -s reload
fi
