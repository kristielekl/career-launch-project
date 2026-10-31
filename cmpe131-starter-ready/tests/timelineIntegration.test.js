const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { promisify } = require("node:util");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { openDb } = require("../db");
const { createTimelineRoutes } = require("../routes/timelineRoutes");

const fields = {
  title: "Prepare resume", category: "Career", dueDate: "2026-11-01",
  description: "Review experience", estimatedHours: 1.5
};

async function start(filename) {
  const db = openDb(filename);
  const app = express();
  app.use(express.json());
  app.use("/api/tasks", createTimelineRoutes(db));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  let closed = false;
  return {
    db,
    async send(method = "GET", suffix = "", body) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/tasks${suffix}`, {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
      });
      return { status: response.status, body: await response.json() };
    },
    async close() {
      if (closed) return; // Safe to call twice (explicit close + t.after cleanup).
      closed = true;
      await new Promise(resolve => server.close(resolve));
      await promisify(db.close.bind(db))();
    }
  };
}

test("API create/list persists in SQLite across application restart", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "timeline-api-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filename = path.join(dir, "tasks.sqlite");
  let app = await start(filename);
  t.after(() => app.close());
  assert.deepEqual((await app.send()).body, []);
  const created = await app.send("POST", "", { ...fields, userId: 99 });
  assert.equal(created.status, 201);
  assert.deepEqual(created.body, { id: 1, userId: 1, ...fields, status: "Planned" });
  const row = await promisify(app.db.get.bind(app.db))("SELECT * FROM TimelineTasks WHERE task_id = 1");
  assert.equal(row.due_date, fields.dueDate);
  assert.equal(row.estimated_hours, 1.5);
  assert.equal(row.description, fields.description);
  await app.close();
  app = await start(filename);
  assert.deepEqual((await app.send()).body, [created.body]);
  assert.deepEqual((await app.send("GET", "/1")).body, created.body);
  // Close before cleanup: Windows cannot delete an open SQLite file (EBUSY).
  await app.close();
});

test("invalid input and unowned IDs never change saved tasks", async t => {
  const app = await start(":memory:");
  t.after(() => app.close());
  const created = await app.send("POST", "", fields);
  for (const invalid of [
    { title: " " }, { category: "" }, { dueDate: "2026-02-30" },
    { estimatedHours: -1 }, { estimatedHours: "2" }, { description: {} }
  ]) {
    assert.equal((await app.send("POST", "", { ...fields, ...invalid })).status, 400);
    assert.equal((await app.send("PUT", "/1", { ...fields, ...invalid })).status, 400);
  }
  await promisify(app.db.run.bind(app.db))(
    "INSERT INTO TimelineTasks (user_id, title, category, due_date) VALUES (2, 'Private', 'Career', '2026-11-01')"
  );
  for (const method of ["GET", "PUT", "DELETE"]) {
    assert.equal((await app.send(method, "/2", method === "PUT" ? fields : undefined)).status, 404);
    assert.equal((await app.send(method, "/999", method === "PUT" ? fields : undefined)).status, 404);
    assert.equal((await app.send(method, "/bad", method === "PUT" ? fields : undefined)).status, 400);
  }
  assert.deepEqual((await app.send()).body, [created.body]);
  assert.equal((await promisify(app.db.get.bind(app.db))("SELECT COUNT(*) AS count FROM TimelineTasks")).count, 2);
});

test("database errors return a controlled message", async t => {
  const app = await start(":memory:");
  t.after(() => app.close());
  await promisify(app.db.run.bind(app.db))("DROP TABLE TimelineTasks");
  for (const method of ["GET", "POST"]) {
    assert.deepEqual(await app.send(method, "", method === "POST" ? fields : undefined), {
      status: 500, body: { error: "Unable to access tasks. Please try again." }
    });
  }
});
