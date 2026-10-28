const { promisify } = require("node:util");
const { createQuestionRepository } = require("../repositories/questionRepository");

function createProgressService(db) {
  const repo = Object.fromEntries(Object.entries(createQuestionRepository(db))
    .map(([name, fn]) => [name, promisify(fn)]));

  return {
    async getProgress(userId) {
      const [questions, progress] = await Promise.all([
        repo.getQuestions(), repo.getProgress(userId)
      ]);
      const completed = new Set(progress.filter(row => row.completed === 1)
        .map(row => row.question_id));
      return questions.map(question => ({
        questionId: question.question_id, completed: completed.has(question.question_id)
      }));
    },

    async updateProgress(userId, questionId, data) {
      const id = Number(questionId);
      if (!/^[1-9]\d*$/.test(questionId) || !Number.isSafeInteger(id)) {
        throw Object.assign(new Error("Invalid question ID."), { status: 400 });
      }
      if (!data || typeof data !== "object" || Array.isArray(data) ||
          typeof data.completed !== "boolean") {
        throw Object.assign(new Error("Completed must be true or false."), { status: 400 });
      }
      const questions = await repo.getQuestions();
      if (!questions.some(question => question.question_id === id)) {
        throw Object.assign(new Error("Question not found."), { status: 404 });
      }
      await repo.setCompleted(userId, id, data.completed ? 1 : 0);
      return { questionId: id, completed: data.completed };
    }
  };
}

module.exports = { createProgressService };
