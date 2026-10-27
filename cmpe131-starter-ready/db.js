const sqlite3 = require("sqlite3").verbose();
const path = require("path");

function openDb(filename = path.join(__dirname, "database.sqlite")) {
  const db = new sqlite3.Database(filename);
  db.serialize(() => {
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
  });
  return db;
}

module.exports = { openDb };
