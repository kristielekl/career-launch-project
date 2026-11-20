const { createGoalRepository } = require("../repositories/goalRepository");

function createGoalService(db) {
  const goals = createGoalRepository(db);
  return {
    list(userId) {
      return goals.list(userId);
    },
    async remove(userId, id) {
      if (!/^[1-9]\d*$/.test(String(id)) || !Number.isSafeInteger(Number(id))) {
        const error = new Error("Invalid career goal ID.");
        error.status = 400;
        throw error;
      }
      if (!await goals.remove(userId, Number(id))) {
        const error = new Error("Career goal not found.");
        error.status = 404;
        throw error;
      }
    },
    add(userId, input) {
      const text = typeof input?.text === "string" ? input.text.trim() : "";
      if (!text || text.length > 200) {
        const error = new Error("Enter a career goal between 1 and 200 characters.");
        error.status = 400;
        throw error;
      }
      return goals.add(userId, text);
    }
  };
}

module.exports = { createGoalService };
