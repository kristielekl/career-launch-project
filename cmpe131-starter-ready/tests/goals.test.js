const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { promisify } = require("node:util");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { openDb } = require("../db");
const { createGoalService } = require("../services/goalService");
const goalRoutes = require("../routes/goalRoutes");
const close = db => promisify(db.close.bind(db))();

test("career goals persist after reopening SQLite and stay scoped to their student", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "career-goals-test-"));
  let db = openDb(path.join(dir, "goals.sqlite"));
  t.after(async () => { await close(db); await rm(dir, { recursive: true, force: true }); });
  let goals = createGoalService(db);
  assert.deepEqual(await goals.list(1), []);
  const first = await goals.add(1, { text: "  Get an internship  " });
  const second = await goals.add(1, { text: "Complete 30 LeetCode questions" });
  const privateGoal = await goals.add(2, { text: "Another student's goal" });
  await close(db);
  db = openDb(path.join(dir, "goals.sqlite"));
  goals = createGoalService(db);
  assert.deepEqual(await goals.list(1), [first, second]);
  assert.deepEqual(first.text, "Get an internship");
  assert.deepEqual(await goals.list(2), [privateGoal]);
});

test("career goal API validates text, ignores supplied identity, and handles database failures", async t => {
  const db = openDb(":memory:");
  const app = express();
  app.use(express.json());
  app.use("/api/goals", goalRoutes(db));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await close(db); });
  const url = `http://127.0.0.1:${server.address().port}/api/goals`;
  const post = body => fetch(url + "?userId=2", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
  });
  assert.deepEqual(await (await fetch(url)).json(), []);
  for (const body of [null, {}, { text: 123 }, { text: [] }, { text: "" },
    { text: " \t\n " }, { text: "x".repeat(201) }]) {
    const response = await post(body);
    assert.equal(response.status, 400);
  }
  assert.deepEqual(await (await fetch(url)).json(), []);
  const text = "<img src=x onerror=alert(1)> '; DROP TABLE CareerGoals; --";
  const saved = await post({ text, userId: 2, user_id: 2 });
  assert.equal(saved.status, 201);
  const goal = await saved.json();
  assert.equal(goal.text, text);
  const limit = await post({ text: "x".repeat(200) });
  assert.equal(limit.status, 201);
  const goals = createGoalService(db);
  await goals.add(2, { text: "Private" });
  assert.deepEqual(await (await fetch(url + "?userId=2")).json(), [goal, await limit.json()]);
  assert.deepEqual((await goals.list(2)).map(goal => goal.text), ["Private"]);
  await promisify(db.run.bind(db))("DROP TABLE CareerGoals");
  const loadFailure = await fetch(url);
  assert.equal(loadFailure.status, 500);
  assert.deepEqual(await loadFailure.json(), { error: "Unable to load career goals. Please try again." });
  const saveFailure = await post({ text: "Get an internship" });
  assert.equal(saveFailure.status, 500);
  assert.deepEqual(await saveFailure.json(), { error: "Unable to save career goal. Please try again." });
});
