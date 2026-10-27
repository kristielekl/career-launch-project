# Repositories

Place CareerLaunch data access functions here, grouped by feature (for example,
`timeline.js`). Encapsulate create, read, update, and delete queries and return data
or persistence errors to `../services/`.

Use parameterized SQL with `?` placeholders. Reuse the SQLite connection initialized
through `../db.js`; do not introduce a second connection setup or database location.
Keep HTTP handling and business rules in routes and services.

`../db.js` remains responsible for the SQLite connection and table initialization.
The generated `database.sqlite` file stays in the app directory and is not committed.
