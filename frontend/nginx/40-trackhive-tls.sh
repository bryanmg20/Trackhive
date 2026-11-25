#!/bin/sh
# Picks the nginx site when the container starts (HU-42). By default HTTPS
# (https.conf, already in conf.d). With FRONTEND_TLS=off, plain HTTP on port
# 80: development, or a university proxy that serves HTTPS in front.
set -eu

case "${FRONTEND_TLS:-on}" in
  on) ;;
  off) cp /etc/nginx/trackhive/http.conf /etc/nginx/conf.d/default.conf ;;
  *)
    echo "FRONTEND_TLS must be on or off, not '${FRONTEND_TLS}'" >&2
    exit 1
    ;;
esac
