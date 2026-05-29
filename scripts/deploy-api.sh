#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "DEPRECATION: scripts/deploy-api.sh is a compatibility wrapper."
echo "Use ./scripts/deploy.sh <dev|shadow|prod> instead."
echo ""

# Preserve legacy behavior: default to dev when env is omitted.
ENV="${1:-dev}"
if [[ ! "$ENV" =~ ^(dev|shadow|prod)$ ]]; then
  echo "Usage: $0 [dev|shadow|prod]"
  echo ""
  echo "Examples:"
  echo "  $0         # deploy API to dev (legacy default)"
  echo "  $0 dev     # deploy API to dev"
  echo "  $0 shadow  # deploy API to shadow (UAT)"
  echo "  $0 prod    # deploy API to prod"
  exit 1
fi

exec "$SCRIPT_DIR/deploy.sh" "$ENV"
