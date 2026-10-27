# Tests

Place automated unit and integration tests here. Unit tests should exercise service
rules independently; integration tests should cover routes, services, repositories,
and SQLite together. Use disposable test data and an isolated test database.

Reference applicable Test Plan case IDs in test names or descriptions, such as
TC-001 (create TimelineTask), TC-002 (invalid input), and TC-009 (user data isolation).
Run `npm test` from `cmpe131-starter-ready` after installing dependencies.
The tests cover repository CRUD, status rules, API create/read persistence after
reopening the application database, invalid input, user isolation, and database errors.

Keep manual scenarios and test results here as Markdown when automation is not
available, recording inputs, expected and actual results, and the tested commit.
For Timeline Create/View, also check the empty state, Cancel, submit, validation
messages, and saved tasks after browser refresh and application restart.
