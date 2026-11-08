# run16 notes (2026-11-05)
- url-guard first run: U-BROWSER FAILED (probe ran on a demo page whose own CSP blocked the requests before the route guard saw them, so the guard was not exercised). Fixed the test to probe from about:blank; mutation check with the OLD prefix guard fails U-BROWSER, new guard passes.
- Practical ESG page: NOT modified. Root cause = stray HTML line 160 (`<a href="k-issb-wizard.html">K-ISSB Reporting Wizard</a>`) inside the `copy.en` object literal of the single inline script -> SyntaxError -> script never runs (language switch dead, footer year empty). Introduced in commit 43b2444. Target k-issb-wizard.html does not exist in the repo.
- Verified only in a temp copy (line 160 removed): 0 page errors, language switch and year work.
