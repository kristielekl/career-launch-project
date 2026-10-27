const express = require("express");
const { promisify } = require("node:util");
const { createTimelineRepository } = require("../repositories/timelineRepository");
const { validateTask, canChangeStatus } = require("../services/timelineService");

// Keep the existing camelCase API while the repository uses SFDS column names.
function toApi(task) {
  return {
    id: task.task_id, userId: task.user_id, title: task.title,
    category: task.category, description: task.description,
    dueDate: task.due_date, estimatedHours: task.estimated_hours,
    status: task.status
  };
}

function toStorage(task) {
  return {
    ...task, title: task.title.trim(), category: task.category.trim(),
    due_date: task.dueDate, estimated_hours: task.estimatedHours
  };
}

function createTimelineRoutes(db) {
  const router = express.Router();
  const userId = 1; // Simulated active user; never accept ownership from the client.
  const repo = Object.fromEntries(Object.entries(createTimelineRepository(db))
    .map(([name, fn]) => [name, promisify(fn)]));
  const handle = fn => (req, res, next) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

  router.get("/", handle(async (req, res) => {
    res.json((await repo.getTasks(userId)).map(toApi));
  }));

  router.post("/", handle(async (req, res) => {
    const data = req.body || {};
    const errors = validateTask(data);
    if (data.status != null && data.status !== "Planned") {
      errors.push("New tasks must start in Planned status.");
    }
    if (errors.length) return res.status(400).json({ errors });
    const id = await repo.createTask(userId, toStorage(data));
    res.status(201).json(toApi(await repo.getTaskById(userId, id)));
  }));

  // Load only owned tasks for all existing single-task endpoints.
  router.param("id", (req, res, next, value) => {
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid task ID." });
    }
    repo.getTaskById(userId, id).then(task => {
      if (!task) return res.status(404).json({ error: "Task not found." });
      req.task = task;
      next();
    }).catch(next);
  });

  router.get("/:id", (req, res) => res.json(toApi(req.task)));

  router.put("/:id", handle(async (req, res) => {
    const data = { ...req.body, status: req.body?.status ?? req.task.status };
    const errors = validateTask(data);
    if (!canChangeStatus(req.task.status, data.status)) {
      errors.push("Invalid status transition.");
    }
    if (errors.length) return res.status(400).json({ errors });
    await repo.updateTask(userId, req.task.task_id, toStorage(data));
    res.json(toApi(await repo.getTaskById(userId, req.task.task_id)));
  }));

  router.delete("/:id", handle(async (req, res) => {
    await repo.deleteTask(userId, req.task.task_id);
    res.json({ ok: true });
  }));

  router.use((err, req, res, next) => {
    res.status(500).json({ error: "Unable to access tasks. Please try again." });
  });
  return router;
}

module.exports = { createTimelineRoutes };
