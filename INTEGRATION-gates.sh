#!/usr/bin/env bash
# Integration gates G1–G5 (+G6 lint). No keys, no live chain. Usage: bash INTEGRATION-gates.sh [--fast]
#   --fast skips npm ci and the anvil rehearsal (use when only docs/PROGRESS changed).
set -u
export PATH="$HOME/.foundry/bin:$PATH"
R="$(cd "$(dirname "$0")" && pwd)"
FAST=${1:-}
ok() { printf '%s ✅ %s\n' "$1" "$2"; }
no() { printf '%s ❌ %s\n' "$1" "$2"; }
q() { "$@" >/tmp/gate.log 2>&1; }
unset_keys() { env -u REFEREE_PRIVATE_KEY -u BOTBET_ENV_FILE "$@"; }

cd "$R/shared"; [ "$FAST" = --fast ] || q npm ci
q npm run build && ok G1 "shared builds" || no G1 "shared build: $(tail -1 /tmp/gate.log)"

cd "$R/referee"; [ "$FAST" = --fast ] || q npm ci
if q npx tsc --noEmit; then
  if unset_keys npm run play-game >/tmp/gate.log 2>&1 && grep -q 'Nothing was sent' /tmp/gate.log; then
    t=$(npm test 2>&1 | grep -E '^ℹ (pass|fail)' | tr '\n' ' ')
    ok G2 "tsc, keyless play-game, npm test: $t"
  else no G2 "play-game: $(tail -1 /tmp/gate.log)"; fi
else no G2 "tsc: $(head -1 /tmp/gate.log)"; fi

cd "$R/contracts"
q forge build && forge test 2>&1 | grep -q ' 0 failed' && ok G3 "$(forge test 2>&1 | grep -oE '[0-9]+ tests passed' | tail -1)" || no G3 "forge: $(grep -m1 -E 'FAIL|Error' /tmp/gate.log)"

cd "$R/web"; [ "$FAST" = --fast ] || q npm ci
if q npm run build; then
  s=$(npm run test:smoke 2>&1 | tail -1)
  ok G4 "web build; data: $(ls public/*.json | xargs -n1 basename | tr '\n' ' '); $s"
else no G4 "web build: $(grep -m1 -E 'error' /tmp/gate.log)"; fi

if [ "$FAST" = --fast ]; then echo "G5 ⏭ skipped (--fast)"; else
  cd "$R/referee"
  unset_keys npm run rehearse:local >/tmp/gate.log 2>&1 && grep -q 'REHEARSAL PASSED' /tmp/gate.log \
    && ok G5 "$(grep -o 'REHEARSAL PASSED.*' /tmp/gate.log)" || no G5 "rehearse:local: $(tail -1 /tmp/gate.log)"
fi

cd "$R"
bad=$(grep -rnIi 'trustless' --exclude-dir=node_modules --exclude-dir=lib --exclude-dir=dist --exclude='INTEGRATION*' . | grep -viE 'not trustless|never.{0,12}trustless|no .?trustless' | head -3)
scripts=$(node -e 'console.log(Object.keys(require("./referee/package.json").scripts).join(" "))')
missing=""
for f in README.md docs/demo-runbook.md INTEGRATION-runbook-draft.md INTEGRATION-readme-draft.md; do
  [ -f "$f" ] || continue
  for s in $(grep -oE 'npm run [a-z:-]+' "$f" | awk '{print $3}' | sort -u); do
    case " $scripts dev build preview test:smoke lint " in *" $s "*) ;; *) missing="$missing $f:$s";; esac
  done
done
[ -z "$bad$missing" ] && ok G6 "docs commands exist; no trustless claim" || no G6 "trustless:[$bad] unknown scripts:[$missing]"
git status --short | grep -v '^??' | head -3
