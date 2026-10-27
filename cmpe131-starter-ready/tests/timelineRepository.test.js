const test = require("node:test");
const assert = require("node:assert/strict");
const { promisify } = require("node:util");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { openDb } = require("../db");
const { createTimelineRepository } = require("../repositories/timelineRepository");

const sample = {
  title: "Practice SQL", category: "Coding", description: "Review joins",
  due_date: "2026-11-01", estimated_hours: 1.5
};

function repository(db) {
  return Object.fromEntries(Object.entries(createTimelineRepository(db))
    .map(([name, fn]) => [name, promisify(fn)]));
}

async function setup(t) {
  const db = openDb(":memory:");
  t.after(() => promisify(db.close.bind(db))());
  return repository(db);
}

test("TC-001/003/004/005: create, read, update, reopen and hard delete", async (t) => {
  const repo = await setup(t);
  assert.deepEqual(await repo.getTasks(1), []);
  const id = await repo.createTask(1, sample);
  const original = { task_id: id, user_id: 1, ...sample, status: "Planned", completed_at: null };
  assert.deepEqual(await repo.getTaskById(1, id), original);
  const updated = { ...sample, title: "SQL complete", category: "Interview",
    description: "Finished", due_date: "2026-11-02", estimated_hours: 2,
    status: "Completed", completed_at: "2026-10-27T12:00:00Z" };
  assert.equal(await repo.updateTask(1, id, updated), 1);
  assert.deepEqual(await repo.getTaskById(1, id), { task_id: id, user_id: 1, ...updated });
  assert.equal(await repo.updateTask(1, id, { ...sample, status: "In Progress" }), 1);
  assert.equal((await repo.getTaskById(1, id)).completed_at, null);
  assert.equal(await repo.deleteTask(1, id), 1);
  assert.equal(await repo.getTaskById(1, id), undefined);
  assert.deepEqual(await repo.getTasks(1), []);
});

test("TC-009: every operation is scoped to the simulated user", async (t) => {
  const repo = await setup(t);
  const id = await repo.createTask(1, sample);
  const otherId = await repo.createTask(2, sample);
  assert.deepEqual((await repo.getTasks(2)).map(task => task.task_id), [otherId]);
  assert.equal(await repo.getTaskById(2, id), undefined);
  assert.equal(await repo.updateTask(2, id, { ...sample, status: "Completed" }), 0);
  assert.equal(await repo.deleteTask(2, id), 0);
  assert.equal((await repo.getTaskById(1, id)).status, "Planned");
});

test("missing IDs return undefined or zero without changing saved tasks", async (t) => {
  const repo = await setup(t);
  await repo.createTask(1, sample);
  assert.equal(await repo.getTaskById(1, 999), undefined);
  assert.equal(await repo.updateTask(1, 999, { ...sample, status: "Planned" }), 0);
  assert.equal(await repo.deleteTask(1, 999), 0);
  assert.equal((await repo.getTasks(1)).length, 1);
});

test("queries bind text and IDs as data and list tasks by due date", async (t) => {
  const repo = await setup(t);
  const title = "O'Brien'); DROP TABLE TimelineTasks; --";
  const later = await repo.createTask(1, { ...sample, title });
  const earlier = await repo.createTask(1, { ...sample, due_date: "2026-10-30" });
  assert.equal((await repo.getTaskById(1, later)).title, title);
  assert.deepEqual((await repo.getTasks(1)).map(task => task.task_id), [earlier, later]);
  assert.equal(await repo.updateTask(1, later, { ...sample, title, status: "Planned" }), 1);
  assert.equal((await repo.getTaskById(1, later)).title, title);
  assert.deepEqual(await repo.getTasks("1 OR 1=1"), []);
  assert.equal(await repo.getTaskById(1, "1 OR 1=1"), undefined);
  assert.equal(await repo.updateTask(1, "1 OR 1=1", { ...sample, status: "Completed" }), 0);
  assert.equal(await repo.deleteTask("1 OR 1=1", later), 0);
  assert.equal(await repo.deleteTask(1, "1 OR 1=1"), 0);
});

test("constraint errors reach the caller and failed updates preserve data", async (t) => {
  const repo = await setup(t);
  await assert.rejects(repo.createTask(null, sample), /SQLITE_CONSTRAINT/);
  await assert.rejects(repo.createTask(1, { ...sample, title: null }), /SQLITE_CONSTRAINT/);
  const id = await repo.createTask(1, sample);
  await assert.rejects(repo.updateTask(1, id, { ...sample, status: "Unknown" }), /SQLITE_CONSTRAINT/);
  assert.equal((await repo.getTaskById(1, id)).status, "Planned");
});

test("saved tasks survive process restart and repeated schema initialization", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "career-launch-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filename = path.join(dir, "database.sqlite");
  const dbModule = require.resolve("../db");
  const repoModule = require.resolve("../repositories/timelineRepository");
  const common = `
    const { openDb } = require(${JSON.stringify(dbModule)});
    const { createTimelineRepository } = require(${JSON.stringify(repoModule)});
    const db = openDb(process.argv[1]);
    const repo = createTimelineRepository(db);
  `;
  execFileSync(process.execPath, ["-e", common + `
    repo.createTask(1, ${JSON.stringify(sample)}, (err) => {
      if (err) throw err;
      db.close(err => { if (err) throw err; });
    });
  `, filename]);
  const output = execFileSync(process.execPath, ["-e", common + `
    repo.getTasks(1, (err, tasks) => {
      if (err) throw err;
      console.log(JSON.stringify(tasks));
      db.close(err => { if (err) throw err; });
    });
  `, filename], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(output), [
    { task_id: 1, user_id: 1, ...sample, status: "Planned", completed_at: null }
  ]);
});
