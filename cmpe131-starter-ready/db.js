const sqlite3 = require("sqlite3").verbose();
const path = require("path");

function openDb(filename = path.join(__dirname, "database.sqlite")) {
  const db = new sqlite3.Database(filename);
  db.serialize(() => {
    db.run("PRAGMA foreign_keys = ON");
    db.run(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customerName TEXT NOT NULL,
        service TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        notes TEXT
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS TimelineTasks (
        task_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        due_date TEXT NOT NULL,
        estimated_hours REAL,
        status TEXT NOT NULL DEFAULT 'Planned'
          CHECK (status IN ('Planned', 'In Progress', 'Completed')),
        completed_at TEXT
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS CodingQuestions (
        question_id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        topic TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        external_url TEXT NOT NULL
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS QuestionProgress (
        user_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL REFERENCES CodingQuestions(question_id),
        completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
        PRIMARY KEY (user_id, question_id)
      )
    `);
    const questions = [
      [1, "Two Sum", "Arrays & Hashing", "Easy", "two-sum"],
      [2, "Valid Palindrome", "Two Pointers", "Easy", "valid-palindrome"],
      [3, "Longest Substring Without Repeating Characters", "Sliding Window",
        "Medium", "longest-substring-without-repeating-characters"],
      [4, "Valid Parentheses", "Stack", "Easy", "valid-parentheses"]
    ];
    for (const [id, title, topic, difficulty, slug] of questions) {
      db.run(`INSERT INTO CodingQuestions
        (question_id, title, topic, difficulty, external_url) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(question_id) DO NOTHING`,
      [id, title, topic, difficulty, `https://leetcode.com/problems/${slug}/`]);
    }
  });
  return db;
}

module.exports = { openDb };
