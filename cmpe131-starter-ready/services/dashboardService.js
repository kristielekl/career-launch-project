const { promisify } = require("node:util");
const { createTimelineRepository } = require("../repositories/timelineRepository");
const { createQuestionRepository } = require("../repositories/questionRepository");

function createDashboardService(db) {
  const tasks = createTimelineRepository(db);
  const questions = createQuestionRepository(db);
  return async userId => {
    const [timeline, catalog, progress] = await Promise.all([
      promisify(tasks.getTasks)(userId), promisify(questions.getQuestions)(),
      promisify(questions.getProgress)(userId)
    ]);
    return {
      tasks: {
        total: timeline.length,
        planned: timeline.filter(task => task.status === "Planned").length,
        inProgress: timeline.filter(task => task.status === "In Progress").length,
        completed: timeline.filter(task => task.status === "Completed").length
      },
      upcoming: timeline.filter(task => task.status !== "Completed").slice(0, 5)
        .map(task => ({ title: task.title, dueDate: task.due_date, status: task.status })),
      coding: {
        total: catalog.length,
        completed: progress.filter(item => item.completed === 1).length
      }
    };
  };
}

module.exports = { createDashboardService };
