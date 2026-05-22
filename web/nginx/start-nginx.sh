#!/bin/sh
set -eu

envsubst '${PORT} ${API_HOST} ${API_SCHEME}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

nginx -g 'daemon off;'
