const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { promisify } = require("node:util");
const { openDb } = require("../db");
const dashboardRoutes = require("../routes/dashboardRoutes");

test("TC-007/009: dashboard summarizes stored data for only the active student", async t => {
  const db = openDb(":memory:");
  const run = promisify(db.run.bind(db));
  const app = express();
  app.use("/api/dashboard", dashboardRoutes(db));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await promisify(db.close.bind(db))();
  });
  const url = `http://127.0.0.1:${server.address().port}/api/dashboard`;
  const empty = await (await fetch(url)).json();
  assert.deepEqual(empty, {
    tasks: { total: 0, planned: 0, inProgress: 0, completed: 0 },
    upcoming: [], coding: { total: 4, completed: 0 }
  });
  for (let i = 7; i >= 1; i--) {
    await run(`INSERT INTO TimelineTasks (user_id, title, category, due_date, status)
      VALUES (1, ?, 'Career', ?, ?)`,
    [`Task ${i}`, `2026-11-0${i}`, i === 7 ? "Completed" : i === 1 ? "In Progress" : "Planned"]);
  }
  await run(`INSERT INTO TimelineTasks (user_id, title, category, due_date)
    VALUES (2, 'Private', 'Career', '2026-01-01')`);
  await run("INSERT INTO QuestionProgress VALUES (1, 1, 1), (1, 2, 0), (2, 2, 1)");
  const response = await fetch(url + "?userId=2");
  assert.equal(response.status, 200);
  const summary = await response.json();
  assert.deepEqual(summary.tasks, { total: 7, planned: 5, inProgress: 1, completed: 1 });
  assert.deepEqual(summary.upcoming.map(task => task.title), ["Task 1", "Task 2", "Task 3", "Task 4", "Task 5"]);
  assert.deepEqual(summary.coding, { total: 4, completed: 1 });
  await run("UPDATE TimelineTasks SET status = 'Completed' WHERE user_id = 1");
  assert.deepEqual((await (await fetch(url)).json()).upcoming, []);
  await run("DROP TABLE TimelineTasks");
  const failure = await fetch(url);
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), {
    error: "Unable to load dashboard. Please refresh to try again."
  });
});
