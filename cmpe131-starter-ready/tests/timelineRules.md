# Timeline backend verification (#17, #39)

Developer check: 2026-10-28. This is component evidence, not Alpha/Beta sign-off.
Baseline: main `03d1348d82747130b77fea09b7f325adb8078568`.
Environment: Linux x64, Node 24.22.1, npm 11.9.0, Express 4.22.3,
sqlite3 package 5.1.7. The team has not recorded an exact agreed Node version.
No dependencies were added. Tests use temporary files or in-memory SQLite.

## Results

After `npm install --no-audit --no-fund`, baseline `npm test`: **14 passed, 0 failed**.
The initial attempt before installation could not load express/sqlite3; it was an
environment/setup failure, not a product-test pass.
After these changes, `npm test`: **22 passed, 0 failed**.
`git diff --check` and syntax checks for changed JavaScript passed.
See `results/2026-10-28-timeline.txt` for the actual test output.

| Acceptance criterion | Implementation and test | Expected / actual | Result |
| --- | --- | --- | --- |
| Valid CRUD remains working | Existing timeline/repository/integration tests | Create 201, read/update/delete 200; persist across restart | PASS |
| Invalid input rejected | validateTask; timelineRules field/body test | 400; full database snapshot unchanged | PASS |
| Missing/invalid IDs safe | router.param; positive decimal safe-integer test | 400 invalid, 404 unknown, no mutation | PASS |
| Ownership enforced | Repository user predicates; client-user-ID test | Fixed simulated user 1; other user's read/update/delete returns 404 | PASS |
| Invalid transitions rejected | SAD matrix test and HTTP status tests | Planned -> In Progress/Completed; Completed -> In Progress; reverse-to-Planned rejected; same-state edits accepted | PASS |
| Failed requests preserve data | Invalid-input snapshots and aborting SQLite triggers | Invalid requests and failed INSERT/UPDATE/DELETE leave every row unchanged | PASS |
| Controlled errors | Router JSON parsing/error handler; production-server test | JSON 400/413/500; no SQL, paths or stack in response | PASS |

## Reproduced defects and fixes

These IDs are local evidence identifiers, not newly filed GitHub issues.
Severity is the developer's assessment; QA has not confirmed it.

| ID | Reproduction on baseline | Expected / observed before fix | Severity | Status / retest |
| --- | --- | --- | --- | --- |
| TL-01 | Create task 1; GET /api/tasks/1e0 | Reject malformed identifier / returned task 1 with 200 | Medium | Fixed; decimal-ID regression PASS |
| TL-02 | PUT task 1 with valid fields and status:null | 400 / silently kept existing status with 200 | Medium | Fixed; invalid-field regression PASS |
| TL-03 | POST /api/tasks with truncated JSON | Safe JSON 400 / HTML containing stack and local paths | Medium | Fixed; router and real server regression PASS |
| TL-04 | Complete task with completed_at:"client-controlled" | Server owns timestamp / client text stored | Medium | Fixed; server timestamp, repeated edit and reopen regression PASS |

Creation and updates now build their response from validated fields after the
single successful write. They no longer perform a second database read that
could fail after the change had already been committed. Only approved editable
fields enter storage; task/user IDs and completion timestamps are server-owned.
Zero-row update/delete results return 404.

## Design and review boundaries

Current issue #39 criteria, PR #49 and subsequent SQLite integration (#53/#54)
are the implementation baseline. SAD v1.0 sections 3.2/3.3, 5.2.2, 7.2/7.3
require user filtering, controlled errors, status rules and safe persistence.
PRD v2.0 sections 4.2/5.2 require reliability and user isolation.
The available September 18 SFDS export describes Timeline/Progress components
and algorithms, but its schema/standards sections are incomplete; its currency
relative to the team's submitted final SFDS is unverified. The current Test Plan
and Project Board fields were not available through repository files. Existing
test-case IDs are retained; no unverified Test Plan mappings are invented.

Express's official body-parser/error-handling documentation was used only to
implement parser error responses and middleware ordering:
- https://expressjs.com/en/resources/middleware/body-parser/
- https://expressjs.com/en/guide/error-handling/

The active user remains simulated, not authenticated. No main push, merge,
issue closure or QA/release approval is performed by this change. UI deletion
confirmation remains in the existing Timeline page. Alpha/Beta still need the
integrated release, browser compatibility, performance and formal QA checks.
