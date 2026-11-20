#!/usr/bin/env bash
# UX gate: temporary merge of the given branches onto solo, then the full release gate (G1-G10)
# plus the UX probe (qa/ux-gate.mjs) and the web smoke test. Never pushes the merge.
# Usage: bash qa/ux-gate.sh <workdir> "feat/ux-poker feat/ux-plain" [port=4182]
set -u
WORK=$1; BRANCHES=$2; PORT=${3:-4182}
QA=$(cd "$(dirname "$0")" && pwd)
MERGE="$BRANCHES" bash "$QA/release-gate.sh" solo "$WORK" "$PORT" > "$WORK.release.txt" 2>&1
REL=$(head -1 "$WORK.release.txt"); echo "$REL"; sed -n '2,12p' "$WORK.release.txt" | grep "❌"
R="$WORK/repo"
[ -d "$R/web/node_modules" ] || { echo "UX GATE: FAIL: clone/build missing (see $WORK.release.txt)"; exit 1; }
SMOKE=$(cd "$R/web" && npm run test:smoke 2>&1 | tail -3); SMOKE_RC=$?
(cd "$R/web" && npm run test:smoke >/dev/null 2>&1) && SMOKE_OK=1 || SMOKE_OK=0
(cd "$R/web" && node node_modules/vite/bin/vite.js preview --port "$PORT" --strictPort >/dev/null 2>&1) &
for i in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.5; done
mkdir -p "$WORK.shots"
UX=$(cd "$QA" && node ux-gate.mjs "http://localhost:$PORT/" "$R/web/public/poker-result.json" "$WORK.shots")
for pid in $(netstat -ano 2>/dev/null | grep -E "[:.]$PORT .*LISTEN" | awk '{print $NF}' | sort -u); do taskkill //PID "$pid" //F >/dev/null 2>&1 || kill "$pid" 2>/dev/null; done
echo "$UX"
echo "smoke: $([ $SMOKE_OK = 1 ] && echo green || echo RED) :: $SMOKE"
ok=1
echo "$REL" | grep -q "GATE: PASS" || ok=0
echo "$UX" | grep -q '"ux": "PASS"' || ok=0
[ $SMOKE_OK = 1 ] || ok=0
[ $ok = 1 ] && echo "UX GATE: PASS ($(git -C "$R" rev-parse --short HEAD), $(date +%H:%M))" || echo "UX GATE: FAIL ($(git -C "$R" rev-parse --short HEAD), $(date +%H:%M))"
