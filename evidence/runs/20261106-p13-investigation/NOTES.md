# P13 investigation (2026-11-06). Worktree /home/claude/p13-wt, branch fix/p13-hermetic (from a6db6fe). Codespace files NOT inspected.
- Old P13 ran `node tools/build-pinned.js` with default args in the repo root, so ./vendor and ./dist-pinned of the CHECKOUT were test inputs/outputs.
- Reproduced the exact reported failure ("exit 0; dist-pinned exists=true") with (A) a valid non-fixture vendor/ and (B) a fixture vendor/ in the repo root.
- Real build behaviour was correct in A (valid hashes -> builds). B exposed a fail-open gap: fixture manifest in default vendor/ produced a pseudo-release.
- Fix: P13 hermetic (default invocation in controlled working dirs); new P13b (SDK without MANIFEST), P13c (fixture refused); build refuses fixture manifests unless --allow-fixture; pinned-build tmp dir uses os.tmpdir().
- Mutation: removing the fixture refusal makes P13c FAIL. Stale repo-root dist-pinned/ is left untouched by the test.
- Full suite: 165 PASS / 0 FAIL, 14 result files, exit 0.
- NOTE: an earlier intermediate run of mine showed "PASS=14 FAIL=0" while the script had crashed at P13b (fixture dir mutated by P8); caught by checking exit code/crash marker. Intermediate outputs F0/FA/FB from that attempt are overwritten by the corrected runs.
