# Question Map and persistence (#23)

Based on local SFDS sections 7.1–7.2 (CodingQuestions, QuestionProgress,
composite key and upsert), PRD 4.1 (four example topics), SAD UC-03/04
(topic filtering, external links, manual completion), and TP TC-005/006.

Run: `node --test tests/questionRepository.test.js` from the starter directory.
Tests cover seeded links/topics, complete/incomplete updates, uniqueness,
user isolation, invalid writes, and persistence across process restart.

Browser check: start the app, open Dashboard → Browse Question Map, select
one topic and then All topics, and open a question in a new tab.

Integration contract for #24:
- `createQuestionRepository(db)` uses the existing `openDb()` connection.
- `getQuestions(callback)` returns the seeded catalog.
- `getProgress(userId, callback)` returns saved rows for that user; an absent
  row means incomplete.
- `setCompleted(userId, questionId, completed, callback)` upserts 0 (incomplete)
  or 1 (complete). Callback receives `(error, changedRowCount)`.
- Unknown question IDs and invalid completion values cause database errors;
  the progress API must validate requests and map errors to controlled responses.
- User IDs are simulated, as in TimelineTasks; no User table exists yet.

This PR adds only the read-only catalog endpoint (`GET /api/questions`).
Progress API validation and browser completion controls remain for #24;
completion persistence is exercised directly through the repository here.

## Final-release completion requirements (follow-up #24)

The PRD 4.1 requires manual completion and progress for each topic. The API
alone does not satisfy that requirement. The integration must also:

- Show a labeled checkbox for each question, initialized from the active
  user's saved progress (missing rows mean incomplete).
- Save checking and unchecking through the progress API, then update that
  topic's completed/total count and percentage after a successful save.
- Keep the prior checkbox and summary values if saving fails and show an
  understandable error message.
- Restore the saved values and topic summaries after refresh/server restart.
- Keep different users' progress isolated. Opening a LeetCode link must not
  mark the question complete.

Release acceptance: check a question, verify its topic's count/percentage,
refresh, uncheck it, and verify the updated count/percentage and persistence.
Repeat with another simulated user and verify isolation. This remains a
required integration check before release; #23 alone is not the complete
coding-progress feature.

## Browser validation — 2026-10-27

Passed in headless Chromium against PR #52:

- Dashboard → Browse Question Map loads all four questions.
- Each of the four topic filters shows its matching question; All topics
  restores all four questions.
- Each question link opens its expected LeetCode problem URL in a new tab.
- Refresh reloads the catalog; a failed catalog request shows the error message.
- No browser JavaScript errors were observed.

External requests were intercepted for the new-tab checks; this verifies the
navigation URL and behavior, not live LeetCode content or availability.
T3 preview was unavailable because its browser sandbox cannot start as root;
the check used local Playwright/Chromium without changing project dependencies.
