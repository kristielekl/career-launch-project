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
    title: task.title.trim(), category: task.category.trim(),
    description: task.description ?? null, due_date: task.dueDate,
    estimated_hours: task.estimatedHours ?? null,
    status: task.status === undefined ? "Planned" : task.status
  };
}

function createTimelineRoutes(db) {
  const router = express.Router();
  router.use(express.json());
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
    const data = req.body;
    const errors = validateTask(data);
    if (data?.status !== undefined && data.status !== "Planned") {
      errors.push("New tasks must start in Planned status.");
    }
    if (errors.length) return res.status(400).json({ errors });
    const task = toStorage(data);
    const id = await repo.createTask(userId, task);
    res.status(201).json(toApi({ ...task, task_id: id, user_id: userId }));
  }));

  // Load only owned tasks for all existing single-task endpoints.
  router.param("id", (req, res, next, value) => {
    const id = Number(value);
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(id)) {
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
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ errors: ["Task data must be a JSON object."] });
    }
    const data = { ...req.body,
      status: req.body.status === undefined ? req.task.status : req.body.status };
    const errors = validateTask(data);
    if (!canChangeStatus(req.task.status, data.status)) {
      errors.push("Invalid status transition.");
    }
    if (errors.length) return res.status(400).json({ errors });
    const task = toStorage(data);
    task.completed_at = task.status === "Completed"
      ? req.task.completed_at ?? new Date().toISOString() : null;
    const changes = await repo.updateTask(userId, req.task.task_id, task);
    if (!changes) return res.status(404).json({ error: "Task not found." });
    res.json(toApi({ ...task, task_id: req.task.task_id, user_id: userId }));
  }));

  router.delete("/:id", handle(async (req, res) => {
    const changes = await repo.deleteTask(userId, req.task.task_id);
    if (!changes) return res.status(404).json({ error: "Task not found." });
    res.json({ ok: true });
  }));

  router.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Request body must be valid JSON." });
    }
    if (err.type === "entity.too.large") {
      return res.status(413).json({ error: "Request body is too large." });
    }
    if (err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({ error: "Invalid task request." });
    }
    res.status(500).json({ error: "Unable to access tasks. Please try again." });
  });
  return router;
}

module.exports = { createTimelineRoutes };
