#!/bin/bash
# One-time, administrator-run preparation. Leaves the existing bridge and files intact.
set -euo pipefail
umask 077

SOURCE=/Users/agarwalaarush/Projects/AfterImage-hosted
BASE=/Users/Shared/AfterImageService
CODE="$BASE/code"
PRIVATE="$BASE/private"
ACCOUNT=_afterimage
UID_NUMBER=499
BRIDGE_PLIST=/Library/LaunchDaemons/dev.aarushagarwal.afterimage-storage-isolated.plist
BACKUP_PLIST=/Library/LaunchDaemons/dev.aarushagarwal.afterimage-backup-isolated.plist

fail() { printf '%s\n' "$*" >&2; exit 1; }
[[ "${1:-}" == --check || "${1:-}" == --apply ]] ||
  fail "Usage: bash scripts/prepare-isolated-storage-macserver.sh --check | sudo bash scripts/prepare-isolated-storage-macserver.sh --apply"
[[ "$(hostname -s)" == macserver ]] || fail "This script is restricted to macserver."
if [[ "${1:-}" == --apply ]]; then
[[ "$(id -u)" == 0 ]] || fail "Run --apply with sudo on macserver."
fi
[[ ! -e "$BASE" ]] || fail "Isolated destination already exists; inspect it before retrying."
[[ ! -e "$BRIDGE_PLIST" && ! -e "$BACKUP_PLIST" ]] || fail "Isolated daemon already installed."
account_exists=0
if dscl . -read "/Users/$ACCOUNT" >/dev/null 2>&1; then
  [[ "$(dscl . -read "/Users/$ACCOUNT" UniqueID)" == "UniqueID: $UID_NUMBER" &&
     "$(dscl . -read "/Users/$ACCOUNT" PrimaryGroupID)" == 'PrimaryGroupID: 20' &&
     "$(dscl . -read "/Users/$ACCOUNT" UserShell)" == 'UserShell: /usr/bin/false' &&
     "$(dscl . -read "/Users/$ACCOUNT" NFSHomeDirectory)" == 'NFSHomeDirectory: /var/empty' ]] ||
    fail "Existing service account differs from the expected partial setup."
  dscl . -read "/Users/$ACCOUNT" GeneratedUID >/dev/null 2>&1 ||
    fail "Existing service account has no GeneratedUID."
  if dscl . -read "/Users/$ACCOUNT" AuthenticationAuthority 2>/dev/null |
      grep -q '^AuthenticationAuthority:'; then
    fail "Existing service account has login authentication configured."
  fi
  [[ " $(id -Gn "$ACCOUNT") " != *' admin '* ]] ||
    fail "Existing service account has administrator privileges."
  account_exists=1
fi
uid_owner=$(dscl . -list /Users UniqueID | awk -v uid="$UID_NUMBER" '$2 == uid { print $1 }')
[[ -z "$uid_owner" || "$uid_owner" == "$ACCOUNT" ]] || fail "Service UID is already allocated."
[[ -f "$SOURCE/.env" && -f "$SOURCE/.data/afterimage.sqlite" ]] ||
  fail "Staged bridge environment or database is missing."
[[ -d "$SOURCE/node_modules/tsx" ]] || fail "Staged source dependencies are missing."
grep -Eq '^AFTERIMAGE_BACKEND_TOKEN=[0-9a-f]{64}$' "$SOURCE/.env" ||
  fail "Expected a dedicated 64-character hex bridge credential."
if grep -Eq '^AFTERIMAGE_(ACCESS_KEY|WORKER_TOKEN)=' "$SOURCE/.env"; then
  fail "Bridge environment must not contain owner or worker credentials."
fi
[[ -x /usr/local/bin/node && -x /usr/bin/sqlite3 ]] || fail "Required Node or SQLite binary is missing."
[[ -x /usr/bin/openssl ]] || fail "OpenSSL is required for a fresh bridge credential."
[[ -d "$SOURCE/.data/backups" && -f "$SOURCE/.data/migration/supabase-state-2026-09-25.json" ]] ||
  fail "Staged backups or private export are missing."

if [[ "${1:-}" == --check ]]; then
  printf 'Preflight passed. Account exists: %s. --apply will prepare %s, copy the staged SQLite library and backups, mint a new private bridge credential, and start localhost-only system daemons on port 3102.\n' "$account_exists" "$BASE"
  exit 0
fi

if [[ "$account_exists" == 0 ]]; then
  dscl . -create "/Users/$ACCOUNT"
  dscl . -create "/Users/$ACCOUNT" UserShell /usr/bin/false
  dscl . -create "/Users/$ACCOUNT" RealName 'AfterImage Storage Service'
  dscl . -create "/Users/$ACCOUNT" UniqueID "$UID_NUMBER"
  dscl . -create "/Users/$ACCOUNT" PrimaryGroupID 20
  dscl . -create "/Users/$ACCOUNT" NFSHomeDirectory /var/empty
  dscl . -create "/Users/$ACCOUNT" GeneratedUID "$(uuidgen)"
fi

install -d -o root -g wheel -m 755 "$BASE" "$CODE"
install -d -o "$ACCOUNT" -g staff -m 700 "$PRIVATE" "$PRIVATE/backups" "$PRIVATE/logs" "$PRIVATE/migration"
rsync -a --exclude='.git/' --exclude='.env*' --exclude='.data/' --exclude='.next/' \
  --exclude='.next-production/' --exclude='.vercel/' --exclude='.artifacts/' \
  --exclude='.assistant-runtime/' --exclude='*.log' "$SOURCE/" "$CODE/"
chown -R root:wheel "$CODE"
chmod -R go-w "$CODE"

/usr/bin/sqlite3 "$SOURCE/.data/afterimage.sqlite" ".backup '$PRIVATE/afterimage.sqlite'"
chown "$ACCOUNT":staff "$PRIVATE/afterimage.sqlite"
chmod 600 "$PRIVATE/afterimage.sqlite"
source_version=$(/usr/bin/sqlite3 "$SOURCE/.data/afterimage.sqlite" 'SELECT version FROM state WHERE id=1;')
copy_version=$(/usr/bin/sqlite3 "$PRIVATE/afterimage.sqlite" 'SELECT version FROM state WHERE id=1;')
[[ "$source_version" == "$copy_version" ]] || fail "Isolated SQLite version differs from the staged source."
[[ "$(/usr/bin/sqlite3 "$PRIVATE/afterimage.sqlite" 'PRAGMA integrity_check;')" == ok ]] ||
  fail "Isolated SQLite integrity check failed."
rsync -a "$SOURCE/.data/backups/" "$PRIVATE/backups/"
install -m 600 -o "$ACCOUNT" -g staff \
  "$SOURCE/.data/migration/supabase-state-2026-09-25.json" \
  "$PRIVATE/migration/supabase-state-2026-09-25.json"
chown -R "$ACCOUNT":staff "$PRIVATE/backups"
chmod 700 "$PRIVATE/backups"
find "$PRIVATE/backups" -type f -exec chmod 600 {} +
new_secret=$(/usr/bin/openssl rand -hex 32)
printf 'AFTERIMAGE_STORAGE=sqlite\nAFTERIMAGE_SQLITE_PATH=%s/afterimage.sqlite\nAFTERIMAGE_BACKEND_PORT=3102\nAFTERIMAGE_BACKEND_TOKEN=%s\n' \
  "$PRIVATE" "$new_secret" > "$PRIVATE/service.env"
unset new_secret
chown "$ACCOUNT":staff "$PRIVATE/service.env"
chmod 600 "$PRIVATE/service.env"

cat > "$BRIDGE_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>dev.aarushagarwal.afterimage-storage-isolated</string>
<key>UserName</key><string>$ACCOUNT</string>
<key>GroupName</key><string>staff</string>
<key>ProgramArguments</key><array><string>/usr/local/bin/node</string><string>--env-file=$PRIVATE/service.env</string><string>--import</string><string>tsx</string><string>scripts/storage-server.ts</string></array>
<key>WorkingDirectory</key><string>$CODE</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>30</integer>
<key>StandardOutPath</key><string>$PRIVATE/logs/storage.log</string>
<key>StandardErrorPath</key><string>$PRIVATE/logs/storage-error.log</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>/usr/local/bin:/usr/bin:/bin</string><key>NODE_ENV</key><string>production</string></dict>
</dict></plist>
PLIST

cat > "$BACKUP_PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>dev.aarushagarwal.afterimage-backup-isolated</string>
<key>UserName</key><string>$ACCOUNT</string>
<key>GroupName</key><string>staff</string>
<key>ProgramArguments</key><array><string>/usr/local/bin/node</string><string>$CODE/scripts/backup-sqlite.mjs</string><string>$PRIVATE/afterimage.sqlite</string><string>$PRIVATE/backups</string></array>
<key>WorkingDirectory</key><string>$CODE</string>
<key>RunAtLoad</key><true/>
<key>StartCalendarInterval</key><dict><key>Hour</key><integer>3</integer><key>Minute</key><integer>15</integer></dict>
<key>StandardOutPath</key><string>$PRIVATE/logs/backup.log</string>
<key>StandardErrorPath</key><string>$PRIVATE/logs/backup-error.log</string>
</dict></plist>
PLIST

chown root:wheel "$BRIDGE_PLIST" "$BACKUP_PLIST"
chmod 644 "$BRIDGE_PLIST" "$BACKUP_PLIST"
plutil -lint "$BRIDGE_PLIST" "$BACKUP_PLIST"
launchctl bootstrap system "$BRIDGE_PLIST"
launchctl bootstrap system "$BACKUP_PLIST"
printf 'Isolated storage prepared on macserver at localhost port 3102 with a new credential; original bridge and data remain intact.\n'
printf 'Verify both daemons, sync the new credential to Vercel privately, and verify worker-user read denial before moving traffic or removing originals.\n'
