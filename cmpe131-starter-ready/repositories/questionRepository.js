// Reuse openDb(); completion is manually reported, never verified with LeetCode.
function createQuestionRepository(db) {
  return {
    getQuestions(callback) {
      db.all("SELECT * FROM CodingQuestions ORDER BY topic, question_id", [], callback);
    },

    getProgress(userId, callback) {
      db.all(`SELECT user_id, question_id, completed FROM QuestionProgress
        WHERE user_id = ? ORDER BY question_id`, [userId], callback);
    },

    setCompleted(userId, questionId, completed, callback) {
      db.run(`INSERT INTO QuestionProgress (user_id, question_id, completed)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, question_id)
        DO UPDATE SET completed = excluded.completed`,
      [userId, questionId, completed],
      function (err) { callback(err, this?.changes); });
    }
  };
}

module.exports = { createQuestionRepository };
