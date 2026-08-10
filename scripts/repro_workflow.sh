#!/usr/bin/env bash
# Reproduction locale des 4 étapes du workflow auto-publish (diagnostic crash).
set -u
cd /d/TravaillerEnCI

# Charge .env.local dans l'environnement
while IFS= read -r line; do
  line=$(echo "$line" | xargs)
  [ -z "$line" ] && continue
  case "$line" in
    \#*) continue ;;
  esac
  key="${line%%=*}"
  val="${line#*=}"
  val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
  export "$key=$val"
done < .env.local

# Alias SUPABASE_URL (ExamRepository attend ce nom)
if [ -z "${SUPABASE_URL:-}" ] && [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]; then
  export SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
fi

echo "SUPABASE_URL: ${SUPABASE_URL:-ABSENT}"
echo "SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:+present}"
echo ""

for step in 1 2 3 4; do
  case $step in
    1) cmd="python scraper/scraper.py --maintenance-only" ;;
    2) cmd="python scraper/exams_runner.py --maintenance-only" ;;
    3) cmd="python scraper/exams_runner.py --cleanup-noise --apply" ;;
    4) cmd="python scraper/alert_digest.py" ;;
  esac
  echo "================ ÉTAPE $step : $cmd ================"
  if PYTHONIOENCODING=utf-8 bash -c "$cmd" > /tmp/step_$step.log 2>&1; then
    echo "✅ ÉTAPE $step OK — $(tail -1 /tmp/step_$step.log)"
  else
    echo "❌ ÉTAPE $step A ÉCHOUÉ (exit $?)"
    echo "--- dernières lignes du log ---"
    tail -30 /tmp/step_$step.log
  fi
  echo ""
done
