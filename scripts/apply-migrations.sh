#!/bin/bash
# =====================================================
# SESCINC-MANAGER: Apply pending migrations
# Usage:
#   1. Set SUPABASE_ACCESS_TOKEN or supabase login
#   2. Run: bash scripts/apply-migrations.sh
# =====================================================

set -e

echo "=== Applying pending migrations ==="
echo ""

MIGRATIONS=(
  "022_fix_service_schema_mismatches.sql"
  "025_vigencia_substituicoes.sql"
  "026_vagas_pendentes.sql"
)

for MIGRATION in "${MIGRATIONS[@]}"; do
  FILE="supabase/migrations/$MIGRATION"
  if [ -f "$FILE" ]; then
    echo "Applying $MIGRATION..."
    npx supabase db execute --file "$FILE" --project-ref vopyrlgmwerzvpmjnyug
    echo "  ✓ $MIGRATION applied"
    echo ""
  else
    echo "  ✗ File not found: $FILE"
  fi
done

echo "=== All migrations applied ==="
