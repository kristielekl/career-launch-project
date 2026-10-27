# Timeline browser controls (#19)

Uses the existing Timeline API and repository. Covers SFDS Timeline Management
and Test Plan TC-001 through TC-004 and TC-009.

## Manual verification

1. Open `/timeline.html`, create a task, and verify its Planned status.
2. Select Edit and verify all saved fields are prefilled. Change a field,
   select Cancel, and verify the stored task is unchanged.
3. Edit and save the title, category, due date, estimated hours, and description.
   Verify the list updates and editing preserves the current status.
4. Select Start, Complete, and Reopen. Verify In Progress, Completed, and
   In Progress respectively. Refresh and restart the app; verify saved values.
5. Select Delete and cancel the confirmation; verify the task remains.
6. Confirm Delete; verify the task disappears from the list and SQLite.
7. Simulate failed update/delete requests. Verify an error appears and the
   stored task is unchanged. Cancel editing or retry after restoring access.

## Verification on 2026-10-27

All steps passed in headless Chromium, including direct SQLite checks,
empty-state display after deletion, and no browser JavaScript errors.
T3 preview reported "Chrome will not start its sandbox as root", so the
browser checks used local Chromium with `--no-sandbox` and a temporary database.
All 14 existing automated tests passed, including invalid requests,
ownership isolation, supported status transitions, and persistence.
