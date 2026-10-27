# TimelineTask storage (issue #15)

Run from the application directory after installing dependencies:

```sh
node --test tests/timelineRepository.test.js
```

The tests exercise the repository independently of Express and the UI using
isolated SQLite databases. They cover CRUD, missing IDs, simulated-user isolation,
parameter binding, due-date ordering, constraint errors, and persistence across
separate Node processes. No application data is changed.

Implementation follows the local SFDS sections 7.1–7.2 (schema and SQL) and SAD
section 3.3 (Planned, In Progress, Completed; confirmed hard deletion).

Use `createTimelineRepository(db)` with the connection returned by `openDb()`.
Every method takes the active simulated user's ID first and an error-first
callback last. `createTask` returns the inserted ID; `getTasks` returns rows;
`getTaskById` returns a row or `undefined`; `updateTask` and `deleteTask` return
the number of affected rows (zero for missing or other-user IDs). SQLite errors
are passed to the callback.

Task objects use the schema's snake_case fields. Creation always starts in
Planned. Updates replace all editable fields, including status and the optional
completion timestamp. The application layer supplies validated fields and
completion timestamps and obtains confirmation before calling `deleteTask`.
The repository does not implement HTTP routes or UI behavior.

The default database is `database.sqlite` in the application directory regardless
of the process's working directory. Tests can pass a filename or `:memory:` to
`openDb`. The existing appointments table is retained.
