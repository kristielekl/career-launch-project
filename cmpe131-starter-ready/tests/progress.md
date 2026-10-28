# Progress API and Question Map verification (#24)

Developer check: 2026-10-28; not formal Alpha/Beta approval.
Baseline main: `03d1348d82747130b77fea09b7f325adb8078568`.
Reuses #52's `createQuestionRepository`, seeded catalog and QuestionProgress
table. No persistence/schema rewrite or new application dependencies.

## API contract

- `GET /api/progress`: 200, array of `{questionId, completed}` for every catalog
  question. `completed` is boolean; an absent saved row means false, without
  inserting a row during GET.
- `PUT /api/progress/:questionId`: JSON `{completed: true}` or
  `{completed: false}`. Returns the saved `{questionId, completed}` with 200.
- IDs must be positive decimal safe integers. Missing/malformed ID or invalid
  body/completion: 400. Unknown question: 404. Oversized JSON: 413.
  Database failure: 500 with a general message, never raw SQLite details.
- The server fixes the simulated active user to 1. Client user IDs in a body or
  query string cannot select another user. The URL selects the question;
  client ownership fields are ignored. This is not real authentication.
- HTTP uses booleans; the existing repository stores 0/1 with its composite
  `(user_id, question_id)` key. Repeating a save does not create duplicates.

## Acceptance evidence

Linux x64, Node 24.22.1, npm 11.9.0, Express 4.22.3, sqlite3 package 5.1.7.
`npm test`: **21 passed, 0 failed** (14 baseline plus 7 progress tests).
`git diff --check` and changed-JavaScript syntax checks passed.

| Criterion | Test | Expected / actual | Result |
| --- | --- | --- | --- |
| Progress retrieved | GET/defaults test | All four questions, unsaved defaults false, GET makes no writes | PASS |
| Completion changed | complete/repeat/reopen test | true/false round trip, one row per user/question | PASS |
| Invalid requests rejected | ID/body/JSON tests | 400/404/413, stored snapshot unchanged | PASS |
| Correct simulated user | isolation/spoof test | User 1 reads/writes only its own rows; user 2 unchanged | PASS |
| Persistence | HTTP restart and existing separate-process repository tests | Completed/incomplete values survive close/reopen and process restart | PASS |
| Safe errors | failed-upsert/read tests | Controlled 500; aborted inserts/upserts preserve saved rows | PASS |

Raw automated results: `results/2026-10-28-progress.txt`.

## Browser evidence

`tests/browser/progress-check.cjs` passed eight groups in headless Chromium
141.0.7390.37 using Playwright 1.56.1 supplied outside project dependencies.
Run from the app directory with Playwright resolvable through `NODE_PATH`:
`node tests/browser/progress-check.cjs`. Install a matching Chromium browser
in that separate test environment first. The script uses disposable application
copies and databases; it does not open the team's real database.

Actual results: `results/2026-10-28-progress-browser.txt`.

- Production server registration, Dashboard navigation, four labeled checkboxes
  and default incomplete values passed.
- Each topic filter and All topics passed.
- Check/uncheck saved through the API; counts and percentages updated after
  successful saves and survived refresh and real server restarts.
- An intercepted failed PUT restored the prior checkbox and summary, left
  stored data unchanged and allowed a successful retry.
- Two Sum opened the expected LeetCode URL in a new tab without changing
  progress. Other-user fixture data remained unchanged.
- Failed catalog/progress loads showed an understandable error and no editable
  defaults. Real-server malformed JSON returned controlled 400.
- No browser JavaScript errors were observed.

External LeetCode requests were intercepted, so live destination content was not
verified. Chromium 141 is not evidence for current Chrome/Edge/Safari
compatibility. The initially bundled Playwright browser was absent and its CDN
download returned an unavailable HTML page; testing then used the separately
installed matching Playwright/Chromium version. The initial launch failure is
an environment blocker that was resolved, not a passed browser test.

## Traceability and remaining checks

Current #24 and its #52 handoff comment require both the API and completion UI.
PRD v2.0 sections 4.1/5.1 require per-topic progress; SAD v1.0 UC-03/04,
sections 5.2.2/6.1/7.2/7.3 and VT-09/10 require manual completion, user
filtering and persistence. The September 18 SFDS export describes the Progress
Tracking component and Question Progress Update algorithm; the final submitted
SFDS and current Test Plan were not available in repository files. Do not treat
this as full verification against an unlocated final document.

No new product defect was observed in these checks. Formal QA, current browser
compatibility, release performance and integrated dashboard totals remain for
the responsible owners/QA. PR #55 is marked merged on GitHub, but this main
snapshot has no dashboard route/service; that PR's merged state is not evidence
that its dashboard changes are integrated into main. This change does not take
over #16/#25 or merge someone else's branch.
