const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { promisify } = require("node:util");
const { openDb } = require("../db");
const { createTimelineRoutes } = require("../routes/timelineRoutes");
const { validateTask, canChangeStatus } = require("../services/timelineService");

const fields = { title: "Prepare resume", category: "Career", dueDate: "2026-11-01" };

async function setup(t) {
  const db = openDb(":memory:");
  const app = express();
  app.use("/api/tasks", createTimelineRoutes(db));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await promisify(db.close.bind(db))();
  });
  return {
    run: promisify(db.run.bind(db)),
    rows: () => promisify(db.all.bind(db))("SELECT * FROM TimelineTasks ORDER BY task_id"),
    async send(method = "GET", suffix = "", body, raw = false) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/tasks${suffix}`, {
        method, headers: { "Content-Type": "application/json" },
        body: raw ? body : JSON.stringify(body)
      });
      assert.match(response.headers.get("content-type"), /application\/json/);
      return { status: response.status, body: await response.json() };
    }
  };
}

test("service rejects invalid body shapes and permits only the SAD status matrix", () => {
  for (const body of [undefined, null, [], "task", 42, true]) {
    assert.ok(validateTask(body).length);
  }
  const states = ["Planned", "In Progress", "Completed"];
  const allowed = [[true, true, true], [false, true, true], [false, true, true]];
  states.forEach((current, i) => states.forEach((next, j) => {
    assert.equal(canChangeStatus(current, next), allowed[i][j], `${current} -> ${next}`);
  }));
  for (const status of [null, "complete", "Deleted", 1, {}, []]) {
    assert.ok(validateTask({ ...fields, status }).length);
    assert.equal(canChangeStatus("Planned", status), false);
  }
});

test("missing and invalid create/update fields leave every stored row unchanged", async t => {
  const api = await setup(t);
  assert.equal((await api.send("POST", "", fields)).status, 201);
  const before = await api.rows();
  const invalid = [null, [], {}, { ...fields, title: " " }, { ...fields, title: 1 },
    { ...fields, category: null }, { ...fields, category: " " },
    { ...fields, dueDate: "2026-02-29" }, { ...fields, dueDate: "2026-13-01" },
    { ...fields, dueDate: 20261101 }, { ...fields, estimatedHours: -1 },
    { ...fields, estimatedHours: "2" }, { ...fields, estimatedHours: {} },
    { ...fields, description: false }, { ...fields, status: null },
    { ...fields, status: "Deleted" }];
  for (const field of ["title", "category", "dueDate"]) {
    const missing = { ...fields };
    delete missing[field];
    invalid.push(missing);
  }
  for (const body of invalid) {
    for (const [method, suffix] of [["POST", ""], ["PUT", "/1"]]) {
      assert.equal((await api.send(method, suffix, body)).status, 400, JSON.stringify(body));
      assert.deepEqual(await api.rows(), before);
    }
  }
});

test("IDs must be positive decimal safe integers for read, update and delete", async t => {
  const api = await setup(t);
  await api.send("POST", "", fields);
  const before = await api.rows();
  for (const id of ["bad", "0", "-1", "1.0", "1e0", "0x1", "01", "%201", "1%20",
    "9007199254740992", "1%20OR%201=1"]) {
    for (const method of ["GET", "PUT", "DELETE"]) {
      assert.equal((await api.send(method, `/${id}`, method === "PUT" ? fields : undefined)).status, 400, id);
    }
  }
  for (const method of ["GET", "PUT", "DELETE"]) {
    assert.equal((await api.send(method, "/999", method === "PUT" ? fields : undefined)).status, 404);
  }
  assert.deepEqual(await api.rows(), before);
});

test("client user IDs cannot expose or mutate another simulated user's task", async t => {
  const api = await setup(t);
  await api.send("POST", "", { ...fields, userId: 2, user_id: 2 });
  await api.run("INSERT INTO TimelineTasks (user_id, title, category, due_date) VALUES (2, 'Private', 'Career', '2026-11-01')");
  const before = await api.rows();
  assert.equal((await api.send("GET", "?userId=2")).body.length, 1);
  assert.equal((await api.send("GET", "/1")).body.userId, 1);
  for (const method of ["GET", "PUT", "DELETE"]) {
    assert.deepEqual(await api.send(method, "/2?userId=2", method === "PUT" ? { ...fields, userId: 2 } : undefined),
      { status: 404, body: { error: "Task not found." } });
  }
  assert.deepEqual(await api.rows(), before);
});

test("completion timestamps are server-owned, preserved on edits and cleared on reopening", async t => {
  const api = await setup(t);
  const created = await api.send("POST", "", { ...fields, title: "  Prepare resume  ", completed_at: "fake" });
  assert.equal(created.body.title, fields.title);
  assert.equal((await api.rows())[0].completed_at, null);
  await api.send("PUT", "/1", { ...fields, status: "Completed", completed_at: "fake" });
  const timestamp = (await api.rows())[0].completed_at;
  assert.ok(Number.isFinite(Date.parse(timestamp)));
  assert.notEqual(timestamp, "fake");
  await api.send("PUT", "/1", { ...fields, title: "Edited", completed_at: "fake" });
  assert.equal((await api.rows())[0].completed_at, timestamp);
  const before = await api.rows();
  assert.equal((await api.send("PUT", "/1", { ...fields, status: "Planned" })).status, 400);
  assert.deepEqual(await api.rows(), before);
  assert.equal((await api.send("PUT", "/1", { ...fields, status: "In Progress" })).status, 200);
  assert.equal((await api.rows())[0].completed_at, null);
});

test("malformed, scalar and oversized JSON return controlled errors without writes", async t => {
  const api = await setup(t);
  await api.send("POST", "", fields);
  const before = await api.rows();
  for (const [method, suffix] of [["POST", ""], ["PUT", "/1"]]) {
    for (const body of ['{"title":', '"task"', "true", "42"]) {
      assert.deepEqual(await api.send(method, suffix, body, true), {
        status: 400, body: { error: "Request body must be valid JSON." }
      });
    }
    const large = { ...fields, description: "x".repeat(110000) };
    assert.deepEqual(await api.send(method, suffix, large), {
      status: 413, body: { error: "Request body is too large." }
    });
  }
  assert.deepEqual(await api.rows(), before);
  assert.equal((await api.send()).status, 200);
});

test("SQLite write failures are masked and preserve previously stored data", async t => {
  const api = await setup(t);
  await api.send("POST", "", fields);
  const before = await api.rows();
  for (const operation of ["INSERT", "UPDATE", "DELETE"]) {
    await api.run(`CREATE TRIGGER fail_write BEFORE ${operation} ON TimelineTasks
      BEGIN SELECT RAISE(ABORT, 'private SQLite details'); END`);
    const method = { INSERT: "POST", UPDATE: "PUT", DELETE: "DELETE" }[operation];
    assert.deepEqual(await api.send(method, method === "POST" ? "" : "/1", method === "DELETE" ? undefined : fields),
      { status: 500, body: { error: "Unable to access tasks. Please try again." } });
    assert.deepEqual(await api.rows(), before);
    await api.run("DROP TRIGGER fail_write");
  }
  assert.equal((await api.send("PUT", "/1", { ...fields, title: "Retry" })).status, 200);
  assert.equal((await api.send("DELETE", "/1")).status, 200);
  assert.deepEqual((await api.send()).body, []);
});
