# Applying this work to your Codespace without disturbing the pending merge

Never run these inside `/workspaces/gaongreen-merge-review` (the pending merge, MERGE_HEAD present). Use the main repo directory or a NEW worktree. Nothing below uses reset, force, rebase, or `--index`/`--3way`.

1. Safety copy (read-only): `cp -a /workspaces/gaongreen-merge-review /tmp/gaongreen-review-backup-$(date +%s)` (optional if your earlier backup is current).
2. Verify the file: `sha256sum -c gaongreen-recovery.bundle.sha256` (checksums delivered with the bundle).
3. `git bundle verify gaongreen-recovery.bundle`. It requires prerequisite commit `a6db6fe`; if your repo lacks it, tell me and I'll build a bundle on your base.
4. Fetch into a SEPARATE branch: `git fetch gaongreen-recovery.bundle integration/lead-eng:review/lead-eng-recovery` (creates a new local branch; touches nothing else).
5. Inspect: `git log --oneline a6db6fe..review/lead-eng-recovery` and `git diff --stat a6db6fe review/lead-eng-recovery`.
6. Test in a new worktree: `git worktree add ../gaongreen-lead-eng review/lead-eng-recovery`, then `cd ../gaongreen-lead-eng && bash tests/run-all.sh /tmp/lead-eng-run` (needs node, playwright+chromium, python3 with OpenCV: set `PYTHON_BIN` to your venv python).
7. Integrate into your own branch only after review, and only when the pending merge is finished or aborted by you.
