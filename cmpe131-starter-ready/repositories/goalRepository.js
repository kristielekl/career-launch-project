const { promisify } = require("node:util");

function createGoalRepository(db) {
  const all = promisify(db.all.bind(db));
  return {
    list(userId) {
      return all(`SELECT goal_id AS id, text FROM CareerGoals
        WHERE user_id = ? ORDER BY goal_id`, [userId]);
    },
    add(userId, text) {
      return new Promise((resolve, reject) => {
        db.run("INSERT INTO CareerGoals (user_id, text) VALUES (?, ?)",
          [userId, text], function (error) {
            if (error) return reject(error);
            resolve({ id: this.lastID, text });
          });
      });
    }
  };
}

module.exports = { createGoalRepository };
