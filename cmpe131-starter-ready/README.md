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

## Recommended “CMPE 131 Implementation Scope”
Implement **one end-to-end flow** (UI → API → DB) for **one main entity**.
Everything else can be **Simulated** (stub pages, dummy data, placeholder endpoints), as long as you document it and keep traceability to PRD/SAD/SFDS and your test plan.

## Quick test (optional)
- Visit http://localhost:3000/api/health
- Create an appointment using **Create** page.
- Verify it appears on the list and can be edited/deleted.
