const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { promisify } = require("node:util");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { openDb } = require("../db");
const { createProgressRoutes } = require("../routes/progressRoutes");
const { createProgressService } = require("../services/progressService");

async function start(t, filename = ":memory:") {
  const db = openDb(filename);
  const app = express();
  app.use("/api/progress", createProgressRoutes(db));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    await new Promise(resolve => server.close(resolve));
    await promisify(db.close.bind(db))();
  }
  t.after(close);
  return {
    db, close, run: promisify(db.run.bind(db)),
    rows: () => promisify(db.all.bind(db))("SELECT * FROM QuestionProgress ORDER BY user_id, question_id"),
    async send(method = "GET", suffix = "", body, raw = false) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/progress${suffix}`, {
        method, headers: { "Content-Type": "application/json" },
        body: raw ? body : JSON.stringify(body)
      });
      assert.match(response.headers.get("content-type"), /application\/json/);
      return { status: response.status, body: await response.json() };
    }
  };
}

test("GET includes incomplete defaults; complete/repeat/reopen persist one row", async t => {
  const api = await start(t);
  const initial = await api.send();
  assert.equal(initial.status, 200);
  assert.equal(initial.body.length, 4);
  assert.ok(initial.body.every(row => row.completed === false));
  assert.deepEqual(await api.rows(), []);
  for (const completed of [true, true, false]) {
    assert.deepEqual(await api.send("PUT", "/1", { completed }),
      { status: 200, body: { questionId: 1, completed } });
    assert.equal((await api.send()).body.find(row => row.questionId === 1).completed, completed);
    assert.deepEqual(await api.rows(), [{ user_id: 1, question_id: 1, completed: completed ? 1 : 0 }]);
  }
});

test("missing, malformed and nonexistent question IDs are rejected without writes", async t => {
  const api = await start(t);
  await api.send("PUT", "/1", { completed: true });
  const before = await api.rows();
  for (const suffix of ["", "/bad", "/0", "/-1", "/1.0", "/1e0", "/0x1", "/01",
    "/%201", "/1%20", "/9007199254740992", "/1%20OR%201=1"]) {
    assert.equal((await api.send("PUT", suffix, { completed: false })).status, 400, suffix);
    assert.deepEqual(await api.rows(), before);
  }
  assert.deepEqual(await api.send("PUT", "/999", { completed: true }),
    { status: 404, body: { error: "Question not found." } });
  assert.deepEqual(await api.rows(), before);
});

test("only boolean completion in an object is accepted; failures preserve all users", async t => {
  const api = await start(t);
  await api.send("PUT", "/1", { completed: true });
  await api.run("INSERT INTO QuestionProgress VALUES (2, 1, 1)");
  const before = await api.rows();
  for (const body of [undefined, null, [], {}, { completed: null }, { completed: 0 },
    { completed: 1 }, { completed: "true" }, { completed: "Complete" },
    { completed: [] }, { completed: {} }]) {
    assert.equal((await api.send("PUT", "/1", body)).status, 400, JSON.stringify(body));
    assert.deepEqual(await api.rows(), before);
  }
});

test("simulated user ignores client ownership and other users keep separate progress", async t => {
  const api = await start(t);
  await api.run("INSERT INTO QuestionProgress VALUES (2, 1, 1)");
  assert.equal((await api.send("GET", "?userId=2")).body.find(row => row.questionId === 1).completed, false);
  await api.send("PUT", "/1?userId=2", { completed: false, userId: 2, user_id: 2 });
  assert.deepEqual(await api.rows(), [
    { user_id: 1, question_id: 1, completed: 0 }, { user_id: 2, question_id: 1, completed: 1 }
  ]);
  const otherUser = await createProgressService(api.db).getProgress(2);
  assert.equal(otherUser.find(row => row.questionId === 1).completed, true);
});

test("malformed/scalar/oversized JSON is controlled and never changes progress", async t => {
  const api = await start(t);
  await api.send("PUT", "/1", { completed: true });
  const before = await api.rows();
  for (const body of ['{"completed":', "true", '"false"', "42"]) {
    assert.deepEqual(await api.send("PUT", "/1", body, true), {
      status: 400, body: { error: "Request body must be valid JSON." }
    });
  }
  assert.deepEqual(await api.send("PUT", "/1", { completed: false, extra: "x".repeat(110000) }),
    { status: 413, body: { error: "Request body is too large." } });
  assert.deepEqual(await api.rows(), before);
  assert.equal((await api.send()).status, 200);
});

test("failed SQLite upserts preserve rows; database read errors never expose internals", async t => {
  const api = await start(t);
  await api.send("PUT", "/1", { completed: true });
  const before = await api.rows();
  await api.run(`CREATE TRIGGER fail_progress BEFORE INSERT ON QuestionProgress
    BEGIN SELECT RAISE(ABORT, 'private SQL and path'); END`);
  const expected = { status: 500, body: { error: "Unable to access progress. Please try again." } };
  assert.deepEqual(await api.send("PUT", "/1", { completed: false }), expected);
  assert.deepEqual(await api.send("PUT", "/2", { completed: true }), expected);
  assert.deepEqual(await api.rows(), before);
  await api.run("DROP TRIGGER fail_progress");
  assert.equal((await api.send("PUT", "/1", { completed: false })).status, 200);
  await api.run("DROP TABLE QuestionProgress");
  assert.deepEqual(await api.send(), expected);
  await api.run("DROP TABLE CodingQuestions");
  assert.deepEqual(await api.send("PUT", "/1", { completed: true }), expected);
});

test("HTTP progress saves survive closing and reopening the application database", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "progress-api-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filename = path.join(dir, "database.sqlite");
  const first = await start(t, filename);
  await first.send("PUT", "/1", { completed: true });
  await first.close();
  const second = await start(t, filename);
  assert.equal((await second.send()).body.find(row => row.questionId === 1).completed, true);
  await second.send("PUT", "/1", { completed: false });
  await second.close();
  const third = await start(t, filename);
  assert.equal((await third.send()).body.find(row => row.questionId === 1).completed, false);
  // Close before cleanup: Windows cannot delete an open SQLite file (EBUSY).
  await third.close();
});
