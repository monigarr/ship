#!/bin/sh
set -eu

export PORT="${PORT:-10000}"
export API_HOST="${API_HOST:?API_HOST must be set}"
export API_SCHEME="${API_SCHEME:-http}"
export API_PORT="${API_PORT:-}"
export API_HEALTH_FALLBACK="${API_HEALTH_FALLBACK:-0}"
export PROXY_CONNECT_TIMEOUT="${PROXY_CONNECT_TIMEOUT:-5s}"
export PROXY_READ_TIMEOUT="${PROXY_READ_TIMEOUT:-60s}"
export PROXY_SEND_TIMEOUT="${PROXY_SEND_TIMEOUT:-60s}"
export API_STARTUP_CHECK_MODE="${API_STARTUP_CHECK_MODE:-warn}"
export API_STARTUP_CHECK_PATH="${API_STARTUP_CHECK_PATH:-/health}"
export API_STARTUP_CHECK_RETRIES="${API_STARTUP_CHECK_RETRIES:-3}"
export API_STARTUP_CHECK_TIMEOUT_SECONDS="${API_STARTUP_CHECK_TIMEOUT_SECONDS:-2}"

case "$API_SCHEME" in
  http|https) ;;
  *)
    echo "ERROR: API_SCHEME must be 'http' or 'https' (got '$API_SCHEME')" >&2
    exit 1
    ;;
esac

if [ -z "$API_PORT" ]; then
  if [ "$API_SCHEME" = "https" ]; then
    API_PORT=443
  else
    API_PORT=80
  fi
fi

API_UPSTREAM="${API_SCHEME}://${API_HOST}:${API_PORT}"

echo "Starting nginx with API upstream: ${API_UPSTREAM}" >&2

api_health_check_url="${API_UPSTREAM%/}${API_STARTUP_CHECK_PATH}"
api_upstream_ready=0

case "$API_STARTUP_CHECK_MODE" in
  off)
    echo "Startup check disabled (API_STARTUP_CHECK_MODE=off)." >&2
    api_upstream_ready=1
    ;;
  warn|fail) ;;
  *)
    echo "ERROR: API_STARTUP_CHECK_MODE must be one of: off, warn, fail (got '$API_STARTUP_CHECK_MODE')" >&2
    exit 1
    ;;
esac

if [ "$api_upstream_ready" -ne 1 ]; then
  if ! command -v wget >/dev/null 2>&1; then
    if [ "$API_STARTUP_CHECK_MODE" = "fail" ]; then
      echo "ERROR: wget is required for API startup checks when mode=fail." >&2
      exit 1
    fi

    echo "WARNING: wget not found; skipping API startup checks." >&2
    api_upstream_ready=1
  fi
fi

if [ "$api_upstream_ready" -ne 1 ]; then
  attempt=1
  while [ "$attempt" -le "$API_STARTUP_CHECK_RETRIES" ]; do
    if wget --quiet --spider --timeout="$API_STARTUP_CHECK_TIMEOUT_SECONDS" "$api_health_check_url"; then
      api_upstream_ready=1
      echo "API startup check passed on attempt ${attempt}: ${api_health_check_url}" >&2
      break
    fi

    echo "API startup check failed on attempt ${attempt}/${API_STARTUP_CHECK_RETRIES}: ${api_health_check_url}" >&2
    attempt=$((attempt + 1))
  done
fi

if [ "$api_upstream_ready" -ne 1 ]; then
  if [ "$API_STARTUP_CHECK_MODE" = "fail" ]; then
    echo "ERROR: API upstream failed startup check; refusing to start nginx." >&2
    exit 1
  fi

  echo "WARNING: API upstream failed startup check; continuing because API_STARTUP_CHECK_MODE=warn." >&2
fi

envsubst '${PORT} ${API_HOST} ${API_SCHEME} ${API_PORT} ${API_UPSTREAM} ${API_HEALTH_FALLBACK} ${PROXY_CONNECT_TIMEOUT} ${PROXY_READ_TIMEOUT} ${PROXY_SEND_TIMEOUT}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

nginx -g 'daemon off;'
