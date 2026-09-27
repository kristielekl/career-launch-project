const sqlite3 = require("sqlite3").verbose();

function openDb() {
  const db = new sqlite3.Database("./database.sqlite");
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
  });
  return db;
}

module.exports = { openDb };
