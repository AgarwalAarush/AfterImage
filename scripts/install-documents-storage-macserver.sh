#!/bin/bash
# Privileged, one-time bridge update. Stage only the three named source files.
set -euo pipefail
umask 077

STAGE=${1:?Pass the absolute staged release directory}
CODE=/Users/Shared/AfterImageService/code
PRIVATE=/Users/Shared/AfterImageService/private
LABEL=dev.aarushagarwal.afterimage-storage-isolated
FILES=(scripts/storage-server.ts src/lib/documents.ts src/lib/macserver-client.ts)

[[ "$(hostname -s)" == macserver && "$(id -u)" == 0 ]] || {
  echo "Run as administrator on macserver only." >&2; exit 1;
}
[[ "$STAGE" == /* && -d "$CODE" && -d "$PRIVATE" && -f "$PRIVATE/afterimage.sqlite" ]] || {
  echo "Staging or isolated storage is missing." >&2; exit 1;
}
for file in "${FILES[@]}"; do
  [[ -f "$STAGE/$file" && ! -L "$STAGE/$file" ]] || {
    echo "Missing staged file: $file" >&2; exit 1;
  }
done

ROLLBACK=$(mktemp -d /private/tmp/afterimage-documents-code.XXXXXX)
installed=0
cleanup() {
  status=$?
  if (( status != 0 && installed )); then
    for file in "${FILES[@]}"; do
      if [[ -f "$ROLLBACK/$file" ]]; then
        /usr/bin/install -o root -g wheel -m 644 "$ROLLBACK/$file" "$CODE/$file"
      else
        /bin/rm -f "$CODE/$file"
      fi
    done
    /bin/launchctl kickstart -k "system/$LABEL" || true
    echo "Bridge code restored after failed update." >&2
  fi
  /bin/rm -rf "$ROLLBACK"
}
trap cleanup EXIT
for file in "${FILES[@]}"; do
  /bin/mkdir -p "$ROLLBACK/$(dirname "$file")"
  if [[ -f "$CODE/$file" ]]; then /bin/cp -p "$CODE/$file" "$ROLLBACK/$file"; fi
done

# A consistent snapshot precedes all code changes and stays on macserver.
/usr/bin/sudo -u _afterimage /usr/local/bin/node "$CODE/scripts/backup-sqlite.mjs" \
  "$PRIVATE/afterimage.sqlite" "$PRIVATE/backups"
installed=1
for file in "${FILES[@]}"; do
  /usr/bin/install -o root -g wheel -m 644 "$STAGE/$file" "$CODE/$file"
done
/bin/launchctl kickstart -k "system/$LABEL"

# Exercise signed actions through the same localhost bridge without logging its secret.
cd "$CODE"
for attempt in 1 2 3 4 5; do
  if /usr/bin/sudo -u _afterimage /usr/bin/env NODE_ENV=development \
    AFTERIMAGE_STORAGE=macserver AFTERIMAGE_BACKEND_URL=http://127.0.0.1:3102 \
    /usr/local/bin/node --env-file="$PRIVATE/service.env" --import tsx --input-type=module \
    -e 'import { macserverRequest } from "./src/lib/macserver-client.ts"; const docs = await macserverRequest({action:"documentList"}); const status = await macserverRequest({action:"status"}); if (!Array.isArray(docs) || !Number.isSafeInteger(status.version)) process.exit(1); console.log(`Signed document list OK; count=${docs.length}; state version=${status.version}`);'; then
    break
  fi
  if (( attempt == 5 )); then echo "Signed bridge check failed." >&2; exit 1; fi
  /bin/sleep 1
done

# The new table must be present in a fresh private snapshot and a disposable restore.
BACKUP=$(/usr/bin/sudo -u _afterimage /usr/local/bin/node "$CODE/scripts/backup-sqlite.mjs" \
  "$PRIVATE/afterimage.sqlite" "$PRIVATE/backups" | /usr/local/bin/node -e \
  'let s=""; process.stdin.on("data", x => s+=x); process.stdin.on("end", () => console.log(JSON.parse(s).path));')
RESTORE="$PRIVATE/migration/documents-release-restore-$$.sqlite"
/usr/bin/sudo -u _afterimage /usr/bin/sqlite3 "$BACKUP" ".backup '$RESTORE'"
CHECK=$(/usr/bin/sudo -u _afterimage /usr/bin/sqlite3 "$RESTORE" \
  'PRAGMA integrity_check; SELECT count(*) FROM documents;')
/bin/rm -f "$RESTORE" "$RESTORE-wal" "$RESTORE-shm"
[[ "$CHECK" == $'ok\n'* ]] || { echo "Backup restore verification failed." >&2; exit 1; }
echo "Private backup restore OK; documents table present."
