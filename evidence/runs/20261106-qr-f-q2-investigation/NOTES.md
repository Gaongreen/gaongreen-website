# QR F-Q2 investigation (2026-11-06) - sandbox state a6db6fe, NOT the Codespace review branches (51c1cea not available here)
- On a6db6fe F-Q1..F-Q5 all pass here (3 more runs under 2x CPU load also pass: timing is not the cause here).
- E1 (decoder unavailable, simulated): reproduces the reported signature exactly - F-Q2 actual `{}`, F-Q3..F-Q5 pass, and F-Q1 ALSO fails (=2 FAIL lines).
- E2 (/tmp/claude-0 truly absent): func-tools, func-auth-settings, pinned-build, func-roundtrips, func-kissb-reports all still pass -> hard-coded path ruled out.
- NOT proven: that the Codespace failure is a missing cv2. Needs the Codespace's decoder stderr (commands in the report).
- Fix branch fix/qr-decoder-diagnostics: decoder exit codes + stderr markers, F-Q0 precondition, non-swallowed diagnostics in F-Q1/F-Q2, PYTHON_BIN override. Assertions unchanged. Full suite 167 PASS / 0 FAIL.
