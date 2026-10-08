#!/bin/sh
# Garante que /data (volume Railway/Coolify) seja gravável pelo usuário da app.
# Sem isso, o SQLite cai para /app/data (efêmero) e uploads/API somem no redeploy.
set -eu

DATA_ROOT="${DATA_ROOT:-/data}"

mkdir -p \
  "$DATA_ROOT" \
  "$DATA_ROOT/ordens-compra-anexos" \
  "$DATA_ROOT/treinamentos-evidencias"

fix_data_perms() {
  if chown -R nextjs:nodejs "$DATA_ROOT" 2>/dev/null; then
    return 0
  fi
  # Alguns mounts só aceitam chmod amplo
  chmod -R a+rwX "$DATA_ROOT" 2>/dev/null || true
}

probe_write() {
  probe="$DATA_ROOT/.aionscope-write-test"
  if touch "$probe" 2>/dev/null; then
    rm -f "$probe"
    return 0
  fi
  return 1
}

if [ "$(id -u)" = "0" ]; then
  fix_data_perms
  if ! su-exec nextjs:nodejs sh -c "touch '$DATA_ROOT/.aionscope-write-test' && rm -f '$DATA_ROOT/.aionscope-write-test'"; then
    echo "WARN: $DATA_ROOT ainda não gravável por nextjs — tentando chmod a+rwX" >&2
    chmod -R a+rwX "$DATA_ROOT" 2>/dev/null || true
  fi
  exec su-exec nextjs:nodejs "$@"
fi

if ! probe_write; then
  echo "WARN: $DATA_ROOT não é gravável (uid=$(id -u)). SQLite pode usar disco efêmero." >&2
fi

exec "$@"
