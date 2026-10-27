# CMPE 131 Starter App (Appointments)

A tiny, process-friendly starter that demonstrates **UI → API → Database** for one entity.

## What’s included
- Node.js + Express backend
- SQLite database (auto-created as `database.sqlite`)
- Plain HTML pages in `public/` (no framework)
- Working endpoints:
  - GET `/api/health`
  - GET `/api/appointments`
  - GET `/api/appointments/:id`
  - POST `/api/appointments`
  - PUT `/api/appointments/:id`
  - DELETE `/api/appointments/:id`

## Run it
1. Install **Node.js (LTS)**.
2. In this folder:

   ```bash
   npm install
   npm start
   ```

3. Open in a browser:

   - http://localhost:3000

## Folder responsibilities

- `public/`: browser HTML, inline JavaScript, CSS, and images, served by Express.
- [routes/](routes/README.md): HTTP endpoints and controller handlers; call services.
- [services/](services/README.md): validation and application rules; call repositories.
- [repositories/](repositories/README.md): parameterized SQL and persistence operations.
- [tests/](tests/README.md): unit and integration tests, with Test Plan case references.
- `server.js`: Express startup and appointment API routes.
- `db.js`: SQLite connection and appointments table initialization.
- `package.json`: application commands and dependencies.
- `database.sqlite`: generated local data, never committed.

For new CareerLaunch features, requests flow from `public/` through `routes/`,
`services/`, and `repositories/` to SQLite. Keep HTTP handling in routes, business
rules in services, and SQL in repositories. Use these shared folders instead of
creating parallel folders for the same responsibility.

The instructor's appointment example remains in `server.js` and `db.js` as a
working baseline. The new folders establish where future feature code belongs;
they do not yet contain a refactored appointment implementation. Keep existing
starter files and assets in place unless a feature requires moving them.

This convention supports [issue #43](https://github.com/kristielekl/career-launch-project/issues/43),
SAD sections 3.2 and 4, SFDS section 8, and Test Plan sections 3 and 8. The documents
define responsibilities, not exact directory names. Developers should review and
agree on this convention before closing the issue.

## Recommended “CMPE 131 Implementation Scope”
Implement **one end-to-end flow** (UI → API → DB) for **one main entity**.
Everything else can be **Simulated** (stub pages, dummy data, placeholder endpoints), as long as you document it and keep traceability to PRD/SAD/SFDS and your test plan.

## Quick test (optional)
- Visit http://localhost:3000/api/health
- Create an appointment using **Create** page.
- Verify it appears on the list and can be edited/deleted.
