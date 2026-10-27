// Reuse the connection from openDb(); callbacks receive (error, result).
function createTimelineRepository(db) {
  return {
    createTask(userId, task, callback) {
      db.run(
        `INSERT INTO TimelineTasks
          (user_id, title, category, description, due_date, estimated_hours)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, task.title, task.category, task.description ?? null,
          task.due_date, task.estimated_hours ?? null],
        function (err) { callback(err, this?.lastID); }
      );
    },

    getTasks(userId, callback) {
      db.all(
        "SELECT * FROM TimelineTasks WHERE user_id = ? ORDER BY due_date ASC, task_id ASC",
        [userId], callback
      );
    },

    getTaskById(userId, taskId, callback) {
      db.get(
        "SELECT * FROM TimelineTasks WHERE task_id = ? AND user_id = ?",
        [taskId, userId], callback
      );
    },

    // Full replacement of editable fields; ownership and ID cannot change.
    updateTask(userId, taskId, task, callback) {
      db.run(
        `UPDATE TimelineTasks
         SET title = ?, category = ?, description = ?, due_date = ?,
             estimated_hours = ?, status = ?, completed_at = ?
         WHERE task_id = ? AND user_id = ?`,
        [task.title, task.category, task.description ?? null, task.due_date,
          task.estimated_hours ?? null, task.status, task.completed_at ?? null,
          taskId, userId],
        function (err) { callback(err, this?.changes); }
      );
    },

    // Call only after the application has obtained deletion confirmation.
    deleteTask(userId, taskId, callback) {
      db.run(
        "DELETE FROM TimelineTasks WHERE task_id = ? AND user_id = ?",
        [taskId, userId],
        function (err) { callback(err, this?.changes); }
      );
    }
  };
}

module.exports = { createTimelineRepository };
