# Dashboard UI — issue #16

References: PRD §5.1 dashboard; SAD §5.1 FR-04 and UC-05; SFDS §4
Dashboard component; Test Plan TC-007 (stored summaries) and TC-009 (isolation).

`GET /api/dashboard` aggregates existing task and question repositories for the
same simulated active user (1) as the task API. No schema, dependency, or login
changes. It returns task counts, the first five unfinished tasks in due-date
order, and manually reported coding completion counts. Profile/goal setup is
explicitly labeled future work; coding progress is read from QuestionProgress,
not verified with LeetCode. Completion controls and the Progress API are provided by merged PR #58 (#24).

Run `npm test`. At `/dashboard.html`, verify:

- An empty database shows helpful task, upcoming-task and coding empty states.
- Create Task opens the Timeline creation form. Create a sample task, return
  to Dashboard and verify the count and due date. Manage Timeline opens the list.
- Complete a task on Timeline and revisit Dashboard: Completed increases and
  that task leaves Upcoming. Reopen/delete it and verify counts change.
- Stored coding progress displays completed/total and percentage; another
  simulated user's progress is excluded. Text containing HTML displays literally.
- A failed dashboard request displays an error and clears the loading message.

Together with the Timeline controls PR and the existing create/view flow, this
covers #16's UI acceptance criteria. Merge both PRs before closing the issue.

## Integration verification — 2026-10-29

PR #55 originally merged into `feat/timeline-controls-19` instead of `main`.
Its dashboard changes are now applied to main `71cce37`, preserving the current
Timeline validation and Progress API registrations from #57/#58.

- All 30 automated tests passed on Node 22.22.3, including dashboard stored
  summaries, due-date ordering, user isolation, empty states and safe errors.
- Headless Chromium 141 / Playwright 1.56.1 passed dashboard creation/navigation,
  stored task counts, safe text rendering, complete/reopen, Progress UI updates
  reflected as dashboard totals, actual server restart persistence, canceled
  and confirmed deletion, and failed-load feedback without browser JS errors.
- All eight existing Progress browser-check groups also passed with dashboard
  integration applied. External LeetCode requests were intercepted.

Raw results: `results/2026-10-29-dashboard-integration.txt`.
These are developer integration checks; formal QA and current Chrome/Edge/Safari
compatibility remain separate.
