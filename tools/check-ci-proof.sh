#!/usr/bin/env bash
# READ-ONLY. Proves that the live staging security tests PASSED in GitHub Actions for EXACTLY the commit that is about to be built/deployed.
# Requires: clean tracked tree, HEAD == the pushed tip of the recovery branch, and a recent successful "Live staging tests" run for that very commit whose
# live job and its test step both concluded success (a skipped/neutral/failed step does not count). Needs the GitHub CLI (gh) logged in. No passwords involved.
# Exit 0 = proven; 2 = not proven (reason printed). MAX_AGE_HOURS (default 24) bounds how old the passing run may be.
set -uo pipefail
REPO="${GG_REPO:-Gaongreen/gaongreen-website}"; BR="recovery/lead-eng-2afe977"; WF="live-staging-tests.yml"; MAXH="${MAX_AGE_HOURS:-24}"
no(){ echo "NOT PROVEN: $*" >&2; exit 2; }
git rev-parse --git-dir >/dev/null 2>&1 || no "not inside the git repository"
SHA="$(git rev-parse HEAD)"
[ -z "$(git status --porcelain --untracked-files=no)" ] || no "tracked files are modified; deploy only a committed, pushed state"
git fetch -q origin "$BR" 2>/dev/null || no "cannot fetch origin/$BR"
[ "$(git rev-parse FETCH_HEAD)" = "$SHA" ] || no "HEAD ($(echo "$SHA" | cut -c1-8)) is not the pushed tip of $BR ($(git rev-parse FETCH_HEAD | cut -c1-8)); git pull first"
command -v gh >/dev/null 2>&1 || no "GitHub CLI (gh) not found"
RUNS="$(gh api "repos/$REPO/actions/workflows/$WF/runs?head_sha=$SHA&per_page=30" 2>/dev/null)" || no "cannot read workflow runs (gh not logged in?)"
IDS="$(printf '%s' "$RUNS" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s),max=Number(process.argv[1])*3600e3,now=Date.now();console.log((j.workflow_runs||[]).filter(r=>r.head_sha===process.argv[2]&&r.head_branch===process.argv[3]&&r.conclusion==="success"&&["push","workflow_dispatch"].includes(r.event)&&now-Date.parse(r.updated_at)<=max).map(r=>r.id).join(" "))}catch(e){console.log("")}})' "$MAXH" "$SHA" "$BR")"
[ -n "$IDS" ] || no "no successful $WF run for commit $(echo "$SHA" | cut -c1-8) within $MAXH h (trigger one: Actions > Live staging tests > Run workflow, then approve under Review deployments)"
for ID in $IDS; do
  JOBS="$(gh api "repos/$REPO/actions/runs/$ID/jobs" 2>/dev/null)" || continue
  OK="$(printf '%s' "$JOBS" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const l=(j.jobs||[]).find(x=>/^Live /.test(x.name));const st=l&&(l.steps||[]).find(x=>/^Live staging security tests/.test(x.name));console.log(l&&l.conclusion==="success"&&st&&st.conclusion==="success"?"yes":"no")}catch(e){console.log("no")}})')"
  [ "$OK" = yes ] && { echo "PROVEN: live staging tests passed in run $ID for commit $(echo "$SHA" | cut -c1-8)"; exit 0; }
done
no "a run exists but its live job/test step did not conclude success"
