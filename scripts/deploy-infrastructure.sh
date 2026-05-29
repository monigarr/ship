#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "DEPRECATION: scripts/deploy-infrastructure.sh is a compatibility wrapper."
echo "Use ./scripts/terraform.sh <dev|shadow|prod> <terraform command> for direct control."
echo ""

# Preserve legacy behavior: default to dev when env is omitted.
ENV="${1:-dev}"
if [[ ! "$ENV" =~ ^(dev|shadow|prod)$ ]]; then
  echo "Usage: $0 [dev|shadow|prod]"
  echo ""
  echo "Examples:"
  echo "  $0         # apply infrastructure to dev (legacy default)"
  echo "  $0 dev     # apply infrastructure to dev"
  echo "  $0 shadow  # apply infrastructure to shadow"
  echo "  $0 prod    # apply infrastructure to prod"
  exit 1
fi

echo "=========================================="
echo "Ship - Infrastructure Deployment ($ENV)"
echo "=========================================="
echo ""

echo "Step 1: Initializing Terraform..."
"$SCRIPT_DIR/terraform.sh" "$ENV" init

echo ""
echo "Step 2: Planning infrastructure changes..."
"$SCRIPT_DIR/terraform.sh" "$ENV" plan -out=tfplan

echo ""
echo "Step 3: Applying infrastructure changes..."
echo "This will update environment: $ENV"
echo ""
read -r -p "Continue? (y/n) " -n 1 REPLY
echo
if [[ ! "$REPLY" =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled"
  exit 1
fi

"$SCRIPT_DIR/terraform.sh" "$ENV" apply tfplan
"$SCRIPT_DIR/terraform.sh" "$ENV" output

echo ""
echo "Infrastructure deployment complete for $ENV."
