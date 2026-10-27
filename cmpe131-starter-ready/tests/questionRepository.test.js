const test = require("node:test");
const assert = require("node:assert/strict");
const { promisify } = require("node:util");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { openDb } = require("../db");
const { createQuestionRepository } = require("../repositories/questionRepository");

function repository(db) {
  return Object.fromEntries(Object.entries(createQuestionRepository(db))
    .map(([name, fn]) => [name, promisify(fn)]));
}

async function setup(t) {
  const db = openDb(":memory:");
  t.after(() => promisify(db.close.bind(db))());
  return repository(db);
}

test("catalog covers the four PRD topics with matching LeetCode links", async (t) => {
  const repo = await setup(t);
  const questions = await repo.getQuestions();
  assert.deepEqual(questions.map(q => [q.topic, q.external_url]), [
    ["Arrays & Hashing", "https://leetcode.com/problems/two-sum/"],
    ["Sliding Window", "https://leetcode.com/problems/longest-substring-without-repeating-characters/"],
    ["Stack", "https://leetcode.com/problems/valid-parentheses/"],
    ["Two Pointers", "https://leetcode.com/problems/valid-palindrome/"]
  ]);
});

test("complete, repeat and reopen keep one row per user/question and isolate users", async (t) => {
  const repo = await setup(t);
  assert.deepEqual(await repo.getProgress(1), []);
  await repo.setCompleted(1, 1, 1);
  await repo.setCompleted(1, 1, 1);
  await repo.setCompleted(2, 1, 1);
  await repo.setCompleted(1, 1, 0);
  assert.deepEqual(await repo.getProgress(1), [{ user_id: 1, question_id: 1, completed: 0 }]);
  assert.deepEqual(await repo.getProgress(2), [{ user_id: 2, question_id: 1, completed: 1 }]);
  assert.deepEqual(await repo.getProgress("1 OR 1=1"), []);
});

test("unknown questions and invalid completion fail without changing progress", async (t) => {
  const repo = await setup(t);
  await repo.setCompleted(1, 1, 1);
  for (const args of [[1, 999, 1], [1, "1 OR 1=1", 1], [1, 1, 2], [1, 1, null], [null, 1, 1]]) {
    await assert.rejects(repo.setCompleted(...args), /SQLITE_CONSTRAINT/);
  }
  assert.deepEqual(await repo.getProgress(1), [{ user_id: 1, question_id: 1, completed: 1 }]);
});

test("progress survives process restart and seeds do not duplicate or reset it", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "question-progress-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const filename = path.join(dir, "database.sqlite");
  const common = `
    const { openDb } = require(${JSON.stringify(require.resolve("../db"))});
    const { createQuestionRepository } = require(${JSON.stringify(require.resolve("../repositories/questionRepository"))});
    const db = openDb(process.argv[1]);
    const repo = createQuestionRepository(db);
  `;
  execFileSync(process.execPath, ["-e", common + `
    repo.setCompleted(1, 1, 1, err => {
      if (err) throw err;
      db.close(err => { if (err) throw err; });
    });
  `, filename]);
  const db = openDb(filename);
  const repo = repository(db);
  try {
    assert.equal((await repo.getQuestions()).length, 4);
    assert.deepEqual(await repo.getProgress(1), [{ user_id: 1, question_id: 1, completed: 1 }]);
    await repo.setCompleted(1, 1, 0);
  } finally {
    await promisify(db.close.bind(db))();
  }
  const reopened = openDb(filename);
  try {
    assert.deepEqual(await repository(reopened).getProgress(1),
      [{ user_id: 1, question_id: 1, completed: 0 }]);
  } finally {
    await promisify(reopened.close.bind(reopened))();
  }
});
