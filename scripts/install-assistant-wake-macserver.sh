#!/bin/bash
# Administrator-only bridge-first rollout. Credentials and backups never leave macserver.
set -euo pipefail
umask 077
STAGE=${1:?Pass the absolute staged release directory}
MODE=${2:---check}
BASE=/Users/Shared/AfterImageService
CODE="$BASE/code"
PRIVATE="$BASE/private"
BRIDGE_LABEL=dev.aarushagarwal.afterimage-storage-isolated
BRIDGE_PLIST="/Library/LaunchDaemons/$BRIDGE_LABEL.plist"
WORKER_USER=agarwalaarush
WORKER_LABEL=dev.aarushagarwal.afterimage-assistant
WORKER_PLIST="/Users/$WORKER_USER/Library/LaunchAgents/$WORKER_LABEL.plist"
FILES=(scripts/storage-server.ts scripts/assistant-wake-server.ts src/lib/assistant-storage.ts scripts/check-assistant-release.ts)
fail() { echo "$*" >&2; exit 1; }
[[ "$(hostname -s)" == macserver && "$(id -u)" == 0 ]] || fail 'Run as administrator on macserver.'
[[ "$MODE" == --check || "$MODE" == --install || "$MODE" == --verify || "$MODE" == --recover-rollback ]] || fail 'Expected --check, --install, --verify or --recover-rollback.'
[[ "$STAGE" == /* && -d "$STAGE" && ! -L "$STAGE" ]] || fail 'Invalid stage.'
[[ -f "$PRIVATE/afterimage.sqlite" && -f "$BRIDGE_PLIST" && -f "$WORKER_PLIST" ]] || fail 'Existing isolated services are required.'
run() { /usr/bin/sudo -u _afterimage /usr/local/bin/node "$@"; }
backup() { run scripts/backup-sqlite.mjs "$PRIVATE/afterimage.sqlite" "$PRIVATE/backups" | /usr/local/bin/node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>console.log(JSON.parse(s).path))'; }
idle() { run --import tsx scripts/check-assistant-release.ts idle "$PRIVATE/afterimage.sqlite"; }
reload_service() {
  local domain=$1 label=$2 plist=$3 attempt
  if /bin/launchctl print "$domain/$label" >/dev/null 2>&1; then
    /bin/launchctl bootout "$domain/$label"
  fi
  # launchd removal is asynchronous. Wait until the old registration disappears;
  # no storage action or queued mutation is replayed by this service operation.
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    if ! /bin/launchctl print "$domain/$label" >/dev/null 2>&1; then break; fi
    (( attempt < 10 )) || return 1
    /bin/sleep 1
  done
  for attempt in 1 2 3 4 5; do
    /bin/launchctl bootstrap "$domain" "$plist" || true
    /bin/sleep 1
    if /bin/launchctl print "$domain/$label" >/dev/null 2>&1; then return; fi
    (( attempt < 5 )) || return 1
  done
}
probe() {
  /usr/bin/sudo -u _afterimage /usr/bin/env NODE_ENV=development AFTERIMAGE_STORAGE=macserver AFTERIMAGE_BACKEND_URL=http://127.0.0.1:3102 \
    /usr/local/bin/node --env-file="$PRIVATE/service.env" --env-file="$PRIVATE/assistant-wake.env" --import tsx --input-type=module <<'JS'
import {macserverRequest} from './src/lib/macserver-client.ts';
if(!Number.isSafeInteger((await macserverRequest({action:'status'})).version))throw Error('Signed status failed.');
const stop=new AbortController(),timeout=setTimeout(()=>stop.abort(),3000);
try {
 const r=await fetch('http://127.0.0.1:3104/internal/assistant/events',{headers:{Authorization:`Bearer ${process.env.AFTERIMAGE_ASSISTANT_WAKE_TOKEN}`},signal:stop.signal});
 if(r.status!==200||!r.body)throw Error('Wake authentication failed.');
 const frame=new TextDecoder().decode((await r.body.getReader().read()).value);
 if(!frame.startsWith('event: connected\ndata: {}\n\n'))throw Error('Invalid wake stream.');
 console.log('Signed storage and local wake authentication OK.');
}finally{clearTimeout(timeout);stop.abort();}
JS
}
cd "$CODE"
if [[ "$MODE" == --recover-rollback ]]; then
  # Archive only an unused credential after proving the previous release is restored.
  /bin/launchctl print "system/$BRIDGE_LABEL" >/dev/null
  /bin/launchctl print "gui/$(id -u "$WORKER_USER")/$WORKER_LABEL" >/dev/null
  if /usr/sbin/lsof -nP -iTCP:3104 -sTCP:LISTEN >/dev/null; then fail 'Wake listener is active; recovery refused.'; fi
  python3 - "$PRIVATE" "$CODE" "$BRIDGE_PLIST" "$WORKER_PLIST" <<'PY'
import os,pathlib,plistlib,sys
private,code,bridge,worker=map(pathlib.Path,sys.argv[1:])
releases=sorted(private.glob('assistant-wake-release-*'))
if not releases:raise SystemExit('Missing rollback snapshot.')
release=releases[-1]
for active,saved in ((bridge,release/'bridge.plist'),(worker,release/'worker.plist')):
 if active.read_bytes()!=saved.read_bytes():raise SystemExit('Service configuration differs from rollback snapshot.')
 with active.open('rb') as f:p=plistlib.load(f)
 if any('assistant-wake' in arg for arg in p['ProgramArguments']):raise SystemExit('Wake configuration remains active.')
 if 'assistant-wake' in p['WorkingDirectory']:raise SystemExit('Wake worker remains active.')
for name in ('scripts/storage-server.ts','scripts/assistant-wake-server.ts','src/lib/assistant-storage.ts','scripts/check-assistant-release.ts'):
 saved=release/name;active=code/name
 if pathlib.Path(str(saved)+'.absent').exists():
  if active.exists():raise SystemExit('Unexpected wake source remains active.')
 elif active.read_bytes()!=saved.read_bytes():raise SystemExit('Bridge source differs from rollback snapshot.')
source=private/'assistant-wake.env';target=release/'unused-wake.env'
if not source.is_file() or source.is_symlink() or target.exists():raise SystemExit('Invalid unused wake configuration.')
os.rename(source,target)
print('Previous release verified; unused wake credential archived on macserver.')
PY
  exit 0
fi
if [[ "$MODE" == --verify ]]; then
  probe
  python3 - "$WORKER_PLIST" "$WORKER_USER" "$WORKER_LABEL" <<'PY'
import os,plistlib,pwd,re,subprocess,sys
with open(sys.argv[1],'rb') as f:p=plistlib.load(f)
if '--env-file=.env.assistant-wake' not in p['ProgramArguments']:raise SystemExit('Wake worker configuration is not installed.')
domain='gui/'+str(pwd.getpwnam(sys.argv[2]).pw_uid)+'/'+sys.argv[3]
state=subprocess.check_output(['/bin/launchctl','print',domain],text=True)
match=re.search(r'\n\s*pid = (\d+)\n',state)
if not match or '\n\tstate = running\n' not in state or p['WorkingDirectory'] not in state:raise SystemExit('Expected worker release is not running.')
subprocess.run(['/usr/sbin/lsof','-a','-p',match[1],'-iTCP:3104','-sTCP:ESTABLISHED'],stdout=subprocess.DEVNULL,check=True)
print('Expected worker release running with an established local wake connection.')
PY
  BACKUP=$(backup)
  RESTORE="$PRIVATE/migration/assistant-wake-restore-$$.sqlite"
  /usr/bin/sudo -u _afterimage /usr/bin/sqlite3 "$BACKUP" ".backup '$RESTORE'"
  run --import tsx scripts/check-assistant-release.ts verify "$RESTORE"
  /bin/rm -f "$RESTORE" "$RESTORE-wal" "$RESTORE-shm"
  echo 'Post-release local backup restore verified. Check Vercel traffic and desktop behavior separately.'
  exit 0
fi
for file in "${FILES[@]}" worker/assistant.ts worker/assistant-runtime.ts worker/assistant-wake.ts package-lock.json; do
  [[ -f "$STAGE/$file" && ! -L "$STAGE/$file" ]] || fail "Missing staged source: $file"
done
[[ -f "$STAGE/release.sha256" && ! -L "$STAGE/release.sha256" ]] || fail 'Missing source manifest.'
# Only fixed allowlisted paths are accepted; no manifest can read private host files.
python3 - "$STAGE" <<'PY'
import hashlib,pathlib,sys
root=pathlib.Path(sys.argv[1]); expected={'scripts/storage-server.ts','scripts/assistant-wake-server.ts','src/lib/assistant-storage.ts','scripts/check-assistant-release.ts','worker/assistant.ts','worker/assistant-runtime.ts','worker/assistant-wake.ts','package-lock.json'}
found=set()
for line in (root/'release.sha256').read_text().splitlines():
 digest,name=line.split('  ',1)
 if name not in expected or name in found:raise SystemExit('Invalid source manifest.')
 found.add(name)
 if hashlib.sha256((root/name).read_bytes()).hexdigest()!=digest:raise SystemExit('Source digest mismatch.')
if found!=expected:raise SystemExit('Incomplete source manifest.')
print('Reviewed source manifest OK.')
PY
CURRENT=$(/usr/libexec/PlistBuddy -c 'Print :WorkingDirectory' "$WORKER_PLIST")
[[ "$CURRENT" == "/Users/$WORKER_USER/Projects/AfterImage-assistant-"* && -d "$CURRENT/node_modules" ]] || fail 'Inspect the current assistant release before installation.'
python3 - "$STAGE/package-lock.json" "$CURRENT/node_modules/.package-lock.json" <<'PY'
import json,sys
with open(sys.argv[1]) as f:expected=json.load(f)['packages']
with open(sys.argv[2]) as f:installed=json.load(f)['packages']
seen=set()
def check(name,optional=False):
 key='node_modules/'+name
 if key in seen:return
 seen.add(key)
 if optional and key not in installed:return
 if key not in expected or key not in installed:raise SystemExit('Missing pinned assistant dependency.')
 a,b=expected[key],installed[key]
 if any(a.get(k)!=b.get(k) for k in ('version','resolved','integrity')):raise SystemExit('Assistant dependency lock mismatch.')
 for dep in a.get('dependencies',{}):check(dep)
 for dep in a.get('optionalDependencies',{}):check(dep,True)
check('tsx');check('zod')
print('Pinned assistant dependency closure matches; existing bytes will be reused.')
PY
[[ "$(/usr/bin/sudo -u _afterimage /usr/bin/sqlite3 "$PRIVATE/afterimage.sqlite" "SELECT count(*) FROM assistant_migrations WHERE id='legacy-v1';")" == 1 ]] || fail 'Activate the compatible conversation release first.'
idle
if [[ "$MODE" == --check ]]; then echo 'Wake rollout preflight passed. No files or services changed.'; exit 0; fi
[[ ! -e "$PRIVATE/assistant-wake.env" ]] || fail 'Wake configuration already exists; verify the prior installation before reapplying.'
RELEASE="$PRIVATE/assistant-wake-release-$(date -u +%Y%m%dT%H%M%SZ)"
NEW="/Users/$WORKER_USER/Projects/AfterImage-assistant-wake-$(date -u +%Y%m%dT%H%M%SZ)"
[[ ! -e "$NEW" ]] || fail 'Worker release destination exists.'
/bin/mkdir -m 700 "$RELEASE"
/bin/cp -p "$BRIDGE_PLIST" "$RELEASE/bridge.plist"
/bin/cp -p "$WORKER_PLIST" "$RELEASE/worker.plist"
for file in "${FILES[@]}"; do
  /bin/mkdir -p "$RELEASE/$(dirname "$file")"
  if [[ -f "$CODE/$file" ]]; then /bin/cp -p "$CODE/$file" "$RELEASE/$file"; else /usr/bin/touch "$RELEASE/$file.absent"; fi
done
BEFORE=$(backup)
echo 'Macserver-only pre-release snapshot created.'
RESTORE="$PRIVATE/migration/assistant-wake-preflight-$$.sqlite"
/usr/bin/sudo -u _afterimage /usr/bin/sqlite3 "$BEFORE" ".backup '$RESTORE'"
run --import tsx scripts/check-assistant-release.ts verify "$RESTORE"
/bin/rm -f "$RESTORE" "$RESTORE-wal" "$RESTORE-shm"
installed=0; switched=0
rollback() {
  status=$?
  if (( status != 0 && installed )); then
    for file in "${FILES[@]}"; do
      if [[ -f "$RELEASE/$file.absent" ]]; then /bin/rm -f "$CODE/$file"; else /usr/bin/install -o root -g wheel -m 644 "$RELEASE/$file" "$CODE/$file"; fi
    done
    /bin/cp -p "$RELEASE/bridge.plist" "$BRIDGE_PLIST"
    /bin/cp -p "$RELEASE/worker.plist" "$WORKER_PLIST"
    reload_service system "$BRIDGE_LABEL" "$BRIDGE_PLIST" || true
    if (( switched )); then
      reload_service "gui/$(id -u "$WORKER_USER")" "$WORKER_LABEL" "$WORKER_PLIST" || true
    fi
    echo 'Service code/configuration restored; authoritative data was not rolled back. Retained wake files require inspection before retry.' >&2
  fi
}
trap rollback EXIT
/usr/bin/install -d -o "$WORKER_USER" -g staff -m 700 "$NEW"
/usr/bin/rsync -a --exclude=node_modules --exclude='.env*' --exclude='.data/' --exclude='.artifacts/' --exclude='.assistant-runtime/' --exclude='.git/' --exclude='.next*/' --exclude='.vercel/' --exclude='*.log' "$CURRENT/" "$NEW/"
# rsync preserves the old release directory owner; this new worker-only copy
# must belong to its existing worker account, without following dependency links.
/usr/sbin/chown -R -P "$WORKER_USER:staff" "$NEW"
/bin/chmod 700 "$NEW"
/bin/ln -s "$CURRENT/node_modules" "$NEW/node_modules"
for file in worker/assistant.ts worker/assistant-runtime.ts worker/assistant-wake.ts; do /usr/bin/install -o "$WORKER_USER" -g staff -m 644 "$STAGE/$file" "$NEW/$file"; done
/usr/bin/install -o "$WORKER_USER" -g staff -m 600 "$CURRENT/.env" "$NEW/.env"
python3 - "$PRIVATE/assistant-wake.env" "$NEW/.env.assistant-wake" "$WORKER_USER" <<'PY'
import os,pwd,secrets,sys
contents='AFTERIMAGE_ASSISTANT_WAKE_TOKEN='+secrets.token_hex(32)+'\n'
for name,user in ((sys.argv[1],'_afterimage'),(sys.argv[2],sys.argv[3])):
 fd=os.open(name,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as f:f.write(contents)
 p=pwd.getpwnam(user);os.chown(name,p.pw_uid,p.pw_gid)
PY
installed=1
for file in "${FILES[@]}"; do /usr/bin/install -o root -g wheel -m 644 "$STAGE/$file" "$CODE/$file"; done
/usr/bin/plutil -insert ProgramArguments.2 -string "--env-file=$PRIVATE/assistant-wake.env" "$BRIDGE_PLIST"
reload_service system "$BRIDGE_LABEL" "$BRIDGE_PLIST"
for attempt in 1 2 3 4 5; do if probe; then break; fi; (( attempt < 5 )) || fail 'Bridge probe failed.'; /bin/sleep 1; done
idle
python3 - "$WORKER_PLIST" "$NEW" <<'PY'
import plistlib,sys
with open(sys.argv[1],'rb') as f:p=plistlib.load(f)
p['WorkingDirectory']=sys.argv[2]
p['ProgramArguments']=[p['ProgramArguments'][0],'--env-file=.env','--env-file=.env.assistant-wake','--import','tsx','worker/assistant.ts']
with open(sys.argv[1],'wb') as f:plistlib.dump(p,f)
PY
# The loaded LaunchAgent must be re-bootstrapped to pick up changed arguments/directory.
switched=1
reload_service "gui/$(id -u "$WORKER_USER")" "$WORKER_LABEL" "$WORKER_PLIST"
echo 'Bridge installed before assistant worker. Run --verify and inspect live idle request cadence. Previous code, plists and dependency directory retained.'
