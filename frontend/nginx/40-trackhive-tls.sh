#!/bin/sh
# Picks the nginx site when the container starts (HU-42). By default HTTPS
# (https.conf). With FRONTEND_TLS=off, plain HTTP on port 80: development, or
# a university proxy that serves HTTPS in front. It always copies the chosen
# file, so a restart of the same container with another value also works.
set -eu

case "${FRONTEND_TLS:-on}" in
  on) site=https.conf ;;
  off) site=http.conf ;;
  *)
    echo "FRONTEND_TLS must be on or off, not '${FRONTEND_TLS}'" >&2
    exit 1
    ;;
esac
cp "/etc/nginx/trackhive/$site" /etc/nginx/conf.d/default.conf
