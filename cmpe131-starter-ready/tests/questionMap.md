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
