#!/usr/bin/env bash
# Release gate: fresh clone of a branch, keyless judge path, page checks.
# Usage: bash qa/release-gate.sh [branch=solo] [workdir] [port=4175]
# Never needs keys, never sends transactions (.env is copied from .env.example only).
set -u
BRANCH=${1:-solo}
WORK=${2:-${TMPDIR:-/tmp}/botbet-gate}
PORT=${3:-4175}
QA=$(cd "$(dirname "$0")" && pwd)
LOG="$WORK/gate.log"
rm -rf "$WORK"; mkdir -p "$WORK"; : > "$LOG"
fails=(); results=()
pass() { results+=("✅ $1: $2"); }
fail() { results+=("❌ $1: $2"); fails+=("$1"); }
run()  { echo "### $* [$(date +%H:%M:%S)]" >> "$LOG"; "$@" >> "$LOG" 2>&1; local rc=$?; echo "### rc=$rc" >> "$LOG"; return $rc; }

cd "$WORK"
run git clone -q -b "$BRANCH" https://github.com/MarBacc/BotBet.git repo || { echo "SOLO RELEASE GATE: FAIL (1): clone failed"; exit 1; }
cd repo
# MERGE=feat/demo simulates "solo after merging that branch" (local throwaway clone, never pushed)
if [ -n "${MERGE:-}" ]; then
  run git fetch -q origin "$MERGE" && run git merge --no-edit -q FETCH_HEAD \
    || { echo "SOLO RELEASE GATE: FAIL (1): $BRANCH + $MERGE does not merge cleanly: $(git diff --name-only --diff-filter=U | tr '\n' ' ')"; exit 1; }
  BRANCH="$BRANCH+$MERGE@$(git rev-parse --short FETCH_HEAD)"
fi
SHA=$(git rev-parse --short HEAD)

# 1) judge README, not the internal one
if grep -q "Run it yourself" README.md && ! grep -q "Fill these in as they become true" README.md; then pass G1 "judge README"; else fail G1 "README on $BRANCH is the internal one (no 'Run it yourself' / has 'Fill these in')"; fi

# 2) placeholders
ph=$(grep -nF -e "[video link" -e "[team" -e "<validated" README.md | tr '\n' ' ')
[ -z "$ph" ] && pass G2 "no placeholders" || fail G2 "placeholders: $ph"

# 3) keyless judge path
k=""
cp .env.example .env
(cd shared && run npm install && run npm run build) || k+="shared "
(cd referee && run npm install) || k+="referee-install "
(cd referee && run npm run play-game && grep -q "Nothing was sent to the chain" "$LOG") || k+="play-game "
(cd referee && run npm run check-setup) || k+="check-setup "
(cd referee && run npm run replay-last) || k+="replay-last "
(cd referee && run npm test) || k+="npm-test "
(cd web && run npm install && run npm run build) || k+="web-build "
(cd web && node node_modules/vite/bin/vite.js preview --port "$PORT" --strictPort >> "$LOG" 2>&1) & PREVIEW=$!
for i in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.5; done
PAGE=$(cd "$QA" && node gate-page.mjs "http://localhost:$PORT/" 2>>"$LOG")
kill $PREVIEW 2>/dev/null
for pid in $(netstat -ano 2>/dev/null | grep -E "[:.]$PORT .*LISTEN" | awk '{print $NF}' | sort -u); do taskkill //PID "$pid" //F >/dev/null 2>&1 || kill "$pid" 2>/dev/null; done
[ -n "$PAGE" ] || k+="preview "
[ -z "$k" ] && pass G3 "keyless path (play-game, check-setup, replay-last, npm test, web build+preview)" || fail G3 "failed: $k(see $LOG)"

j() { node -e "const d=JSON.parse(process.argv[1]);console.log($1)" "$PAGE" 2>/dev/null; }
# 4) console errors
if [ -n "$PAGE" ] && [ "$(j 'd.errs.length')" = "0" ] && [ "$(j 'd.sample')" = "false" ] && [ "$(j 'd.presentEnd')" = "true" ]; then
  pass G4 "0 console errors, real data, Present end screen"
else fail G4 "errs=$(j 'JSON.stringify(d.errs)') sample=$(j 'd.sample') presentEnd=$(j 'd.presentEnd')"; fi

# 5) links match data (page hrefs + README), testnet explorer only
DATA="web/public/result.json web/public/cap-demo.json LIVE-RUNS.md shared/deployments.json docs/arc.md"
known=$(grep -ohE "0x[0-9a-fA-F]{40,64}" $DATA | tr 'A-F' 'a-f' | sort -u)
cand=$( { j 'd.hrefs.join("\n")'; cat README.md; } | grep -oE "0x[0-9a-fA-F]{40,64}" | tr 'A-F' 'a-f' | sort -u)
bad=$(comm -23 <(echo "$cand") <(echo "$known") | tr '\n' ' ')
hosts=$( { j 'd.hrefs.join("\n")'; cat README.md; } | grep -oE "https?://[a-z0-9.-]*(explorer|scan)[a-z0-9.-]*" | sort -u | grep -v "^https://explorer.testnet.arc.io$" | tr '\n' ' ')
[ -z "$bad$hosts" ] && pass G5 "all hashes/addresses in data, testnet explorer only" || fail G5 "not in data: ${bad:-none}; other explorers: ${hosts:-none}"

# 6) mobile overflow
ov=$(j 'd.overflow'); [ "$ov" = "0" ] && pass G6 "mobile 390px overflow 0" || fail G6 "mobile overflow ${ov:-?}px"

# 7) screenshots referenced and present
refs=$(grep -oE "docs/screenshots/[A-Za-z0-9._-]+" README.md | sort -u)
missing=""; for r in $refs; do [ -f "$r" ] || missing+="$r "; done
if [ -z "$refs" ]; then fail G7 "README references no docs/screenshots/* files"
elif [ -n "$missing" ]; then fail G7 "missing: $missing"
else pass G7 "README references $(echo $refs | wc -w) screenshot(s), all exist"; fi

# 8) runbook commands exist
if [ ! -f docs/demo-runbook.md ]; then fail G8 "docs/demo-runbook.md not on $BRANCH"
else
  scripts=$(cat */package.json | node -e "let s='';process.stdin.on('data',c=>s+=c).on('end',()=>{const n=new Set();for(const m of s.matchAll(/\"scripts\"\s*:\s*\{([^}]*)\}/g))for(const k of m[1].matchAll(/\"([^\"]+)\"\s*:/g))n.add(k[1]);console.log([...n].join(' '))})")
  miss=""; for c in $(grep -oE "npm run [a-z:-]+" docs/demo-runbook.md | awk '{print $3}' | sort -u); do echo " $scripts " | grep -q " $c " || miss+="$c "; done
  [ -z "$miss" ] && pass G8 "runbook npm scripts all exist" || fail G8 "runbook uses missing scripts: $miss"
fi

# 9) cap refusal wording matches data: an on-chain refusedTxHash must not be described as "not broadcast"/simulation-only
rtx=$(grep -oE '"refusedTxHash"[^"]*"0x[0-9a-fA-F]{64}"' web/public/cap-demo.json | grep -oE "0x[0-9a-fA-F]{64}")
if [ -n "$rtx" ]; then
  stale=$(grep -nE "not broadcast|no reverting transaction|simulation, not a mined" README.md docs/*.md 2>/dev/null | cut -d: -f1,2 | tr '\n' ' ')
  inreadme=$(grep -ci "$rtx" README.md)
  [ -z "$stale" ] && [ "$inreadme" != "0" ] && pass G9 "on-chain refusal ${rtx:0:10}… described and linked in README" \
    || fail G9 "cap-demo.json has on-chain refusal ${rtx:0:10}… but docs say simulated/not broadcast at: ${stale:-none}; README links it: $inreadme"
else
  grep -q "Refused on-chain" web/src/CapCard.tsx && ! grep -q "simulated" web/src/CapCard.tsx && fail G9 "page says on-chain refusal but no refusedTxHash in data" || pass G9 "refusal described as simulated, no refusal tx in data"
fi

# 10) bot registry: every house bot verifies against its registered hash on this checkout (CRLF on Windows)
if [ -f referee/src/registry/register-bot.ts ]; then
  bad=""; nb=0
  for d in referee/src/registry/house/*/ referee/src/registry/house/*/*/; do
    [ -f "$d/bot.json" ] || continue; nb=$((nb+1))
    name=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).name)" "$d/bot.json")
    out=$(cd referee && npx tsx src/registry/register-bot.ts --verify "$name" --dir "${d#referee/}" 2>&1 | tail -1)
    echo "$out" | grep -q "VERIFIED" || bad+="$name; "
  done
  [ -z "$bad" ] && pass G10 "registry: $nb house bots VERIFIED (autocrlf=$(git config core.autocrlf))" || fail G10 "registry verify MISMATCH: ${bad}(autocrlf=$(git config core.autocrlf))"
else pass G10 "no bot registry on this branch"; fi

n=${#fails[@]}
if [ "$n" = 0 ]; then echo "SOLO RELEASE GATE: PASS ($BRANCH @ $SHA, $(date +%H:%M))"
else echo "SOLO RELEASE GATE: FAIL ($n): ${fails[*]} ($BRANCH @ $SHA, $(date +%H:%M))"; fi
printf '%s\n' "${results[@]}"
echo "log: $LOG"
